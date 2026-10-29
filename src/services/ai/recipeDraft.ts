import { Schema, Type } from '@google/genai';
import { Course, Recipe } from '../../types/recipe';
import { createGeminiClient, GEMINI_MODEL } from './client';
import { coerceRecipe, isCoercionError } from './recipeCoercion';

const COURSE_LABEL: Record<Course, string> = {
  vorspeise: 'Vorspeise (Suppe oder Salat)',
  hauptspeise: 'Hauptspeise',
  nachspeise: 'Nachspeise (Dessert)',
};

const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    subCategory: { type: Type.STRING, enum: ['suppe', 'salat', 'dessert'] },
    proteinCategory: { type: Type.STRING, enum: ['gefluegel', 'rind', 'fisch', 'suess', 'vegetarisch'] },
    beilage: { type: Type.STRING },
    prepTimeMinutes: { type: Type.NUMBER },
    cookTimeMinutes: { type: Type.NUMBER },
    instructions: { type: Type.ARRAY, items: { type: Type.STRING } },
    ingredients: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          item: { type: Type.STRING },
          amountPer10Pax: { type: Type.NUMBER },
          unit: { type: Type.STRING, enum: ['g', 'ml', 'Stück'] },
          storeCategory: { type: Type.STRING, enum: ['gemuese', 'kuehlung', 'mopro', 'trocken', 'tk'] },
        },
        required: ['item', 'amountPer10Pax', 'unit', 'storeCategory'],
      },
    },
  },
  required: ['prepTimeMinutes', 'cookTimeMinutes', 'instructions', 'ingredients'],
};

// Beilagen brauchen weder Protein-Kategorie noch Beilage/Unterkategorie.
const { proteinCategory: _p, beilage: _b, subCategory: _s, ...beilageProperties } = responseSchema.properties ?? {};
const beilageSchema: Schema = { ...responseSchema, properties: beilageProperties };

function buildBeilagePrompt(name: string): string {
  return `Erstelle ein Rezept für die Beilage "${name}" für die Großküche eines Kinderheims: als Beilage zu Hauptgerichten, 10 Portionen, Kinder und Jugendliche von 5 bis 17 Jahren, einfach und in höchstens ca. 45 Minuten machbar.

Regeln:
- Mengen in "amountPer10Pax" gelten für 10 Portionen. Einheit ausschließlich "g", "ml" oder "Stück" (z.B. Eier in Stück; Flüssigkeiten in ml; alles andere in g).
- Zutatennamen und Zubereitungsschritte auf Deutsch. 3 bis 6 kurze, konkrete Schritte.
- storeCategory je Zutat: gemuese = Obst und Gemüse, kuehlung = Fleisch/Fisch/Wurst, mopro = Milchprodukte/Eier/Käse, trocken = Trockensortiment/Konserven/Gewürze/Öl/Mehl/Reis/Nudeln, tk = Tiefkühlware.
- Keine proteinCategory, keine subCategory und keine "beilage" angeben.
- Ist der Name nicht deutsch (z.B. türkisch), erkenne die Beilage trotzdem und erstelle das passende Rezept.`;
}

function buildPrompt(name: string, course: Course): string {
  return `Erstelle ein Rezept für das Gericht "${name}" (Gang: ${COURSE_LABEL[course]}) für die Großküche eines Kinderheims: 10 Portionen, Kinder und Jugendliche von 5 bis 17 Jahren, alles zusammen in höchstens ca. 60 Minuten machbar.

Regeln:
- Mengen in "amountPer10Pax" gelten für 10 Portionen. Einheit ausschließlich "g", "ml" oder "Stück" (Eier, Zitronen u.ä. in Stück; Flüssigkeiten in ml; alles andere in g - auch Gemüse wie Zwiebeln, Karotten, Paprika).
- Zutatennamen und Zubereitungsschritte auf Deutsch. 4 bis 8 kurze, konkrete Schritte. Wasser, Salz und Pfeffer nur, wenn wirklich nötig.
- storeCategory je Zutat: gemuese = Obst und Gemüse, kuehlung = Fleisch/Fisch/Wurst, mopro = Milchprodukte/Eier/Käse, trocken = Trockensortiment/Konserven/Gewürze/Öl/Mehl/Reis/Nudeln, tk = Tiefkühlware.
- Hauptspeise: proteinCategory angeben (gefluegel, rind, fisch, suess oder vegetarisch; niemals Schweinefleisch) und eine typische Beilage als "beilage" (oder "—", wenn keine nötig ist, z.B. bei süßen Hauptspeisen).
- Vorspeise: subCategory ist "suppe" oder "salat". Nachspeise: subCategory ist "dessert".
- Ist der Name nicht deutsch (z.B. türkisch), erkenne das Gericht trotzdem und erstelle das passende Rezept.`;
}

/**
 * Lässt Gemini zu einem Gerichtnamen ein vollständiges Rezept vorschlagen
 * (Zutaten, Schritte, Zeiten, Kategorie). Ergebnis ist ein Entwurf zum Prüfen,
 * wird hier NICHT gespeichert. Wirft bei API-/Formatfehlern einen Error.
 */
