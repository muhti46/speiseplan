import { describe, expect, it, vi } from 'vitest';

const { generateRecipeDrafts } = vi.hoisted(() => ({ generateRecipeDrafts: vi.fn() }));
vi.mock('./recipeDraft', () => ({ generateRecipeDrafts }));

import { createToolDispatcher, findRecipeByName } from './tools';
import { generateWeeklyPlan } from '../generator';
import { Recipe } from '../../types/recipe';
import recipesData from '../../data/recipes.json';

const recipes = recipesData as Recipe[];

describe('swap_meal', () => {
  it('never picks a Beilage from the pool when searching a Hauptspeise by name', async () => {
    const beilageReis: Recipe = {
      id: 'user-reis',
      name: 'Reis',
      course: 'hauptspeise',
      subCategory: 'beilage',
      prepTimeMinutes: 5,
      cookTimeMinutes: 20,
      totalTimeMinutes: 25,
      instructions: ['Kochen.'],
      ingredients: [{ item: 'Reis', amountPer10Pax: 900, unit: 'g', storeCategory: 'trocken' }],
    };
    const pool = [beilageReis, ...recipes];
    const plan = generateWeeklyPlan(pool, { calendarWeek: 10, year: 2026 });
    const onPlanUpdate = vi.fn();
    const dispatch = createToolDispatcher({
      apiKey: 'key',
      plan,
      recipes: pool,
      lang: 'de',
      recentRecipeIds: [],
      calendarWeek: 10,
      year: 2026,
      onPlanUpdate,
      onRecipeAdd: vi.fn(),
    });

    const result = await dispatch('swap_meal', { dayOfWeek: 'Montag', course: 'hauptspeise', recipeName: 'reis' });

    expect(result.status).toBe('updated');
    expect(result.recipeName).not.toBe('Reis');
    expect(onPlanUpdate.mock.calls[0][0].days[0].hauptspeise.subCategory).not.toBe('beilage');
  });
});

describe('set_week_plan', () => {
  const builtin = (course: Recipe['course']) => recipes.filter((r) => r.course === course && r.subCategory !== 'beilage');

  function setup() {
    const plan = generateWeeklyPlan(recipes, { calendarWeek: 10, year: 2026 });
    const onPlanUpdate = vi.fn();
    const onRecipeAdd = vi.fn();
    const dispatch = createToolDispatcher({
      apiKey: 'key',
      plan,
      recipes,
      lang: 'de',
      recentRecipeIds: [],
      calendarWeek: 10,
      year: 2026,
      onPlanUpdate,
      onRecipeAdd,
    });
    return { dispatch, onPlanUpdate, onRecipeAdd };
  }

  it('sets a whole week in one call and creates only the missing dishes (batched)', async () => {
    generateRecipeDrafts.mockReset();
    const newDish: Recipe = {
      id: 'ai-tantuni-1',
      name: 'Tantuni',
      course: 'hauptspeise',
      proteinCategory: 'rind',
      prepTimeMinutes: 20,
      cookTimeMinutes: 20,
      totalTimeMinutes: 40,
      instructions: ['Braten.'],
      ingredients: [{ item: 'Rinderhack', amountPer10Pax: 1000, unit: 'g', storeCategory: 'kuehlung' }],
    };
    generateRecipeDrafts.mockResolvedValue([newDish]);
    const { dispatch, onPlanUpdate, onRecipeAdd } = setup();
    const haupt = builtin('hauptspeise');
    const vor = builtin('vorspeise')[0];

    const result = await dispatch('set_week_plan', {
      days: [
        { dayOfWeek: 'Montag', vorspeise: vor.name.toUpperCase(), hauptspeise: haupt[0].name, beilage: 'Bulgur' },
        { dayOfWeek: 'Dienstag', hauptspeise: 'Tantuni' },
      ],
    });

    expect(generateRecipeDrafts).toHaveBeenCalledTimes(1);
    expect(generateRecipeDrafts).toHaveBeenCalledWith('key', [{ name: 'Tantuni', course: 'hauptspeise' }]);
    expect(onRecipeAdd).toHaveBeenCalledWith(newDish);
    const updated = onPlanUpdate.mock.calls[0][0];
    expect(updated.days[0].vorspeise.id).toBe(vor.id);
    expect(updated.days[0].hauptspeise.id).toBe(haupt[0].id);
    expect(updated.days[0].beilage).toBe('Bulgur');
    expect(updated.days[1].hauptspeise.id).toBe('ai-tantuni-1');
    expect(updated.shoppingListMon.length).toBeGreaterThan(0);
    expect(result.newRecipesAdded).toEqual(['Tantuni']);
  });

  it('builds a plan for the current week when asked for "this week"', async () => {
    generateRecipeDrafts.mockReset();
    const { dispatch, onPlanUpdate } = setup();
    await dispatch('set_week_plan', { week: 'current', days: [{ dayOfWeek: 'Montag', hauptspeise: builtin('hauptspeise')[0].name }] });
    expect(generateRecipeDrafts).not.toHaveBeenCalled();
    expect(onPlanUpdate.mock.calls[0][0].calendarWeek).not.toBe(10);
  });

  it('keeps going and reports dishes that could not be created', async () => {
    generateRecipeDrafts.mockReset();
    generateRecipeDrafts.mockResolvedValue([{ error: 'kaputt' }]);
    const { dispatch, onPlanUpdate } = setup();
    const result = await dispatch('set_week_plan', { days: [{ dayOfWeek: 'Freitag', hauptspeise: 'Gibtsnicht Gericht' }] });
    expect(onPlanUpdate).toHaveBeenCalled();
    expect(result.notCreated).toEqual([{ name: 'Gibtsnicht Gericht', error: 'kaputt' }]);
  });
});

describe('findRecipeByName', () => {
  it('matches ignoring case/accents and extra words, but never Beilagen', () => {
    const haupt = recipes.find((r) => r.course === 'hauptspeise' && r.subCategory !== 'beilage')!;
    expect(findRecipeByName(recipes, 'hauptspeise', `${haupt.name} mit Reis`)?.id).toBe(haupt.id);
    expect(findRecipeByName(recipes, 'hauptspeise', 'xyz')).toBeUndefined();
  });
});
