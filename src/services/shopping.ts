import { Recipe } from '../types/recipe';
import { DayMenu, ShoppingItem, WeeklyPlan } from '../types/menu';

export const DEFAULT_PORTIONS = 11; // Mittelwert der Zielgruppe von 10-12 Personen

const AISLE_ORDER: ShoppingItem['storeCategory'][] = ['gemuese', 'kuehlung', 'mopro', 'trocken', 'tk'];

export const AISLE_LABELS: Record<ShoppingItem['storeCategory'], string> = {
  gemuese: 'Obst & Gemüse',
  kuehlung: 'Fleisch & Fisch (Kühlung)',
  mopro: 'Molkereiprodukte',
  trocken: 'Trockensortiment / Vorrat',
  tk: 'Tiefkühlware',
};

function recipesOfDay(day: DayMenu): Recipe[] {
  return [day.vorspeise, day.hauptspeise, day.nachspeise];
}

function aggregateIngredients(days: DayMenu[], portions: number): ShoppingItem[] {
  const scale = portions / 10;
  const byKey = new Map<string, ShoppingItem>();

  for (const day of days) {
    for (const recipe of recipesOfDay(day)) {
      for (const ingredient of recipe.ingredients) {
        const key = `${ingredient.item}__${ingredient.unit}__${ingredient.storeCategory}`;
        const scaledAmount = ingredient.amountPer10Pax * scale;
        const existing = byKey.get(key);
        if (existing) {
          existing.amount += scaledAmount;
          if (!existing.recipeNames.includes(recipe.name)) {
            existing.recipeNames.push(recipe.name);
          }
        } else {
          byKey.set(key, {
            item: ingredient.item,
            amount: scaledAmount,
            unit: ingredient.unit,
            storeCategory: ingredient.storeCategory,
            recipeNames: [recipe.name],
            checked: false,
          });
        }
      }
    }
  }

  return Array.from(byKey.values())
    .map((item) => ({ ...item, amount: Math.round(item.amount * 100) / 100 }))
    .sort((a, b) => {
      const aisleDiff = AISLE_ORDER.indexOf(a.storeCategory) - AISLE_ORDER.indexOf(b.storeCategory);
      return aisleDiff !== 0 ? aisleDiff : a.item.localeCompare(b.item, 'de');
    });
}

/** Einkauf 1 (Montag): Zutaten für Montag, Dienstag, Mittwoch. */
export function buildMondayShoppingList(plan: WeeklyPlan, portions: number = DEFAULT_PORTIONS): ShoppingItem[] {
  const relevantDays = plan.days.filter((d) =>
    ['Montag', 'Dienstag', 'Mittwoch'].includes(d.dayOfWeek),
  );
  return aggregateIngredients(relevantDays, portions);
}

/** Einkauf 2 (Freitag): Zutaten für Freitag. */
export function buildFridayShoppingList(plan: WeeklyPlan, portions: number = DEFAULT_PORTIONS): ShoppingItem[] {
  const relevantDays = plan.days.filter((d) => ['Donnerstag', 'Freitag'].includes(d.dayOfWeek));
  return aggregateIngredients(relevantDays, portions);
}

export function buildShoppingLists(
  plan: WeeklyPlan,
  portions: number = DEFAULT_PORTIONS,
): { shoppingListMon: ShoppingItem[]; shoppingListFri: ShoppingItem[] } {
  return {
    shoppingListMon: buildMondayShoppingList(plan, portions),
    shoppingListFri: buildFridayShoppingList(plan, portions),
  };
}

export function groupByAisle(items: ShoppingItem[]): Array<{ category: ShoppingItem['storeCategory']; label: string; items: ShoppingItem[] }> {
  return AISLE_ORDER.filter((category) => items.some((i) => i.storeCategory === category)).map((category) => ({
    category,
    label: AISLE_LABELS[category],
    items: items.filter((i) => i.storeCategory === category),
  }));
}
