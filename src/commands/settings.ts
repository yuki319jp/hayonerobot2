import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';
import { getSettingsAsync } from '../database';
import { t, defaultMessage } from '../i18n';

export const data = new SlashCommandBuilder()
  .setName('settings')
  .setDescription('Show current settings / 現在の設定を表示')
  .setDescriptionLocalizations({ ja: '現在の設定を表示', 'en-US': 'Show current settings' });

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId!;
  const s = await getSettingsAsync(guildId);
  const lang = s.language;

  const channelDisplay = s.channelId ? `<#${s.channelId}>` : t(lang, 'settings.none');
  const mentionTargetDisplay = !s.mentionTarget || s.mentionTarget === 'none'
    ? t(lang, 'settings.none')
    : s.mentionTarget === 'online'
    ? (lang === 'ja' ? '🌐 オンラインユーザー全員' : '🌐 All online users')
    : s.mentionTarget.startsWith('role:')
    ? `<@&${s.mentionTarget.slice(5)}>`
    : `<@${s.mentionTarget}>`;

  const warnTime = `${String(s.warnHour).padStart(2, '0')}:${String(s.warnMinute).padStart(2, '0')}`;
  const msgDisplay = s.customMessage ?? `*(${lang === 'ja' ? 'デフォルト' : 'default'})*`;

  const embed = new EmbedBuilder()
    .setTitle(t(lang, 'settings.title'))
    .addFields(
      { name: t(lang, 'settings.language'), value: lang === 'ja' ? '🇯🇵 日本語' : '🇺🇸 English', inline: true },
      { name: t(lang, 'settings.status'), value: s.enabled ? t(lang, 'settings.on') : t(lang, 'settings.off'), inline: true },
      { name: t(lang, 'settings.warn_time'), value: warnTime, inline: true },
      { name: t(lang, 'settings.channel'), value: channelDisplay, inline: true },
      { name: t(lang, 'settings.mention'), value: s.mentionEnabled ? t(lang, 'settings.on') : t(lang, 'settings.off'), inline: true },
      { name: t(lang, 'settings.mention_target'), value: mentionTargetDisplay, inline: true },
      { name: t(lang, 'settings.allowed_role'), value: s.allowedRoleId ? `<@&${s.allowedRoleId}>` : t(lang, 'settings.none'), inline: true },
      { name: t(lang, 'settings.custom_message'), value: msgDisplay }
    )
    .setColor(0x5865f2)
    .setFooter({ text: 'Hayonero2' });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
