import { describe, expect, it } from 'vitest';
import { isBackupDue, parseBackup } from './backup';

describe('parseBackup', () => {
  it('accepts a speiseplan backup with known tables', () => {
    const json = JSON.stringify({ app: 'speiseplan-backup', formatVersion: 1, createdAt: '', tables: { plans: [] } });
    expect(parseBackup(json).tables.plans).toEqual([]);
  });

  it('rejects foreign JSON, unknown tables and broken files', () => {
    expect(() => parseBackup('[]')).toThrow();
    expect(() => parseBackup('{nope')).toThrow();
    expect(() => parseBackup(JSON.stringify({ app: 'speiseplan-backup', tables: { secrets: [] } }))).toThrow();
    expect(() => parseBackup(JSON.stringify({ app: 'speiseplan-backup', tables: { plans: {} } }))).toThrow();
  });
});

describe('isBackupDue', () => {
  const now = new Date('2026-10-28T12:00:00Z');
  it('is due without any backup or after 7 days', () => {
    expect(isBackupDue(null, now)).toBe(true);
    expect(isBackupDue(new Date('2026-10-20T12:00:00Z'), now)).toBe(true);
  });
  it('is not due right after a backup', () => {
    expect(isBackupDue(new Date('2026-10-27T12:00:00Z'), now)).toBe(false);
  });
});
