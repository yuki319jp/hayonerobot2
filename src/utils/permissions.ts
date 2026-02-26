import { ChatInputCommandInteraction, GuildMember, PermissionFlagsBits } from 'discord.js';
import { getSettings } from '../database';
import { t } from '../i18n';

/**
 * Returns true if the member has ManageGuild permission OR the configured allowedRoleId.
 * Sends an ephemeral error reply and returns false otherwise.
 */
export async function checkAdminPermission(
  interaction: ChatInputCommandInteraction
): Promise<boolean> {
  const guildId = interaction.guildId!;
  const member = interaction.member as GuildMember;

  if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;

  const settings = getSettings(guildId);
  if (settings.allowedRoleId && member.roles.cache.has(settings.allowedRoleId)) return true;

  await interaction.reply({
    content: t(settings.language, 'error.no_permission'),
    ephemeral: true,
  });
  return false;
}
