import { describe, expect, it } from 'vitest';
import { preserveChecked } from './shopping';
import { ShoppingItem } from '../types/menu';

const item = (name: string, unit: string, checked: boolean): ShoppingItem => ({
  item: name,
  amount: 1,
  unit,
  storeCategory: 'trocken',
  recipeNames: [],
  checked,
});

describe('preserveChecked', () => {
  it('keeps checked state for items that still exist and leaves new items unchecked', () => {
    const old = [item('Reis', 'g', true), item('Mehl', 'g', false)];
    const next = [item('Reis', 'g', false), item('Mehl', 'g', false), item('Linsen', 'g', false)];
    expect(preserveChecked(old, next).map((i) => i.checked)).toEqual([true, false, false]);
  });

  it('does not match the same name with a different unit', () => {
    const old = [item('Milch', 'ml', true)];
    const next = [item('Milch', 'l', false)];
    expect(preserveChecked(old, next)[0].checked).toBe(false);
  });
});
