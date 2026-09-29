import { useEffect, useMemo, useState } from 'react';
import { Check, Plus, Search, X } from 'lucide-react';
import { Course, Recipe } from '../types/recipe';
import { getCategoryLabel } from '../services/labels';
import { useLanguage } from '../i18n/LanguageContext';

interface RecipePickerModalProps {
  course: Course;
  currentId: string;
  recipes: Recipe[];
  onSelect: (recipe: Recipe) => void;
  onCreateNew: () => void;
  onClose: () => void;
}

export default function RecipePickerModal({
  course,
  currentId,
  recipes,
  onSelect,
  onCreateNew,
  onClose,
}: RecipePickerModalProps) {
  const { lang, t } = useLanguage();
  const [query, setQuery] = useState('');

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const options = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return recipes
      .filter((r) => r.course === course && r.subCategory !== 'beilage')
      .filter((r) => !needle || r.name.toLowerCase().includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name, 'de'));
  }, [recipes, course, query]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="recipe-picker-title"
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[calc(var(--app-height)*0.9)] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:max-w-md sm:rounded-2xl"
      >
        <div className="flex items-start justify-between border-b border-slate-100 p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t.pickMealTitle}</p>
            <h2 id="recipe-picker-title" className="text-lg font-bold text-slate-800">
              {t.courseLabels[course]}
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

        <div className="space-y-3 border-b border-slate-100 p-4">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.pickMealSearch}
              className="w-full rounded-full border border-slate-300 py-2 pl-9 pr-3 text-base focus:border-brand-600 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={onCreateNew}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-dashed border-brand-600 px-4 py-2 text-sm font-medium text-brand-700 active:scale-95"
          >
            <Plus size={16} />
            {t.pickMealNew}
          </button>
        </div>

        <ul className="flex-1 divide-y divide-slate-100 overflow-y-auto">
          {options.length === 0 && (
            <li className="p-6 text-center text-sm text-slate-400">{t.pickMealEmpty}</li>
          )}
          {options.map((recipe) => {
            const isCurrent = recipe.id === currentId;
            return (
              <li key={recipe.id}>
                <button
                  type="button"
                  onClick={() => onSelect(recipe)}
                  className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left ${
                    isCurrent ? 'bg-brand-50' : 'active:bg-slate-50'
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block text-base text-slate-800">{recipe.name}</span>
                    <span className="block text-xs text-slate-400">{getCategoryLabel(recipe, lang)}</span>
                  </span>
                  {isCurrent && <Check size={18} className="shrink-0 text-brand-600" aria-label={t.pickMealCurrent} />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
