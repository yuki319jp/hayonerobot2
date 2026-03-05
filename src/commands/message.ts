import {
  ActionRowBuilder,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
} from 'discord.js';
import { getSettings, saveSettings, getSchedules } from '../database';
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
  const settings = getSettings(guildId);
  const lang = settings.language;

  const text = interaction.options.getString('text');

  // If a direct text argument is provided, update the server-wide message (legacy behaviour).
  if (text !== null) {
    if (!text) {
      settings.customMessage = null;
      saveSettings(settings);
      await interaction.reply({ content: t(lang, 'message.reset'), ephemeral: true });
    } else {
      settings.customMessage = text;
      saveSettings(settings);
      await interaction.reply({
        content: t(lang, 'message.success', { message: text }),
        ephemeral: true,
      });
    }
    return;
  }

  // No argument → show interactive select menu for per-schedule messages.
  const schedules = getSchedules(guildId);
  if (schedules.length === 0) {
    await interaction.reply({ content: t(lang, 'message.no_schedules'), ephemeral: true });
    return;
  }

  const isJa = lang === 'ja';

  const options = schedules.map((s) => {
    const timeLabel = `${String(s.hour).padStart(2, '0')}:${String(s.minute).padStart(2, '0')}`;
    const status = s.customMessage
      ? `(${t(lang, 'message.status_set')})`
      : `(${t(lang, 'message.status_none')})`;
    return {
      label: `${timeLabel} ${status}`,
      description: s.customMessage
        ? s.customMessage.substring(0, 50) + (s.customMessage.length > 50 ? '…' : '')
        : (isJa ? 'クリックして設定する' : 'Click to configure'),
      value: String(s.id),
    };
  });

  const select = new StringSelectMenuBuilder()
    .setCustomId('message_schedule_select')
    .setPlaceholder(t(lang, 'message.select_placeholder'))
    .addOptions(options);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

  await interaction.reply({
    content: `**${t(lang, 'message.select_title')}**`,
    components: [row],
    ephemeral: true,
  });
}
