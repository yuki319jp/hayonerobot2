import {
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { getSettings, saveSettings } from '../database';
import { t } from '../i18n';

export const data = new SlashCommandBuilder()
  .setName('mention')
  .setDescription('Configure mention settings / メンション設定')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setDescriptionLocalizations({ ja: 'メンション設定', 'en-US': 'Configure mention settings' })
  .addBooleanOption((o) =>
    o
      .setName('enabled')
      .setDescription('Enable or disable mentions / メンションのON/OFF')
      .setDescriptionLocalizations({
        ja: 'メンションのON/OFF',
        'en-US': 'Enable or disable mentions',
      })
      .setRequired(true)
  )
  .addRoleOption((o) =>
    o
      .setName('role')
      .setDescription('Role to mention / メンションするロール')
      .setDescriptionLocalizations({
        ja: 'メンションするロール',
        'en-US': 'Role to mention',
      })
  )
  .addUserOption((o) =>
    o
      .setName('user')
      .setDescription('User to mention (ignored if role is set) / メンションするユーザー')
      .setDescriptionLocalizations({
        ja: 'メンションするユーザー（ロール優先）',
        'en-US': 'User to mention (ignored if role is set)',
      })
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId!;
  const settings = getSettings(guildId);
  const lang = settings.language;

  const enabled = interaction.options.getBoolean('enabled', true);
  const role = interaction.options.getRole('role');
  const user = interaction.options.getUser('user');

  settings.mentionEnabled = enabled;
  const messages: string[] = [t(lang, enabled ? 'mention.enabled' : 'mention.disabled')];

  if (enabled) {
    if (role) {
      settings.mentionTarget = `role:${role.id}`;
      messages.push(t(lang, 'mention.target_set', { target: `<@&${role.id}>` }));
    } else if (user) {
      settings.mentionTarget = user.id;
      messages.push(t(lang, 'mention.target_set', { target: `<@${user.id}>` }));
    }
  }

  saveSettings(settings);
  await interaction.reply({ content: messages.join('\n'), ephemeral: true });
}
