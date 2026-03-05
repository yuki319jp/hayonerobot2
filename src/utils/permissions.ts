import { ChatInputCommandInteraction, GuildMember, PermissionFlagsBits, MessageComponentInteraction, Interaction } from 'discord.js';
import { getSettingsAsync } from '../database';
import { t } from '../i18n';
import type { TranslationKey } from '../i18n';

/**
 * Union type for interactions that can be checked for admin permission.
 */
type AdminCheckInteraction = ChatInputCommandInteraction | MessageComponentInteraction;

/**
 * Returns true if the member has ManageGuild permission OR the configured allowedRoleId.
 * Sends an ephemeral error reply and returns false otherwise.
 * Works with both slash commands and message components.
 */
export async function checkAdminPermission(
  interaction: AdminCheckInteraction
): Promise<boolean> {
  const guildId = interaction.guildId!;
  const member = interaction.member;

  // Type guard: ensure we have a GuildMember (not partial)
  if (!member || typeof member === 'string' || !('permissions' in member)) {
    await sendErrorReply(interaction, guildId, 'error.no_permission');
    return false;
  }

  if ((member as GuildMember).permissions.has(PermissionFlagsBits.ManageGuild)) {
    return true;
  }

  const settings = await getSettingsAsync(guildId);
  if (settings.allowedRoleId && (member as GuildMember).roles.cache.has(settings.allowedRoleId)) {
    return true;
  }

  await sendErrorReply(interaction, guildId, 'error.no_permission');
  return false;
}

/**
 * Helper to send error reply, handling both replied and deferred states.
 */
async function sendErrorReply(
  interaction: AdminCheckInteraction,
  guildId: string,
  messageKey: TranslationKey
): Promise<void> {
  try {
    const settings = await getSettingsAsync(guildId);
    const errMsg = t(settings.language, messageKey);
    
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: errMsg, ephemeral: true });
    } else {
      await interaction.reply({ content: errMsg, ephemeral: true });
    }
  } catch (err) {
    console.error('[checkAdminPermission]', err);
  }
}
