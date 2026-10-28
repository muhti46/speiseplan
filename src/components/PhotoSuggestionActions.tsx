import { useState } from 'react';
import { Check, ImageOff, Images, Loader2 } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

/** Was mit einem automatisch vorgeschlagenen Foto passieren kann. */
export interface PhotoSuggestionHandlers {
  /** Foto übernehmen: wird heruntergeladen und dauerhaft beim Rezept gespeichert. */
  approve: () => Promise<void>;
  /** Alle gefundenen Fotos zur Auswahl zeigen (und weitere suchen). */
  showAll: () => void;
  /** Kein Foto für dieses Gericht vorschlagen. */
  reject: () => void;
}

interface PhotoSuggestionActionsProps extends PhotoSuggestionHandlers {
  /** dark = im schwarzen Vollbild, light = im weißen Rezept-Fenster. */
  variant: 'dark' | 'light';
  /** Wird nach Übernehmen/Ablehnen aufgerufen (z.B. Vollbild schließen). */
  onDone?: () => void;
}

export default function PhotoSuggestionActions({ approve, showAll, reject, variant, onDone }: PhotoSuggestionActionsProps) {
  const { t } = useLanguage();
  const [saving, setSaving] = useState(false);
  const base = 'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium active:scale-95 disabled:opacity-60';
  const secondary =
    variant === 'dark' ? `${base} bg-white/15 text-white` : `${base} border border-slate-300 text-slate-600`;

  async function handleApprove() {
    setSaving(true);
    try {
      await approve();
      onDone?.();
    } catch {
      window.alert(t.photoApproveFailed);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button type="button" onClick={handleApprove} disabled={saving} className={`${base} bg-brand-600 text-white`}>
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
        {t.photoApprove}
      </button>
      <button
        type="button"
        onClick={() => {
          onDone?.();
          showAll();
        }}
        disabled={saving}
        className={secondary}
      >
        <Images size={14} />
        {t.photoNext}
      </button>
      <button
        type="button"
        onClick={() => {
          reject();
          onDone?.();
        }}
        disabled={saving}
        className={secondary}
      >
        <ImageOff size={14} />
        {t.photoReject}
      </button>
    </>
  );
}
