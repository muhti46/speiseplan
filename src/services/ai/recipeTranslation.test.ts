import { beforeEach, describe, expect, it, vi } from 'vitest';

const { generateContent } = vi.hoisted(() => ({ generateContent: vi.fn() }));

vi.mock('./client', () => ({
  GEMINI_MODEL: 'test-model',
  createGeminiClient: () => ({ models: { generateContent } }),
}));

import { translateInstructions } from './recipeTranslation';
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

describe('translateInstructions', () => {
  beforeEach(() => generateContent.mockReset());

  it('returns the translated steps keyed by recipe and language', async () => {
    generateContent.mockResolvedValue({ text: JSON.stringify({ steps: ['Mercimekleri pişirin.', ' Servis yapın. '] }) });
    const result = await translateInstructions('key', recipe, 'tr');
    expect(result.key).toBe('hs-test|tr');
    expect(result.steps).toEqual(['Mercimekleri pişirin.', 'Servis yapın.']);
    expect(generateContent.mock.calls[0][0].contents[0].parts[0].text).toContain('Türkisch');
  });

  it('rejects a translation with a different number of steps', async () => {
    generateContent.mockResolvedValue({ text: JSON.stringify({ steps: ['Nur einer.'] }) });
    await expect(translateInstructions('key', recipe, 'tr')).rejects.toThrow();
  });
});
