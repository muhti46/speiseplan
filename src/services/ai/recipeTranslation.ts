import { Schema, Type } from '@google/genai';
import { Recipe, RecipeTranslation } from '../../types/recipe';
import { Lang } from '../../i18n/translations';
import { createGeminiClient, GEMINI_MODEL } from './client';
import { recipeDetailKey } from './recipeDetail';

const LANGUAGE_NAME: Record<Lang, string> = { de: 'Deutsch', tr: 'Türkisch' };

const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: { steps: { type: Type.ARRAY, items: { type: Type.STRING } } },
  required: ['steps'],
};

/**
 * Übersetzt die Zubereitungsschritte eines Rezepts in die App-Sprache. Die Anzahl der Schritte
 * bleibt gleich. Speichert nicht selbst; wirft bei API-/Formatfehlern einen Error.
 */
export async function translateInstructions(apiKey: string, recipe: Recipe, lang: Lang): Promise<RecipeTranslation> {
  const client = createGeminiClient(apiKey);
  const numbered = recipe.instructions.map((s, i) => `${i + 1}. ${s}`).join('\n');
  const prompt = `Übersetze die folgenden Zubereitungsschritte des Gerichts "${recipe.name}" (Großküche, Kinderheim) ins ${LANGUAGE_NAME[lang]}. Behalte Reihenfolge, Mengen, Zeiten und Temperaturen exakt bei, verwende gängige Küchenbegriffe und gib GENAU ${recipe.instructions.length} Schritte zurück, ohne Nummerierung.

${numbered}`;

  const response = await client.models.generateContent({
    model: GEMINI_MODEL,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: { responseMimeType: 'application/json', responseSchema },
  });

  let raw: { steps?: unknown };
  try {
    raw = JSON.parse(response.text ?? '');
  } catch {
    throw new Error('Antwort der KI war kein gültiges JSON.');
  }
  const steps = (Array.isArray(raw.steps) ? raw.steps : [])
    .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    .map((s) => s.trim());
  if (steps.length !== recipe.instructions.length) {
    throw new Error('Die Übersetzung hat eine andere Schrittzahl als das Original.');
  }
  return {
    key: recipeDetailKey(recipe.id, lang),
    recipeId: recipe.id,
    lang,
    steps,
    createdAt: new Date().toISOString(),
  };
}
