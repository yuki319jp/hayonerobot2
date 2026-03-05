import crypto from 'crypto';
import { ServerSettings } from '../types';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16;

/**
 * Derives a per-guild encryption key using HKDF.
 * The key is derived from both ENCRYPTION_SECRET (env-only) and guildId,
 * so the database is unreadable without the secret.
 */
function deriveKey(guildId: string): Buffer {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('ENCRYPTION_SECRET must be at least 32 characters');
  }
  // HKDF-SHA256: extract + expand
  const prk = crypto.createHmac('sha256', secret).update(guildId).digest();
  return Buffer.from(crypto.hkdfSync('sha256', prk, guildId, 'hayonero2-v1', KEY_LENGTH));
}

export interface EncryptedPayload {
  data: string; // base64
  iv: string;   // base64
  tag: string;  // base64
}

export function encrypt(guildId: string, settings: ServerSettings): EncryptedPayload {
  const key = deriveKey(guildId);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const json = JSON.stringify(settings);
  const encrypted = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    data: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  };
}

export function decrypt(guildId: string, payload: EncryptedPayload): ServerSettings {
  const key = deriveKey(guildId);
  const iv = Buffer.from(payload.iv, 'base64');
  const tag = Buffer.from(payload.tag, 'base64');
  const data = Buffer.from(payload.data, 'base64');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8')) as ServerSettings;
}

/** Encrypts a plain-text message string for a guild. */
export function encryptMessage(guildId: string, message: string): EncryptedPayload {
  const key = deriveKey(guildId);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(message, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    data: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  };
}

/**
 * Decrypts a per-schedule message string.
 * Returns null (and logs an error) if decryption fails to avoid plaintext exposure.
 */
export function decryptMessage(guildId: string, payload: EncryptedPayload): string | null {
  try {
    const key = deriveKey(guildId);
    const iv = Buffer.from(payload.iv, 'base64');
    const tag = Buffer.from(payload.tag, 'base64');
    const data = Buffer.from(payload.data, 'base64');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err) {
    console.error(`[Crypto] Failed to decrypt message for guild ${guildId}:`, err);
    return null;
  }
}
