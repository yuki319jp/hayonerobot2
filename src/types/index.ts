export interface ServerSettings {
  guildId: string;
  language: 'ja' | 'en';
  enabled: boolean;
  channelId: string | null;
  mentionEnabled: boolean;
  mentionTarget: string | null; // role ID or user ID
  warnHour: number;   // 0-23, hour to start warning (default: 0 = midnight)
  warnMinute: number; // 0-59, minute to start warning (default: 0)
  customMessage: string | null;
  allowedRoleId: string | null; // role allowed to use admin commands
}

export interface EncryptedRow {
  guild_id: string;
  data: string; // base64 encoded ciphertext
  iv: string;   // base64 encoded IV
  tag: string;  // base64 encoded auth tag
}
