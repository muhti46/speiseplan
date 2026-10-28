import { db } from './storage';

const BACKUP_APP_ID = 'speiseplan-backup';
const BACKUP_FORMAT_VERSION = 1;
const LAST_BACKUP_KEY = 'speiseplan-last-backup';
/** Nach so vielen Tagen ohne Sicherung erinnert die App daran. */
export const BACKUP_REMINDER_DAYS = 7;

// Alle Dexie-Tabellen mit Nutzerdaten. Der Gemini API-Key (localStorage) wird bewusst
// NICHT gesichert, damit er nicht versehentlich in einer geteilten Datei landet.
export const BACKUP_TABLES = [
  'plans',
  'currentPlan',
  'recipes',
  'recipeImages',
  'recipeDetails',
  'recipeTranslations',
  'recipeChats',
  'chatConversations',
] as const;
type BackupTable = (typeof BACKUP_TABLES)[number];

export interface BackupFile {
  app: typeof BACKUP_APP_ID;
  formatVersion: number;
  createdAt: string;
  tables: Partial<Record<BackupTable, unknown[]>>;
}

/**
 * Bittet den Browser, die Daten dieser App nicht bei Speicherknappheit automatisch zu
 * löschen. Schützt NICHT vor dem Deinstallieren der App oder "Daten löschen".
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function createBackup(now = new Date()): Promise<BackupFile> {
  const tables: BackupFile['tables'] = {};
  await db.transaction('r', BACKUP_TABLES.map((name) => db.table(name)), async () => {
    for (const name of BACKUP_TABLES) {
      tables[name] = await db.table(name).toArray();
    }
  });
  return { app: BACKUP_APP_ID, formatVersion: BACKUP_FORMAT_VERSION, createdAt: now.toISOString(), tables };
}

export function parseBackup(json: string): BackupFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('invalid');
  }
  const file = parsed as Partial<BackupFile>;
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    file.app !== BACKUP_APP_ID ||
    typeof file.tables !== 'object' ||
    file.tables === null
  ) {
    throw new Error('invalid');
  }
  for (const [name, rows] of Object.entries(file.tables)) {
    if (!BACKUP_TABLES.includes(name as BackupTable) || !Array.isArray(rows)) throw new Error('invalid');
  }
  return file as BackupFile;
}

/**
 * Spielt eine Sicherung ein. Vorhandene Einträge mit gleicher Id werden überschrieben,
 * alles andere bleibt erhalten (Zusammenführen statt Löschen) - so kann eine ältere
 * Sicherung nie neuere Pläne auf dem Gerät vernichten.
 */
export async function restoreBackup(backup: BackupFile): Promise<number> {
  let count = 0;
  const names = Object.keys(backup.tables) as BackupTable[];
  await db.transaction('rw', names.map((name) => db.table(name)), async () => {
    for (const name of names) {
      const rows = backup.tables[name] ?? [];
      await db.table(name).bulkPut(rows);
      count += rows.length;
    }
  });
  return count;
}

export function backupFileName(date = new Date()): string {
  return `speiseplan-sicherung-${date.toISOString().slice(0, 10)}.json`;
}

/**
 * Gibt die Sicherung an den Nutzer: auf Android über das Teilen-Menü (z.B. direkt in
 * Google Drive speichern), sonst als normaler Download.
 */
export async function saveBackupFile(backup: BackupFile): Promise<void> {
  const name = backupFileName(new Date(backup.createdAt));
  const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
  const file = new File([blob], name, { type: 'application/json' });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return;
    } catch (err) {
      // Abbruch durch den Nutzer nicht als Download weiterführen.
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export function getLastBackupDate(): Date | null {
  try {
    const raw = window.localStorage.getItem(LAST_BACKUP_KEY);
    return raw ? new Date(raw) : null;
  } catch {
    return null;
  }
}

export function markBackupDone(date = new Date()): void {
  try {
    window.localStorage.setItem(LAST_BACKUP_KEY, date.toISOString());
  } catch {
    // Ohne localStorage gibt es eben keine Erinnerung.
  }
}

export function isBackupDue(lastBackup: Date | null, now = new Date(), days = BACKUP_REMINDER_DAYS): boolean {
  if (!lastBackup || Number.isNaN(lastBackup.getTime())) return true;
  return now.getTime() - lastBackup.getTime() >= days * 24 * 60 * 60 * 1000;
}
