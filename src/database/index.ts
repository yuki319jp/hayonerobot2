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
