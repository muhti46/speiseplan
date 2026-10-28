import { useEffect, useState, useSyncExternalStore } from 'react';
import { CloudUpload, HardDriveDownload, Loader2, Unlink } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import {
  backupToDrive,
  connectDrive,
  disconnectDrive,
  DriveBackupEntry,
  getDriveState,
  listDriveBackups,
  refreshDriveStatus,
  restoreFromDrive,
  subscribeDrive,
} from '../services/driveBackup';

interface DriveBackupSectionProps {
  /** Auf dem Gerät gibt es noch keine Pläne (z.B. frisch neu installiert) - Sicherungen gleich anbieten. */
  isLocalEmpty: boolean;
}

/** Verbinden mit Google Drive, Status der automatischen Sicherung und Wiederherstellen aus Drive. */
export default function DriveBackupSection({ isLocalEmpty }: DriveBackupSectionProps) {
  const { lang, t } = useLanguage();
  const drive = useSyncExternalStore(subscribeDrive, getDriveState);
  const [backups, setBackups] = useState<DriveBackupEntry[] | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const locale = lang === 'tr' ? 'tr-TR' : 'de-DE';

  useEffect(() => {
    refreshDriveStatus();
  }, []);

  async function openRestoreList() {
    setLoadingList(true);
    try {
      setBackups(await listDriveBackups());
    } catch {
      await refreshDriveStatus();
    } finally {
      setLoadingList(false);
    }
  }

  // Leeres Gerät + frisch verbunden: direkt die vorhandenen Sicherungen zeigen.
  useEffect(() => {
    if (drive.status === 'connected' && isLocalEmpty && backups === null) openRestoreList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drive.status, isLocalEmpty]);

  async function handleRestore(entry: DriveBackupEntry) {
    if (!window.confirm(t.backupRestoreConfirm)) return;
    setRestoring(true);
    try {
      const count = await restoreFromDrive(entry.id);
      window.alert(t.backupRestored(count));
      window.location.reload();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Wiederherstellung aus Drive fehlgeschlagen', err);
      window.alert(t.backupError);
      setRestoring(false);
    }
  }

  async function handleDisconnect() {
    if (!window.confirm(t.driveDisconnectConfirm)) return;
    await disconnectDrive();
    setBackups(null);
  }

  const busy = drive.busy || restoring || loadingList;
  const buttonClass =
    'flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium active:scale-95 disabled:opacity-60';

  if (drive.status === 'unknown') {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Loader2 size={14} className="animate-spin" />
        {t.driveTitle}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-700">{t.driveTitle}</h3>

      {drive.error === 'oauth' && <p className="text-sm text-red-600">{t.driveErrorOauth}</p>}

      {drive.status === 'not_configured' && <p className="text-sm text-slate-500">{t.driveNotConfigured}</p>}

      {(drive.status === 'disconnected' || drive.status === 'expired') && (
        <>
          <p className={`text-sm ${drive.status === 'expired' ? 'font-medium text-red-600' : 'text-slate-600'}`}>
            {drive.status === 'expired' ? t.driveExpired : t.driveConnectHint}
          </p>
          <button type="button" onClick={connectDrive} className={`${buttonClass} w-full bg-brand-700 text-white`}>
            <CloudUpload size={16} />
            {drive.status === 'expired' ? t.driveReconnect : t.driveConnect}
          </button>
        </>
      )}

      {drive.status === 'connected' && (
        <>
          <p className="text-sm font-medium text-brand-700">✓ {t.driveActive}</p>
          <p className="text-xs text-slate-500">
            {drive.lastBackup
              ? t.driveLast(drive.lastBackup.toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' }))
              : t.driveNever}
          </p>
          {drive.error === 'network' && <p className="text-sm text-amber-700">{t.driveErrorNetwork}</p>}
          {drive.needsDecision && (
            <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-800">{t.driveNeedsDecision}</p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => backupToDrive({ auto: false })}
              disabled={busy}
              className={`${buttonClass} bg-brand-700 text-white`}
            >
              {drive.busy ? <Loader2 size={16} className="animate-spin" /> : <CloudUpload size={16} />}
              {t.driveBackupNow}
            </button>
            <button
              type="button"
              onClick={openRestoreList}
              disabled={busy}
              className={`${buttonClass} border border-slate-300 text-slate-600`}
            >
              {loadingList ? <Loader2 size={16} className="animate-spin" /> : <HardDriveDownload size={16} />}
              {t.driveRestore}
            </button>
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={busy}
              aria-label={t.driveDisconnect}
              title={t.driveDisconnect}
              className="shrink-0 rounded-full border border-slate-300 p-2 text-slate-500 active:scale-95 disabled:opacity-60"
            >
              <Unlink size={16} />
            </button>
          </div>

          {backups && (
            <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-slate-700">{t.driveChooseBackup}</p>
                <button type="button" onClick={() => setBackups(null)} className="text-xs text-slate-500 underline">
                  {t.driveCancel}
                </button>
              </div>
              {backups.length === 0 && <p className="text-sm text-slate-500">{t.driveNoBackups}</p>}
              <ul className="max-h-60 space-y-1 overflow-y-auto">
                {backups.map((entry) => (
                  <li key={entry.id}>
                    <button
                      type="button"
                      onClick={() => handleRestore(entry)}
                      disabled={busy}
                      className="flex w-full items-center justify-between rounded-lg bg-white px-3 py-2 text-left text-sm active:bg-slate-100 disabled:opacity-60"
                    >
                      <span>{new Date(entry.modifiedTime).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                      {entry.size && <span className="text-xs text-slate-400">{Math.round(Number(entry.size) / 1024)} KB</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
