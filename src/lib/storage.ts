import {Capacitor} from '@capacitor/core';
import {CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection} from '@capacitor-community/sqlite';
import {db, type InAppMessage, type UserProfile, type WorkEntry} from './db';

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
  default_project TEXT,
  profile_photo TEXT,
  onboarding_complete INTEGER DEFAULT 0,
  role_locked INTEGER DEFAULT 0,
  employee_pdf_base64 TEXT,
  employee_code TEXT,
  qr_data_url TEXT
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
CREATE TABLE IF NOT EXISTS app_messages (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  read INTEGER NOT NULL DEFAULT 0,
  source TEXT
);
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
      `INSERT OR REPLACE INTO profile (id, name, role, hourly_rate, signature, theme, default_project, profile_photo,
       onboarding_complete, role_locked, employee_pdf_base64, employee_code, qr_data_url)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        profile.id,
        profile.name,
        profile.role,
        profile.hourlyRate,
        profile.signature ?? '',
        profile.theme ?? null,
        profile.defaultProject ?? null,
        profile.profilePhoto ?? null,
        profile.onboardingComplete ? 1 : 0,
        profile.roleLocked ? 1 : 0,
        profile.employeePdfBase64 ?? null,
        profile.employeeCode ?? null,
        profile.qrDataUrl ?? null,
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
  try {
    const dexieMsgs = await db.appMessages.toArray();
    for (const m of dexieMsgs) {
      await sqlConn.run(
        `INSERT OR REPLACE INTO app_messages (id, title, body, created_at, read, source) VALUES (?,?,?,?,?,?)`,
        [m.id, m.title, m.body, m.createdAt, m.read ? 1 : 0, m.source ?? null],
      );
    }
    if (dexieMsgs.length) await db.appMessages.clear();
  } catch {
    /* tabela app_messages pode não existir em Dexie antigo */
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
  const alters = [
    'ALTER TABLE profile ADD COLUMN profile_photo TEXT;',
    'ALTER TABLE profile ADD COLUMN onboarding_complete INTEGER DEFAULT 0;',
    'ALTER TABLE profile ADD COLUMN role_locked INTEGER DEFAULT 0;',
    'ALTER TABLE profile ADD COLUMN employee_pdf_base64 TEXT;',
    'ALTER TABLE profile ADD COLUMN employee_code TEXT;',
    'ALTER TABLE profile ADD COLUMN qr_data_url TEXT;',
  ];
  for (const sql of alters) {
    try {
      await sqlConn.execute(sql, false);
    } catch {
      /* coluna já existe */
    }
  }
  await migrateFromDexieIfNeeded();
  await migrateMessagesFromDexieIfNeeded();
  useNativeSqlite = true;
}

async function migrateMessagesFromDexieIfNeeded(): Promise<void> {
  if (!sqlConn) return;
  const res = await sqlConn.query('SELECT COUNT(*) AS c FROM app_messages', []);
  const c = Number((res.values?.[0] as Record<string, unknown> | undefined)?.c ?? 0);
  if (c > 0) return;
  try {
    const fromDexie = await db.appMessages.toArray();
    for (const m of fromDexie) {
      await sqlConn.run(
        `INSERT OR REPLACE INTO app_messages (id, title, body, created_at, read, source) VALUES (?,?,?,?,?,?)`,
        [m.id, m.title, m.body, m.createdAt, m.read ? 1 : 0, m.source ?? null],
      );
    }
    if (fromDexie.length) await db.appMessages.clear();
  } catch {
    /* Dexie já removido ou sem tabela */
  }
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
      `SELECT id, name, role, hourly_rate AS hourlyRate, signature, theme, default_project AS defaultProject,
              profile_photo AS profilePhoto, onboarding_complete AS onboardingComplete, role_locked AS roleLocked,
              employee_pdf_base64 AS employeePdfBase64, employee_code AS employeeCode, qr_data_url AS qrDataUrl
       FROM profile WHERE id = 'current'`,
      [],
    );
    const row = res.values?.[0] as Record<string, unknown> | undefined;
    if (!row) return undefined;
    const hr = Number(row.hourlyRate ?? row.hourly_rate ?? 0);
    const ocRaw = row.onboardingComplete ?? row.onboarding_complete;
    const onboardingComplete =
      ocRaw != null ? Number(ocRaw) === 1 : false;
    return {
      id: 'current',
      name: String(row.name ?? ''),
      role: String(row.role ?? ''),
      hourlyRate: hr,
      signature: String(row.signature ?? ''),
      theme: (row.theme as 'dark' | 'light') || undefined,
      defaultProject: row.defaultProject != null ? String(row.defaultProject) : undefined,
      profilePhoto:
        row.profilePhoto != null && String(row.profilePhoto).length > 0
          ? String(row.profilePhoto)
          : undefined,
      onboardingComplete,
      roleLocked: Number(row.roleLocked ?? row.role_locked) === 1,
      employeePdfBase64:
        row.employeePdfBase64 != null && String(row.employeePdfBase64).length > 0
          ? String(row.employeePdfBase64)
          : undefined,
      employeeCode:
        row.employeeCode != null && String(row.employeeCode).length > 0
          ? String(row.employeeCode)
          : undefined,
      qrDataUrl:
        row.qrDataUrl != null && String(row.qrDataUrl).length > 0
          ? String(row.qrDataUrl)
          : undefined,
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
      `INSERT OR REPLACE INTO profile (id, name, role, hourly_rate, signature, theme, default_project, profile_photo,
       onboarding_complete, role_locked, employee_pdf_base64, employee_code, qr_data_url)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        p.id,
        p.name,
        p.role,
        p.hourlyRate,
        p.signature ?? '',
        p.theme ?? null,
        p.defaultProject ?? null,
        p.profilePhoto ?? null,
        p.onboardingComplete ? 1 : 0,
        p.roleLocked ? 1 : 0,
        p.employeePdfBase64 ?? null,
        p.employeeCode ?? null,
        p.qrDataUrl ?? null,
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
    await sqlConn.execute('DELETE FROM app_messages;', true);
    return;
  }
  await db.profile.clear();
  await db.entries.clear();
  await db.appMessages.clear();
}

