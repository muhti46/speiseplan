import { afterEach, describe, expect, it, vi } from 'vitest';

const { generateContent } = vi.hoisted(() => ({ generateContent: vi.fn() }));
vi.mock('./client', () => ({
  GEMINI_MODEL: 'test-model',
  createGeminiClient: () => ({ models: { generateContent } }),
}));

import { createPhotoRanker } from './photoPick';

const found = ['a', 'b', 'c'].map((n) => ({ title: n === 'c' ? 'Kaiserschmarrn' : `Bild ${n}`, candidate: { thumbUrl: `https://x/${n}.jpg`, fullUrl: `https://x/${n}-big.jpg` } }));

afterEach(() => {
  vi.unstubAllGlobals();
  generateContent.mockReset();
});

describe('createPhotoRanker', () => {
  it('sends the loadable photos to Gemini and maps its numbers back to the candidates', async () => {
    // Foto "b" lässt sich nicht laden -> Gemini sieht nur a (=0) und c (=1).
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (url.includes('/b.') ? new Response('', { status: 404 }) : new Response(new Blob(['img'], { type: 'image/jpeg' })))));
    generateContent.mockResolvedValue({ text: JSON.stringify({ matches: [1, 1, 7, 0] }) });

    const order = await createPhotoRanker('key')('Kaiserschmarrn', found);

    expect(order).toEqual([2, 0]); // doppelte und ungültige Nummern ignoriert
    const parts = generateContent.mock.calls[0][0].contents[0].parts;
    expect(parts.filter((p: { inlineData?: unknown }) => p.inlineData)).toHaveLength(2);
    expect(parts[0].text).toContain('Kaiserschmarrn');
  });

  it('falls back to title matching when no photo can be loaded', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    expect(await createPhotoRanker('key')('Kaiserschmarrn', found)).toEqual([2]);
    expect(generateContent).not.toHaveBeenCalled();
  });
});
