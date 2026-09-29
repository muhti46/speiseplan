import { describe, expect, it } from 'vitest';
import { allBeilageNames, findBeilageRecipe, userBeilagen } from './beilagen';
import { Recipe } from '../types/recipe';

const own = (name: string): Recipe => ({
  id: `m-${name}`,
  name,
  course: 'hauptspeise',
  subCategory: 'beilage',
  source: 'manual',
  prepTimeMinutes: 5,
  cookTimeMinutes: 10,
  totalTimeMinutes: 15,
  instructions: ['Kochen.'],
  ingredients: [{ item: 'Couscous', amountPer10Pax: 800, unit: 'g', storeCategory: 'trocken' }],
});

describe('user-defined Beilagen', () => {
  it('appear in the sorted name list next to the built-in ones, without duplicates', () => {
    const names = allBeilageNames([own('Couscous'), own('Reis')]);
    expect(names).toContain('Couscous');
    expect(names.filter((n) => n === 'Reis')).toHaveLength(1);
    expect([...names].sort((a, b) => a.localeCompare(b, 'de'))).toEqual(names);
  });

  it('are found by name (case-insensitive) and take precedence over built-in recipes', () => {
    const custom = own('Reis');
    expect(findBeilageRecipe('reis', [custom])).toBe(custom);
    expect(findBeilageRecipe('Reis', [])?.id).toBe('bg-reis');
    expect(findBeilageRecipe('Nichtvorhanden', [])).toBeUndefined();
  });

  it('are separated from normal recipes and built-in names', () => {
    const pool = [own('Couscous'), own('Reis'), { ...own('Linsen'), subCategory: undefined }];
    expect(userBeilagen(pool).map((r) => r.name)).toEqual(['Couscous']);
  });
});
