import cron, { ScheduledTask } from 'node-cron';
import { Client, GuildMember, PresenceStatus, TextChannel } from 'discord.js';
import { getAllGuildIdsAsync, getSettingsAsync } from '../database';
import { defaultMessage } from '../i18n';
import { sendAlert } from '../services/monitoring';

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

// Key: `${guildId}:${hour}:${minute}` → task
const scheduledTasks: Map<string, ScheduledTask> = new Map();

export async function rescheduleGuild(client: Client, guildId: string): Promise<void> {
  // Stop old task if exists
  scheduledTasks.get(guildId)?.stop();
  scheduledTasks.delete(guildId);

  const settings = await getSettingsAsync(guildId);
  if (!settings.enabled || !settings.channelId) return;

  const schedules = getSchedules(guildId);
  if (schedules.length === 0) return;

  for (const schedule of schedules) {
    if (!schedule.enabled) continue;
    scheduleEntry(client, guildId, schedule);
  }
}

function scheduleEntry(client: Client, guildId: string, schedule: Schedule): void {
  const key = `${guildId}:${schedule.hour}:${schedule.minute}`;
  const cronExpr = `${schedule.minute} ${schedule.hour} * * *`;

  const task = cron.schedule(cronExpr, async () => {
    try {
      const s = await getSettingsAsync(guildId); // re-read in case settings changed
      if (!s.enabled || !s.channelId) return;

      const channel = await client.channels.fetch(s.channelId).catch(() => null);
      if (!channel || !(channel instanceof TextChannel)) return;

      // Re-fetch schedule to get latest customMessage (avoids closure stale values)
      const latestSchedule = getScheduleById(schedule.id, guildId);
      if (!latestSchedule) return;

      // Priority: per-schedule message → server customMessage → system default
      const formattedTime = `${String(latestSchedule.hour).padStart(2, '0')}:${String(latestSchedule.minute).padStart(2, '0')}`;
      const rawMsg = latestSchedule.customMessage ?? s.customMessage ?? defaultMessage(s.language);

      // Replace {user} and {time} placeholders (mention prefix handled separately)
      let msg = rawMsg
        .replace(/\{time\}/g, formattedTime);

      // Build mention prefix
      let prefix = '';
      if (s.mentionEnabled && s.mentionTarget) {
        if (s.mentionTarget === 'online') {
          prefix = await buildOnlineMentions(client, guildId, s.excludedUserIds ?? []);
        } else if (s.mentionTarget.startsWith('role:')) {
          prefix = `<@&${s.mentionTarget.slice(5)}> `;
        } else {
          prefix = `<@${s.mentionTarget}> `;
        }
      }

      // Replace {user} placeholder with mention prefix (without trailing space)
      msg = msg.replace(/\{user\}/g, prefix.trimEnd());

      const fullMessage = msg.includes(prefix.trimEnd()) ? msg : prefix + msg;

      // Check if message exceeds Discord's 2000 character limit
      if (fullMessage.length > 2000) {
        if (prefix.length > 0) {
          const maxPrefixLength = 1800 - msg.length;
          if (maxPrefixLength > 0) {
            const truncatedPrefix = truncateMentions(prefix, maxPrefixLength);
            const truncatedMsg = truncatedPrefix + msg;
            if (truncatedMsg.length <= 2000) {
              await channel.send(truncatedMsg);
              return;
            }
          }
          await channel.send(msg);
        } else {
          await channel.send(msg.substring(0, 2000));
        }
      } else {
        await channel.send(fullMessage);
      }
    } catch (err) {
      console.error(`[NightWarn] Error for guild ${guildId}:`, err);
      sendAlert(`Night warn failed for guild ${guildId}`, {
        severity: 'warning',
        title: 'NightWarn Error',
        detail: String(err),
      }).catch(() => undefined);
    }
  });

  scheduledTasks.set(key, task);
  console.log(`[NightWarn] Scheduled for guild ${guildId} at ${schedule.hour}:${String(schedule.minute).padStart(2, '0')}`);
}

/**
 * Truncates mention string to fit within maxLength, removing partial mentions at the end.
 * Preserves complete mentions only.
 */
function truncateMentions(mentions: string, maxLength: number): string {
  if (mentions.length <= maxLength) return mentions;
  
  const truncated = mentions.substring(0, maxLength);
  // Find the last complete mention and truncate there
  const lastMentionEnd = truncated.lastIndexOf('>');
  if (lastMentionEnd > 0) {
    return truncated.substring(0, lastMentionEnd + 1) + ' ';
  }
  return '';
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

export async function scheduleAll(client: Client): Promise<void> {
  const guildIds = await getAllGuildIdsAsync();
  for (const guildId of guildIds) {
    rescheduleGuild(client, guildId);
  }
  console.log(`[NightWarn] Scheduled ${scheduledTasks.size} guild(s).`);
}
