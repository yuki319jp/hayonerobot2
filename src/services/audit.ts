/**
 * Structured audit logging for Hayonero2.
 *
 * Records security- and operations-relevant events to console (always)
 * and optionally to a JSON Lines file (AUDIT_LOG_FILE env var).
 *
 * Log entries include: timestamp, action, guildId (if applicable), actor,
 * and optional detail payload.
 */

import fs from 'fs';
import path from 'path';

// ---------------------------------------------------------------------------
// Action catalogue
// ---------------------------------------------------------------------------

export const AuditAction = {
  // Settings
  SETTINGS_SAVE:         'SETTINGS_SAVE',
  SETTINGS_READ:         'SETTINGS_READ',
  // Schedule
  SCHEDULE_ENABLE:       'SCHEDULE_ENABLE',
  SCHEDULE_DISABLE:      'SCHEDULE_DISABLE',
  SCHEDULE_DELETE:       'SCHEDULE_DELETE',
  // Mention / Exclusion
  EXCLUDE_ADD:           'EXCLUDE_ADD',
  EXCLUDE_REMOVE:        'EXCLUDE_REMOVE',
  // Backup
  BACKUP_CREATE:         'BACKUP_CREATE',
  BACKUP_RESTORE:        'BACKUP_RESTORE',
  BACKUP_PRUNE:          'BACKUP_PRUNE',
  BACKUP_FAILED:         'BACKUP_FAILED',
  // Key rotation
  KEY_ROTATION_LAZY:     'KEY_ROTATION_LAZY',
  KEY_ROTATION_BULK:     'KEY_ROTATION_BULK',
  // Auth / permission
  PERMISSION_DENIED:     'PERMISSION_DENIED',
  // Database
  DB_INIT:               'DB_INIT',
  DB_MIGRATION:          'DB_MIGRATION',
  // General
  BOT_START:             'BOT_START',
  ERROR:                 'ERROR',
} as const;

export type AuditActionType = (typeof AuditAction)[keyof typeof AuditAction];

// ---------------------------------------------------------------------------
// Log entry type
// ---------------------------------------------------------------------------

export interface AuditEntry {
  ts: string;          // ISO-8601 timestamp
  action: AuditActionType;
  guildId?: string;
  actor?: string;      // userId or 'system'
  detail?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

let logFilePath: string | null | undefined = undefined;

function getLogFilePath(): string | null {
  if (logFilePath !== undefined) return logFilePath;
  const envPath = process.env.AUDIT_LOG_FILE;
  if (!envPath) {
    logFilePath = null;
    return null;
  }
  logFilePath = path.isAbsolute(envPath)
    ? envPath
    : path.join(process.cwd(), envPath);
  // Ensure directory exists
  const dir = path.dirname(logFilePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return logFilePath;
}

function writeToFile(entry: AuditEntry): void {
  const filePath = getLogFilePath();
  if (!filePath) return;
  try {
    fs.appendFileSync(filePath, JSON.stringify(entry) + '\n', 'utf-8');
  } catch (err) {
    // Don't let audit log failures crash the bot
    console.error('[Audit] Failed to write log entry:', err);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Records an audit event.
 *
 * @param action  - The operation being logged (use AuditAction constants)
 * @param options - Optional guildId, actor (userId or 'system'), and detail payload
 */
export function audit(
  action: AuditActionType,
  options?: { guildId?: string; actor?: string; detail?: Record<string, unknown> }
): void {
  const entry: AuditEntry = {
    ts: new Date().toISOString(),
    action,
    ...(options?.guildId && { guildId: options.guildId }),
    ...(options?.actor   && { actor:   options.actor }),
    ...(options?.detail  && { detail:  options.detail }),
  };

  // Always log to console in a human-readable format
  const parts: string[] = [`[Audit] ${entry.ts} | ${entry.action}`];
  if (entry.guildId) parts.push(`guild=${entry.guildId}`);
  if (entry.actor)   parts.push(`actor=${entry.actor}`);
  if (entry.detail)  parts.push(JSON.stringify(entry.detail));
  console.log(parts.join(' | '));

  writeToFile(entry);
}