export async function restoreData(
  profile: UserProfile | undefined,
  entries: WorkEntry[],
  messages?: InAppMessage[],
): Promise<void> {
  if (useNativeSqlite && sqlConn) {
    await sqlConn.execute('DELETE FROM entries;', true);
    await sqlConn.execute('DELETE FROM profile;', true);
    await sqlConn.execute('DELETE FROM app_messages;', true);
    if (profile) {
      await sqlConn.run(
        `INSERT OR REPLACE INTO profile (id, name, role, hourly_rate, signature, theme, default_project, profile_photo,
         onboarding_complete, role_locked, employee_pdf_base64, employee_code, qr_data_url)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          profile.id,
          profile.name,
          profile.role,
          profile.hourlyRate,
          profile.signature ?? '',
          profile.theme ?? null,
          profile.defaultProject ?? null,
          profile.profilePhoto ?? null,
          profile.onboardingComplete ? 1 : 0,
          profile.roleLocked ? 1 : 0,
          profile.employeePdfBase64 ?? null,
          profile.employeeCode ?? null,
          profile.qrDataUrl ?? null,
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
    if (messages?.length) {
      for (const m of messages) {
        await sqlConn.run(
          `INSERT OR REPLACE INTO app_messages (id, title, body, created_at, read, source) VALUES (?,?,?,?,?,?)`,
          [m.id, m.title, m.body, m.createdAt, m.read ? 1 : 0, m.source ?? null],
        );
      }
    }
    return;
  }
  await db.profile.clear();
  await db.entries.clear();
  await db.appMessages.clear();
  if (profile) await db.profile.put(profile);
  if (entries.length) await db.entries.bulkAdd(entries);
  if (messages?.length) await db.appMessages.bulkPut(messages);
}

function mapMessageRow(row: Record<string, unknown>): InAppMessage {
  return {
    id: String(row.id ?? ''),
    title: String(row.title ?? ''),
    body: String(row.body ?? ''),
    createdAt: Number(row.created_at ?? row.createdAt ?? 0),
    read: Boolean(row.read === 1 || row.read === true),
    source:
      row.source != null && String(row.source).length > 0
        ? (String(row.source) as InAppMessage['source'])
        : undefined,
  };
}

export async function loadAllMessages(): Promise<InAppMessage[]> {
  if (useNativeSqlite && sqlConn) {
    const res = await sqlConn.query(
      'SELECT id, title, body, created_at, read, source FROM app_messages ORDER BY created_at DESC',
      [],
    );
    const rows = (res.values ?? []) as Record<string, unknown>[];
    return rows.map(mapMessageRow);
  }
  return db.appMessages.orderBy('createdAt').reverse().toArray();
}

export async function saveMessage(m: InAppMessage): Promise<void> {
  if (useNativeSqlite && sqlConn) {
    await sqlConn.run(
      `INSERT OR REPLACE INTO app_messages (id, title, body, created_at, read, source) VALUES (?,?,?,?,?,?)`,
      [m.id, m.title, m.body, m.createdAt, m.read ? 1 : 0, m.source ?? null],
    );
    return;
  }
  await db.appMessages.put(m);
}

export async function getMessage(id: string): Promise<InAppMessage | undefined> {
  if (useNativeSqlite && sqlConn) {
    const res = await sqlConn.query(
      'SELECT id, title, body, created_at, read, source FROM app_messages WHERE id = ? LIMIT 1',
      [id],
    );
    const row = res.values?.[0] as Record<string, unknown> | undefined;
    return row ? mapMessageRow(row) : undefined;
  }
  return db.appMessages.get(id);
}

export async function deleteMessage(id: string): Promise<void> {
  if (useNativeSqlite && sqlConn) {
    await sqlConn.run('DELETE FROM app_messages WHERE id = ?', [id]);
    return;
  }
  await db.appMessages.delete(id);
}

export async function markMessageRead(id: string, read: boolean): Promise<void> {
  if (useNativeSqlite && sqlConn) {
    await sqlConn.run('UPDATE app_messages SET read = ? WHERE id = ?', [read ? 1 : 0, id]);
    return;
  }
  const row = await db.appMessages.get(id);
  if (row) await db.appMessages.put({...row, read});
}

export async function markAllMessagesRead(): Promise<void> {
  if (useNativeSqlite && sqlConn) {
    await sqlConn.run('UPDATE app_messages SET read = 1', []);
    return;
  }
  await db.appMessages.toCollection().modify({read: true});
}

/** Evita duplicados ao sincronizar (mesmo id). */
export async function upsertMessages(rows: InAppMessage[]): Promise<void> {
  for (const m of rows) {
    await saveMessage(m);
  }
}
