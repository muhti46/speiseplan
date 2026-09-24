import { useEffect } from 'react';
import { X, Clock, ChefHat, Flame, Users } from 'lucide-react';
import { Recipe } from '../types/recipe';
import { getCategoryLabel } from '../services/labels';
import { DEFAULT_PORTIONS } from '../services/shopping';
import { useLanguage } from '../i18n/LanguageContext';

interface RecipeDetailModalProps {
  recipe: Recipe;
  onClose: () => void;
}

function formatIngredientAmount(amountPer10Pax: number, unit: string, portions: number): string {
  const amount = (amountPer10Pax * portions) / 10;

  if (unit === 'g' && amount >= 1000) {
    return `${(amount / 1000).toFixed(amount % 1000 === 0 ? 0 : 1)} kg`;
  }
  if (unit === 'ml' && amount >= 1000) {
    return `${(amount / 1000).toFixed(amount % 1000 === 0 ? 0 : 1)} l`;
  }
  const rounded = Math.round(amount * 10) / 10;
  return `${rounded} ${unit}`;
}

export default function RecipeDetailModal({ recipe, onClose }: RecipeDetailModalProps) {
  const { lang, t } = useLanguage();

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="recipe-modal-title"
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[90vh] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:max-w-md sm:rounded-2xl"
      >
        <div className="flex items-start justify-between border-b border-slate-100 p-4">
          <div>
            <span className="mb-1 inline-block rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-brand-800">
              {getCategoryLabel(recipe, lang)}
            </span>
            <h2 id="recipe-modal-title" className="text-lg font-bold text-slate-800">
              {recipe.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.close}
            className="shrink-0 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-4 flex items-center gap-2 text-sm text-slate-600">
            <Users size={16} className="text-brand-600" />
            {t.portions(DEFAULT_PORTIONS - 1, DEFAULT_PORTIONS + 1)}
          </div>

          <div className="mb-5 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center">
            <div>
              <ChefHat size={16} className="mx-auto mb-1 text-brand-600" />
              <p className="text-sm font-semibold text-slate-800">{recipe.prepTimeMinutes} min</p>
              <p className="text-xs text-slate-500">{t.prep}</p>
            </div>
            <div>
              <Flame size={16} className="mx-auto mb-1 text-brand-600" />
              <p className="text-sm font-semibold text-slate-800">{recipe.cookTimeMinutes} min</p>
              <p className="text-xs text-slate-500">{t.cook}</p>
            </div>
            <div>
              <Clock size={16} className="mx-auto mb-1 text-brand-600" />
              <p className="text-sm font-semibold text-slate-800">{recipe.totalTimeMinutes} min</p>
              <p className="text-xs text-slate-500">{t.total}</p>
            </div>
          </div>

          <section className="mb-5">
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">{t.ingredients}</h3>
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {recipe.ingredients.map((ingredient) => (
                <li
                  key={ingredient.item}
                  className="flex items-center justify-between px-3 py-2 text-sm text-slate-700"
                >
                  <span>{ingredient.item}</span>
                  <span className="font-medium text-slate-600">
                    {formatIngredientAmount(ingredient.amountPer10Pax, ingredient.unit, DEFAULT_PORTIONS)}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
              {t.steps}
            </h3>
            <ol className="space-y-3">
              {recipe.instructions.map((step, index) => (
                <li key={index} className="flex gap-3 text-sm text-slate-700">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-800">
                    {index + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
