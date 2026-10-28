import { beforeEach, describe, expect, it, vi } from 'vitest';

const { counts } = vi.hoisted(() => ({ counts: { plans: 1, currentPlan: 1 } }));

vi.mock('./storage', () => ({
  db: {
    plans: { count: async () => counts.plans },
    currentPlan: { count: async () => counts.currentPlan },
    table: () => ({ hook: () => undefined }),
  },
}));
vi.mock('./backup', () => ({
  BACKUP_TABLES: [],
  createBackup: async () => ({ app: 'speiseplan-backup', formatVersion: 1, createdAt: '2026-10-28T10:00:00.000Z', tables: {} }),
  markBackupDone: () => undefined,
  parseBackup: (json: string) => JSON.parse(json),
  restoreBackup: async () => 3,
}));

const store = new Map<string, string>();
vi.stubGlobal('window', {
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
  },
  setTimeout: () => 0,
  clearTimeout: () => undefined,
});

import { backupToDrive, driveFileName, filesToPrune, getDriveState } from './driveBackup';

type Call = { url: string; method: string };
let calls: Call[];
let remoteFiles: { id: string; name: string; modifiedTime: string }[];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

beforeEach(() => {
  store.clear();
  store.set('speiseplan-drive-connected', '1');
  counts.plans = 1;
  counts.currentPlan = 1;
  calls = [];
  remoteFiles = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const method = init.method ?? 'GET';
      calls.push({ url, method });
      if (url.startsWith('/api/google/token')) return jsonResponse({ accessToken: 'tok', expiresIn: 3600 });
      if (url.includes('vnd.google-apps.folder')) return jsonResponse({ files: [{ id: 'folder1' }] });
      if (url.includes('/drive/v3/files?') && method === 'GET') return jsonResponse({ files: remoteFiles });
      return jsonResponse({ id: 'new' });
    }),
  );
});

describe('driveFileName / filesToPrune', () => {
  it('uses one file per local day', () => {
    expect(driveFileName(new Date(2026, 9, 5, 23, 30))).toBe('speiseplan-sicherung-2026-10-05.json');
  });

  it('keeps only the newest files', () => {
    const files = ['03', '01', '02'].map((d) => ({ id: d, name: `speiseplan-sicherung-2026-10-${d}.json`, modifiedTime: '' }));
    expect(filesToPrune(files, 2).map((f) => f.id)).toEqual(['01']);
  });
});

describe('backupToDrive', () => {
  it('never auto-uploads an empty app (e.g. right after reinstalling)', async () => {
    counts.plans = 0;
    counts.currentPlan = 0;
    expect(await backupToDrive({ auto: true })).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it('does not auto-overwrite existing Drive backups from a new device', async () => {
    remoteFiles = [{ id: 'old', name: 'speiseplan-sicherung-2026-10-01.json', modifiedTime: '' }];
    expect(await backupToDrive({ auto: true })).toBe(false);
    expect(getDriveState().needsDecision).toBe(true);
    expect(calls.some((c) => c.url.includes('/upload/'))).toBe(false);
  });

  it('uploads when the user decides, and auto-backups afterwards', async () => {
    remoteFiles = [{ id: 'old', name: 'speiseplan-sicherung-2026-10-01.json', modifiedTime: '' }];
    expect(await backupToDrive({ auto: false })).toBe(true);
    expect(calls.some((c) => c.url.includes('/upload/drive/v3/files?uploadType=multipart') && c.method === 'POST')).toBe(true);
    expect(await backupToDrive({ auto: true })).toBe(true);
  });

  it('overwrites the file of the same day instead of creating a second one', async () => {
    store.set('speiseplan-drive-linked', '1');
    remoteFiles = [{ id: 'today', name: driveFileName(new Date('2026-10-28T10:00:00.000Z')), modifiedTime: '' }];
    await backupToDrive({ auto: true });
    expect(calls.some((c) => c.url.includes('/upload/drive/v3/files/today') && c.method === 'PATCH')).toBe(true);
  });

  it('marks the connection as expired when the server says so', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: 'expired' }, 401)));
    expect(await backupToDrive({ auto: false })).toBe(false);
    expect(getDriveState().status).toBe('expired');
  });
});
