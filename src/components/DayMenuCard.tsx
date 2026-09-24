import { Clock, Shuffle, Soup, UtensilsCrossed, IceCreamCone, Salad } from 'lucide-react';
import { DayMenu } from '../types/menu';
import { Recipe } from '../types/recipe';
import { getBeilageRecipe } from '../data/beilagen';

const PROTEIN_LABELS: Record<string, string> = {
  gefluegel: 'Geflügel',
  rind: 'Rindfleisch',
  fisch: 'Fisch',
  suess: 'Süße Hauptspeise',
  vegetarisch: 'Vegetarisch',
};

interface DayMenuCardProps {
  day: DayMenu;
  onReroll: () => void;
  onOpenRecipe: (recipe: Recipe) => void;
}

export default function DayMenuCard({ day, onReroll, onOpenRecipe }: DayMenuCardProps) {
  const proteinLabel = day.hauptspeise.proteinCategory
    ? PROTEIN_LABELS[day.hauptspeise.proteinCategory]
    : undefined;
  const beilageRecipe = getBeilageRecipe(day.beilage);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">{day.dayOfWeek}</h3>
          <p className="flex items-center gap-1 text-xs text-slate-500">
            <Clock size={14} />
            Start {day.prepStartTime} Uhr · Servieren {day.targetServeTime} Uhr
          </p>
        </div>
        {proteinLabel && (
          <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-brand-800">
            {proteinLabel}
          </span>
        )}
      </div>

      <ul className="space-y-2 text-sm text-slate-700">
        <li className="flex items-start gap-2">
          <Soup size={16} className="mt-0.5 shrink-0 text-brand-600" />
          <button
            type="button"
            onClick={() => onOpenRecipe(day.vorspeise)}
            className="cursor-pointer text-left underline-offset-2 hover:text-brand-700 hover:underline"
          >
            {day.vorspeise.name}
          </button>
        </li>
        <li className="flex items-start gap-2">
          <UtensilsCrossed size={16} className="mt-0.5 shrink-0 text-brand-600" />
          <button
            type="button"
            onClick={() => onOpenRecipe(day.hauptspeise)}
            className="cursor-pointer text-left underline-offset-2 hover:text-brand-700 hover:underline"
          >
            {day.hauptspeise.name}
          </button>
        </li>
        {day.beilage !== '—' && (
          <li className="flex items-start gap-2 pl-6 text-slate-500">
            <Salad size={14} className="mt-0.5 shrink-0 text-brand-500" />
            {beilageRecipe ? (
              <button
                type="button"
                onClick={() => onOpenRecipe(beilageRecipe)}
                className="cursor-pointer text-left underline-offset-2 hover:text-brand-700 hover:underline"
              >
                Beilage: {day.beilage}
              </button>
            ) : (
              <span>Beilage: {day.beilage}</span>
            )}
          </li>
        )}
        <li className="flex items-start gap-2">
          <IceCreamCone size={16} className="mt-0.5 shrink-0 text-brand-600" />
          <button
            type="button"
            onClick={() => onOpenRecipe(day.nachspeise)}
            className="cursor-pointer text-left underline-offset-2 hover:text-brand-700 hover:underline"
          >
            {day.nachspeise.name}
          </button>
        </li>
      </ul>

      <button
        type="button"
        onClick={onReroll}
        className="mt-4 flex items-center gap-2 rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 active:scale-95"
      >
        <Shuffle size={14} />
        Tag neu würfeln
      </button>
    </div>
  );
}
