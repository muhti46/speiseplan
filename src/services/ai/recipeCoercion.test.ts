import { describe, expect, it } from 'vitest';
import { coerceRecipe, isCoercionError } from './recipeCoercion';

const validHauptspeise = {
  name: 'Linsen-Curry',
  course: 'hauptspeise',
  proteinCategory: 'vegetarisch',
  beilage: 'Reis',
  prepTimeMinutes: 15,
  cookTimeMinutes: 25,
  instructions: ['Linsen kochen.', 'Curry-Gewürze anrösten.', 'Alles vermengen.'],
  ingredients: [{ item: 'Rote Linsen', amountPer10Pax: 800, unit: 'g', storeCategory: 'trocken' }],
};

describe('coerceRecipe', () => {
  it('accepts a valid hauptspeise and computes totalTimeMinutes', () => {
    const result = coerceRecipe(validHauptspeise);
    expect(isCoercionError(result)).toBe(false);
    if (!isCoercionError(result)) {
      expect(result.totalTimeMinutes).toBe(40);
      expect(result.proteinCategory).toBe('vegetarisch');
      expect(result.source).toBe('ai');
      expect(result.id).toMatch(/^ai-linsen-curry-/);
    }
  });

  it('rejects a hauptspeise missing proteinCategory instead of defaulting', () => {
    const { proteinCategory, ...withoutProtein } = validHauptspeise;
    void proteinCategory;
    const result = coerceRecipe(withoutProtein);
    expect(isCoercionError(result)).toBe(true);
  });

  it('rejects an invalid storeCategory on an ingredient', () => {
    const result = coerceRecipe({
      ...validHauptspeise,
      ingredients: [{ item: 'Rote Linsen', amountPer10Pax: 800, unit: 'g', storeCategory: 'unbekannt' }],
    });
    expect(isCoercionError(result)).toBe(true);
  });

  it('rejects a course outside the 3 allowed literals', () => {
    const result = coerceRecipe({ ...validHauptspeise, course: 'zwischengericht' });
    expect(isCoercionError(result)).toBe(true);
  });

  it('rejects missing instructions', () => {
    const result = coerceRecipe({ ...validHauptspeise, instructions: [] });
    expect(isCoercionError(result)).toBe(true);
  });
});
