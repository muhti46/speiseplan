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

  it('does not match the same name with a unit that cannot be combined', () => {
    const old = [item('Zitronen', 'g', true)];
    const next = [item('Zitronen', 'Stück', false)];
    expect(preserveChecked(old, next)[0].checked).toBe(false);
  });

  it('matches spelling variants and convertible units (l = ml)', () => {
    const old = [item('Zwiebel', 'Stk', true), item('Milch', 'l', true)];
    const next = [item('Zwiebeln', 'Stück', false), item('Milch', 'ml', false)];
    expect(preserveChecked(old, next).map((i) => i.checked)).toEqual([true, true]);
  });
});

import { buildShoppingLists, canonicalItemKey, isPantryStaple, refreshShoppingLists } from './shopping';
import { generateWeeklyPlan } from './generator';
import { Recipe } from '../types/recipe';
import { DayMenu, WeeklyPlan } from '../types/menu';
import recipesData from '../data/recipes.json';

describe('isPantryStaple', () => {
  it('removes salt, sugar, flour, spices and vinegar', () => {
    for (const name of ['Salz', 'Meersalz', 'Salz und Pfeffer', 'Pfeffer (grün)', 'Zucker', 'Puderzucker', 'Vanillezucker', 'brauner Zucker', 'Mehl', 'Mehl Type 405', 'Weizenmehl', 'Essig', 'Apfelessig', 'Balsamico', 'Zimt', 'Paprikapulver edelsüß', 'Currypulver', 'Gyrosgewürz', 'Garam Masala', 'Muskatnuss', 'Kreuzkümmel gemahlen']) {
      expect(isPantryStaple(name, 'trocken'), name).toBe(true);
    }
    expect(isPantryStaple('Oregano (getrocknet)', 'trocken')).toBe(true);
  });

  it('also removes oils, broths, honey, ginger and lemon juice', () => {
    for (const name of ['Rapsöl', 'Olivenöl', 'Sonnenblumenöl', 'Öl', 'Speiseöl', 'Gemüsebrühe', 'Rinderbrühe', 'Hühnerbrühe', 'Geflügelbrühe', 'Kalbsfond', 'Brühwürfel', 'Honig', 'Zitronensaft']) {
      expect(isPantryStaple(name, 'trocken'), name).toBe(true);
    }
    expect(isPantryStaple('Ingwer', 'gemuese')).toBe(true);
    for (const name of ['Butter', 'Milch', 'H-Milch', 'Vollmilch', 'Milch (3,5 %)']) {
      expect(isPantryStaple(name, 'mopro'), name).toBe(true);
    }
    for (const name of ['Buttermilch', 'Kokosmilch', 'Milchreis', 'Erdnussbutter', 'Butterkekse', 'Milchbrötchen']) {
      expect(isPantryStaple(name, 'mopro'), name).toBe(false);
    }
    for (const name of ['Zitrone', 'Ölsardinen', 'Karfiol', 'Kokosmilch', 'Honigmelone']) {
      expect(isPantryStaple(name, 'gemuese'), name).toBe(false);
    }
  });

  it('keeps real groceries that only contain such a word', () => {
    for (const name of ['Zuckerschoten', 'Zuckermais', 'Salzkartoffeln', 'Gewürzgurken', 'Essig-Gurken', 'Paniermehl', 'Puddingpulver Vanille', 'Backpulver', 'Senf', 'Zimtschnecken']) {
      expect(isPantryStaple(name, 'trocken'), name).toBe(false);
    }
    // Frische Kräuter werden gekauft, getrocknete sind Vorrat.
    expect(isPantryStaple('Petersilie', 'gemuese')).toBe(false);
  });
});

describe('canonicalItemKey', () => {
  it('treats spellings, singular/plural and preparation notes as the same item', () => {
    expect(canonicalItemKey('Zwiebel')).toBe(canonicalItemKey('Zwiebeln'));
    expect(canonicalItemKey('Ei')).toBe(canonicalItemKey('Eier'));
    expect(canonicalItemKey('Tomate')).toBe(canonicalItemKey('Tomaten'));
    expect(canonicalItemKey('Möhren')).toBe(canonicalItemKey('Karotten'));
    expect(canonicalItemKey('Rinderhackfleisch')).toBe(canonicalItemKey('Rinderhack'));
    expect(canonicalItemKey('Vanillepuddingpulver')).toBe(canonicalItemKey('Puddingpulver Vanille'));
    expect(canonicalItemKey('Gouda (gerieben)')).toBe(canonicalItemKey('Geriebener Gouda'));
    expect(canonicalItemKey('Kartoffeln (gekocht)')).toBe(canonicalItemKey('Kartoffeln'));
  });

  it('keeps different goods apart', () => {
    expect(canonicalItemKey('Reis')).not.toBe(canonicalItemKey('Basmatireis'));
    expect(canonicalItemKey('Erbsen (TK)')).not.toBe(canonicalItemKey('Erbsen'));
    expect(canonicalItemKey('Rindfleisch (Gulasch)')).not.toBe(canonicalItemKey('Rindfleisch (Streifen)'));
  });
});

