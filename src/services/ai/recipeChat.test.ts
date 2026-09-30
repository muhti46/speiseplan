import { beforeEach, describe, expect, it, vi } from 'vitest';

const { generateContent } = vi.hoisted(() => ({ generateContent: vi.fn() }));

vi.mock('./client', () => ({
  GEMINI_MODEL: 'test-model',
  createGeminiClient: () => ({ models: { generateContent } }),
}));

import { askAboutRecipe, buildRecipeChatPrompt } from './recipeChat';
import { Recipe } from '../../types/recipe';

const recipe: Recipe = {
  id: 'hs-test',
  name: 'Linsen-Eintopf',
  course: 'hauptspeise',
  proteinCategory: 'vegetarisch',
  prepTimeMinutes: 15,
  cookTimeMinutes: 30,
  totalTimeMinutes: 45,
  instructions: ['Linsen kochen.', 'Servieren.'],
  ingredients: [{ item: 'Rote Linsen', amountPer10Pax: 1000, unit: 'g', storeCategory: 'trocken' }],
};

describe('recipe chat', () => {
  beforeEach(() => generateContent.mockReset());

  it('puts the recipe (scaled amounts, steps) into the system prompt', () => {
    const prompt = buildRecipeChatPrompt(recipe, undefined, 'de');
    expect(prompt).toContain('Linsen-Eintopf');
    expect(prompt).toContain('Rote Linsen: 1,1 kg');
    expect(prompt).toContain('1. Linsen kochen.');
  });

  it('sends history plus the new question and returns the answer text', async () => {
    generateContent.mockResolvedValue({ text: ' Ja, am Vortag. ' });
    const answer = await askAboutRecipe(
      'key',
      recipe,
      undefined,
      [
        { role: 'user', text: 'Frage 1' },
        { role: 'assistant', text: 'Antwort 1' },
      ],
      'Frage 2',
      'de',
    );
    expect(answer).toBe('Ja, am Vortag.');
    const call = generateContent.mock.calls[0][0];
    expect(call.contents.map((c: { role: string }) => c.role)).toEqual(['user', 'model', 'user']);
    expect(call.contents[2].parts[0].text).toBe('Frage 2');
  });

  it('throws on an empty answer', async () => {
    generateContent.mockResolvedValue({ text: '' });
    await expect(askAboutRecipe('key', recipe, undefined, [], 'Hallo', 'de')).rejects.toThrow();
  });
});
