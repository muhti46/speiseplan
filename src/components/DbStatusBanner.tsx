import { useSyncExternalStore } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { getDbError, getDbStatus, subscribeDbStatus } from '../services/storage';

/**
 * Warnt deutlich, wenn die Datenbank (noch) nicht geöffnet werden kann - statt einer App,
 * die leer wirkt und bei der Plan-Erzeugen und Chat stillschweigend nichts tun.
 */
export default function DbStatusBanner() {
  const { t } = useLanguage();
  const status = useSyncExternalStore(subscribeDbStatus, getDbStatus);
  if (status !== 'blocked' && status !== 'error') return null;
  const error = getDbError();

  return (
    <div role="alert" className="space-y-2 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">
      <p className="flex items-center gap-2 font-semibold">
        <AlertTriangle size={18} className="shrink-0" />
        {status === 'blocked' ? t.dbBlockedTitle : t.dbErrorTitle}
      </p>
      <p className="leading-relaxed">{status === 'blocked' ? t.dbBlockedText : t.dbErrorText}</p>
      {error && <p className="break-all font-mono text-xs text-red-700">{error}</p>}
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="flex items-center gap-2 rounded-full border border-red-300 bg-white px-4 py-2 font-medium active:scale-95"
      >
        <RefreshCw size={16} />
        {t.dbReload}
      </button>
    </div>
  );
}
