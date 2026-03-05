/**
 * Startup environment validation for Hayonero2.
 *
 * Call validateEnv() before initializing the bot to catch misconfigurations
 * early with actionable error messages.
 */

/** Known weak / default placeholder values to reject */
const WEAK_SECRETS = new Set([
  'changeme',
  'secret',
  'password',
  'your_secret_here',
  'your-secret-here',
  'example',
  'replace_me',
  'placeholder',
]);

/**
 * Estimates the character-set entropy class of a string.
 * Returns an approximate bits-per-char value.
 */
function detectCharsetSize(s: string): number {
  const hasLower = /[a-z]/.test(s);
  const hasUpper = /[A-Z]/.test(s);
  const hasDigit = /[0-9]/.test(s);
  const hasSymbol = /[^a-zA-Z0-9]/.test(s);
  let size = 0;
  if (hasLower) size += 26;
  if (hasUpper) size += 26;
  if (hasDigit) size += 10;
  if (hasSymbol) size += 32;
  return size;
}

function validateEncryptionSecret(): void {
  const secret = process.env.ENCRYPTION_SECRET;

  if (!secret) {
    throw new Error(
      '[Env] ENCRYPTION_SECRET is not set.\n' +
      '  → Generate a strong random secret (>= 32 chars) and set it in .env\n' +
      '  → Example: openssl rand -base64 48'
    );
  }

  if (secret.length < 32) {
    throw new Error(
      `[Env] ENCRYPTION_SECRET is too short (${secret.length} chars, minimum 32).\n` +
      '  → Use a longer secret: openssl rand -base64 48'
    );
  }

  const lower = secret.toLowerCase();
  if (WEAK_SECRETS.has(lower) || WEAK_SECRETS.has(lower.replace(/[^a-z]/g, ''))) {
    throw new Error(
      '[Env] ENCRYPTION_SECRET appears to be a placeholder or weak value.\n' +
      '  → Replace it with a cryptographically random secret.\n' +
      '  → Example: openssl rand -base64 48'
    );
  }

  // Entropy heuristic: require some character diversity
  const charsetSize = detectCharsetSize(secret);
  if (charsetSize < 36) {
    console.warn(
      '[Env] WARNING: ENCRYPTION_SECRET uses a limited character set.\n' +
      '  → For best security, use a mix of letters, digits and symbols.'
    );
  }

  // Check key version env var if present
  const kv = process.env.ENCRYPTION_KEY_VERSION;
  if (kv !== undefined) {
    const v = parseInt(kv, 10);
    if (isNaN(v) || v < 1) {
      throw new Error(
        `[Env] ENCRYPTION_KEY_VERSION must be a positive integer, got: "${kv}"`
      );
    }
    // Validate that old secret archives exist for versions < current
    for (let i = 1; i < v; i++) {
      const archiveKey = `ENCRYPTION_SECRET_V${i}`;
      if (!process.env[archiveKey]) {
        throw new Error(
          `[Env] ENCRYPTION_KEY_VERSION=${v} but ${archiveKey} is not set.\n` +
          `  → Set ${archiveKey} to the secret that was previously used as ENCRYPTION_SECRET.\n` +
          '  → This is required to decrypt records that were encrypted with older keys.'
        );
      }
    }
  }
}

function validateDiscordToken(): void {
  const token = process.env.DISCORD_TOKEN;
  if (!token) {
    throw new Error(
      '[Env] DISCORD_TOKEN is not set.\n' +
      '  → Get the bot token from https://discord.com/developers/applications'
    );
  }
  // Discord bot tokens have a recognisable base64 + HMAC structure
  if (token.length < 50) {
    console.warn(
      '[Env] WARNING: DISCORD_TOKEN looks unusually short. Verify it is correct.'
    );
  }
}

function validateOptionalVars(): void {
  const backupSchedule = process.env.BACKUP_SCHEDULE;
  if (backupSchedule) {
    // Basic cron expression check (5 or 6 fields)
    const parts = backupSchedule.trim().split(/\s+/);
    if (parts.length < 5 || parts.length > 6) {
      console.warn(
        `[Env] WARNING: BACKUP_SCHEDULE="${backupSchedule}" does not look like a valid cron expression.`
      );
    }
  }

  const retentionDays = process.env.BACKUP_RETENTION_DAYS;
  if (retentionDays !== undefined) {
    const n = parseInt(retentionDays, 10);
    if (isNaN(n) || n < 1) {
      console.warn(
        `[Env] WARNING: BACKUP_RETENTION_DAYS="${retentionDays}" is invalid; defaulting to 7.`
      );
    }
  }
}

/**
 * Validates all required and optional environment variables.
 * Throws an Error for critical misconfigurations; logs warnings for minor issues.
 * Call this at application startup before any other initialization.
 */
export function validateEnv(): void {
  validateDiscordToken();
  validateEncryptionSecret();
  validateOptionalVars();
  console.log('[Env] Environment validation passed ✅');
}
