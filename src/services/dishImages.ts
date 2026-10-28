import { Recipe } from '../types/recipe';

// Automatische Gerichtfotos: Kandidaten aus der deutschen Wikipedia und Wikimedia Commons
// (frei lizenziert, kein API-Key nötig); Gemini schaut sich die Fotos an und sortiert die aus,
// die das Gericht nicht zeigen. Der beste Treffer ist nur ein VORSCHLAG - erst wenn der Nutzer
// ihn bestätigt, wird das Foto als eigenes Foto des Rezepts gespeichert und danach immer von dort
// genommen (keine erneute Suche). Alles wird je Rezept in IndexedDB gemerkt.

export interface PhotoCandidate {
  /** Kleines Vorschaubild (Liste und Gemini-Prüfung). */
  thumbUrl: string;
  /** Größeres Bild für Vollbild und zum Speichern. */
  fullUrl: string;
  /** Wikimedia-Dateiseite (Urheber/Lizenz). */
  pageUrl?: string;
  artist?: string;
  license?: string;
}

export interface DishWebImage {
  recipeId: string;
  /**
   * suggested = Vorschlag wartet auf Bestätigung, approved = bestätigt (Foto liegt als eigenes Foto
   * in recipeImages), none = nichts Passendes gefunden, hidden = vom Nutzer abgelehnt.
   * found = Altbestand aus der ersten Version (ungeprüft) - wird neu gesucht.
   */
  status: 'suggested' | 'approved' | 'none' | 'hidden' | 'found';
  checkedAt: string;
  /** Passende Kandidaten, bestes zuerst (von Gemini sortiert, sonst nach Titel-Heuristik). */
  candidates?: PhotoCandidate[];
  /** Index des aktuell vorgeschlagenen Kandidaten. */
  current?: number;
  /** Bestätigtes Foto (für die Quellenangabe). */
  approved?: PhotoCandidate;
  /** Nur mit Gemini geprüft = true; ohne API-Key ist die Reihenfolge nur geraten. */
  verified?: boolean;
}

const WIKI_API = 'https://de.wikipedia.org/w/api.php';
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const THUMB_WIDTH = 320;
const FULL_WIDTH = 1280;
const MAX_CANDIDATES = 8;
/** "Nichts gefunden" wird nach so vielen Tagen erneut versucht (Wikipedia wächst). */
const RETRY_NONE_DAYS = 30;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Suchbegriffe: zuerst der volle Name, dann ohne Beilagen-Zusatz ("... mit Reis"). */
export function searchTerms(name: string): string[] {
  const full = name.trim();
  const short = full.split(/\s+(?:mit|an|aus|auf|in|und|nach)\s+/i)[0].trim();
  return short && short !== full ? [full, short] : [full];
}

// Ein Titelwort, das nur *im* Gerichtnamen steckt (z.B. "Geschnetzeltes" in
// "Hähnchengeschnetzeltes"), muss lang genug sein - sonst passen "Reis" oder "Pute" (Feld/Tier-Fotos).
const MIN_CONTAINED_WORD = 6;

/**
 * Passt ein Titel (Artikel oder Dateiname) zum Hauptgericht? Beilagen-Zusatz "mit ..." zählt nicht.
 * Dient ohne Gemini als Filter, mit Gemini nur zum Vorsortieren.
 */
export function isRelevantTitle(dishName: string, title: string): boolean {
  const terms = searchTerms(dishName);
  const mainDish = normalize(terms[terms.length - 1]);
  const dishWords = mainDish.split(' ').filter((w) => w.length >= 4);
  const titleWords = normalize(title.replace(/\(.*?\)/g, '').replace(/^(file|datei):/i, '').replace(/\.\w+$/, ''))
    .split(' ')
    .filter((w) => w.length >= 4);
  return (
    dishWords.some((dw) => titleWords.some((tw) => tw.includes(dw))) ||
    titleWords.some((tw) => tw.length >= MIN_CONTAINED_WORD && mainDish.includes(tw))
  );
}

function stripHtml(html: string | undefined): string | undefined {
  if (!html) return undefined;
  const text = html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  return text || undefined;
}

async function wikiQuery(api: string, params: Record<string, string>): Promise<Record<string, unknown>> {
  const url = `${api}?${new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', origin: '*', ...params })}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Wikimedia ${response.status}`);
  return (await response.json()) as Record<string, unknown>;
}

interface ImageInfo {
  thumburl?: string;
  url?: string;
  descriptionurl?: string;
  mime?: string;
  extmetadata?: Record<string, { value?: string }>;
}

interface InfoPage {
  title: string;
  index?: number;
  pageimage?: string;
  imageinfo?: ImageInfo[];
}

const IMAGE_INFO_PARAMS = {
  prop: 'imageinfo',
  iiprop: 'url|mime|extmetadata',
  iiurlwidth: String(FULL_WIDTH),
  iiextmetadatafilter: 'Artist|LicenseShortName',
};

function pagesOf(result: Record<string, unknown>): InfoPage[] {
  return ((result.query as { pages?: InfoPage[] } | undefined)?.pages ?? []).slice().sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
}

function toCandidate(info: ImageInfo | undefined): PhotoCandidate | null {
  // Nur Fotos: SVG (Karten, Logos, Wappen), GIF, PDF usw. fallen raus.
  if (!info || (info.mime && !/^image\/(jpeg|png|webp)$/.test(info.mime))) return null;
  const fullUrl = info.thumburl ?? info.url;
  if (!fullUrl) return null;
  return {
    // Wikimedia-Thumbnails lassen sich über die Breite im Dateinamen beliebig verkleinern.
    thumbUrl: fullUrl.replace(/\/\d+px-([^/]+)$/, `/${THUMB_WIDTH}px-$1`),
    fullUrl,
    pageUrl: info.descriptionurl,
    artist: stripHtml(info.extmetadata?.Artist?.value),
    license: stripHtml(info.extmetadata?.LicenseShortName?.value),
  };
}

