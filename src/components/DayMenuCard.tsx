import { useState } from 'react';
import { LucideIcon, Shuffle, Soup, UtensilsCrossed, IceCreamCone, Salad, Pencil } from 'lucide-react';
import { DayMenu, DayOfWeek } from '../types/menu';
import { Course, Recipe } from '../types/recipe';
import { useLanguage } from '../i18n/LanguageContext';
import ImageLightbox, { PhotoCredit } from './ImageLightbox';
import PhotoSuggestionActions, { PhotoSuggestionHandlers } from './PhotoSuggestionActions';

/** Foto eines Gerichts: eigenes Foto des Nutzers oder automatisch gefundenes (mit Quellenangabe). */
export interface DishPhoto {
  thumbUrl: string;
  fullUrl: string;
  credit?: PhotoCredit;
  /** Automatischer Vorschlag, noch nicht vom Nutzer bestätigt. */
  pending?: boolean;
}

// Jeder Wochentag hat einen eigenen, bewusst blassen Farbton (Tailwind-Stufen 50/100/200),
// damit die Karten unterscheidbar bleiben, ohne die Augen zu ermüden. Klassen stehen
// vollständig ausgeschrieben da, damit Tailwind sie beim Build findet.
const DAY_THEME: Record<DayOfWeek, { card: string; title: string; icon: string; badge: string; hover: string }> = {
  Montag: {
    card: 'border-sky-200 bg-sky-50',
    title: 'text-sky-900',
    icon: 'text-sky-600',
    badge: 'bg-sky-100 text-sky-800',
    hover: 'hover:text-sky-700',
  },
  Dienstag: {
    card: 'border-amber-200 bg-amber-50',
    title: 'text-amber-900',
    icon: 'text-amber-600',
    badge: 'bg-amber-100 text-amber-800',
    hover: 'hover:text-amber-700',
  },
  Mittwoch: {
    card: 'border-rose-200 bg-rose-50',
    title: 'text-rose-900',
    icon: 'text-rose-500',
    badge: 'bg-rose-100 text-rose-800',
    hover: 'hover:text-rose-700',
  },
  Donnerstag: {
    card: 'border-violet-200 bg-violet-50',
    title: 'text-violet-900',
    icon: 'text-violet-500',
    badge: 'bg-violet-100 text-violet-800',
    hover: 'hover:text-violet-700',
  },
  Freitag: {
    card: 'border-emerald-200 bg-emerald-50',
    title: 'text-emerald-900',
    icon: 'text-emerald-600',
    badge: 'bg-emerald-100 text-emerald-800',
    hover: 'hover:text-emerald-700',
  },
};

interface DayMenuCardProps {
  day: DayMenu;
  /** Ohne onReroll/onChangeBeilage ist die Karte schreibgeschützt (Archiv-Ansicht). */
  onReroll?: () => void;
  /** `course` ist nur für die drei Gänge gesetzt (änderbar), nicht für die Beilage. */
  onOpenRecipe: (recipe: Recipe, course?: Course) => void;
  onChangeBeilage?: () => void;
  /** Rezept zur gewählten Beilage (fest hinterlegt oder selbst angelegt), falls vorhanden. */
  beilageRecipe?: Recipe;
  /** Foto je Gericht für das kleine Vorschaubild (antippen = Vollbild). */
  photoFor?: (recipe: Recipe) => DishPhoto | undefined;
  /** Übernehmen/Anderes/Kein Foto für einen noch unbestätigten Vorschlag. */
  suggestionHandlers?: (recipe: Recipe) => PhotoSuggestionHandlers;
}

