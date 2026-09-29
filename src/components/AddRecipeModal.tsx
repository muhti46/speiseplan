import { FormEvent, useEffect, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { Course, ProteinCategory, Recipe, StoreCategory, SubCategory } from '../types/recipe';
import { coerceRecipe, isCoercionError } from '../services/ai/recipeCoercion';
import { useLanguage } from '../i18n/LanguageContext';

interface AddRecipeModalProps {
  onSave: (recipe: Recipe) => void;
  onClose: () => void;
}

interface IngredientRow {
  item: string;
  amountPer10Pax: string;
  unit: string;
  storeCategory: StoreCategory;
}

const COURSES: Course[] = ['vorspeise', 'hauptspeise', 'nachspeise'];
const PROTEIN_CATEGORIES: ProteinCategory[] = ['gefluegel', 'rind', 'fisch', 'suess', 'vegetarisch'];
const STORE_CATEGORIES: StoreCategory[] = ['gemuese', 'kuehlung', 'mopro', 'trocken', 'tk'];

function emptyIngredient(): IngredientRow {
  return { item: '', amountPer10Pax: '', unit: '', storeCategory: 'gemuese' };
}

export default function AddRecipeModal({ onSave, onClose }: AddRecipeModalProps) {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [course, setCourse] = useState<Course>('hauptspeise');
  const [subCategory, setSubCategory] = useState<SubCategory>('suppe');
  const [proteinCategory, setProteinCategory] = useState<ProteinCategory>('vegetarisch');
  const [beilage, setBeilage] = useState('');
  const [prepTimeMinutes, setPrepTimeMinutes] = useState('');
  const [cookTimeMinutes, setCookTimeMinutes] = useState('');
  const [instructions, setInstructions] = useState('');
  const [ingredients, setIngredients] = useState<IngredientRow[]>([emptyIngredient()]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  function updateIngredient(index: number, patch: Partial<IngredientRow>) {
    setIngredients((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addIngredientRow() {
    setIngredients((prev) => [...prev, emptyIngredient()]);
  }

  function removeIngredientRow(index: number) {
    setIngredients((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const raw = {
      name,
      course,
      subCategory: course === 'hauptspeise' ? undefined : course === 'nachspeise' ? 'dessert' : subCategory,
      proteinCategory: course === 'hauptspeise' ? proteinCategory : undefined,
      beilage: course === 'hauptspeise' ? beilage : undefined,
      prepTimeMinutes: Number(prepTimeMinutes),
      cookTimeMinutes: Number(cookTimeMinutes),
      instructions: instructions
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      ingredients: ingredients.map((row) => ({
        item: row.item,
        amountPer10Pax: Number(row.amountPer10Pax),
        unit: row.unit,
        storeCategory: row.storeCategory,
      })),
    };

    const result = coerceRecipe(raw, 'manual');
    if (isCoercionError(result)) {
      setError(result.error);
      return;
    }
    onSave(result);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-recipe-modal-title"
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[90vh] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:max-w-md sm:rounded-2xl"
      >
        <div className="flex items-start justify-between border-b border-slate-100 p-4">
          <h2 id="add-recipe-modal-title" className="text-lg font-bold text-slate-800">
            {t.addRecipeTitle}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.close}
            className="shrink-0 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto p-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              {t.addRecipeName}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.addRecipeNamePlaceholder}
              required
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              {t.addRecipeCourse}
            </label>
            <select
              value={course}
              onChange={(e) => setCourse(e.target.value as Course)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
            >
              {COURSES.map((c) => (
                <option key={c} value={c}>
                  {t.courseLabels[c]}
                </option>
              ))}
            </select>
          </div>

          {course === 'vorspeise' && (
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                {t.addRecipeSubCategory}
              </label>
              <select
                value={subCategory}
                onChange={(e) => setSubCategory(e.target.value as SubCategory)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
              >
                <option value="suppe">{t.subCategoryLabels.suppe}</option>
                <option value="salat">{t.subCategoryLabels.salat}</option>
              </select>
            </div>
          )}

          {course === 'hauptspeise' && (
            <>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {t.addRecipeProtein}
                </label>
                <select
                  value={proteinCategory}
                  onChange={(e) => setProteinCategory(e.target.value as ProteinCategory)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
                >
                  {PROTEIN_CATEGORIES.map((p) => (
                    <option key={p} value={p}>
                      {t.proteinLabels[p]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {t.addRecipeBeilage}
                </label>
                <input
                  type="text"
                  value={beilage}
                  onChange={(e) => setBeilage(e.target.value)}
                  placeholder={t.addRecipeBeilagePlaceholder}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
                />
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                {t.prep} (min)
              </label>
              <input
                type="number"
                min={0}
                value={prepTimeMinutes}
                onChange={(e) => setPrepTimeMinutes(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                {t.cook} (min)
              </label>
              <input
                type="number"
                min={0}
                value={cookTimeMinutes}
                onChange={(e) => setCookTimeMinutes(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              {t.steps}
            </label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder={t.addRecipeInstructionsPlaceholder}
              rows={4}
              required
              className="w-full resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {t.ingredients}
              </label>
              <button
                type="button"
                onClick={addIngredientRow}
                className="flex items-center gap-1 text-xs font-medium text-brand-700"
              >
                <Plus size={14} />
                {t.addRecipeIngredientAdd}
              </button>
            </div>
            <div className="space-y-2">
              {ingredients.map((row, index) => (
                <div key={index} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 p-2">
                  <input
                    type="text"
                    value={row.item}
                    onChange={(e) => updateIngredient(index, { item: e.target.value })}
                    placeholder={t.addRecipeItemPlaceholder}
                    required
                    className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:border-brand-600 focus:outline-none"
                  />
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={row.amountPer10Pax}
                    onChange={(e) => updateIngredient(index, { amountPer10Pax: e.target.value })}
                    placeholder={t.addRecipeAmountPlaceholder}
                    required
                    className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:border-brand-600 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={row.unit}
                    onChange={(e) => updateIngredient(index, { unit: e.target.value })}
                    placeholder={t.addRecipeUnitPlaceholder}
                    required
                    className="w-16 rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:border-brand-600 focus:outline-none"
                  />
                  <select
                    value={row.storeCategory}
                    onChange={(e) => updateIngredient(index, { storeCategory: e.target.value as StoreCategory })}
                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:border-brand-600 focus:outline-none"
                  >
                    {STORE_CATEGORIES.map((sc) => (
                      <option key={sc} value={sc}>
                        {t.aisleLabels[sc]}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => removeIngredientRow(index)}
                    aria-label={t.addRecipeIngredientRemove}
                    className="ml-auto rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600"
            >
              {t.addRecipeCancel}
            </button>
            <button
              type="submit"
              className="flex-1 rounded-full bg-brand-700 px-4 py-2 text-sm font-medium text-white active:scale-95"
            >
              {t.addRecipeSave}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
