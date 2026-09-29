import { Schema, Type } from '@google/genai';
import { Recipe, RecipeDetail, RecipeDetailStep } from '../../types/recipe';
import { Lang } from '../../i18n/translations';
import { formatIngredientAmount } from '../format';
import { DEFAULT_PORTIONS } from '../shopping';
import { createGeminiClient, GEMINI_MODEL } from './client';

export function recipeDetailKey(recipeId: string, lang: string): string {
  return `${recipeId}|${lang}`;
}

const LANGUAGE_NAME: Record<Lang, string> = { de: 'Deutsch', tr: 'Türkisch' };

const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    steps: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          text: { type: Type.STRING },
          minutes: { type: Type.NUMBER },
        },
        required: ['title', 'text'],
      },
    },
    tips: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['steps', 'tips'],
};

function buildPrompt(recipe: Recipe, lang: Lang): string {
  const ingredients = recipe.ingredients
    .map((i) => `- ${i.item}: ${formatIngredientAmount(i.amountPer10Pax, i.unit, DEFAULT_PORTIONS)}`)
    .join('\n');
  const short = recipe.instructions.map((s, i) => `${i + 1}. ${s}`).join('\n');

  return `Schreibe eine AUSFÜHRLICHE Schritt-für-Schritt-Anleitung für das Gericht "${recipe.name}" für die Großküche eines Kinderheims (${DEFAULT_PORTIONS} Portionen, Kinder und Jugendliche von 5 bis 17 Jahren, alles muss um 18:00 Uhr servierfertig sein).

Zutaten (bereits für ${DEFAULT_PORTIONS} Portionen umgerechnet):
${ingredients}

Bisherige Kurzanleitung (nur als Grundlage, die ausführliche Version muss dazu passen):
${short}

Regeln:
- 8 bis 14 Schritte in sinnvoller Reihenfolge, jeder mit kurzem Titel ("title") und ausführlichem Text ("text") aus 2 bis 4 Sätzen.
- Nenne in den Schritten die konkreten Mengen aus der Zutatenliste, passende Topf-/Pfannen-/Blechgrößen für eine Großküche, Temperaturen (°C) und Zeiten, sowie woran man erkennt, dass etwas fertig ist (z.B. "bis die Zwiebeln glasig sind").
- "minutes" nur angeben, wenn ein Schritt eine klare Dauer hat (Garzeit, Ruhezeit), sonst weglassen.
- Erwähne Arbeiten, die parallel laufen können, damit alles gleichzeitig fertig wird.
- Erfinde keine zusätzlichen Zutaten außer Wasser, Salz, Pfeffer und etwas Öl/Fett zum Braten.
- Danach 3 bis 6 kurze praktische Tipps ("tips"): kindgerechtes Würzen, was am Vortag vorbereitet werden kann, Warmhalten, Resteverwertung.
- Schreibe alles auf ${LANGUAGE_NAME[lang]}.${lang === 'de' ? '' : ' Zutatennamen aus der Liste dürfen in Klammern auf Deutsch stehen bleiben.'}`;
}

/**
 * Lässt Gemini zu einem Rezept eine ausführliche Anleitung mit Mengen, Zeiten und Tipps schreiben.
 * Speichert nicht selbst; wirft bei API-/Formatfehlern einen Error.
 */
export async function generateRecipeDetail(apiKey: string, recipe: Recipe, lang: Lang): Promise<RecipeDetail> {
  const client = createGeminiClient(apiKey);
  const response = await client.models.generateContent({
    model: GEMINI_MODEL,
    contents: [{ role: 'user', parts: [{ text: buildPrompt(recipe, lang) }] }],
    config: { responseMimeType: 'application/json', responseSchema },
  });

  let raw: { steps?: unknown; tips?: unknown };
  try {
    raw = JSON.parse(response.text ?? '');
  } catch {
    throw new Error('Antwort der KI war kein gültiges JSON.');
  }

  const steps: RecipeDetailStep[] = [];
  for (const item of Array.isArray(raw.steps) ? raw.steps : []) {
    const s = item as Record<string, unknown>;
    const title = typeof s?.title === 'string' ? s.title.trim() : '';
    const text = typeof s?.text === 'string' ? s.text.trim() : '';
    if (!text) continue;
    const minutes = Number(s.minutes);
    steps.push({ title, text, ...(Number.isFinite(minutes) && minutes > 0 ? { minutes: Math.round(minutes) } : {}) });
  }
  if (steps.length === 0) throw new Error('Die KI hat keine Schritte geliefert.');

  const tips = (Array.isArray(raw.tips) ? raw.tips : [])
    .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
    .map((t) => t.trim());

  return {
    key: recipeDetailKey(recipe.id, lang),
    recipeId: recipe.id,
    lang,
    steps,
    tips,
    createdAt: new Date().toISOString(),
  };
}
