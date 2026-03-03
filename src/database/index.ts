import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import path from 'path';
import fs from 'fs';
import { ServerSettings } from '../types';
import { encrypt, decrypt, EncryptedPayload } from './crypto';

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
      guild_id TEXT PRIMARY KEY,
      data     TEXT NOT NULL,
      iv       TEXT NOT NULL,
      tag      TEXT NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);
  
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
  warnHour: 0,
  warnMinute: 0,
  customMessage: null,
  allowedRoleId: null,
};

export function getSettings(guildId: string): ServerSettings {
  const db = getDb();
  const stmt = db.prepare('SELECT data, iv, tag FROM server_settings WHERE guild_id = ?');
  stmt.bind([guildId]);
  
  if (stmt.step()) {
    const row = stmt.getAsObject() as { data: string; iv: string; tag: string };
    stmt.free();
    return decrypt(guildId, row as EncryptedPayload);
  }
  
  stmt.free();
  return { guildId, ...DEFAULT_SETTINGS };
}

export function saveSettings(settings: ServerSettings): void {
  const db = getDb();
  const payload = encrypt(settings.guildId, settings);
  db.run(`
    INSERT INTO server_settings (guild_id, data, iv, tag, updated_at)
    VALUES (?, ?, ?, ?, unixepoch())
    ON CONFLICT(guild_id) DO UPDATE SET
      data = excluded.data,
      iv   = excluded.iv,
      tag  = excluded.tag,
      updated_at = excluded.updated_at
  `, [settings.guildId, payload.data, payload.iv, payload.tag]);
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
