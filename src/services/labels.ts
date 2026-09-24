import { Course, ProteinCategory, Recipe, SubCategory } from '../types/recipe';

export const PROTEIN_LABELS: Record<ProteinCategory, string> = {
  gefluegel: 'Geflügel',
  rind: 'Rind',
  fisch: 'Fisch',
  suess: 'Süß',
  vegetarisch: 'Vegetarisch',
};

export const COURSE_LABELS: Record<Course, string> = {
  vorspeise: 'Vorspeise',
  hauptspeise: 'Hauptspeise',
  nachspeise: 'Nachspeise',
};

export const SUBCATEGORY_LABELS: Record<SubCategory, string> = {
  suppe: 'Suppe',
  salat: 'Salat',
  beilage: 'Beilage',
  dessert: 'Dessert',
};

/** Kurzes Kategorie-Label für die Modal-Kopfzeile, z. B. "Rind" oder "Suppe". */
export function getCategoryLabel(recipe: Recipe): string {
  if (recipe.proteinCategory) return PROTEIN_LABELS[recipe.proteinCategory];
  if (recipe.subCategory) return SUBCATEGORY_LABELS[recipe.subCategory];
  return COURSE_LABELS[recipe.course];
}
