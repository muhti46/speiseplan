import { describe, expect, it } from 'vitest';
import recipesData from './recipes.json';
import { Recipe } from '../types/recipe';

const recipes = recipesData as Recipe[];
const count = (pred: (r: Recipe) => boolean) => recipes.filter(pred).length;

describe('built-in recipe pool', () => {
  it('has unique ids and names', () => {
    expect(new Set(recipes.map((r) => r.id)).size).toBe(recipes.length);
    expect(new Set(recipes.map((r) => r.name)).size).toBe(recipes.length);
  });

  it('offers a broad selection per category', () => {
    expect(count((r) => r.subCategory === 'salat')).toBeGreaterThanOrEqual(15);
    expect(count((r) => r.subCategory === 'suppe')).toBeGreaterThanOrEqual(15);
    for (const p of ['rind', 'gefluegel', 'fisch'] as const) {
      expect(count((r) => r.proteinCategory === p)).toBeGreaterThanOrEqual(24);
    }
    expect(count((r) => r.course === 'nachspeise')).toBeGreaterThanOrEqual(26);
  });

  it('has consistent times and a protein category on every Hauptspeise', () => {
    for (const r of recipes) {
      expect(r.totalTimeMinutes, r.id).toBe(r.prepTimeMinutes + r.cookTimeMinutes);
      expect(r.instructions.length, r.id).toBeGreaterThan(0);
      expect(r.ingredients.length, r.id).toBeGreaterThan(0);
      if (r.course === 'hauptspeise') expect(r.proteinCategory, r.id).toBeDefined();
    }
  });
});
