export type Course = 'vorspeise' | 'hauptspeise' | 'nachspeise';

export type SubCategory = 'suppe' | 'salat' | 'beilage' | 'dessert';

export type ProteinCategory = 'gefluegel' | 'rind' | 'fisch' | 'suess' | 'vegetarisch';

export type StoreCategory = 'gemuese' | 'kuehlung' | 'mopro' | 'trocken' | 'tk';

export interface Ingredient {
  item: string;
  amountPer10Pax: number;
  unit: string;
  storeCategory: StoreCategory;
}

export type RecipeSource = 'builtin' | 'ai' | 'manual';

export interface Recipe {
  id: string;
  name: string;
  course: Course;
  subCategory?: SubCategory;
  proteinCategory?: ProteinCategory;
  /** Beilagen-Name für Hauptspeisen; überschreibt ggf. die statische BEILAGE_BY_RECIPE_ID-Map. */
  beilage?: string;
  source?: RecipeSource;
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  totalTimeMinutes: number;
  instructions: string[];
  ingredients: Ingredient[];
}
