import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { ServerSettings } from '../types';
import { encrypt, decrypt, EncryptedPayload } from './crypto';

const DB_PATH = path.join(process.cwd(), 'data', 'hayonero2.db');

let db: Database.Database;

export function initDatabase(): void {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS server_settings (
      guild_id TEXT PRIMARY KEY,
      data     TEXT NOT NULL,
      iv       TEXT NOT NULL,
      tag      TEXT NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);
}

export function getDb(): Database.Database {
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
};

export function getSettings(guildId: string): ServerSettings {
  const db = getDb();
  const row = db
    .prepare('SELECT data, iv, tag FROM server_settings WHERE guild_id = ?')
    .get(guildId) as { data: string; iv: string; tag: string } | undefined;

  if (!row) {
    return { guildId, ...DEFAULT_SETTINGS };
  }

  return decrypt(guildId, row as EncryptedPayload);
}

export function saveSettings(settings: ServerSettings): void {
  const db = getDb();
  const payload = encrypt(settings.guildId, settings);
  db.prepare(`
    INSERT INTO server_settings (guild_id, data, iv, tag, updated_at)
    VALUES (?, ?, ?, ?, unixepoch())
    ON CONFLICT(guild_id) DO UPDATE SET
      data = excluded.data,
      iv   = excluded.iv,
      tag  = excluded.tag,
      updated_at = excluded.updated_at
  `).run(settings.guildId, payload.data, payload.iv, payload.tag);
}

export function getAllGuildIds(): string[] {
  const db = getDb();
  return (
    db.prepare('SELECT guild_id FROM server_settings').all() as { guild_id: string }[]
  ).map((r) => r.guild_id);
}
