import { beforeEach, describe, expect, it, vi } from 'vitest';

const { generateContent } = vi.hoisted(() => ({ generateContent: vi.fn() }));

vi.mock('./client', () => ({
  GEMINI_MODEL: 'test-model',
  createGeminiClient: () => ({ models: { generateContent } }),
}));

import { generateRecipeDraft } from './recipeDraft';

const base = {
  prepTimeMinutes: 15,
  cookTimeMinutes: 30,
  instructions: ['Kochen.', 'Servieren.'],
  ingredients: [{ item: 'Linsen', amountPer10Pax: 800, unit: 'g', storeCategory: 'trocken' }],
};

function reply(json: unknown) {
  generateContent.mockResolvedValue({ text: typeof json === 'string' ? json : JSON.stringify(json) });
}

describe('generateRecipeDraft', () => {
  beforeEach(() => generateContent.mockReset());

  it('returns a validated hauptspeise draft with protein category and beilage', async () => {
    reply({ ...base, proteinCategory: 'vegetarisch', beilage: 'Reis', subCategory: 'suppe' });
    const draft = await generateRecipeDraft('key', '  Linsen-Curry ', 'hauptspeise');
    expect(draft.name).toBe('Linsen-Curry');
    expect(draft.proteinCategory).toBe('vegetarisch');
    expect(draft.beilage).toBe('Reis');
    expect(draft.subCategory).toBeUndefined();
    expect(draft.totalTimeMinutes).toBe(45);
  });

  it('forces dessert for nachspeise and ignores protein/beilage', async () => {
    reply({ ...base, proteinCategory: 'rind', beilage: 'Reis' });
    const draft = await generateRecipeDraft('key', 'Pudding', 'nachspeise');
    expect(draft.subCategory).toBe('dessert');
    expect(draft.proteinCategory).toBeUndefined();
    expect(draft.beilage).toBeUndefined();
  });

  it('rejects a hauptspeise without a valid protein category', async () => {
    reply(base);
    await expect(generateRecipeDraft('key', 'Eintopf', 'hauptspeise')).rejects.toThrow(/proteinCategory/);
  });

  it('rejects a non-JSON answer', async () => {
    reply('Entschuldigung, das kann ich nicht.');
    await expect(generateRecipeDraft('key', 'Suppe', 'vorspeise')).rejects.toThrow(/JSON/);
  });

  it('asks for JSON output using the given name and course', async () => {
    reply({ ...base, subCategory: 'salat' });
    await generateRecipeDraft('key', 'Gurkensalat', 'vorspeise');
    const call = generateContent.mock.calls[0][0];
    expect(call.config.responseMimeType).toBe('application/json');
    expect(call.contents[0].parts[0].text).toContain('"Gurkensalat"');
  });
});
