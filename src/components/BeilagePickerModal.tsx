import { FormEvent, useEffect, useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

interface BeilagePickerModalProps {
  current: string;
  /** Alle wählbaren Beilagen-Namen (fest hinterlegte + selbst angelegte). */
  beilagen: string[];
  onCreateNew: () => void;
  onSelect: (beilage: string) => void;
  onClose: () => void;
}

export default function BeilagePickerModal({ current, beilagen, onCreateNew, onSelect, onClose }: BeilagePickerModalProps) {
  const { t } = useLanguage();
  const [custom, setCustom] = useState('');

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  function submitCustom(event: FormEvent) {
    event.preventDefault();
    if (custom.trim()) onSelect(custom.trim());
  }

  const options = [{ value: '—', label: t.noBeilage }, ...beilagen.map((b) => ({ value: b, label: b }))];
  // Eine bereits gesetzte eigene Beilage (nicht in der Liste) trotzdem als aktuell anzeigen.
  if (current !== '—' && !beilagen.includes(current)) options.splice(1, 0, { value: current, label: current });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="beilage-picker-title"
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[calc(var(--app-height)*0.9)] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:max-w-md sm:rounded-2xl"
      >
        <div className="flex items-start justify-between border-b border-slate-100 p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t.pickMealTitle}</p>
            <h2 id="beilage-picker-title" className="text-lg font-bold text-slate-800">
              {t.beilageLabel}
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

        <div className="border-b border-slate-100 p-4 pb-0">
          <button
            type="button"
            onClick={onCreateNew}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-dashed border-brand-600 px-4 py-2 text-sm font-medium text-brand-700 active:scale-95"
          >
            <Plus size={16} />
            {t.beilageNew}
          </button>
        </div>

        <form onSubmit={submitCustom} className="flex gap-2 border-b border-slate-100 p-4">
          <input
            type="text"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder={t.beilageCustomPlaceholder}
            className="min-w-0 flex-1 rounded-full border border-slate-300 px-4 py-2 text-base focus:border-brand-600 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!custom.trim()}
            className="shrink-0 rounded-full bg-brand-700 px-4 py-2 text-sm font-medium text-white active:scale-95 disabled:opacity-50"
          >
            {t.beilageCustomApply}
          </button>
        </form>

        <ul className="flex-1 divide-y divide-slate-100 overflow-y-auto">
          {options.map((option) => {
            const isCurrent = option.value === current;
            return (
              <li key={option.value}>
                <button
                  type="button"
                  onClick={() => onSelect(option.value)}
                  className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-base ${
                    isCurrent ? 'bg-brand-50' : 'active:bg-slate-50'
                  } ${option.value === '—' ? 'text-slate-500' : 'text-slate-800'}`}
                >
                  {option.label}
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
