import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import path from 'path';
import fs from 'fs';
import { ServerSettings } from '../types';
import { encrypt, decrypt, getCurrentKeyVersion, EncryptedPayload } from './crypto';

const DB_PATH = path.join(process.cwd(), 'data', 'hayonero2.db');

let db: SqlJsDatabase;

export async function initDatabase(): Promise<void> {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const SQL = await initSqlJs();
  
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS server_settings (
      guild_id    TEXT PRIMARY KEY,
      data        TEXT NOT NULL,
      iv          TEXT NOT NULL,
      tag         TEXT NOT NULL,
      key_version INTEGER NOT NULL DEFAULT 1,
      updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);

  // Migration: add key_version column to existing DBs that don't have it
  try {
    db.run('ALTER TABLE server_settings ADD COLUMN key_version INTEGER NOT NULL DEFAULT 1');
  } catch (_) {
    // Column already exists — safe to ignore
  }
  
  saveDatabase();
}

function saveDatabase(): void {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

export function getDb(): SqlJsDatabase {
  if (!db) throw new Error('Database not initialized');
  return db;
}

export const DEFAULT_SETTINGS: Omit<ServerSettings, 'guildId'> = {
  language: 'ja',
  enabled: false,
  channelId: null,
  mentionEnabled: false,
  mentionTarget: null,
  excludedUserIds: [],
  warnHour: 0,
  warnMinute: 0,
  customMessage: null,
  allowedRoleId: null,
};

export function getSettings(guildId: string): ServerSettings {
  const db = getDb();
  const stmt = db.prepare('SELECT data, iv, tag, key_version FROM server_settings WHERE guild_id = ?');
  stmt.bind([guildId]);
  
  if (stmt.step()) {
    const row = stmt.getAsObject() as { data: string; iv: string; tag: string; key_version: number };
    stmt.free();
    const storedVersion = row.key_version ?? 1;
    const payload: EncryptedPayload = {
      data: row.data,
      iv: row.iv,
      tag: row.tag,
      keyVersion: storedVersion,
    };
    const result = decrypt(guildId, payload);
    // backward compatibility: ensure excludedUserIds is always an array
    if (!Array.isArray(result.excludedUserIds)) {
      result.excludedUserIds = [];
    }
    // Lazy key rotation: re-encrypt if stored key version is outdated
    const currentVersion = getCurrentKeyVersion();
    if (storedVersion < currentVersion) {
      console.log(`[KeyRotation] Lazy-rotating guild ${guildId}: v${storedVersion} → v${currentVersion}`);
      saveSettings(result);
    }
    return result;
  }
  
  stmt.free();
  return { guildId, ...DEFAULT_SETTINGS };
}

export function saveSettings(settings: ServerSettings): void {
  const db = getDb();
  const payload = encrypt(settings.guildId, settings);
  db.run(`
    INSERT INTO server_settings (guild_id, data, iv, tag, key_version, updated_at)
    VALUES (?, ?, ?, ?, ?, unixepoch())
    ON CONFLICT(guild_id) DO UPDATE SET
      data        = excluded.data,
      iv          = excluded.iv,
      tag         = excluded.tag,
      key_version = excluded.key_version,
      updated_at  = excluded.updated_at
  `, [settings.guildId, payload.data, payload.iv, payload.tag, payload.keyVersion]);
  saveDatabase();
}

export function getAllGuildIds(): string[] {
  const db = getDb();
  const stmt = db.prepare('SELECT guild_id FROM server_settings');
  const result: string[] = [];
  
  while (stmt.step()) {
    const row = stmt.getAsObject() as { guild_id: string };
    result.push(row.guild_id);
  }
  
  stmt.free();
  return result;
}

// ─── Schedules CRUD ──────────────────────────────────────────────────────────

function rowToSchedule(guildId: string, row: Record<string, unknown>): Schedule {
  let customMessage: string | null = null;
  if (row.msg_data && row.msg_iv && row.msg_tag) {
    customMessage = decryptMessage(guildId, {
      data: row.msg_data as string,
      iv: row.msg_iv as string,
      tag: row.msg_tag as string,
    });
    // decryptMessage returns null on failure → falls back to guild-level message
  }
  return {
    id: row.id as number,
    guildId,
    hour: row.hour as number,
    minute: row.minute as number,
    customMessage,
    enabled: (row.enabled as number) === 1,
  };
}

export function getSchedules(guildId: string): Schedule[] {
  const db = getDb();
  const stmt = db.prepare(
    'SELECT id, hour, minute, msg_data, msg_iv, msg_tag, enabled FROM schedules WHERE guild_id = ? ORDER BY hour, minute'
  );
  stmt.bind([guildId]);
  const result: Schedule[] = [];
  while (stmt.step()) {
    result.push(rowToSchedule(guildId, stmt.getAsObject() as Record<string, unknown>));
  }
  stmt.free();
  return result;
}

export function getScheduleById(id: number, guildId: string): Schedule | null {
  const db = getDb();
  const stmt = db.prepare(
    'SELECT id, hour, minute, msg_data, msg_iv, msg_tag, enabled FROM schedules WHERE id = ? AND guild_id = ?'
  );
  stmt.bind([id, guildId]);
  if (stmt.step()) {
    const s = rowToSchedule(guildId, stmt.getAsObject() as Record<string, unknown>);
    stmt.free();
    return s;
  }
  stmt.free();
  return null;
}

/**
 * Creates or updates a schedule for the given guild/time.
 * If message is undefined, the existing custom_message is preserved.
 * If message is null, it clears the custom_message.
 * If message is a string, it is encrypted and stored.
 */
export function upsertSchedule(
  guildId: string,
  hour: number,
  minute: number,
  message?: string | null
): Schedule {
  const db = getDb();

  let msgData: string | null = null;
  let msgIv: string | null = null;
  let msgTag: string | null = null;

  if (message === null) {
    // Explicitly clear message — keep nulls
  } else if (typeof message === 'string') {
    const payload = encryptMessage(guildId, message);
    msgData = payload.data;
    msgIv = payload.iv;
    msgTag = payload.tag;
  }

  if (message !== undefined) {
    db.run(
      `INSERT INTO schedules (guild_id, hour, minute, msg_data, msg_iv, msg_tag)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(guild_id, hour, minute) DO UPDATE SET
         msg_data = excluded.msg_data,
         msg_iv   = excluded.msg_iv,
         msg_tag  = excluded.msg_tag`,
      [guildId, hour, minute, msgData, msgIv, msgTag]
    );
  } else {
    // Insert only; don't overwrite message if row exists
    db.run(
      `INSERT OR IGNORE INTO schedules (guild_id, hour, minute) VALUES (?, ?, ?)`,
      [guildId, hour, minute]
    );
  }

  saveDatabase();

  // Return the saved record
  const stmt = db.prepare(
    'SELECT id, hour, minute, msg_data, msg_iv, msg_tag, enabled FROM schedules WHERE guild_id = ? AND hour = ? AND minute = ?'
  );
  stmt.bind([guildId, hour, minute]);
  stmt.step();
  const s = rowToSchedule(guildId, stmt.getAsObject() as Record<string, unknown>);
  stmt.free();
  return s;
}

export function setScheduleMessage(id: number, guildId: string, message: string | null): void {
  const db = getDb();
  if (message === null) {
    db.run(
      'UPDATE schedules SET msg_data = NULL, msg_iv = NULL, msg_tag = NULL WHERE id = ? AND guild_id = ?',
      [id, guildId]
    );
  } else {
    const payload = encryptMessage(guildId, message);
    db.run(
      'UPDATE schedules SET msg_data = ?, msg_iv = ?, msg_tag = ? WHERE id = ? AND guild_id = ?',
      [payload.data, payload.iv, payload.tag, id, guildId]
    );
  }
  saveDatabase();
}

export function deleteSchedule(id: number, guildId: string): void {
  const db = getDb();
  db.run('DELETE FROM schedules WHERE id = ? AND guild_id = ?', [id, guildId]);
  saveDatabase();
}

export function deleteAllSchedules(guildId: string): void {
  const db = getDb();
  db.run('DELETE FROM schedules WHERE guild_id = ?', [guildId]);
  saveDatabase();
}

/**
 * One-time migration: for each guild already in server_settings,
 * if no schedules exist, create one from the stored warnHour/warnMinute.
 */
function migrateSchedules(): void {
  const guildIds = getAllGuildIds();
  for (const guildId of guildIds) {
    try {
      const countStmt = db.prepare('SELECT COUNT(*) AS cnt FROM schedules WHERE guild_id = ?');
      countStmt.bind([guildId]);
      countStmt.step();
      const cnt = (countStmt.getAsObject() as { cnt: number }).cnt;
      countStmt.free();
      if (cnt > 0) continue; // already has schedules

      const settings = getSettings(guildId);
      if (!settings.enabled && settings.warnHour === 0 && settings.warnMinute === 0) continue;
      db.run(
        'INSERT OR IGNORE INTO schedules (guild_id, hour, minute) VALUES (?, ?, ?)',
        [guildId, settings.warnHour, settings.warnMinute]
      );
      console.log(`[DB] Migrated schedule for guild ${guildId}: ${settings.warnHour}:${String(settings.warnMinute).padStart(2, '0')}`);
    } catch (err) {
      console.error(`[DB] Migration failed for guild ${guildId}:`, err);
    }
  }
}
