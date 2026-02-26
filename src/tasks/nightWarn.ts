import cron, { ScheduledTask } from 'node-cron';
import { Client, TextChannel } from 'discord.js';
import { getAllGuildIds, getSettings } from '../database';
import { defaultMessage } from '../i18n';

/**
 * For each guild, schedule a cron task at the configured warn time.
 * Reschedules when settings change by calling this function again.
 * Uses a per-guild map so old tasks are destroyed before rescheduling.
 */
const scheduledTasks: Map<string, ScheduledTask> = new Map();

export function rescheduleGuild(client: Client, guildId: string): void {
  // Stop old task if exists
  scheduledTasks.get(guildId)?.stop();
  scheduledTasks.delete(guildId);

  const settings = getSettings(guildId);
  if (!settings.enabled || !settings.channelId) return;

  const { warnHour, warnMinute } = settings;
  const cronExpr = `${warnMinute} ${warnHour} * * *`;

  const task = cron.schedule(cronExpr, async () => {
    try {
      const s = getSettings(guildId); // re-read in case settings changed
      if (!s.enabled || !s.channelId) return;

      const channel = await client.channels.fetch(s.channelId).catch(() => null);
      if (!channel || !(channel instanceof TextChannel)) return;

      const msg = s.customMessage ?? defaultMessage(s.language);

      let prefix = '';
      if (s.mentionEnabled && s.mentionTarget) {
        prefix = s.mentionTarget.startsWith('role:')
          ? `<@&${s.mentionTarget.slice(5)}> `
          : `<@${s.mentionTarget}> `;
      }

      await channel.send(prefix + msg);
    } catch (err) {
      console.error(`[NightWarn] Error for guild ${guildId}:`, err);
    }
  });

  scheduledTasks.set(guildId, task);
  console.log(`[NightWarn] Scheduled for guild ${guildId} at ${warnHour}:${String(warnMinute).padStart(2, '0')}`);
}

export function scheduleAll(client: Client): void {
  const guildIds = getAllGuildIds();
  for (const guildId of guildIds) {
    rescheduleGuild(client, guildId);
  }
  console.log(`[NightWarn] Scheduled ${scheduledTasks.size} guild(s).`);
}
