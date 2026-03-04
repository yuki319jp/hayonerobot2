import cron, { ScheduledTask } from 'node-cron';
import { Client, GuildMember, PresenceStatus, TextChannel } from 'discord.js';
import { getAllGuildIds, getSettings } from '../database';
import { defaultMessage } from '../i18n';

/**
 * For each guild, schedule a cron task at the configured warn time.
 * Reschedules when settings change by calling this function again.
 * Uses a per-guild map so old tasks are destroyed before rescheduling.
 */
/**
 * Maximum number of online users to mention per message.
 * Prevents message length exceeding 2000 chars and helps with API limits.
 */
const MAX_ONLINE_MENTIONS = 50;

/**
 * Timeout for fetching members with presences (in milliseconds).
 */
const FETCH_MEMBERS_TIMEOUT = 5000;

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
        if (s.mentionTarget === 'online') {
          // Mention all online non-bot users not in the exclude list
          prefix = await buildOnlineMentions(client, guildId, s.excludedUserIds ?? []);
        } else if (s.mentionTarget.startsWith('role:')) {
          prefix = `<@&${s.mentionTarget.slice(5)}> `;
        } else {
          prefix = `<@${s.mentionTarget}> `;
        }
      }

      await channel.send(prefix + msg);
    } catch (err) {
      console.error(`[NightWarn] Error for guild ${guildId}:`, err);
    }
  });

  scheduledTasks.set(guildId, task);
  console.log(`[NightWarn] Scheduled for guild ${guildId} at ${warnHour}:${String(warnMinute).padStart(2, '0')}`);
}

/**
 * Fetches all online (non-offline) guild members and returns a mention string.
 * Bots and users in excludedUserIds are excluded.
 * Limits mentions to MAX_ONLINE_MENTIONS to prevent message overflow.
 * Requires GatewayIntentBits.GuildPresences and GatewayIntentBits.GuildMembers.
 */
async function buildOnlineMentions(
  client: Client,
  guildId: string,
  excludedUserIds: string[]
): Promise<string> {
  try {
    const guild = await client.guilds.fetch(guildId);
    
    // Fetch with timeout to avoid hanging on large guilds
    const fetchPromise = guild.members.fetch({ withPresences: true });
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Fetch timeout')), FETCH_MEMBERS_TIMEOUT)
    );
    
    const members = await Promise.race([fetchPromise, timeoutPromise]);

    const onlineStatuses: PresenceStatus[] = ['online', 'idle', 'dnd'];

    const onlineMembers = members
      .filter((member: GuildMember) => {
        if (member.user.bot) return false;
        if (excludedUserIds.includes(member.id)) return false;
        const presence = member.presence;
        if (!presence) return false;
        return onlineStatuses.includes(presence.status);
      });

    // Limit mentions to MAX_ONLINE_MENTIONS to prevent message overflow
    const mentionList = Array.from(onlineMembers.values())
      .slice(0, MAX_ONLINE_MENTIONS)
      .map((member: GuildMember) => `<@${member.id}>`)
      .join(' ');

    return mentionList ? mentionList + ' ' : '';
  } catch (err) {
    console.error(`[NightWarn] Failed to fetch online members for guild ${guildId}:`, err);
    return '';
  }
}

export function scheduleAll(client: Client): void {
  const guildIds = getAllGuildIds();
  for (const guildId of guildIds) {
    rescheduleGuild(client, guildId);
  }
  console.log(`[NightWarn] Scheduled ${scheduledTasks.size} guild(s).`);
}
