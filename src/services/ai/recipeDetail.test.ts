import { beforeEach, describe, expect, it, vi } from 'vitest';

const { generateContent } = vi.hoisted(() => ({ generateContent: vi.fn() }));

vi.mock('./client', () => ({
  GEMINI_MODEL: 'test-model',
  createGeminiClient: () => ({ models: { generateContent } }),
}));

import { generateRecipeDetail, recipeDetailKey } from './recipeDetail';
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
  ingredients: [
    { item: 'Rote Linsen', amountPer10Pax: 1000, unit: 'g', storeCategory: 'trocken' },
    { item: 'Brühe', amountPer10Pax: 2000, unit: 'ml', storeCategory: 'trocken' },
  ],
};

function reply(json: unknown) {
  generateContent.mockResolvedValue({ text: typeof json === 'string' ? json : JSON.stringify(json) });
}

describe('generateRecipeDetail', () => {
  beforeEach(() => generateContent.mockReset());

  it('returns cleaned steps and tips keyed by recipe and language', async () => {
    reply({
      steps: [
        { title: ' Vorbereiten ', text: ' Linsen waschen. ', minutes: 10.4 },
        { title: 'Leer', text: '   ' },
        { title: 'Kochen', text: 'Ca. 25 Minuten köcheln.', minutes: 0 },
        { title: 'Ohne Zeit', text: 'Abschmecken.', minutes: 'viel' },
      ],
      tips: ['  Am Vortag vorbereiten. ', '', 42],
    });
    const detail = await generateRecipeDetail('key', recipe, 'de');
    expect(detail.key).toBe(recipeDetailKey('hs-test', 'de'));
    expect(detail.recipeId).toBe('hs-test');
    expect(detail.steps).toEqual([
      { title: 'Vorbereiten', text: 'Linsen waschen.', minutes: 10 },
      { title: 'Kochen', text: 'Ca. 25 Minuten köcheln.' },
      { title: 'Ohne Zeit', text: 'Abschmecken.' },
    ]);
    expect(detail.tips).toEqual(['Am Vortag vorbereiten.']);
  });

  it('puts portion-scaled amounts, the language and JSON mode into the request', async () => {
    reply({ steps: [{ title: 'A', text: 'B' }], tips: [] });
    await generateRecipeDetail('key', recipe, 'tr');
    const call = generateContent.mock.calls[0][0];
    const prompt: string = call.contents[0].parts[0].text;
    expect(prompt).toContain('Rote Linsen: 1.1 kg'); // 1000 g je 10 Personen → 11 Portionen
    expect(prompt).toContain('Brühe: 2.2 l');
    expect(prompt).toContain('Türkisch');
    expect(call.config.responseMimeType).toBe('application/json');
  });

  it('rejects answers without usable steps or without JSON', async () => {
    reply({ steps: [{ title: 'x', text: '' }], tips: [] });
    await expect(generateRecipeDetail('key', recipe, 'de')).rejects.toThrow(/Schritte/);
    reply('kein json');
    await expect(generateRecipeDetail('key', recipe, 'de')).rejects.toThrow(/JSON/);
  });
});