describe('buildShoppingLists', () => {
  const recipe = (id: string, ingredients: Recipe['ingredients']): Recipe => ({
    id, name: id, course: 'hauptspeise', prepTimeMinutes: 1, cookTimeMinutes: 1, totalTimeMinutes: 2, instructions: ['x'], ingredients,
  });
  const day = (dayOfWeek: DayMenu['dayOfWeek'], r: Recipe): DayMenu => ({
    dayOfWeek, vorspeise: r, hauptspeise: recipe(`${dayOfWeek}-h`, []), nachspeise: recipe(`${dayOfWeek}-n`, []), beilage: '—', targetServeTime: '18:00', prepStartTime: '17:00',
  });

  it('merges duplicates into one line and drops pantry items', () => {
    const plan = {
      id: 'p', calendarWeek: 1, year: 2026, isFinalized: false, createdAt: '', shoppingListMon: [], shoppingListFri: [],
      days: [
        day('Montag', recipe('A', [
          { item: 'Eier', amountPer10Pax: 4, unit: 'Stk', storeCategory: 'mopro' },
          { item: 'Zwiebeln', amountPer10Pax: 2, unit: 'Stück', storeCategory: 'gemuese' },
          { item: 'Mehl', amountPer10Pax: 500, unit: 'g', storeCategory: 'trocken' },
          { item: 'Hähnchenbrust', amountPer10Pax: 1, unit: 'kg', storeCategory: 'kuehlung' },
        ])),
        day('Dienstag', recipe('B', [
          { item: 'Ei', amountPer10Pax: 6, unit: 'Stück', storeCategory: 'kuehlung' },
          { item: 'Zwiebel', amountPer10Pax: 1, unit: 'Stück', storeCategory: 'gemuese' },
          { item: 'Salz', amountPer10Pax: 10, unit: 'g', storeCategory: 'trocken' },
          { item: 'Hähnchenbrust', amountPer10Pax: 500, unit: 'g', storeCategory: 'kuehlung' },
        ])),
      ],
    } as WeeklyPlan;
    const { shoppingListMon } = buildShoppingLists(plan, 10);
    expect(shoppingListMon.map((i) => [i.item, i.amount, i.unit])).toEqual([
      ['Zwiebeln', 300, 'g'],
      ['Hähnchenbrust', 1500, 'g'],
      ['Eier', 10, 'Stück'],
    ]);
    expect(shoppingListMon.find((i) => i.item === 'Eier')?.recipeNames).toEqual(['A', 'B']);
  });

  it('counts onions given in pieces and in grams on ONE line (in g)', () => {
    const plan = {
      id: 'p', calendarWeek: 1, year: 2026, isFinalized: false, createdAt: '', shoppingListMon: [], shoppingListFri: [],
      days: [
        day('Montag', recipe('A', [{ item: 'Zwiebeln', amountPer10Pax: 400, unit: 'g', storeCategory: 'gemuese' }])),
        day('Mittwoch', recipe('B', [
          { item: 'Zwiebel', amountPer10Pax: 2, unit: 'Stück', storeCategory: 'gemuese' },
          { item: 'Zitrone', amountPer10Pax: 2, unit: 'Stk', storeCategory: 'gemuese' },
        ])),
      ],
    } as WeeklyPlan;
    const { shoppingListMon } = buildShoppingLists(plan, 10);
    expect(shoppingListMon.map((i) => [i.item, i.amount, i.unit])).toEqual([
      ['Zitrone', 2, 'Stück'],
      ['Zwiebeln', 600, 'g'],
    ]);
  });

  it('has no pantry items and no duplicate lines for the built-in recipes', () => {
    const plan = generateWeeklyPlan(recipesData as Recipe[], { calendarWeek: 2, year: 2026 });
    const { shoppingListMon, shoppingListFri } = buildShoppingLists(plan);
    for (const list of [shoppingListMon, shoppingListFri]) {
      expect(list.filter((i) => isPantryStaple(i.item, i.storeCategory))).toEqual([]);
      const keys = list.map((i) => `${canonicalItemKey(i.item)}__${i.unit}`);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it('refreshShoppingLists keeps checked items checked', () => {
    const plan = generateWeeklyPlan(recipesData as Recipe[], { calendarWeek: 3, year: 2026 });
    const withLists = { ...plan, ...buildShoppingLists(plan) };
    const first = withLists.shoppingListMon[0];
    const checked = { ...withLists, shoppingListMon: withLists.shoppingListMon.map((i) => (i === first ? { ...i, checked: true } : i)) };
    const refreshed = refreshShoppingLists(checked);
    expect(refreshed.shoppingListMon.find((i) => i.item === first.item)?.checked).toBe(true);
  });
});
