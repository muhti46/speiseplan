import { afterEach, describe, expect, it, vi } from 'vitest';
import { findDishImage, isRelevantTitle, needsLookup, searchTerms } from './dishImages';

describe('searchTerms', () => {
  it('tries the full name first, then without the side dish', () => {
    expect(searchTerms('Hähnchengeschnetzeltes mit Reis')).toEqual(['Hähnchengeschnetzeltes mit Reis', 'Hähnchengeschnetzeltes']);
    expect(searchTerms('Kaiserschmarrn')).toEqual(['Kaiserschmarrn']);
  });
});

describe('isRelevantTitle', () => {
  it('accepts articles that match a word of the dish', () => {
    expect(isRelevantTitle('Hähnchengeschnetzeltes mit Reis', 'Geschnetzeltes')).toBe(true);
    expect(isRelevantTitle('Kartoffelsuppe mit Würstchen', 'Kartoffelsuppe')).toBe(true);
    expect(isRelevantTitle('Griechischer Salat', 'Bauernsalat (Griechenland)')).toBe(true);
    expect(isRelevantTitle('Rindsragout mit Ofengemüse', 'Ragout')).toBe(true);
  });

  it('rejects unrelated articles', () => {
    expect(isRelevantTitle('Fisch-Burger mit Kartoffelspalten', 'Hamburg')).toBe(false);
    expect(isRelevantTitle('Milchreis mit Zimt', 'Karl Zimmermann')).toBe(false);
    // Beilage oder kurzes Teilwort reichen nicht (sonst Reisfeld- oder Tierfotos).
    expect(isRelevantTitle('Hähnchengeschnetzeltes mit Reis', 'Reis')).toBe(false);
    expect(isRelevantTitle('Putenkeulen aus dem Ofen', 'Pute')).toBe(false);
    expect(isRelevantTitle('Kartoffelsuppe mit Würstchen', 'Würstchen')).toBe(false);
  });
});

describe('needsLookup', () => {
  const now = new Date('2026-10-29T12:00:00Z');
  it('looks up unknown recipes and retries "none" after 30 days, never found/hidden ones', () => {
    expect(needsLookup(undefined, now)).toBe(true);
    expect(needsLookup({ recipeId: 'a', status: 'found', checkedAt: '2020-01-01T00:00:00Z' }, now)).toBe(false);
    expect(needsLookup({ recipeId: 'a', status: 'hidden', checkedAt: '2020-01-01T00:00:00Z' }, now)).toBe(false);
    expect(needsLookup({ recipeId: 'a', status: 'none', checkedAt: '2026-10-20T00:00:00Z' }, now)).toBe(false);
    expect(needsLookup({ recipeId: 'a', status: 'none', checkedAt: '2026-09-01T00:00:00Z' }, now)).toBe(true);
  });
});

describe('findDishImage', () => {
  afterEach(() => vi.unstubAllGlobals());

  function mockWikipedia(searchResults: Record<string, { title: string; index: number; pageimage?: string }[]>) {
    const fetchMock = vi.fn(async (url: string) => {
      const params = new URL(url).searchParams;
      if (params.get('generator') === 'search') {
        return Response.json({ query: { pages: searchResults[params.get('gsrsearch')!] ?? [] } });
      }
      const file = params.get('titles')!.replace('File:', '');
      return Response.json({
        query: {
          pages: [
            {
              imageinfo: [
                {
                  thumburl: `https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/${file}/1280px-${file}`,
                  descriptionurl: `https://commons.wikimedia.org/wiki/File:${file}`,
                  extmetadata: { Artist: { value: '<a href="x">Max Muster</a>' }, LicenseShortName: { value: 'CC BY-SA 4.0' } },
                },
              ],
            },
          ],
        },
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it('skips SVGs and unrelated hits, falls back to the short name, and returns a small thumbnail', async () => {
    mockWikipedia({
      'Hähnchengeschnetzeltes mit Reis': [
        { title: 'Reis', index: 2, pageimage: 'Reisfeld.jpg' },
        { title: 'Geschnetzeltes', index: 1, pageimage: 'Karte.svg' },
      ],
      Hähnchengeschnetzeltes: [{ title: 'Geschnetzeltes', index: 1, pageimage: 'Geschnetzeltes.jpg' }],
    });
    const image = await findDishImage('Hähnchengeschnetzeltes mit Reis');
    // Voller Name: SVG verworfen, "Reis" (nur Beilage) verworfen -> Kurzname liefert das Gericht.
    expect(image?.articleTitle).toBe('Geschnetzeltes');
  });

  it('returns license info and a 160px thumbnail', async () => {
    mockWikipedia({ Kaiserschmarrn: [{ title: 'Kaiserschmarrn', index: 1, pageimage: 'Kaiserschmarrn.jpg' }] });
    const image = await findDishImage('Kaiserschmarrn');
    expect(image).toMatchObject({
      articleTitle: 'Kaiserschmarrn',
      artist: 'Max Muster',
      license: 'CC BY-SA 4.0',
      thumbUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Kaiserschmarrn.jpg/160px-Kaiserschmarrn.jpg',
    });
  });

  it('returns null when nothing relevant has a photo', async () => {
    mockWikipedia({ Bananenquark: [{ title: 'Bananenrepublik', index: 1 }] });
    expect(await findDishImage('Bananenquark')).toBeNull();
  });
});
