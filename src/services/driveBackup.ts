import { db } from './storage';
import { BACKUP_TABLES, BackupFile, createBackup, markBackupDone, parseBackup, restoreBackup } from './backup';

// Automatische Sicherung in Google Drive. Die Anmeldung läuft über die Vercel-Funktionen
// unter /api/google/* (Refresh-Token nur im HttpOnly-Cookie); hier gibt es nur kurzlebige
// Access-Tokens. Scope drive.file: die App sieht in Drive ausschließlich eigene Dateien.

const CONNECTED_KEY = 'speiseplan-drive-connected';
const LAST_DRIVE_BACKUP_KEY = 'speiseplan-drive-last-backup';
const DIRTY_KEY = 'speiseplan-drive-dirty';
// Gesetzt, sobald dieses Gerät einmal in Drive gesichert oder aus Drive wiederhergestellt hat.
const LINKED_KEY = 'speiseplan-drive-linked';

export const DRIVE_FOLDER_NAME = 'Speiseplan Sicherungen';
const FILE_PREFIX = 'speiseplan-sicherung-';
/** Eine Datei pro Tag; ältere als die letzten 30 werden gelöscht. */
export const DRIVE_KEEP_FILES = 30;
const DEBOUNCE_MS = 15_000;
const RETRY_MS = 5 * 60_000;
const DAILY_MS = 24 * 60 * 60_000;

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3';

export type DriveStatus = 'unknown' | 'not_configured' | 'disconnected' | 'connected' | 'expired';

export interface DriveState {
  status: DriveStatus;
  lastBackup: Date | null;
  busy: boolean;
  /** In Drive liegen schon Sicherungen, dieses Gerät hat aber noch nie gesichert/wiederhergestellt. */
  needsDecision: boolean;
  error: 'network' | 'oauth' | null;
}

export interface DriveBackupEntry {
  id: string;
  name: string;
  modifiedTime: string;
  size?: string;
}

class DriveAuthError extends Error {
  constructor(public status: Exclude<DriveStatus, 'unknown' | 'connected'>) {
    super(status);
  }
}

// ---------------------------------------------------------------- Zustand für die UI

function readFlag(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeFlag(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Ohne localStorage keine Merker - die Sicherung selbst funktioniert trotzdem.
  }
}

function readDate(key: string): Date | null {
  const raw = readFlag(key);
  const date = raw ? new Date(raw) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

let state: DriveState = {
  status: readFlag(CONNECTED_KEY) ? 'connected' : 'unknown',
  lastBackup: readDate(LAST_DRIVE_BACKUP_KEY),
  busy: false,
  needsDecision: false,
  error: null,
};
const listeners = new Set<() => void>();

function setState(patch: Partial<DriveState>): void {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

export function subscribeDrive(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getDriveState(): DriveState {
  return state;
}

function isConnected(): boolean {
  return readFlag(CONNECTED_KEY) === '1';
}

// ---------------------------------------------------------------- Anmeldung

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.token;

  const response = await fetch('/api/google/token', { credentials: 'same-origin', cache: 'no-store' });
  // Ohne Server-Funktion (z.B. `npm run dev`) kommt hier die index.html zurück.
  if (!(response.headers.get('content-type') ?? '').includes('application/json')) {
    throw new DriveAuthError('not_configured');
  }
  const body = (await response.json()) as { accessToken?: string; expiresIn?: number; error?: string };
  if (response.status === 501) throw new DriveAuthError('not_configured');
  if (response.status === 401) throw new DriveAuthError(body.error === 'expired' ? 'expired' : 'disconnected');
  if (!response.ok || !body.accessToken) throw new Error(`Token-Fehler ${response.status}`);

  cachedToken = { token: body.accessToken, expiresAt: Date.now() + ((body.expiresIn ?? 3600) - 60) * 1000 };
  return body.accessToken;
}

/** Leitet zur Google-Anmeldung weiter (kommt mit ?drive=... zurück, siehe handleDriveOAuthReturn). */
export function connectDrive(): void {
  window.location.href = '/api/google/start';
}

export async function disconnectDrive(): Promise<void> {
  await fetch('/api/google/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => undefined);
  cachedToken = null;
  writeFlag(CONNECTED_KEY, null);
  writeFlag(LINKED_KEY, null);
  writeFlag(DIRTY_KEY, null);
  setState({ status: 'disconnected', needsDecision: false, error: null });
}

/**
 * Wertet den Rücksprung von der Google-Anmeldung aus (?drive=connected|error|not_configured)
 * und entfernt den Parameter wieder aus der Adresse. Gibt das Ergebnis zurück (oder null).
 */
export function handleDriveOAuthReturn(): string | null {
  const url = new URL(window.location.href);
  const result = url.searchParams.get('drive');
  if (!result) return null;
  url.searchParams.delete('drive');
  window.history.replaceState(null, '', url.pathname + url.search + url.hash);

  if (result === 'connected') {
    writeFlag(CONNECTED_KEY, '1');
    cachedToken = null;
    setState({ status: 'connected', error: null });
  } else if (result === 'not_configured') {
    setState({ status: 'not_configured' });
  } else {
    setState({ error: 'oauth' });
  }
  return result;
}

/** Prüft beim Server, ob Drive eingerichtet und verbunden ist. */
export async function refreshDriveStatus(): Promise<void> {
  try {
    await getAccessToken();
    writeFlag(CONNECTED_KEY, '1');
    setState({ status: 'connected' });
  } catch (err) {
    if (err instanceof DriveAuthError) {
      if (err.status !== 'expired') writeFlag(CONNECTED_KEY, null);
      setState({ status: err.status });
    } else {
      // Offline o.ä.: bekannten Zustand beibehalten.
      setState({ status: isConnected() ? 'connected' : 'disconnected' });
    }
  }
}

// ---------------------------------------------------------------- Drive-API

async function driveFetch(token: string, url: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } });
  if (response.status === 401) {
    cachedToken = null;
    throw new DriveAuthError('expired');
  }
  if (!response.ok) throw new Error(`Drive-Fehler ${response.status}`);
  return response;
}

