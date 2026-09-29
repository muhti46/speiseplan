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

function buildPrompt(name: string, course: Course): string {
  return `Erstelle ein Rezept für das Gericht "${name}" (Gang: ${COURSE_LABEL[course]}) für die Großküche eines Kinderheims: 10 Portionen, Kinder und Jugendliche von 5 bis 17 Jahren, alles zusammen in höchstens ca. 60 Minuten machbar.

Regeln:
- Mengen in "amountPer10Pax" gelten für 10 Portionen. Einheit ausschließlich "g", "ml" oder "Stück" (z.B. Eier, Zwiebeln in Stück; Flüssigkeiten in ml; alles andere in g).
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
export async function generateRecipeDraft(apiKey: string, name: string, course: Course): Promise<Recipe> {
  const client = createGeminiClient(apiKey);
  const response = await client.models.generateContent({
    model: GEMINI_MODEL,
    contents: [{ role: 'user', parts: [{ text: buildPrompt(name.trim(), course) }] }],
    config: { responseMimeType: 'application/json', responseSchema },
  });

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(response.text ?? '');
  } catch {
    throw new Error('Antwort der KI war kein gültiges JSON.');
  }

  // Gang bestimmt die erlaubten Felder, egal was das Modell zusätzlich liefert.
  const normalized = {
    ...raw,
    name: name.trim(),
    course,
    subCategory: course === 'vorspeise' ? raw.subCategory : course === 'nachspeise' ? 'dessert' : undefined,
    proteinCategory: course === 'hauptspeise' ? raw.proteinCategory : undefined,
    beilage: course === 'hauptspeise' ? raw.beilage : undefined,
  };
  const result = coerceRecipe(normalized, 'manual');
  if (isCoercionError(result)) throw new Error(result.error);
  return result;
}
