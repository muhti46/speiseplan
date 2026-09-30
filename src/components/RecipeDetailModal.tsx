import { useEffect, useRef, useState } from 'react';
import { X, Clock, ChefHat, Flame, Users, Sparkles, ArrowLeftRight, Lightbulb, Loader2, RefreshCw, Pencil, Trash2, Camera } from 'lucide-react';
import { Recipe, RecipeDetail, RecipeTranslation } from '../types/recipe';
import { translateInstructions } from '../services/ai/recipeTranslation';
import { generateRecipeDetail } from '../services/ai/recipeDetail';
import { getApiKey } from '../services/ai/apiKey';
import { describeChatError } from '../services/ai/chat';
import { getCategoryLabel } from '../services/labels';
import { DEFAULT_PORTIONS } from '../services/shopping';
import { formatIngredientAmount } from '../services/format';
import { resizeImageFile } from '../services/image';
import RecipeChat from './RecipeChat';
import { useLanguage } from '../i18n/LanguageContext';

interface RecipeDetailModalProps {
  recipe: Recipe;
  onClose: () => void;
  /** Wenn gesetzt, erscheint neben dem Namen ein "Ändern"-Button (nur für Gänge im Wochenplan). */
  onChange?: () => void;
  /** Rezept bearbeiten (Gang, Kategorie, Zutaten, Zubereitung). */
  onEdit?: () => void;
  /** Rezept aus dem Pool löschen (nur für selbst angelegte/KI-Rezepte). */
  onDelete?: () => void;
  /** Bereits gespeicherte ausführliche Anleitung (in der aktuellen Sprache), falls vorhanden. */
  detail?: RecipeDetail;
  /** Foto des Gerichts (Data-URL), falls vorhanden. */
  image?: string;
  /** Bereits gespeicherte Übersetzung der Kurz-Schritte in die aktuelle Sprache (nur wenn nicht Deutsch). */
  translation?: RecipeTranslation;
  onTranslationCreated?: (translation: RecipeTranslation) => void;
  /** Neues Foto (Data-URL) oder `null` zum Entfernen; der Aufrufer speichert es. */
  onImageChange?: (dataUrl: string | null) => void;
  /** Wird mit einer neu erzeugten ausführlichen Anleitung aufgerufen; der Aufrufer speichert sie. */
  onDetailCreated?: (detail: RecipeDetail) => void;
}