async function ensureFolder(token: string): Promise<string> {
  const q = `mimeType='application/vnd.google-apps.folder' and name='${DRIVE_FOLDER_NAME}' and trashed=false`;
  const found = await driveFetch(token, `${DRIVE_API}/files?${new URLSearchParams({ q, fields: 'files(id)', spaces: 'drive' })}`);
  const { files } = (await found.json()) as { files: { id: string }[] };
  if (files.length > 0) return files[0].id;

  const created = await driveFetch(token, `${DRIVE_API}/files?fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: DRIVE_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
  });
  return ((await created.json()) as { id: string }).id;
}

async function listFiles(token: string, folderId: string): Promise<DriveBackupEntry[]> {
  const params = new URLSearchParams({
    q: `'${folderId}' in parents and name contains '${FILE_PREFIX}' and trashed=false`,
    orderBy: 'name desc',
    fields: 'files(id,name,modifiedTime,size)',
    pageSize: '100',
    spaces: 'drive',
  });
  const response = await driveFetch(token, `${DRIVE_API}/files?${params}`);
  return ((await response.json()) as { files: DriveBackupEntry[] }).files;
}

export function driveFileName(date: Date): string {
  // Lokales Datum, damit "heute" dem Kalender in der Küche entspricht.
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${FILE_PREFIX}${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`;
}

/** Dateien, die nach dem Behalten der neuesten `keep` Tagesdateien gelöscht werden sollen. */
export function filesToPrune(files: DriveBackupEntry[], keep = DRIVE_KEEP_FILES): DriveBackupEntry[] {
  return [...files].sort((a, b) => b.name.localeCompare(a.name)).slice(keep);
}

async function uploadBackup(token: string, folderId: string, files: DriveBackupEntry[], backup: BackupFile): Promise<void> {
  const name = driveFileName(new Date(backup.createdAt));
  const content = JSON.stringify(backup);
  const existing = files.find((f) => f.name === name);

  if (existing) {
    // Eine Datei pro Tag wird überschrieben; Drive hebt frühere Stände zusätzlich als Versionen auf.
    await driveFetch(token, `${DRIVE_UPLOAD}/files/${existing.id}?uploadType=media`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: content,
    });
  } else {
    const boundary = `speiseplan-${Date.now()}`;
    const metadata = JSON.stringify({ name, parents: [folderId], mimeType: 'application/json' });
    const body =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
      `--${boundary}\r\nContent-Type: application/json\r\n\r\n${content}\r\n--${boundary}--`;
    await driveFetch(token, `${DRIVE_UPLOAD}/files?uploadType=multipart&fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    });
  }

  const all = existing ? files : [{ id: '', name, modifiedTime: backup.createdAt }, ...files];
  for (const old of filesToPrune(all)) {
    if (old.id) await driveFetch(token, `${DRIVE_API}/files/${old.id}`, { method: 'DELETE' }).catch(() => undefined);
  }
}

async function isLocalDataEmpty(): Promise<boolean> {
  return (await db.plans.count()) === 0 && (await db.currentPlan.count()) === 0;
}

// ---------------------------------------------------------------- Sichern / Wiederherstellen

let running = false;

/**
 * Sichert alle Daten nach Google Drive. `auto` = automatisch ausgelöst: dann wird eine leere
 * App (z.B. frisch neu installiert) nie hochgeladen, und auf einem neuen Gerät nichts
 * überschrieben, solange der Nutzer nicht entschieden hat (wiederherstellen oder sichern).
 */
export async function backupToDrive({ auto }: { auto: boolean }): Promise<boolean> {
  if (running || !isConnected()) return false;
  if (auto && (await isLocalDataEmpty())) return false;

  running = true;
  setState({ busy: true, error: null });
  try {
    const token = await getAccessToken();
    const folderId = await ensureFolder(token);
    const files = await listFiles(token, folderId);
    if (auto && !readFlag(LINKED_KEY) && files.length > 0) {
      setState({ needsDecision: true });
      return false;
    }

    await uploadBackup(token, folderId, files, await createBackup());
    const now = new Date();
    writeFlag(LAST_DRIVE_BACKUP_KEY, now.toISOString());
    writeFlag(LINKED_KEY, '1');
    writeFlag(DIRTY_KEY, null);
    markBackupDone(now);
    setState({ status: 'connected', lastBackup: now, needsDecision: false });
    return true;
  } catch (err) {
    if (err instanceof DriveAuthError) {
      setState({ status: err.status });
    } else {
      // eslint-disable-next-line no-console
      console.error('Drive-Sicherung fehlgeschlagen', err);
      setState({ error: 'network' });
      if (auto) schedule(RETRY_MS);
    }
    return false;
  } finally {
    running = false;
    setState({ busy: false });
  }
}

export async function listDriveBackups(): Promise<DriveBackupEntry[]> {
  const token = await getAccessToken();
  return listFiles(token, await ensureFolder(token));
}

export async function restoreFromDrive(fileId: string): Promise<number> {
  const token = await getAccessToken();
  const response = await driveFetch(token, `${DRIVE_API}/files/${fileId}?alt=media`);
  const count = await restoreBackup(parseBackup(await response.text()));
  writeFlag(LINKED_KEY, '1');
  setState({ needsDecision: false });
  return count;
}

// ---------------------------------------------------------------- Automatik

let timer: number | undefined;

function schedule(delayMs: number): void {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    backupToDrive({ auto: true });
  }, delayMs);
}

function markDirty(): void {
  if (!isConnected()) return;
  writeFlag(DIRTY_KEY, '1');
  schedule(DEBOUNCE_MS);
}

let started = false;

/**
 * Startet die automatische Drive-Sicherung: jede Änderung an den gesicherten Tabellen löst
 * nach kurzer Ruhepause eine Sicherung aus; beim Start wird Liegengebliebenes nachgeholt
 * (ungesicherte Änderungen oder letzte Sicherung älter als 24 h).
 */
export function startDriveAutoBackup(): void {
  if (started) return;
  started = true;

  for (const name of BACKUP_TABLES) {
    const table = db.table(name);
    table.hook('creating', () => {
      markDirty();
    });
    table.hook('updating', () => {
      markDirty();
    });
    table.hook('deleting', () => {
      markDirty();
    });
  }

  document.addEventListener('visibilitychange', () => {
    // Beim Verlassen der App nicht auf die Ruhepause warten.
    if (document.visibilityState === 'hidden' && readFlag(DIRTY_KEY)) backupToDrive({ auto: true });
  });

  if (isConnected()) {
    const last = readDate(LAST_DRIVE_BACKUP_KEY);
    if (readFlag(DIRTY_KEY) || !last || Date.now() - last.getTime() > DAILY_MS) schedule(3000);
  }
}
