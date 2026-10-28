import { Recipe } from '../types/recipe';

// Automatische Gerichtfotos aus der deutschen Wikipedia (frei lizenziert, kein API-Key nötig).
// Ergebnisse - auch "nichts gefunden" - werden je Rezept in IndexedDB gemerkt, damit jedes
// Gericht nur einmal nachgeschlagen wird. Eigene Fotos des Nutzers haben immer Vorrang.

export interface DishWebImage {
  recipeId: string;
  /** found = Foto vorhanden, none = nichts Passendes gefunden, hidden = vom Nutzer ausgeblendet. */
  status: 'found' | 'none' | 'hidden';
  checkedAt: string;
  thumbUrl?: string;
  fullUrl?: string;
  /** Wikimedia-Dateiseite (Urheber/Lizenz). */
  pageUrl?: string;
  artist?: string;
  license?: string;
  /** Wikipedia-Artikel, aus dem das Foto stammt. */
  articleTitle?: string;
}

const WIKI_API = 'https://de.wikipedia.org/w/api.php';
const THUMB_WIDTH = 160;
const FULL_WIDTH = 1280;
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
 * Nur Artikel übernehmen, deren Titel wirklich zum Hauptgericht passt (Beilagen-Zusatz
 * "mit ..." zählt nicht): ein Wort des Gerichts steckt in einem Titelwort
 * (z.B. "Salat" in "Bauernsalat"), oder ein langes Titelwort steckt im Gericht
 * (z.B. "Geschnetzeltes" in "Hähnchengeschnetzeltes").
 */
export function isRelevantTitle(dishName: string, title: string): boolean {
  const terms = searchTerms(dishName);
  const mainDish = normalize(terms[terms.length - 1]);
  const dishWords = mainDish.split(' ').filter((w) => w.length >= 4);
  const titleWords = normalize(title.replace(/\(.*?\)/g, '')).split(' ').filter((w) => w.length >= 4);
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

async function wikiQuery(params: Record<string, string>): Promise<Record<string, unknown>> {
  const url = `${WIKI_API}?${new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', origin: '*', ...params })}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Wikipedia ${response.status}`);
  return (await response.json()) as Record<string, unknown>;
}

interface SearchPage {
  title: string;
  index: number;
  pageimage?: string;
}

interface ImageInfo {
  thumburl?: string;
  url?: string;
  descriptionurl?: string;
  extmetadata?: Record<string, { value?: string }>;
}

/** Sucht ein passendes Foto für ein Gericht. `null` = nichts Passendes gefunden. */
export async function findDishImage(name: string): Promise<Omit<DishWebImage, 'recipeId' | 'checkedAt' | 'status'> | null> {
  for (const term of searchTerms(name)) {
    const search = await wikiQuery({
      generator: 'search',
      gsrsearch: term,
      gsrlimit: '5',
      gsrnamespace: '0',
      prop: 'pageimages',
      piprop: 'name',
    });
    const pages = (((search.query as { pages?: SearchPage[] } | undefined)?.pages ?? []) as SearchPage[])
      .slice()
      .sort((a, b) => a.index - b.index);
    // Karten, Logos, Wappen o.ä. sind fast immer SVG - nur echte Fotos übernehmen.
    const hit = pages.find((p) => p.pageimage && !/\.svg$/i.test(p.pageimage) && isRelevantTitle(name, p.title));
    if (!hit?.pageimage) continue;

    const info = await wikiQuery({
      titles: `File:${hit.pageimage}`,
      prop: 'imageinfo',
      iiprop: 'url|extmetadata',
      iiurlwidth: String(FULL_WIDTH),
      iiextmetadatafilter: 'Artist|LicenseShortName',
    });
    const page = ((info.query as { pages?: { imageinfo?: ImageInfo[] }[] } | undefined)?.pages ?? [])[0];
    const image = page?.imageinfo?.[0];
    const fullUrl = image?.thumburl ?? image?.url;
    if (!fullUrl) continue;

    return {
      // Wikimedia-Thumbnails lassen sich über die Breite im Dateinamen beliebig verkleinern.
      thumbUrl: fullUrl.replace(/\/\d+px-([^/]+)$/, `/${THUMB_WIDTH}px-$1`),
      fullUrl,
      pageUrl: image?.descriptionurl,
      artist: stripHtml(image?.extmetadata?.Artist?.value),
      license: stripHtml(image?.extmetadata?.LicenseShortName?.value),
      articleTitle: hit.title,
    };
  }
  return null;
}

/** Muss für dieses Rezept (erneut) nachgeschlagen werden? */
export function needsLookup(entry: DishWebImage | undefined, now = new Date()): boolean {
  if (!entry) return true;
  if (entry.status !== 'none') return false;
  return now.getTime() - new Date(entry.checkedAt).getTime() > RETRY_NONE_DAYS * 24 * 60 * 60 * 1000;
}

export async function lookupDishImage(recipe: Recipe, now = new Date()): Promise<DishWebImage> {
  const found = await findDishImage(recipe.name);
  return found
    ? { recipeId: recipe.id, status: 'found', checkedAt: now.toISOString(), ...found }
    : { recipeId: recipe.id, status: 'none', checkedAt: now.toISOString() };
}
