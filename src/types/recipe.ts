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

export interface Recipe {
  id: string;
  name: string;
  course: Course;
  subCategory?: SubCategory;
  proteinCategory?: ProteinCategory;
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  totalTimeMinutes: number;
  instructions: string[];
  ingredients: Ingredient[];
}
