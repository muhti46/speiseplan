import { Recipe } from '../types/recipe';
import { Lang, translations } from '../i18n/translations';

/** Kurzes Kategorie-Label für die Modal-Kopfzeile, z. B. "Rind" oder "Suppe". */
export function getCategoryLabel(recipe: Recipe, lang: Lang): string {
  const t = translations[lang];
  if (recipe.proteinCategory) return t.proteinLabels[recipe.proteinCategory];
  if (recipe.subCategory) return t.subCategoryLabels[recipe.subCategory];
  return t.courseLabels[recipe.course];
}
