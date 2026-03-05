import { ServerSettings } from '../types';
import { encrypt, decrypt, EncryptedPayload } from './crypto';
import { getPrismaClient } from './prisma-client';

export async function initDatabase(): Promise<void> {
  const prisma = getPrismaClient();
  // Verify DB connectivity; Prisma handles migrations via `prisma migrate`
  await prisma.$connect();
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
  throw new Error(
    'getSettings() is async in Prisma mode — use getSettingsAsync() instead'
  );
}

export async function getSettingsAsync(guildId: string): Promise<ServerSettings> {
  const prisma = getPrismaClient();
  const row = await prisma.serverSettings.findUnique({ where: { guildId } });

  if (!row) {
    return { guildId, ...DEFAULT_SETTINGS };
  }

  const payload: EncryptedPayload = {
    data: row.data,
    iv: row.iv,
    tag: row.tag,
  };

  const result = decrypt(guildId, payload);
  if (!Array.isArray(result.excludedUserIds)) {
    result.excludedUserIds = [];
  }
  return result;
}

export async function saveSettingsAsync(settings: ServerSettings): Promise<void> {
  const prisma = getPrismaClient();
  const payload = encrypt(settings.guildId, settings);

  await prisma.serverSettings.upsert({
    where: { guildId: settings.guildId },
    create: {
      guildId: settings.guildId,
      data: payload.data,
      iv: payload.iv,
      tag: payload.tag,
      keyVersion: 1,
      updatedAt: Math.floor(Date.now() / 1000),
    },
    update: {
      data: payload.data,
      iv: payload.iv,
      tag: payload.tag,
      keyVersion: 1,
      updatedAt: Math.floor(Date.now() / 1000),
    },
  });
}

export async function getAllGuildIdsAsync(): Promise<string[]> {
  const prisma = getPrismaClient();
  const rows = await prisma.serverSettings.findMany({ select: { guildId: true } });
  return rows.map((r: { guildId: string }) => r.guildId);
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
