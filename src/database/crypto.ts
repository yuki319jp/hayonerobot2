import crypto from 'crypto';
import { ServerSettings } from '../types';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16;

/**
 * Returns the current (active) key version from ENCRYPTION_KEY_VERSION env.
 * Defaults to 1 if not set.
 */
export function getCurrentKeyVersion(): number {
  const v = parseInt(process.env.ENCRYPTION_KEY_VERSION ?? '1', 10);
  if (isNaN(v) || v < 1) throw new Error('ENCRYPTION_KEY_VERSION must be a positive integer');
  return v;
}

/**
 * Retrieves the raw secret for a given key version.
 * - Current version: ENCRYPTION_SECRET
 * - Older versions:  ENCRYPTION_SECRET_V<n>  (archived when rotating)
 */
function getSecret(version: number): string {
  const currentVersion = getCurrentKeyVersion();
  const secret =
    version === currentVersion
      ? process.env.ENCRYPTION_SECRET
      : process.env[`ENCRYPTION_SECRET_V${version}`];

  if (!secret || secret.length < 32) {
    if (version === currentVersion) {
      throw new Error('ENCRYPTION_SECRET must be at least 32 characters');
    }
    throw new Error(
      `ENCRYPTION_SECRET_V${version} must be set (>=32 chars) for key rotation`
    );
  }
  return secret;
}

/**
 * Derives a per-guild encryption key using HKDF.
 * Supports versioned keys for key rotation.
 */
function deriveKey(guildId: string, keyVersion?: number): Buffer {
  const version = keyVersion ?? getCurrentKeyVersion();
  const secret = getSecret(version);
  const prk = crypto.createHmac('sha256', secret).update(guildId).digest();
  return Buffer.from(crypto.hkdfSync('sha256', prk, guildId, 'hayonero2-v1', KEY_LENGTH));
}

export interface EncryptedPayload {
  data: string;       // base64
  iv: string;         // base64
  tag: string;        // base64
  keyVersion: number; // key version used for encryption
}

export function encrypt(guildId: string, settings: ServerSettings): EncryptedPayload {
  const keyVersion = getCurrentKeyVersion();
  const key = deriveKey(guildId, keyVersion);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const json = JSON.stringify(settings);
  const encrypted = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    data: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    keyVersion,
  };
}

export function decrypt(guildId: string, payload: EncryptedPayload): ServerSettings {
  // Default to version 1 for records written before key versioning was added
  const version = payload.keyVersion ?? 1;
  const key = deriveKey(guildId, version);
  const iv = Buffer.from(payload.iv, 'base64');
  const tag = Buffer.from(payload.tag, 'base64');
  const data = Buffer.from(payload.data, 'base64');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8')) as ServerSettings;
}
