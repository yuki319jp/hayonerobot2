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
