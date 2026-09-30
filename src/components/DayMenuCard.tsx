import { Shuffle, Soup, UtensilsCrossed, IceCreamCone, Salad, Pencil } from 'lucide-react';
import { DayMenu, DayOfWeek } from '../types/menu';
import { Course, Recipe } from '../types/recipe';
import { useLanguage } from '../i18n/LanguageContext';

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
}

export default function DayMenuCard({ day, onReroll, onOpenRecipe, onChangeBeilage, beilageRecipe }: DayMenuCardProps) {
  const { t } = useLanguage();
  const theme = DAY_THEME[day.dayOfWeek];
  const proteinLabel = day.hauptspeise.proteinCategory
    ? t.proteinLabels[day.hauptspeise.proteinCategory]
    : undefined;

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${theme.card}`}>
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
        <li className="flex items-start gap-2">
          <Soup size={16} className={`mt-0.5 shrink-0 ${theme.icon}`} />
          <button
            type="button"
            onClick={() => onOpenRecipe(day.vorspeise, 'vorspeise')}
            className={`cursor-pointer text-left underline-offset-2 hover:underline ${theme.hover}`}
          >
            {day.vorspeise.name}
          </button>
        </li>
        <li className="flex items-start gap-2">
          <UtensilsCrossed size={16} className={`mt-0.5 shrink-0 ${theme.icon}`} />
          <button
            type="button"
            onClick={() => onOpenRecipe(day.hauptspeise, 'hauptspeise')}
            className={`cursor-pointer text-left underline-offset-2 hover:underline ${theme.hover}`}
          >
            {day.hauptspeise.name}
          </button>
        </li>
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
        <li className="flex items-start gap-2">
          <IceCreamCone size={16} className={`mt-0.5 shrink-0 ${theme.icon}`} />
          <button
            type="button"
            onClick={() => onOpenRecipe(day.nachspeise, 'nachspeise')}
            className={`cursor-pointer text-left underline-offset-2 hover:underline ${theme.hover}`}
          >
            {day.nachspeise.name}
          </button>
        </li>
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
