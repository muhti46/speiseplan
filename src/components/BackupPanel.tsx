import { ChangeEvent, useRef, useState } from 'react';
import { DatabaseBackup, Loader2, Upload } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import {
  createBackup,
  getLastBackupDate,
  isBackupDue,
  markBackupDone,
  parseBackup,
  restoreBackup,
  saveBackupFile,
} from '../services/backup';

interface BackupPanelProps {
  onBackupDone: () => void;
}

/** Sichern/Wiederherstellen aller App-Daten als JSON-Datei (Schutz gegen Deinstallation). */
export default function BackupPanel({ onBackupDone }: BackupPanelProps) {
  const { lang, t } = useLanguage();
  const [lastBackup, setLastBackup] = useState(() => getLastBackupDate());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const due = isBackupDue(lastBackup);

  async function handleSave() {
    setBusy(true);
    setMessage(null);
    try {
      await saveBackupFile(await createBackup());
      const now = new Date();
      markBackupDone(now);
      setLastBackup(now);
      onBackupDone();
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        // eslint-disable-next-line no-console
        console.error('Sicherung fehlgeschlagen', err);
        setMessage({ text: t.backupError, isError: true });
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleRestore(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setMessage(null);

    let backup;
    try {
      backup = parseBackup(await file.text());
    } catch {
      setMessage({ text: t.backupInvalid, isError: true });
      return;
    }
    if (!window.confirm(t.backupRestoreConfirm)) return;

    setBusy(true);
    try {
      const count = await restoreBackup(backup);
      window.alert(t.backupRestored(count));
      // Alle Ansichten lesen ihre Daten beim Start aus der Datenbank - neu laden ist am einfachsten.
      window.location.reload();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Wiederherstellung fehlgeschlagen', err);
      setMessage({ text: t.backupError, isError: true });
      setBusy(false);
    }
  }

  return (
    <section
      className={`space-y-3 rounded-xl border p-4 ${due ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`}
    >
      <div className="flex items-center gap-2">
        <DatabaseBackup size={18} className={due ? 'text-amber-600' : 'text-brand-700'} />
        <h2 className="text-base font-semibold text-slate-700">{t.backupTitle}</h2>
      </div>
      <p className="text-sm leading-relaxed text-slate-600">{t.backupHint}</p>
      <p className={`text-xs ${due ? 'font-medium text-amber-700' : 'text-slate-500'}`}>
        {lastBackup
          ? t.backupLast(lastBackup.toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'de-DE'))
          : t.backupNever}
      </p>
      {message && (
        <p className={`text-sm ${message.isError ? 'text-red-600' : 'text-brand-700'}`}>{message.text}</p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={busy}
          className="flex flex-1 items-center justify-center gap-2 rounded-full bg-brand-700 px-4 py-2 text-sm font-medium text-white active:scale-95 disabled:opacity-60"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <DatabaseBackup size={16} />}
          {t.backupSave}
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="flex flex-1 items-center justify-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 active:scale-95 disabled:opacity-60"
        >
          <Upload size={16} />
          {t.backupRestore}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          onChange={handleRestore}
          className="hidden"
        />
      </div>
    </section>
  );
}
