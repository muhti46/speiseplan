import { describe, expect, it } from 'vitest';
import { applyMealSwap, generateWeeklyPlan } from './generator';
import { Recipe } from '../types/recipe';
import recipesData from '../data/recipes.json';

const recipes = recipesData as Recipe[];

function makePlan() {
  return generateWeeklyPlan(recipes, { calendarWeek: 10, year: 2026 });
}

describe('applyMealSwap', () => {
  it('replaces only the targeted course and recomputes prepStartTime', () => {
    const plan = makePlan();
    const day = plan.days[0];
    const otherHauptspeise = recipes.find(
      (r) => r.course === 'hauptspeise' && r.id !== day.hauptspeise.id,
    )!;

    const updated = applyMealSwap(plan, day.dayOfWeek, 'hauptspeise', otherHauptspeise);
    const updatedDay = updated.days.find((d) => d.dayOfWeek === day.dayOfWeek)!;

    expect(updatedDay.hauptspeise.id).toBe(otherHauptspeise.id);
    expect(updatedDay.vorspeise.id).toBe(day.vorspeise.id);
    expect(updatedDay.nachspeise.id).toBe(day.nachspeise.id);
    expect(updatedDay.prepStartTime).toBeTruthy();

    const otherDays = updated.days.filter((d) => d.dayOfWeek !== day.dayOfWeek);
    const originalOtherDays = plan.days.filter((d) => d.dayOfWeek !== day.dayOfWeek);
    expect(otherDays).toEqual(originalOtherDays);
  });

  it('prefers an explicit recipe.beilage over the static BEILAGE_BY_RECIPE_ID map', () => {
    const plan = makePlan();
    const day = plan.days[0];
    const aiHauptspeise: Recipe = {
      id: 'ai-test-dish',
      name: 'Test-Gericht',
      course: 'hauptspeise',
      proteinCategory: 'vegetarisch',
      beilage: 'Couscous',
      source: 'ai',
      prepTimeMinutes: 10,
      cookTimeMinutes: 10,
      totalTimeMinutes: 20,
      instructions: ['Kochen.'],
      ingredients: [{ item: 'Gemüse', amountPer10Pax: 500, unit: 'g', storeCategory: 'gemuese' }],
    };

    const updated = applyMealSwap(plan, day.dayOfWeek, 'hauptspeise', aiHauptspeise);
    const updatedDay = updated.days.find((d) => d.dayOfWeek === day.dayOfWeek)!;

    expect(updatedDay.beilage).toBe('Couscous');
  });
});
