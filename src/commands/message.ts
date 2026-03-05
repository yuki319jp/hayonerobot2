import {
  ActionRowBuilder,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
} from 'discord.js';
import { getSettingsAsync, saveSettingsAsync } from '../database';
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
        'Server-wide default message (leave empty to reset) / サーバー共通デフォルトメッセージ（空でリセット）'
      )
      .setDescriptionLocalizations({
        ja: 'サーバー共通デフォルトメッセージ（空でリセット）',
        'en-US': 'Server-wide default message (leave empty to reset)',
      })
      .setMaxLength(1000)
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!(await checkAdminPermission(interaction))) return;

  const guildId = interaction.guildId!;
  const settings = await getSettingsAsync(guildId);
  const lang = settings.language;

  const text = interaction.options.getString('text');

  if (!text) {
    settings.customMessage = null;
    await saveSettingsAsync(settings);
    await interaction.reply({ content: t(lang, 'message.reset'), ephemeral: true });
    return;
  }

  settings.customMessage = text;
  await saveSettingsAsync(settings);
  await interaction.reply({
    content,
    components: [row],
    ephemeral: true,
  });
}
