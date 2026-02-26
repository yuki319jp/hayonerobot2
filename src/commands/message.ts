import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from 'discord.js';
import { getSettings, saveSettings } from '../database';
import { t } from '../i18n';
import { checkAdminPermission } from '../utils/permissions';

export const data = new SlashCommandBuilder()
  .setName('message')
  .setDescription('Customize the warning message / 警告メッセージをカスタマイズ')
  .setDescriptionLocalizations({
    ja: '警告メッセージをカスタマイズ',
    'en-US': 'Customize the warning message',
  })
  .addStringOption((o) =>
    o
      .setName('text')
      .setDescription(
        'New message (leave empty to reset to default) / 新しいメッセージ（空でデフォルトに戻す）'
      )
      .setDescriptionLocalizations({
        ja: '新しいメッセージ（空でデフォルトに戻す）',
        'en-US': 'New message (leave empty to reset to default)',
      })
      .setMaxLength(500)
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!(await checkAdminPermission(interaction))) return;

  const guildId = interaction.guildId!;
  const settings = getSettings(guildId);
  const lang = settings.language;

  const text = interaction.options.getString('text');

  if (!text) {
    settings.customMessage = null;
    saveSettings(settings);
    await interaction.reply({ content: t(lang, 'message.reset'), ephemeral: true });
    return;
  }

  settings.customMessage = text;
  saveSettings(settings);
  await interaction.reply({
    content: t(lang, 'message.success', { message: text }),
    ephemeral: true,
  });
}
