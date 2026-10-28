import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  collectCandidates,
  currentSuggestion,
  DishWebImage,
  isRelevantTitle,
  lookupDishImage,
  needsLookup,
  nextSuggestion,
  searchTerms,
} from './dishImages';
import { Recipe } from '../types/recipe';

describe('searchTerms', () => {
  it('tries the full name first, then without the side dish', () => {
    expect(searchTerms('Hähnchengeschnetzeltes mit Reis')).toEqual(['Hähnchengeschnetzeltes mit Reis', 'Hähnchengeschnetzeltes']);
    expect(searchTerms('Kaiserschmarrn')).toEqual(['Kaiserschmarrn']);
  });
});

describe('isRelevantTitle', () => {
  it('accepts articles and file names that match the main dish', () => {
    expect(isRelevantTitle('Hähnchengeschnetzeltes mit Reis', 'Geschnetzeltes')).toBe(true);
    expect(isRelevantTitle('Griechischer Salat', 'Bauernsalat (Griechenland)')).toBe(true);
    expect(isRelevantTitle('Kaiserschmarrn mit Apfelmus', 'File:Kaiserschmarrn mit Puderzucker.jpg')).toBe(true);
  });

  it('rejects side dishes, short partial words and unrelated titles', () => {
    expect(isRelevantTitle('Hähnchengeschnetzeltes mit Reis', 'Reis')).toBe(false);
    expect(isRelevantTitle('Putenkeulen aus dem Ofen', 'Pute')).toBe(false);
    expect(isRelevantTitle('Milchreis mit Zimt', 'Karl Zimmermann')).toBe(false);
  });
});

describe('needsLookup', () => {
  const now = new Date('2026-10-29T12:00:00Z');
  const entry = (status: DishWebImage['status'], checkedAt = '2020-01-01T00:00:00Z'): DishWebImage => ({ recipeId: 'a', status, checkedAt });

  it('never searches again for approved, rejected or pending photos', () => {
    expect(needsLookup(entry('approved'), now)).toBe(false);
    expect(needsLookup(entry('hidden'), now)).toBe(false);
    expect(needsLookup(entry('suggested'), now)).toBe(false);
  });

  it('searches unknown recipes, old unchecked results and "none" after 30 days', () => {
    expect(needsLookup(undefined, now)).toBe(true);
    expect(needsLookup(entry('found'), now)).toBe(true);
    expect(needsLookup(entry('none', '2026-10-20T00:00:00Z'), now)).toBe(false);
    expect(needsLookup(entry('none', '2026-09-01T00:00:00Z'), now)).toBe(true);
  });
});

describe('suggestions', () => {
  const candidates = [1, 2].map((n) => ({ thumbUrl: `t${n}`, fullUrl: `f${n}` }));
  const entry: DishWebImage = { recipeId: 'a', status: 'suggested', checkedAt: '', candidates, current: 0 };

  it('walks through the candidates and ends with "no photo"', () => {
    expect(currentSuggestion(entry)?.fullUrl).toBe('f1');
    const second = nextSuggestion(entry);
    expect(currentSuggestion(second)?.fullUrl).toBe('f2');
    const done = nextSuggestion(second);
    expect(done.status).toBe('hidden');
    expect(currentSuggestion(done)).toBeUndefined();
  });
});

describe('collectCandidates / lookupDishImage', () => {
  afterEach(() => vi.unstubAllGlobals());

  const info = (file: string, mime = 'image/jpeg') => ({
    title: `File:${file}`,
    imageinfo: [
      {
        mime,
        thumburl: `https://upload.wikimedia.org/x/${file}/1280px-${file}`,
        descriptionurl: `https://commons.wikimedia.org/wiki/File:${file}`,
        extmetadata: { Artist: { value: '<a href="x">Max Muster</a>' }, LicenseShortName: { value: 'CC BY-SA 4.0' } },
      },
    ],
  });

  function mockWikimedia() {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const u = new URL(url);
        const params = u.searchParams;
        if (u.hostname === 'commons.wikimedia.org') {
          return Response.json({ query: { pages: [{ ...info('Kaiserschmarrn Teller.jpg'), index: 1 }, { ...info('Logo.svg', 'image/svg+xml'), index: 2 }] } });
        }
        if (params.get('generator') === 'search') {
          return Response.json({
            query: {
              pages: [
                { title: 'Kaiserschmarrn', index: 1, pageimage: 'Kaiserschmarrn.jpg' },
                { title: 'Österreichische Küche', index: 2, pageimage: 'Wien.jpg' },
              ],
            },
          });
        }
        // imageinfo für die Artikelbilder
        return Response.json({ query: { pages: params.get('titles')!.split('|').map((t) => info(t.replace('File:', ''))) } });
      }),
    );
  }

  it('collects article and Commons photos, drops SVGs, puts matching titles first, 320px thumbs', async () => {
    mockWikimedia();
    const found = await collectCandidates('Kaiserschmarrn');
    expect(found.map((f) => f.title)).toEqual(['Kaiserschmarrn', 'File:Kaiserschmarrn Teller.jpg', 'Österreichische Küche']);
    expect(found[0].candidate).toMatchObject({
      thumbUrl: 'https://upload.wikimedia.org/x/Kaiserschmarrn.jpg/320px-Kaiserschmarrn.jpg',
      artist: 'Max Muster',
      license: 'CC BY-SA 4.0',
    });
  });

  const recipe = { id: 'r1', name: 'Kaiserschmarrn' } as Recipe;

  it('uses the Gemini ranking (and its order) when available', async () => {
    mockWikimedia();
    const rank = vi.fn(async () => [1]);
    const result = await lookupDishImage(recipe, rank);
    expect(result).toMatchObject({ status: 'suggested', verified: true, current: 0 });
    expect(result.candidates?.map((c) => c.fullUrl)).toEqual(['https://upload.wikimedia.org/x/Kaiserschmarrn Teller.jpg/1280px-Kaiserschmarrn Teller.jpg']);
  });

  it('suggests nothing when Gemini finds no matching photo', async () => {
    mockWikimedia();
    expect((await lookupDishImage(recipe, async () => [])).status).toBe('none');
  });

  it('without Gemini only keeps photos with a matching title (unverified)', async () => {
    mockWikimedia();
    const result = await lookupDishImage(recipe);
    expect(result.verified).toBe(false);
    expect(result.candidates).toHaveLength(2);
  });
});