/**
 * Sammelt Fotokandidaten für ein Gericht: Titelbilder passender Wikipedia-Artikel und
 * Dateisuche in Wikimedia Commons. Reihenfolge: zum Hauptgericht passende Titel zuerst.
 */
export async function collectCandidates(name: string): Promise<{ candidate: PhotoCandidate; title: string }[]> {
  const terms = searchTerms(name);
  const mainDish = terms[terms.length - 1];
  const found: { candidate: PhotoCandidate; title: string; relevant: boolean }[] = [];
  const seen = new Set<string>();

  function add(title: string, info: ImageInfo | undefined) {
    const candidate = toCandidate(info);
    if (!candidate || seen.has(candidate.fullUrl)) return;
    seen.add(candidate.fullUrl);
    found.push({ candidate, title, relevant: isRelevantTitle(name, title) });
  }

  // 1. Titelbilder der passenden Wikipedia-Artikel (je Suchbegriff).
  const articleImages = new Map<string, string>();
  for (const term of terms) {
    const search = await wikiQuery(WIKI_API, {
      generator: 'search',
      gsrsearch: term,
      gsrlimit: '4',
      gsrnamespace: '0',
      prop: 'pageimages',
      piprop: 'name',
    });
    for (const page of pagesOf(search)) {
      if (page.pageimage && !articleImages.has(page.pageimage)) articleImages.set(page.pageimage, page.title);
    }
  }
  if (articleImages.size > 0) {
    const info = await wikiQuery(WIKI_API, {
      titles: [...articleImages.keys()].map((file) => `File:${file}`).join('|'),
      ...IMAGE_INFO_PARAMS,
    });
    const byFile = new Map(pagesOf(info).map((p) => [normalize(p.title.replace(/^(file|datei):/i, '')), p.imageinfo?.[0]]));
    for (const [file, articleTitle] of articleImages) add(articleTitle, byFile.get(normalize(file)));
  }

  // 2. Fotos direkt aus Wikimedia Commons (Dateinamen beschreiben oft genau das Gericht).
  const commons = await wikiQuery(COMMONS_API, {
    generator: 'search',
    gsrsearch: `${mainDish} filetype:bitmap`,
    gsrlimit: '6',
    gsrnamespace: '6',
    ...IMAGE_INFO_PARAMS,
  });
  for (const page of pagesOf(commons)) add(page.title, page.imageinfo?.[0]);

  // Passende Titel zuerst; die Reihenfolge der Suche bleibt sonst erhalten.
  return [...found.filter((f) => f.relevant), ...found.filter((f) => !f.relevant)]
    .slice(0, MAX_CANDIDATES)
    .map(({ candidate, title }) => ({ candidate, title }));
}

/** Muss für dieses Rezept (erneut) gesucht werden? */
export function needsLookup(entry: DishWebImage | undefined, now = new Date()): boolean {
  if (!entry || entry.status === 'found') return true;
  if (entry.status !== 'none') return false;
  return now.getTime() - new Date(entry.checkedAt).getTime() > RETRY_NONE_DAYS * 24 * 60 * 60 * 1000;
}

/** Wählt aus Kandidaten die passenden aus und sortiert sie; liefert Indizes, bestes zuerst. */
export type RankPhotos = (dishName: string, candidates: { candidate: PhotoCandidate; title: string }[]) => Promise<number[]>;

/**
 * Sucht Fotos für ein Rezept. Mit `rank` (Gemini) bleiben nur Fotos, die das Gericht wirklich
 * zeigen; ohne nur die mit passendem Titel. Ergebnis ist höchstens ein Vorschlag.
 */
export async function lookupDishImage(recipe: Recipe, rank?: RankPhotos, now = new Date()): Promise<DishWebImage> {
  const found = await collectCandidates(recipe.name);
  let candidates: PhotoCandidate[];
  if (rank && found.length > 0) {
    const order = await rank(recipe.name, found);
    candidates = order.filter((i) => i >= 0 && i < found.length).map((i) => found[i].candidate);
  } else {
    candidates = found.filter((f) => isRelevantTitle(recipe.name, f.title)).map((f) => f.candidate);
  }
  const base = { recipeId: recipe.id, checkedAt: now.toISOString(), verified: Boolean(rank) };
  return candidates.length > 0
    ? { ...base, status: 'suggested', candidates, current: 0 }
    : { ...base, status: 'none' };
}

/** Aktuell vorgeschlagenes Foto (nur bei Status "suggested"). */
export function currentSuggestion(entry: DishWebImage | undefined): PhotoCandidate | undefined {
  if (entry?.status !== 'suggested' || !entry.candidates) return undefined;
  return entry.candidates[entry.current ?? 0];
}

/** Nächsten Kandidaten vorschlagen; gibt es keinen mehr, gilt das Rezept als "kein Foto". */
export function nextSuggestion(entry: DishWebImage): DishWebImage {
  const next = (entry.current ?? 0) + 1;
  return entry.candidates && next < entry.candidates.length
    ? { ...entry, current: next }
    : { ...entry, status: 'hidden', current: undefined };
}

/** Lädt das Foto herunter und verkleinert es, damit es dauerhaft offline im Rezept liegt. */
export async function downloadPhoto(url: string, maxSize = 900, quality = 0.82): Promise<string> {
  const response = await fetch(url, { mode: 'cors' });
  if (!response.ok) throw new Error(`Foto ${response.status}`);
  const bitmap = await createImageBitmap(await response.blob());
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas nicht verfügbar');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', quality);
}
