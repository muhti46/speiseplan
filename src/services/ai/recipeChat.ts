import { Content } from '@google/genai';
import { ChatMessage } from '../../types/ai';
import { Recipe, RecipeDetail } from '../../types/recipe';
import { Lang } from '../../i18n/translations';
import { formatIngredientAmount } from '../format';
import { DEFAULT_PORTIONS } from '../shopping';
import { createGeminiClient, GEMINI_MODEL } from './client';

const LANGUAGE_NAME: Record<Lang, string> = { de: 'Deutsch', tr: 'Türkçe' };

export function buildRecipeChatPrompt(recipe: Recipe, detail: RecipeDetail | undefined, lang: Lang): string {
  const ingredients = recipe.ingredients
    .map((i) => `- ${i.item}: ${formatIngredientAmount(i.amountPer10Pax, i.unit, DEFAULT_PORTIONS)}`)
    .join('\n');
  const steps = recipe.instructions.map((s, i) => `${i + 1}. ${s}`).join('\n');
  const detailBlock = detail
    ? `\nAusführliche Anleitung:\n${detail.steps.map((s, i) => `${i + 1}. ${s.title}: ${s.text}`).join('\n')}\nTipps:\n${detail.tips.map((t) => `- ${t}`).join('\n')}\n`
    : '';

  return `Du bist ein Koch-Assistent in der Großküche eines Kinderheims (${DEFAULT_PORTIONS} Portionen, Kinder und Jugendliche von 5 bis 17 Jahren). Der Nutzer stellt Fragen zu genau diesem Rezept. Beantworte sie konkret und praktisch (Mengen, Zeiten, Austausch von Zutaten, Vorbereiten, Warmhalten, Allergene, Fehler vermeiden).

Rezept: ${recipe.name}
Zubereitungszeit: ${recipe.prepTimeMinutes} min Vorbereitung, ${recipe.cookTimeMinutes} min Kochen
Zutaten (für ${DEFAULT_PORTIONS} Portionen):
${ingredients}
Zubereitungsschritte:
${steps}
${detailBlock}
Regeln:
- Antworte IMMER in der Sprache, in der der Nutzer zuletzt geschrieben hat (z.B. Türkisch, wenn seine Nachricht auf Türkisch ist). Nur wenn du die Sprache nicht erkennen kannst, nutze ${LANGUAGE_NAME[lang]}. Antworte kurz.
- Antworte in reinem Fließtext ohne Markdown: keine Sternchen, keine Rauten-Überschriften, keine Backticks. Aufzählungen als Zeilen mit Bindestrich.
- Wenn du etwas nicht sicher weißt, sag das ehrlich, statt Werte zu erfinden.`;
}

/** Beantwortet eine Frage zu einem einzelnen Rezept (ohne Tools; Verlauf = frühere Fragen/Antworten). */
export async function askAboutRecipe(
  apiKey: string,
  recipe: Recipe,
  detail: RecipeDetail | undefined,
  history: ChatMessage[],
  question: string,
  lang: Lang,
): Promise<string> {
  const client = createGeminiClient(apiKey);
  const contents: Content[] = [
    ...history
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.text }] })),
    { role: 'user', parts: [{ text: question }] },
  ];
  const response = await client.models.generateContent({
    model: GEMINI_MODEL,
    contents,
    config: { systemInstruction: buildRecipeChatPrompt(recipe, detail, lang) },
  });
  const text = response.text?.trim();
  if (!text) throw new Error('Leere Antwort der KI.');
  return text;
}
