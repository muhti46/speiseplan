import { Course, Ingredient, ProteinCategory, Recipe, StoreCategory, SubCategory } from '../../types/recipe';

const COURSES: Course[] = ['vorspeise', 'hauptspeise', 'nachspeise'];
const SUB_CATEGORIES: SubCategory[] = ['suppe', 'salat', 'beilage', 'dessert'];
const PROTEIN_CATEGORIES: ProteinCategory[] = ['gefluegel', 'rind', 'fisch', 'suess', 'vegetarisch'];
const STORE_CATEGORIES: StoreCategory[] = ['gemuese', 'kuehlung', 'mopro', 'trocken', 'tk'];

export interface CoercionError {
  error: string;
}

export function isCoercionError(value: Recipe | CoercionError): value is CoercionError {
  return 'error' in value;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Validiert und normalisiert ein von der KI generiertes Rezept.
 * Gibt bei fehlerhaften/fehlenden Pflichtfeldern (z.B. proteinCategory bei
 * Hauptspeisen) einen Fehler zurück statt still einen Default zu setzen -
 * ein falscher Default würde die 5-Tage-Protein-Regel unbemerkt verletzen.
 */
export function coerceRecipe(raw: unknown): Recipe | CoercionError {
  if (typeof raw !== 'object' || raw === null) {
    return { error: 'Rezept-Daten fehlen oder sind kein Objekt.' };
  }
  const r = raw as Record<string, unknown>;

  const name = typeof r.name === 'string' ? r.name.trim() : '';
  if (!name) return { error: 'Feld "name" fehlt oder ist leer.' };

  const course = r.course as Course;
  if (!COURSES.includes(course)) {
    return { error: `Feld "course" muss einer von ${COURSES.join(', ')} sein.` };
  }

  let subCategory: SubCategory | undefined;
  if (r.subCategory !== undefined) {
    if (!SUB_CATEGORIES.includes(r.subCategory as SubCategory)) {
      return { error: `Feld "subCategory" muss einer von ${SUB_CATEGORIES.join(', ')} sein.` };
    }
    subCategory = r.subCategory as SubCategory;
  }

  let proteinCategory: ProteinCategory | undefined;
  if (course === 'hauptspeise') {
    if (!PROTEIN_CATEGORIES.includes(r.proteinCategory as ProteinCategory)) {
      return {
        error: `Hauptspeisen benötigen ein gültiges Feld "proteinCategory" (${PROTEIN_CATEGORIES.join(', ')}).`,
      };
    }
    proteinCategory = r.proteinCategory as ProteinCategory;
  }

  const prepTimeMinutes = Number(r.prepTimeMinutes);
  const cookTimeMinutes = Number(r.cookTimeMinutes);
  if (!Number.isFinite(prepTimeMinutes) || prepTimeMinutes < 0) {
    return { error: 'Feld "prepTimeMinutes" muss eine nicht-negative Zahl sein.' };
  }
  if (!Number.isFinite(cookTimeMinutes) || cookTimeMinutes < 0) {
    return { error: 'Feld "cookTimeMinutes" muss eine nicht-negative Zahl sein.' };
  }

  if (!Array.isArray(r.instructions) || r.instructions.length === 0 || !r.instructions.every((s) => typeof s === 'string')) {
    return { error: 'Feld "instructions" muss eine nicht-leere Liste von Text-Schritten sein.' };
  }

  if (!Array.isArray(r.ingredients) || r.ingredients.length === 0) {
    return { error: 'Feld "ingredients" muss eine nicht-leere Liste sein.' };
  }
  const ingredients: Ingredient[] = [];
  for (const raw of r.ingredients) {
    if (typeof raw !== 'object' || raw === null) {
      return { error: 'Jede Zutat muss ein Objekt sein.' };
    }
    const ing = raw as Record<string, unknown>;
    const item = typeof ing.item === 'string' ? ing.item.trim() : '';
    const amountPer10Pax = Number(ing.amountPer10Pax);
    const unit = typeof ing.unit === 'string' ? ing.unit.trim() : '';
    const storeCategory = ing.storeCategory as StoreCategory;
    if (!item) return { error: 'Zutat ohne "item"-Namen gefunden.' };
    if (!Number.isFinite(amountPer10Pax) || amountPer10Pax <= 0) {
      return { error: `Zutat "${item}": "amountPer10Pax" muss eine positive Zahl sein.` };
    }
    if (!unit) return { error: `Zutat "${item}": Feld "unit" fehlt.` };
    if (!STORE_CATEGORIES.includes(storeCategory)) {
      return { error: `Zutat "${item}": "storeCategory" muss einer von ${STORE_CATEGORIES.join(', ')} sein.` };
    }
    ingredients.push({ item, amountPer10Pax, unit, storeCategory });
  }

  const beilage = course === 'hauptspeise' && typeof r.beilage === 'string' ? r.beilage.trim() : undefined;

  return {
    id: `ai-${slugify(name)}-${Date.now()}`,
    name,
    course,
    subCategory,
    proteinCategory,
    beilage: beilage || undefined,
    source: 'ai',
    prepTimeMinutes,
    cookTimeMinutes,
    totalTimeMinutes: prepTimeMinutes + cookTimeMinutes,
    instructions: r.instructions as string[],
    ingredients,
  };
}
