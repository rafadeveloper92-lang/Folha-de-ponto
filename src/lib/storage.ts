import {Capacitor} from '@capacitor/core';
import {CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection} from '@capacitor-community/sqlite';
import {db, type UserProfile, type WorkEntry} from './db';

const DB_NAME = 'gsi_tracker';

let sqlite: SQLiteConnection | null = null;
let sqlConn: SQLiteDBConnection | null = null;
let useNativeSqlite = false;
let initPromise: Promise<void> | null = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS profile (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  hourly_rate REAL NOT NULL,
  signature TEXT NOT NULL,
  theme TEXT,
  default_project TEXT
);
CREATE TABLE IF NOT EXISTS entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  month_key TEXT NOT NULL,
  day INTEGER NOT NULL,
  project TEXT NOT NULL,
  description TEXT NOT NULL,
  hours TEXT NOT NULL,
  marked INTEGER NOT NULL DEFAULT 0,
  UNIQUE(month_key, day)
);
CREATE INDEX IF NOT EXISTS idx_entries_month ON entries(month_key);
`;

function isNative(): boolean {
  const p = Capacitor.getPlatform();
  return p === 'android' || p === 'ios';
}

async function migrateFromDexieIfNeeded(): Promise<void> {
  if (!sqlConn) return;
  const cntRes = await sqlConn.query('SELECT COUNT(*) AS c FROM entries', []);
  const entryCount = Number(
    (cntRes.values?.[0] as Record<string, unknown> | undefined)?.c ?? 0,
  );
  if (entryCount > 0) return;
  const profRes = await sqlConn.query(
    "SELECT 1 AS ok FROM profile WHERE id = 'current' LIMIT 1",
    [],
  );
  if ((profRes.values?.length ?? 0) > 0) return;

  const dexieEntries = await db.entries.toArray();
  const profile = await db.profile.get('current');
  if (!dexieEntries.length && !profile) return;

  if (profile) {
    await sqlConn.run(
      `INSERT OR REPLACE INTO profile (id, name, role, hourly_rate, signature, theme, default_project)
       VALUES (?,?,?,?,?,?,?)`,
      [
        profile.id,
        profile.name,
        profile.role,
        profile.hourlyRate,
        profile.signature ?? '',
        profile.theme ?? null,
        profile.defaultProject ?? null,
      ],
    );
  }
  for (const e of dexieEntries) {
    await sqlConn.run(
      `INSERT INTO entries (month_key, day, project, description, hours, marked) VALUES (?,?,?,?,?,?)`,
      [
        e.monthKey,
        e.day,
        e.project,
        e.description,
        e.hours,
        e.marked ? 1 : 0,
      ],
    );
  }
  await db.entries.clear();
  await db.profile.clear();
  try {
    await db.delete();
  } catch {
    /* ignore */
  }
}

function mapEntryRow(row: Record<string, unknown>): WorkEntry {
  return {
    id: typeof row.id === 'number' ? row.id : undefined,
    monthKey: String(row.month_key ?? row.monthKey ?? ''),
    day: Number(row.day),
    project: String(row.project ?? ''),
    description: String(row.description ?? ''),
    hours: String(row.hours ?? ''),
    marked: Boolean(row.marked === 1 || row.marked === true),
  };
}

async function openSqlite(): Promise<void> {
  sqlite = new SQLiteConnection(CapacitorSQLite);
  sqlConn = await sqlite.createConnection(DB_NAME, false, 'no-encryption', 1, false);
  await sqlConn.open();
  await sqlConn.execute(SCHEMA, false);
  await migrateFromDexieIfNeeded();
  useNativeSqlite = true;
}

export async function initStorage(): Promise<void> {
  if (!isNative()) {
    useNativeSqlite = false;
    return;
  }
  if (initPromise) return initPromise;
  initPromise = openSqlite().catch((err) => {
    initPromise = null;
    throw err;
  });
  return initPromise;
}

export function storageUsesNativeSqlite(): boolean {
  return useNativeSqlite;
}

export async function loadProfile(): Promise<UserProfile | undefined> {
  if (useNativeSqlite && sqlConn) {
    const res = await sqlConn.query(
      `SELECT id, name, role, hourly_rate AS hourlyRate, signature, theme, default_project AS defaultProject
       FROM profile WHERE id = 'current'`,
      [],
    );
    const row = res.values?.[0] as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return {
      id: 'current',
      name: String(row.name ?? ''),
      role: String(row.role ?? ''),
      hourlyRate: Number(
        row.hourlyRate ?? row.hourly_rate ?? 0,
      ),
      signature: String(row.signature ?? ''),
      theme: (row.theme as 'dark' | 'light') || undefined,
      defaultProject: row.defaultProject != null ? String(row.defaultProject) : undefined,
    };
  }
  return (await db.profile.get('current')) ?? undefined;
}

export async function loadEntriesForMonth(monthKey: string): Promise<WorkEntry[]> {
  if (useNativeSqlite && sqlConn) {
    const res = await sqlConn.query(
      'SELECT id, month_key, day, project, description, hours, marked FROM entries WHERE month_key = ? ORDER BY day',
      [monthKey],
    );
    const rows = (res.values ?? []) as Record<string, unknown>[];
    return rows.map(mapEntryRow);
  }
  return db.entries.where('monthKey').equals(monthKey).toArray();
}

export async function loadAllEntries(): Promise<WorkEntry[]> {
  if (useNativeSqlite && sqlConn) {
    const res = await sqlConn.query(
      'SELECT id, month_key, day, project, description, hours, marked FROM entries ORDER BY month_key, day',
      [],
    );
    const rows = (res.values ?? []) as Record<string, unknown>[];
    return rows.map(mapEntryRow);
  }
  return db.entries.toArray();
}

export async function saveProfile(p: UserProfile): Promise<void> {
  if (useNativeSqlite && sqlConn) {
    await sqlConn.run(
      `INSERT OR REPLACE INTO profile (id, name, role, hourly_rate, signature, theme, default_project)
       VALUES (?,?,?,?,?,?,?)`,
      [
        p.id,
        p.name,
        p.role,
        p.hourlyRate,
        p.signature ?? '',
        p.theme ?? null,
        p.defaultProject ?? null,
      ],
    );
    return;
  }
  await db.profile.put(p);
}

export async function replaceMonthEntries(monthKey: string, rows: WorkEntry[]): Promise<void> {
  if (useNativeSqlite && sqlConn) {
    await sqlConn.run('DELETE FROM entries WHERE month_key = ?', [monthKey]);
    for (const e of rows) {
      await sqlConn.run(
        `INSERT INTO entries (month_key, day, project, description, hours, marked) VALUES (?,?,?,?,?,?)`,
        [
          monthKey,
          e.day,
          e.project ?? '',
          e.description ?? '',
          e.hours ?? '',
          e.marked ? 1 : 0,
        ],
      );
    }
    return;
  }
  await db.entries.where('monthKey').equals(monthKey).delete();
  if (rows.length) await db.entries.bulkAdd(rows);
}

export async function deleteEntryDay(day: number, monthKey: string): Promise<void> {
  if (useNativeSqlite && sqlConn) {
    await sqlConn.run('DELETE FROM entries WHERE month_key = ? AND day = ?', [monthKey, day]);
    return;
  }
  await db.entries.where({day, monthKey}).delete();
}

export async function clearMonth(monthKey: string): Promise<void> {
  if (useNativeSqlite && sqlConn) {
    await sqlConn.run('DELETE FROM entries WHERE month_key = ?', [monthKey]);
    return;
  }
  await db.entries.where('monthKey').equals(monthKey).delete();
}

export async function clearAllData(): Promise<void> {
  if (useNativeSqlite && sqlConn) {
    await sqlConn.execute('DELETE FROM entries;', true);
    await sqlConn.execute('DELETE FROM profile;', true);
    return;
  }
  await db.profile.clear();
  await db.entries.clear();
}

export async function restoreData(profile: UserProfile | undefined, entries: WorkEntry[]): Promise<void> {
  if (useNativeSqlite && sqlConn) {
    await sqlConn.execute('DELETE FROM entries;', true);
    await sqlConn.execute('DELETE FROM profile;', true);
    if (profile) {
      await sqlConn.run(
        `INSERT OR REPLACE INTO profile (id, name, role, hourly_rate, signature, theme, default_project)
         VALUES (?,?,?,?,?,?,?)`,
        [
          profile.id,
          profile.name,
          profile.role,
          profile.hourlyRate,
          profile.signature ?? '',
          profile.theme ?? null,
          profile.defaultProject ?? null,
        ],
      );
    }
    for (const e of entries) {
      await sqlConn.run(
        `INSERT INTO entries (month_key, day, project, description, hours, marked) VALUES (?,?,?,?,?,?)`,
        [
          e.monthKey,
          e.day,
          e.project,
          e.description,
          e.hours,
          e.marked ? 1 : 0,
        ],
      );
    }
    return;
  }
  await db.profile.clear();
  await db.entries.clear();
  if (profile) await db.profile.put(profile);
  if (entries.length) await db.entries.bulkAdd(entries);
}