export default function RecipeDetailModal({
  recipe,
  onClose,
  onChange,
  onEdit,
  onDelete,
  detail,
  image,
  translation,
  onTranslationCreated,
  onImageChange,
  onDetailCreated,
}: RecipeDetailModalProps) {
  const { lang, t } = useLanguage();
  const [view, setView] = useState<'short' | 'long'>('long');
  const [isCreating, setIsCreating] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);
  const [translateAttempt, setTranslateAttempt] = useState(0);

  // Kurz-Schritte liegen auf Deutsch vor: in anderer App-Sprache einmalig per KI übersetzen
  // (und dauerhaft speichern). Schlägt es fehl, bleibt der deutsche Text und ein Retry-Button erscheint.
  useEffect(() => {
    if (lang === 'de' || translation || !onTranslationCreated) return;
    const apiKey = getApiKey();
    if (!apiKey || !navigator.onLine) return;
    let cancelled = false;
    setIsTranslating(true);
    setTranslateError(null);
    translateInstructions(apiKey, recipe, lang)
      .then((created) => {
        if (!cancelled) onTranslationCreated(created);
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('Übersetzung fehlgeschlagen', err);
        if (!cancelled) setTranslateError(`${t.translateFailed} (${describeChatError(err).message})`);
      })
      .finally(() => {
        if (!cancelled) setIsTranslating(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipe.id, lang, !!translation, translateAttempt]);

  const shortSteps = lang !== 'de' && translation ? translation.steps : recipe.instructions;

  async function handlePhotoPicked(file: File | undefined) {
    if (!file || !onImageChange) return;
    setPhotoError(null);
    try {
      onImageChange(await resizeImageFile(file));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Foto konnte nicht verarbeitet werden', err);
      setPhotoError(t.photoFailed);
    }
  }

  async function handleCreateDetail() {
    setDetailError(null);
    const apiKey = getApiKey();
    if (!apiKey) return setDetailError(t.aiFillNoKey);
    if (!navigator.onLine) return setDetailError(t.aiFillOffline);
    setIsCreating(true);
    try {
      const created = await generateRecipeDetail(apiKey, recipe, lang);
      onDetailCreated?.(created);
      setView('long');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Ausführliche Anleitung fehlgeschlagen', err);
      setDetailError(`${t.detailFailed} (${describeChatError(err).message})`);
    } finally {
      setIsCreating(false);
    }
  }

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
        className="flex max-h-[calc(var(--app-height)*0.9)] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:max-w-md sm:rounded-2xl"
      >
        <div className="flex items-start justify-between border-b border-slate-100 p-4">
          <div>
            <span className="mb-1 inline-flex items-center gap-2">
              <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-brand-800">
                {getCategoryLabel(recipe, lang)}
              </span>
              {recipe.source === 'ai' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
                  <Sparkles size={12} />
                  {t.aiRecipeBadge}
                </span>
              )}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="recipe-modal-title" className="text-lg font-bold text-slate-800">
                {recipe.name}
              </h2>
              {onChange && (
                <button
                  type="button"
                  onClick={onChange}
                  className="inline-flex items-center gap-1 rounded-full border border-brand-600 px-2.5 py-1 text-xs font-medium text-brand-700 active:scale-95"
                >
                  <ArrowLeftRight size={12} />
                  {t.changeMeal}
                </button>
              )}
            </div>
            {(onEdit || onDelete) && (
              <div className="mt-2 flex flex-wrap gap-2">
                {onEdit && (
                  <button
                    type="button"
                    onClick={onEdit}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 active:scale-95"
                  >
                    <Pencil size={12} />
                    {t.editRecipe}
                  </button>
                )}
                {onDelete && (
                  <button
                    type="button"
                    onClick={onDelete}
                    className="inline-flex items-center gap-1 rounded-full border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 active:scale-95"
                  >
                    <Trash2 size={12} />
                    {t.deleteRecipe}
                  </button>
                )}
              </div>
            )}
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
          {onImageChange && (
            <div className="mb-4">
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  handlePhotoPicked(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
              {image ? (
                <>
                  <img src={image} alt={recipe.name} className="max-h-64 w-full rounded-xl object-cover" />
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => fileInput.current?.click()}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 active:scale-95"
                    >
                      <Camera size={12} />
                      {t.photoChange}
                    </button>
                    <button
                      type="button"
                      onClick={() => onImageChange(null)}
                      className="inline-flex items-center gap-1 rounded-full border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 active:scale-95"
                    >
                      <Trash2 size={12} />
                      {t.photoRemove}
                    </button>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-4 text-sm font-medium text-slate-500 active:scale-95"
                >
                  <Camera size={18} />
                  {t.photoAdd}
                </button>
              )}
              {photoError && <p className="mt-1 text-sm text-red-600">{photoError}</p>}
            </div>
          )}
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
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                {detail && view === 'long' ? t.detailTitle : t.steps}
              </h3>
              {detail && (
                <div className="flex rounded-full bg-slate-100 p-0.5 text-xs font-medium">
                  {(['short', 'long'] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setView(v)}
                      className={`rounded-full px-3 py-1 ${
                        view === v ? 'bg-white text-brand-800 shadow-sm' : 'text-slate-500'
                      }`}
                    >
                      {v === 'short' ? t.detailShort : t.detailLong}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {detail && view === 'long' ? (
              <>
                <ol className="space-y-4">
                  {detail.steps.map((step, index) => (
                    <li key={index} className="flex gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-800">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2 text-base font-semibold text-slate-800">
                          {step.title}
                          {step.minutes !== undefined && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                              <Clock size={12} />
                              {t.detailMinutes(step.minutes)}
                            </span>
                          )}
                        </p>
                        <p className="mt-1 text-base leading-relaxed text-slate-700">{step.text}</p>
                      </div>
                    </li>
                  ))}
                </ol>

                {detail.tips.length > 0 && (
                  <div className="mt-5 rounded-xl bg-amber-50 p-3">
                    <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-900">
                      <Lightbulb size={16} />
                      {t.detailTips}
                    </p>
                    <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-amber-950">
                      {detail.tips.map((tip, index) => (
                        <li key={index}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-4 flex items-center justify-between gap-2 text-xs text-slate-400">
                  <span>{t.detailAiNote}</span>
                  <button
                    type="button"
                    onClick={handleCreateDetail}
                    disabled={isCreating}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50"
                  >
                    {isCreating ? <Loader2 size={12} className="animate-spin" aria-hidden /> : <RefreshCw size={12} />}
                    {t.detailRegenerate}
                  </button>
                </div>
              </>
            ) : (
              <ol className="space-y-3">
                {shortSteps.map((step, index) => (
                  <li key={index} className="flex gap-3 text-sm text-slate-700">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-800">
                      {index + 1}
                    </span>
                    <span className="pt-0.5">{step}</span>
                  </li>
                ))}
              </ol>
            )}

            {lang !== 'de' && !translation && (isTranslating || translateError) && (
              <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                {isTranslating ? (
                  <>
                    <Loader2 size={12} className="animate-spin" aria-hidden />
                    {t.translating}
                  </>
                ) : (
                  <>
                    <span className="text-red-600">{translateError}</span>
                    <button
                      type="button"
                      onClick={() => setTranslateAttempt((n) => n + 1)}
                      className="shrink-0 font-medium text-brand-700"
                    >
                      {t.retry}
                    </button>
                  </>
                )}
              </div>
            )}

            {!detail && onDetailCreated && (
              <div className="mt-5">
                <button
                  type="button"
                  onClick={handleCreateDetail}
                  disabled={isCreating}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm active:scale-95 disabled:opacity-60"
                >
                  {isCreating ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Sparkles size={16} />}
                  {isCreating ? t.detailCreating : t.detailCreate}
                </button>
              </div>
            )}
            {detailError && <p className="mt-2 text-sm text-red-600">{detailError}</p>}
          </section>

          <RecipeChat recipe={recipe} detail={detail} />
        </div>
      </div>
    </div>
  );
}
