import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';
import { getSettings, saveSettings, DEFAULT_SETTINGS } from '../database';
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
    case 'list': {
      const warnTime = `${String(settings.warnHour).padStart(2, '0')}:${String(settings.warnMinute).padStart(2, '0')}`;
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
            name: t(lang, 'schedule.time'),
            value: warnTime,
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

      await interaction.reply({ embeds: [embed], ephemeral: true });
      break;
    }

    case 'delete': {
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
