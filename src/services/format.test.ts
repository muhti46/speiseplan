import { describe, expect, it } from 'vitest';
import { formatAmount, formatIngredientAmount } from './format';

describe('formatAmount', () => {
  it('rounds pieces up to whole pieces', () => {
    expect(formatAmount(4.4, 'Stück')).toBe('5 Stück');
    expect(formatAmount(2.2, 'Stück')).toBe('3 Stück');
    expect(formatAmount(4, 'Stück')).toBe('4 Stück');
    expect(formatAmount(4.0000001, 'Stk.')).toBe('4 Stück');
  });
  it('converts g/ml to kg/l with comma and rounds small amounts', () => {
    expect(formatAmount(1650, 'g')).toBe('1,65 kg');
    expect(formatAmount(2000, 'g')).toBe('2 kg');
    expect(formatAmount(333.33, 'g')).toBe('333 g');
    expect(formatAmount(1500, 'ml')).toBe('1,5 l');
  });
  it('scales recipe ingredients', () => {
    expect(formatIngredientAmount(4, 'Stück', 11)).toBe('5 Stück');
  });
});