export default function DayMenuCard({
  day,
  onReroll,
  onOpenRecipe,
  onChangeBeilage,
  beilageRecipe,
  photoFor,
  suggestionHandlers,
}: DayMenuCardProps) {
  const { t } = useLanguage();
  const [enlarged, setEnlarged] = useState<Recipe | null>(null);
  // Vorschlag kann sich im Vollbild ändern ("Anderes Foto") - daher immer frisch nachschlagen;
  // ist keiner mehr übrig, verschwindet das Vollbild von selbst.
  const enlargedPhoto = enlarged ? photoFor?.(enlarged) : undefined;
  const theme = DAY_THEME[day.dayOfWeek];
  const proteinLabel = day.hauptspeise.proteinCategory
    ? t.proteinLabels[day.hauptspeise.proteinCategory]
    : undefined;

  function renderCourse(course: Course, Icon: LucideIcon) {
    const recipe = day[course];
    const photo = photoFor?.(recipe);
    return (
      <li className="flex items-center gap-2">
        <Icon size={16} className={`shrink-0 ${theme.icon}`} />
        <button
          type="button"
          onClick={() => onOpenRecipe(recipe, course)}
          className={`min-w-0 flex-1 cursor-pointer text-left underline-offset-2 hover:underline ${theme.hover}`}
        >
          {recipe.name}
        </button>
        {photo && (
          <button
            type="button"
            onClick={() => setEnlarged(recipe)}
            aria-label={recipe.name}
            className="relative shrink-0 cursor-zoom-in rounded-lg border border-white/80 bg-white shadow-sm"
          >
            <img
              src={photo.thumbUrl}
              alt=""
              loading="lazy"
              className={`h-11 w-11 rounded-lg object-cover ${photo.pending ? 'opacity-80' : ''}`}
            />
            {photo.pending && (
              <span
                title={t.photoSuggestedHint}
                className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white"
              >
                ?
              </span>
            )}
          </button>
        )}
      </li>
    );
  }

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${theme.card}`}>
      {enlarged && enlargedPhoto && (
        <ImageLightbox
          key={enlargedPhoto.fullUrl}
          src={enlargedPhoto.fullUrl}
          alt={enlarged.name}
          credit={enlargedPhoto.credit}
          onClose={() => setEnlarged(null)}
          actions={
            enlargedPhoto.pending && suggestionHandlers ? (
              <PhotoSuggestionActions
                {...suggestionHandlers(enlarged)}
                variant="dark"
                onDone={() => setEnlarged(null)}
              />
            ) : undefined
          }
        />
      )}
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className={`text-lg font-semibold ${theme.title}`}>{t.dayLabels[day.dayOfWeek]}</h3>
        </div>
        {proteinLabel && (
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${theme.badge}`}>
            {proteinLabel}
          </span>
        )}
      </div>

      <ul className="space-y-2 text-sm text-slate-700">
        {renderCourse('vorspeise', Soup)}
        {renderCourse('hauptspeise', UtensilsCrossed)}
        {(day.beilage !== '—' || onChangeBeilage) && (
        <li className="flex items-start gap-2 pl-6 text-slate-500">
          <Salad size={14} className={`mt-0.5 shrink-0 ${theme.icon}`} />
          {day.beilage === '—' ? (
            <span className="text-slate-400">{t.noBeilage}</span>
          ) : beilageRecipe ? (
            <button
              type="button"
              onClick={() => onOpenRecipe(beilageRecipe)}
              className={`cursor-pointer text-left underline-offset-2 hover:underline ${theme.hover}`}
            >
              {t.beilage(day.beilage)}
            </button>
          ) : (
            <span>{t.beilage(day.beilage)}</span>
          )}
          {onChangeBeilage && (
            <button
              type="button"
              onClick={onChangeBeilage}
              aria-label={t.changeBeilage}
              className={`-my-1 ml-auto shrink-0 rounded-full p-1.5 text-slate-400 hover:bg-white/70 ${theme.hover}`}
            >
              <Pencil size={14} />
            </button>
          )}
        </li>
        )}
        {renderCourse('nachspeise', IceCreamCone)}
      </ul>

      {onReroll && (
        <button
          type="button"
          onClick={onReroll}
          className="mt-4 flex items-center gap-2 rounded-full border border-slate-300 bg-white/70 px-3 py-1.5 text-xs font-medium text-slate-600 active:scale-95"
        >
          <Shuffle size={14} />
          {t.rerollDay}
        </button>
      )}
    </div>
  );
}
