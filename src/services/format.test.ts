import { describe, expect, it } from 'vitest';
import { formatAmount, formatIngredientAmount } from './format';

describe('formatAmount', () => {
  it('rounds pieces up to whole pieces', () => {
    expect(formatAmount(4.4, 'Stück')).toBe('5 Stück');
    expect(formatAmount(2.2, 'Stück')).toBe('3 Stück');
    expect(formatAmount(4, 'Stück')).toBe('4 Stück');
    expect(formatAmount(4.0000001, 'Stk.')).toBe('4 Stück');
  });
  it('rounds g/ml to shopping-friendly amounts and converts to kg/l', () => {
    expect(formatAmount(1980, 'g')).toBe('2 kg');
    expect(formatAmount(1210, 'g')).toBe('1,2 kg');
    expect(formatAmount(1320, 'g')).toBe('1,3 kg');
    expect(formatAmount(999, 'g')).toBe('1 kg');
    expect(formatAmount(333.33, 'g')).toBe('330 g');
    expect(formatAmount(37, 'g')).toBe('35 g');
    expect(formatAmount(1, 'g')).toBe('5 g');
    expect(formatAmount(1500, 'ml')).toBe('1,5 l');
  });
  it('scales recipe ingredients', () => {
    expect(formatIngredientAmount(4, 'Stück', 11)).toBe('5 Stück');
  });
});
