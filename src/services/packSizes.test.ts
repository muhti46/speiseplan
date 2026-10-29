import { describe, expect, it } from 'vitest';
import { purchaseAmount } from './packSizes';
import { ShoppingItem } from '../types/menu';

const item = (name: string, amount: number, unit: string, storeCategory: ShoppingItem['storeCategory'] = 'gemuese'): ShoppingItem => ({
  item: name, amount, unit, storeCategory, recipeNames: [], checked: false,
});

describe('purchaseAmount', () => {
  it('rounds loose produce to bags: 500 g, then full kilos', () => {
    expect(purchaseAmount(item('Karotten', 880, 'g'))).toBe('1 kg');
    expect(purchaseAmount(item('Äpfel', 990, 'g'))).toBe('1 kg');
    expect(purchaseAmount(item('Äpfel', 1430, 'g'))).toBe('2 kg');
    expect(purchaseAmount(item('Zwiebeln', 330, 'g'))).toBe('500 g');
  });

  it('uses fixed packs, pieces and bunches', () => {
    expect(purchaseAmount(item('Rote Bete (gekocht)', 1210, 'g'))).toBe('3 × 500 g');
    expect(purchaseAmount(item('Rote Bete', 400, 'g'))).toBe('500 g');
    expect(purchaseAmount(item('Kopfsalat', 450, 'g'))).toBe('2 Stück');
    expect(purchaseAmount(item('Eisbergsalat', 440, 'g'))).toBe('1 Stück');
    expect(purchaseAmount(item('Salatgurken', 990, 'g'))).toBe('3 Stück');
    expect(purchaseAmount(item('Petersilie', 44, 'g'))).toBe('2 Bund');
    expect(purchaseAmount(item('Sahne', 440, 'ml', 'mopro'))).toBe('3 × 200 ml');
    expect(purchaseAmount(item('Eier', 13, 'Stück', 'mopro'))).toBe('20 Stück (2 × 10er)');
    expect(purchaseAmount(item('Eier', 4, 'Stück', 'mopro'))).toBe('10 Stück (10er-Packung)');
    expect(purchaseAmount(item('Wraps', 22, 'Stück', 'trocken'))).toBe('24 Stück (4 × 6er)');
    expect(purchaseAmount(item('Brötchen', 170, 'g', 'trocken'))).toBe('3 Stück');
    expect(purchaseAmount(item('Spaghetti', 1100, 'g', 'trocken'))).toBe('3 × 500 g');
    expect(purchaseAmount(item('Reis', 880, 'g', 'trocken'))).toBe('1 kg');
    expect(purchaseAmount(item('Orangensaft', 1500, 'ml', 'trocken'))).toBe('2 × 1 l');
    expect(purchaseAmount(item('Puddingpulver Vanille', 110, 'g', 'trocken'))).toBe('3 Päckchen');
  });

  it('rounds meat and fish to 500 g steps as a total', () => {
    expect(purchaseAmount(item('Hähnchenbrust', 1320, 'g', 'kuehlung'))).toBe('1,5 kg');
    expect(purchaseAmount(item('Rinderhack', 880, 'g', 'kuehlung'))).toBe('1 kg');
    expect(purchaseAmount(item('Kabeljaufilet', 1980, 'g', 'tk'))).toBe('2 kg');
    expect(purchaseAmount(item('Pommes (TK)', 2200, 'g', 'tk'))).toBe('2,5 kg');
  });

  it('falls back to a sensible pack per aisle for unknown goods', () => {
    expect(purchaseAmount(item('Pastinaken', 700, 'g'))).toBe('1 kg');
    expect(purchaseAmount(item('Irgendwas', 120, 'g', 'trocken'))).toBe('500 g');
    expect(purchaseAmount(item('Zitrone', 3, 'Stück'))).toBe('3 Stück');
  });
});
