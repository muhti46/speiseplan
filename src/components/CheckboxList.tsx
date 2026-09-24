import { Check } from 'lucide-react';
import { ShoppingItem } from '../types/menu';
import { AISLE_LABELS, groupByAisle } from '../services/shopping';

function formatAmount(item: ShoppingItem): string {
  const rounded = Math.round(item.amount * 10) / 10;
  return `${rounded} ${item.unit}`;
}

interface CheckboxListProps {
  title: string;
  items: ShoppingItem[];
  onToggle: (item: ShoppingItem) => void;
}

export default function CheckboxList({ title, items, onToggle }: CheckboxListProps) {
  const groups = groupByAisle(items);

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400">
        Noch keine Einkaufsliste für {title}. Erzeuge zuerst einen Wochenplan.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h3 className="text-base font-semibold text-slate-800">{title}</h3>
      {groups.map((group) => (
        <div key={group.category}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {AISLE_LABELS[group.category]}
          </p>
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {group.items.map((item) => (
              <li key={`${item.item}-${item.unit}`}>
                <button
                  type="button"
                  onClick={() => onToggle(item)}
                  className="flex w-full items-center gap-3 px-3 py-3 text-left"
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                      item.checked ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300'
                    }`}
                  >
                    {item.checked && <Check size={14} />}
                  </span>
                  <span className={`flex-1 text-sm ${item.checked ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                    {item.item}
                  </span>
                  <span className="text-sm font-medium text-slate-500">{formatAmount(item)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