export async function generateRecipeDraft(
  apiKey: string,
  name: string,
  course: Course,
  kind: 'gericht' | 'beilage' = 'gericht',
): Promise<Recipe> {
  const isBeilage = kind === 'beilage';
  const client = createGeminiClient(apiKey);
  const response = await client.models.generateContent({
    model: GEMINI_MODEL,
    contents: [{ role: 'user', parts: [{ text: isBeilage ? buildBeilagePrompt(name.trim()) : buildPrompt(name.trim(), course) }] }],
    config: { responseMimeType: 'application/json', responseSchema: isBeilage ? beilageSchema : responseSchema },
  });

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(response.text ?? '');
  } catch {
    throw new Error('Antwort der KI war kein gültiges JSON.');
  }

  const result = coerceRecipe(isBeilage ? normalizeBeilage(raw, name) : normalizeDraft(raw, name, course), 'manual');
  if (isCoercionError(result)) throw new Error(result.error);
  return result;
}

function normalizeBeilage(raw: Record<string, unknown>, name: string): Record<string, unknown> {
  return { ...raw, name: name.trim(), course: 'hauptspeise', subCategory: 'beilage', proteinCategory: undefined, beilage: undefined };
}

// Gang bestimmt die erlaubten Felder, egal was das Modell zusätzlich liefert.
function normalizeDraft(raw: Record<string, unknown>, name: string, course: Course): Record<string, unknown> {
  return {
    ...raw,
    name: name.trim(),
    course,
    subCategory: course === 'vorspeise' ? raw.subCategory : course === 'nachspeise' ? 'dessert' : undefined,
    proteinCategory: course === 'hauptspeise' ? raw.proteinCategory : undefined,
    beilage: course === 'hauptspeise' ? raw.beilage : undefined,
  };
}

export interface DraftRequest {
  name: string;
  course: Course;
}

// Mehrere Gerichte pro Anfrage, damit ein ganzer Wochenplan nicht 15 Einzelaufrufe
// (und damit schnell das Minuten-Limit des kostenlosen Gemini-Kontingents) braucht.
const BATCH_SIZE = 5;

const batchSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    recipes: {
      type: Type.ARRAY,
      items: {
        ...responseSchema,
        properties: { index: { type: Type.NUMBER }, ...responseSchema.properties },
        required: ['index', ...(responseSchema.required ?? [])],
      },
    },
  },
  required: ['recipes'],
};

function buildBatchPrompt(items: DraftRequest[]): string {
  const list = items.map((item, i) => `${i}. "${item.name.trim()}" (Gang: ${COURSE_LABEL[item.course]})`).join('\n');
  // Die Regeln des Einzel-Prompts gelten unverändert; nur die Gerichtliste ist neu.
  const rules = buildPrompt('X', 'hauptspeise').split('Regeln:')[1];
  return `Erstelle für jedes der folgenden Gerichte ein Rezept für die Großküche eines Kinderheims: 10 Portionen, Kinder und Jugendliche von 5 bis 17 Jahren, jeweils in höchstens ca. 60 Minuten machbar. Gib für jedes Gericht ein Objekt in "recipes" zurück, mit "index" = Nummer aus der Liste.

Gerichte:
${list}

Regeln:${rules}`;
}

/**
 * Wie generateRecipeDraft, aber für viele Gerichte auf einmal (gebündelt zu je 5 pro Anfrage).
 * Liefert je Eintrag das Rezept oder einen Fehlertext - ein misslungenes Gericht bricht nicht alles ab.
 */
export async function generateRecipeDrafts(
  apiKey: string,
  items: DraftRequest[],
): Promise<(Recipe | { error: string })[]> {
  const client = createGeminiClient(apiKey);
  const results: (Recipe | { error: string })[] = [];

  for (let start = 0; start < items.length; start += BATCH_SIZE) {
    const batch = items.slice(start, start + BATCH_SIZE);
    let byIndex = new Map<number, Record<string, unknown>>();
    try {
      const response = await client.models.generateContent({
        model: GEMINI_MODEL,
        contents: [{ role: 'user', parts: [{ text: buildBatchPrompt(batch) }] }],
        config: { responseMimeType: 'application/json', responseSchema: batchSchema },
      });
      const parsed = JSON.parse(response.text ?? '') as { recipes?: Record<string, unknown>[] };
      byIndex = new Map((parsed.recipes ?? []).map((r) => [Number(r.index), r]));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      batch.forEach(() => results.push({ error: message }));
      continue;
    }

    batch.forEach((item, i) => {
      const raw = byIndex.get(i);
      if (!raw) {
        results.push({ error: 'Kein Rezept von der KI erhalten.' });
        return;
      }
      const result = coerceRecipe(normalizeDraft(raw, item.name, item.course), 'ai');
      results.push(isCoercionError(result) ? { error: result.error } : result);
    });
  }
  return results;
}
