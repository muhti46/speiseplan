import { useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { checkForUpdate } from '../services/pwaUpdate';

type Status = 'idle' | 'checking' | 'upToDate' | 'found' | 'error';

/** Zeigt die installierte Version und erlaubt eine manuelle Update-Suche (statt Neuinstallation). */
export default function AppVersion() {
  const { lang, t } = useLanguage();
  const [status, setStatus] = useState<Status>('idle');

  const buildDate = new Date(__APP_BUILD__).toLocaleString(lang === 'tr' ? 'tr-TR' : 'de-DE', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  async function handleCheck() {
    setStatus('checking');
    try {
      setStatus((await checkForUpdate()) ? 'found' : 'upToDate');
    } catch {
      setStatus('error');
    }
  }

  const statusText =
    status === 'upToDate' ? t.updateUpToDate : status === 'found' ? t.updateFound : status === 'error' ? t.updateError : null;

  return (
    <section className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 text-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="text-slate-600">{t.appVersion(buildDate)}</span>
        <button
          type="button"
          onClick={handleCheck}
          disabled={status === 'checking' || status === 'found'}
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 active:scale-95 disabled:opacity-60"
        >
          {status === 'checking' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          {status === 'checking' ? t.updateChecking : t.updateCheck}
        </button>
      </div>
      {statusText && (
        <p className={status === 'error' ? 'text-red-600' : 'text-brand-700'}>{statusText}</p>
      )}
      <p className="text-xs leading-relaxed text-slate-500">{t.updateHint}</p>
    </section>
  );
}
