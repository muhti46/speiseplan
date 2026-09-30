import { describe, expect, it } from 'vitest';
import { applyBeilageChange, applyMealSwap, generateWeeklyPlan, getIsoWeek, getNextIsoWeek, getWeekRange, replaceRecipeInPlan, isPlanEditable } from './generator';
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

describe('applyBeilageChange', () => {
  it('changes only the targeted day and falls back to "—" for empty input', () => {
    const plan = makePlan();
    const target = plan.days[1].dayOfWeek;
    const changed = applyBeilageChange(plan, target, '  Couscous ');
    expect(changed.days[1].beilage).toBe('Couscous');
    expect(changed.days.filter((d) => d.dayOfWeek !== target)).toEqual(plan.days.filter((d) => d.dayOfWeek !== target));
    expect(applyBeilageChange(plan, target, '   ').days[1].beilage).toBe('—');
  });
});

describe('ISO weeks', () => {
  it('computes the ISO week and ISO year', () => {
    expect(getIsoWeek(new Date(2026, 8, 29))).toEqual({ calendarWeek: 40, year: 2026 });
    // 29.12.2025 (Montag) gehört bereits zu KW 1 des ISO-Jahres 2026
    expect(getIsoWeek(new Date(2025, 11, 29))).toEqual({ calendarWeek: 1, year: 2026 });
    // 1.1.2027 (Freitag) gehört noch zu KW 53 des ISO-Jahres 2026
    expect(getIsoWeek(new Date(2027, 0, 1))).toEqual({ calendarWeek: 53, year: 2026 });
  });

  it('plans for the following week, including across the year boundary', () => {
    expect(getNextIsoWeek(new Date(2026, 8, 29))).toEqual({ calendarWeek: 41, year: 2026 });
    expect(getNextIsoWeek(new Date(2026, 11, 28))).toEqual({ calendarWeek: 1, year: 2027 });
    expect(getNextIsoWeek(new Date(2026, 11, 21))).toEqual({ calendarWeek: 53, year: 2026 });
    expect(getNextIsoWeek(new Date(2027, 11, 20))).toEqual({ calendarWeek: 52, year: 2027 });
    // 2027 hat nur 52 Wochen: die Woche nach KW 52 ist KW 1 des Jahres 2028
    expect(getNextIsoWeek(new Date(2027, 11, 27))).toEqual({ calendarWeek: 1, year: 2028 });
  });
});

describe('getWeekRange', () => {
  it('returns Monday to Sunday of the ISO week', () => {
    const { start, end } = getWeekRange(40, 2026);
    expect([start.getFullYear(), start.getMonth(), start.getDate()]).toEqual([2026, 8, 28]);
    expect([end.getFullYear(), end.getMonth(), end.getDate()]).toEqual([2026, 9, 4]);
    // KW 1 / 2026 beginnt am 29.12.2025
    expect(getWeekRange(1, 2026).start.getDate()).toBe(29);
    expect(getWeekRange(1, 2026).start.getFullYear()).toBe(2025);
  });
});

describe('replaceRecipeInPlan', () => {
  it('replaces the edited recipe in matching slots only', () => {
    const plan = makePlan();
    const target = plan.days[0].hauptspeise;
    const edited: Recipe = { ...target, name: 'Geändert', beilage: 'Couscous' };
    const updated = replaceRecipeInPlan(plan, edited);
    expect(updated.days[0].hauptspeise.name).toBe('Geändert');
    expect(updated.days[0].beilage).toBe('Couscous');
    expect(updated.days[1]).toEqual(plan.days[1]);
    // Gangwechsel: Plan bleibt unverändert
    expect(replaceRecipeInPlan(plan, { ...target, course: 'vorspeise' })).toEqual(plan);
  });
  it('keeps a manually chosen beilage', () => {
    const plan = applyBeilageChange(makePlan(), makePlan().days[0].dayOfWeek, 'Kartoffeln');
    const updated = replaceRecipeInPlan(plan, { ...plan.days[0].hauptspeise, beilage: 'Reis2' });
    expect(updated.days[0].beilage).toBe('Kartoffeln');
  });
});

describe('isPlanEditable', () => {
  const today = new Date(2026, 9, 1); // Donnerstag in KW 40
  it('allows the current and following weeks, locks past weeks', () => {
    expect(isPlanEditable({ calendarWeek: 40, year: 2026 }, today)).toBe(true);
    expect(isPlanEditable({ calendarWeek: 41, year: 2026 }, today)).toBe(true);
    expect(isPlanEditable({ calendarWeek: 39, year: 2026 }, today)).toBe(false);
    expect(isPlanEditable({ calendarWeek: 52, year: 2025 }, today)).toBe(false);
    expect(isPlanEditable({ calendarWeek: 1, year: 2027 }, today)).toBe(true);
  });
  it('locks a week once it is over (Monday of the following week)', () => {
    expect(isPlanEditable({ calendarWeek: 40, year: 2026 }, new Date(2026, 9, 4))).toBe(true); // Sonntag
    expect(isPlanEditable({ calendarWeek: 40, year: 2026 }, new Date(2026, 9, 5))).toBe(false); // Montag KW 41
  });
});
