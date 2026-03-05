import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';
import { getSettings, saveSettings, DEFAULT_SETTINGS, getSchedules, upsertSchedule, deleteAllSchedules } from '../database';
import { t } from '../i18n';
import { checkAdminPermission } from '../utils/permissions';
import { audit, AuditAction } from '../services/audit';

export const data = new SlashCommandBuilder()
  .setName('schedule')
  .setDescription('Manage warning schedule / スケジュール管理')
  .setDescriptionLocalizations({
    ja: 'スケジュール管理',
    'en-US': 'Manage warning schedule',
  })
  .addSubcommand((sub) =>
    sub
      .setName('set')
      .setDescription('Add or update a schedule entry / スケジュールを追加・更新')
      .setDescriptionLocalizations({
        ja: 'スケジュールを追加・更新',
        'en-US': 'Add or update a schedule entry',
      })
      .addStringOption((o) =>
        o
          .setName('time')
          .setDescription('Warning time in HH:MM format / 警告時刻（HH:MM形式）')
          .setDescriptionLocalizations({
            ja: '警告時刻（HH:MM形式、例: 23:00）',
            'en-US': 'Warning time in HH:MM format (e.g. 23:00)',
          })
          .setRequired(true)
      )
      .addStringOption((o) =>
        o
          .setName('message')
          .setDescription('Custom message for this schedule (optional) / この時刻専用メッセージ（省略可）')
          .setDescriptionLocalizations({
            ja: 'この時刻専用メッセージ（省略可）',
            'en-US': 'Custom message for this schedule (optional)',
          })
          .setMaxLength(1000)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('list')
      .setDescription('Show schedule info / スケジュール一覧を表示')
      .setDescriptionLocalizations({
        ja: 'スケジュール一覧を表示',
        'en-US': 'Show schedule info',
      })
  )
  .addSubcommand((sub) =>
    sub
      .setName('delete')
      .setDescription('Delete (reset) all schedule settings / スケジュール設定を削除')
      .setDescriptionLocalizations({
        ja: 'スケジュール設定を削除',
        'en-US': 'Delete (reset) all schedule settings',
      })
  )
  .addSubcommand((sub) =>
    sub
      .setName('disable')
      .setDescription('Temporarily disable schedule / スケジュールを一時的に無効化')
      .setDescriptionLocalizations({
        ja: 'スケジュールを一時的に無効化',
        'en-US': 'Temporarily disable schedule',
      })
  )
  .addSubcommand((sub) =>
    sub
      .setName('enable')
      .setDescription('Re-enable schedule / スケジュールを有効化')
      .setDescriptionLocalizations({
        ja: 'スケジュールを有効化',
        'en-US': 'Re-enable schedule',
      })
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId!;
  const settings = getSettings(guildId);
  const lang = settings.language;
  const sub = interaction.options.getSubcommand();

  // list subcommand is available to everyone; others require admin permission
  if (sub !== 'list') {
    if (!(await checkAdminPermission(interaction))) return;
  }

  switch (sub) {
    case 'set': {
      const timeStr = interaction.options.getString('time', true).trim();
      const timeMatch = timeStr.match(/^(\d{1,2}):(\d{2})$/);
      if (!timeMatch) {
        await interaction.reply({ content: t(lang, 'error.invalid_time'), ephemeral: true });
        return;
      }
      const h = parseInt(timeMatch[1], 10);
      const m = parseInt(timeMatch[2], 10);
      if (h < 0 || h > 23 || m < 0 || m > 59) {
        await interaction.reply({ content: t(lang, 'error.invalid_time'), ephemeral: true });
        return;
      }

      const messageOpt = interaction.options.getString('message');
      const schedule = upsertSchedule(guildId, h, m, messageOpt ?? undefined);

      // Update server-wide warnHour/warnMinute for backward compatibility
      // Note: These values are set to the last /schedule set time, not the first schedule
      settings.warnHour = h;
      settings.warnMinute = m;
      saveSettings(settings);

      const formattedTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

      if (messageOpt) {
        await interaction.reply({
          content: t(lang, 'schedule.set_success', { time: formattedTime }),
          ephemeral: true,
        });
      } else {
        // Offer quick message setup via button
        const isJa = lang === 'ja';
        const promptText = t(lang, 'schedule.set_message_prompt');
        const setMsgBtn = new ButtonBuilder()
          .setCustomId(`schedule_set_msg:${schedule.id}`)
          .setLabel(isJa ? '📝 メッセージを設定する' : '📝 Set Message')
          .setStyle(ButtonStyle.Primary);
        const skipBtn = new ButtonBuilder()
          .setCustomId('schedule_set_msg_skip')
          .setLabel(isJa ? 'スキップ' : 'Skip')
          .setStyle(ButtonStyle.Secondary);
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(setMsgBtn, skipBtn);
        await interaction.reply({
          content: `${t(lang, 'schedule.set_success', { time: formattedTime })}\n${promptText}`,
          components: [row],
          ephemeral: true,
        });
      }
      break;
    }

    case 'list': {
      const schedules = getSchedules(guildId);
      const channelDisplay = settings.channelId
        ? `<#${settings.channelId}>`
        : t(lang, 'settings.none');

      const embed = new EmbedBuilder()
        .setTitle(t(lang, 'schedule.list_title'))
        .addFields(
          {
            name: t(lang, 'schedule.status'),
            value: settings.enabled ? `✅ ${t(lang, 'settings.on')}` : `🔕 ${t(lang, 'settings.off')}`,
            inline: true,
          },
          {
            name: t(lang, 'schedule.channel'),
            value: channelDisplay,
            inline: true,
          }
        )
        .setColor(settings.enabled ? 0x57f287 : 0xed4245)
        .setFooter({ text: 'Hayonero2' });

      if (schedules.length === 0) {
        embed.setDescription(t(lang, 'schedule.no_schedule'));
      } else {
        // Discord Embed field limit is 25; we already have 2 fields (status, channel)
        // So we can add max 23 schedule fields
        const displaySchedules = schedules.slice(0, 23);
        for (const s of displaySchedules) {
          const timeLabel = `${String(s.hour).padStart(2, '0')}:${String(s.minute).padStart(2, '0')}`;
          const statusIcon = s.enabled ? '✅' : '⏸️';
          const msgStatus = s.customMessage
            ? `📝 ${t(lang, 'message.status_set')}: \`${s.customMessage.substring(0, 40)}${s.customMessage.length > 40 ? '…' : ''}\``
            : `💬 ${t(lang, 'message.status_none')}`;
          embed.addFields({
            name: `${statusIcon} ${timeLabel}`,
            value: `${t(lang, 'schedule.message_label')}: ${msgStatus}`,
            inline: false,
          });
        }
        
        // If there are more than 23 schedules, add a notice
        if (schedules.length > 23) {
          const remaining = schedules.length - 23;
          embed.addFields({
            name: '⚠️ ' + (lang === 'ja' ? '追加スケジュール' : 'More Schedules'),
            value: lang === 'ja' ? `他${remaining}個のスケジュールがあります` : `+${remaining} more schedule(s)`,
            inline: false,
          });
        }
      }

      await interaction.reply({ embeds: [embed], ephemeral: true });
      break;
    }

    case 'delete': {
      deleteAllSchedules(guildId);
      // Reset schedule-related settings to defaults, preserve language and allowedRoleId
      settings.enabled = DEFAULT_SETTINGS.enabled;
      settings.channelId = DEFAULT_SETTINGS.channelId;
      settings.warnHour = DEFAULT_SETTINGS.warnHour;
      settings.warnMinute = DEFAULT_SETTINGS.warnMinute;
      settings.mentionEnabled = DEFAULT_SETTINGS.mentionEnabled;
      settings.mentionTarget = DEFAULT_SETTINGS.mentionTarget;
      settings.customMessage = DEFAULT_SETTINGS.customMessage;
      saveSettings(settings);
      audit(AuditAction.SCHEDULE_DELETE, { guildId, actor: interaction.user.id });
      await interaction.reply({ content: t(lang, 'schedule.deleted'), ephemeral: true });
      break;
    }

    case 'disable': {
      settings.enabled = false;
      saveSettings(settings);
      audit(AuditAction.SCHEDULE_DISABLE, { guildId, actor: interaction.user.id });
      await interaction.reply({ content: t(lang, 'schedule.disabled'), ephemeral: true });
      break;
    }

    case 'enable': {
      settings.enabled = true;
      saveSettings(settings);
      audit(AuditAction.SCHEDULE_ENABLE, { guildId, actor: interaction.user.id });
      await interaction.reply({ content: t(lang, 'schedule.enabled'), ephemeral: true });
      break;
    }
  }
}
