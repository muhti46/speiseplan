import { describe, expect, it, vi } from 'vitest';
import { createToolDispatcher } from './tools';
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
