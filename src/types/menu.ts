import { Recipe, StoreCategory } from './recipe';

export type DayOfWeek = 'Montag' | 'Dienstag' | 'Mittwoch' | 'Donnerstag' | 'Freitag';

export const DAYS_OF_WEEK: DayOfWeek[] = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'];

export interface DayMenu {
  dayOfWeek: DayOfWeek;
  vorspeise: Recipe;
  hauptspeise: Recipe;
  beilage: string;
  nachspeise: Recipe;
  targetServeTime: '18:00';
  prepStartTime: string;
}

export interface ShoppingItem {
  item: string;
  amount: number;
  unit: string;
  storeCategory: StoreCategory;
  recipeNames: string[];
  checked: boolean;
}

export interface WeeklyPlan {
  id: string;
  calendarWeek: number;
  year: number;
  days: DayMenu[];
  shoppingListMon: ShoppingItem[];
  shoppingListFri: ShoppingItem[];
  isFinalized: boolean;
  createdAt: string;
}
