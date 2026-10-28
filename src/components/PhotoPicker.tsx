import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ImageOff, Loader2, Search, X } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { PhotoCandidate } from '../services/dishImages';

interface PhotoPickerProps {
  recipeName: string;
  candidates: PhotoCandidate[];
  /** Foto übernehmen (herunterladen + beim Rezept speichern). Wirft bei Netzwerkfehlern. */
  onChoose: (candidate: PhotoCandidate) => Promise<void>;
  /** Weitere Fotos suchen; liefert die Anzahl neu gefundener. Wirft bei Netzwerkfehlern. */
  onLoadMore: () => Promise<number>;
  onReject: () => void;
  onClose: () => void;
}

/**
 * Alle gefundenen Fotos eines Gerichts zur Auswahl: laut KI passende zuerst (mit Haken), dann die
 * übrigen. Antippen zeigt das Foto groß, "Übernehmen" speichert es beim Rezept.
 */
export default function PhotoPicker({ recipeName, candidates, onChoose, onLoadMore, onReject, onClose }: PhotoPickerProps) {
  const { t } = useLanguage();
  const [selected, setSelected] = useState<PhotoCandidate | null>(candidates[0] ?? null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Noch keine Kandidaten (z.B. aus dem Rezept-Fenster geöffnet): gleich suchen.
  useEffect(() => {
    if (candidates.length === 0) handleLoadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selected && candidates.length > 0) setSelected(candidates[0]);
  }, [candidates, selected]);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    }
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [onClose]);

  async function handleChoose() {
    if (!selected) return;
    setSaving(true);
    try {
      await onChoose(selected);
      onClose();
    } catch {
      setMessage(t.photoApproveFailed);
    } finally {
      setSaving(false);
    }
  }

  async function handleLoadMore() {
    setLoading(true);
    setMessage(null);
    try {
      if ((await onLoadMore()) === 0) setMessage(t.photoNoMore);
    } catch {
      setMessage(t.photoSearchFailed);
    } finally {
      setLoading(false);
    }
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.photoPickerTitle(recipeName)}
      onClick={(event) => {
        event.stopPropagation();
        if (event.target === event.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/60 sm:items-center sm:p-4"
    >
      <div className="flex max-h-[calc(var(--app-height)*0.92)] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:max-w-md sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-4">
          <h2 className="text-base font-semibold text-slate-800">{t.photoPickerTitle(recipeName)}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.close}
            className="shrink-0 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {selected && (
            <div>
              <img src={selected.fullUrl} alt={recipeName} className="max-h-60 w-full rounded-xl bg-slate-100 object-contain" />
              <p className="mt-1 text-[11px] text-slate-400">
                {t.photoCredit(selected.artist, selected.license)}
                {selected.matched && <span className="ml-2 font-medium text-brand-700">✓ {t.photoMatched}</span>}
              </p>
            </div>
          )}

          <div className="grid grid-cols-4 gap-2">
            {candidates.map((candidate) => {
              const isSelected = candidate.fullUrl === selected?.fullUrl;
              return (
                <button
                  key={candidate.fullUrl}
                  type="button"
                  onClick={() => setSelected(candidate)}
                  className={`relative aspect-square overflow-hidden rounded-lg border-2 ${
                    isSelected ? 'border-brand-600' : 'border-transparent'
                  }`}
                >
                  <img src={candidate.thumbUrl} alt="" loading="lazy" className="h-full w-full bg-slate-100 object-cover" />
                  {candidate.matched && (
                    <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 text-white">
                      <Check size={10} strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {message && <p className="text-sm text-slate-500">{message}</p>}

          <button
            type="button"
            onClick={handleLoadMore}
            disabled={loading || saving}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 active:scale-95 disabled:opacity-60"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            {t.photoLoadMore}
          </button>
        </div>

        <div className="flex gap-2 border-t border-slate-100 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={handleChoose}
            disabled={!selected || saving}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white active:scale-95 disabled:opacity-60"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            {t.photoApprove}
          </button>
          <button
            type="button"
            onClick={() => {
              onReject();
              onClose();
            }}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-full border border-slate-300 px-3 py-2.5 text-sm font-medium text-slate-600 active:scale-95 disabled:opacity-60"
          >
            <ImageOff size={16} />
            {t.photoReject}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
