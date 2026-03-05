export interface ServerSettings {
  guildId: string;
  language: 'ja' | 'en';
  enabled: boolean;
  channelId: string | null;
  mentionEnabled: boolean;
  /** 'online' = all online users, 'role:ROLEID' = role, 'USERID' = user, null = none */
  mentionTarget: string | null;
  /** user IDs who opted out of mentions */
  excludedUserIds: string[];
  warnHour: number;   // 0-23, hour to start warning (default: 0 = midnight)
  warnMinute: number; // 0-59, minute to start warning (default: 0)
  customMessage: string | null;
  allowedRoleId: string | null; // role allowed to use admin commands
}

/** A single time-based warning schedule entry. */
export interface Schedule {
  id: number;
  guildId: string;
  hour: number;   // 0-23
  minute: number; // 0-59
  /** Per-schedule custom message (decrypted). null = fall back to guild customMessage. */
  customMessage: string | null;
  enabled: boolean;
}

export interface EncryptedRow {
  guild_id: string;
  data: string;       // base64 encoded ciphertext
  iv: string;         // base64 encoded IV
  tag: string;        // base64 encoded auth tag
  key_version: number; // key version used for encryption
}
