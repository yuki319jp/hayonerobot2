import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  RoleSelectMenuBuilder,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
} from 'discord.js';
import { getSettings } from '../database';
import { ServerSettings } from '../types';
import { checkAdminPermission } from '../utils/permissions';

export const data = new SlashCommandBuilder()
  .setName('setup')
  .setDescription('Bot setup / Botの設定')
  .setDescriptionLocalizations({ ja: 'Botの設定', 'en-US': 'Bot setup' });

function getMentionTargetDisplay(settings: ServerSettings): string {
  const isJa = settings.language === 'ja';
  if (!settings.mentionTarget || settings.mentionTarget === 'none') {
    return isJa ? '🔕 なし' : '🔕 None';
  }
  if (settings.mentionTarget === 'online') {
    return isJa ? '🌐 オンラインユーザー全員' : '🌐 All online users';
  }
  if (settings.mentionTarget.startsWith('role:')) {
    const roleId = settings.mentionTarget.slice(5);
    // Validate that roleId is not empty
    if (!roleId) {
      return isJa ? '🎭 ロール未設定' : '🎭 Role not set';
    }
    return `<@&${roleId}>`;
  }
  return `<@${settings.mentionTarget}>`;
}

export function buildSetupMessage(settings: ServerSettings): {
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<any>[];
} {
  const isJa = settings.language === 'ja';
  const warnTime = `${String(settings.warnHour).padStart(2, '0')}:${String(settings.warnMinute).padStart(2, '0')}`;

  const embed = new EmbedBuilder()
    .setTitle(isJa ? '🛠️ セットアップ' : '🛠️ Bot Setup')
    .setDescription(
      isJa
        ? '以下のコンポーネントで設定を変更できます。変更はすぐに反映されます。'
        : 'Use the components below to change settings. Changes apply immediately.'
    )
    .addFields(
      {
        name: isJa ? '有効' : 'Enabled',
        value: settings.enabled ? '✅ ON' : '❌ OFF',
        inline: true,
      },
      {
        name: isJa ? '警告時刻' : 'Warn Time',
        value: warnTime,
        inline: true,
      },
      {
        name: isJa ? '通知チャンネル' : 'Channel',
        value: settings.channelId ? `<#${settings.channelId}>` : (isJa ? '未設定' : 'Not set'),
        inline: true,
      },
      {
        name: isJa ? 'メンション' : 'Mention',
        value: settings.mentionEnabled ? '🔔 ON' : '🔕 OFF',
        inline: true,
      },
      {
        name: isJa ? 'メンション対象' : 'Mention Target',
        value: getMentionTargetDisplay(settings),
        inline: true,
      },
      {
        name: isJa ? 'カスタムメッセージ' : 'Custom Message',
        value: settings.customMessage
          ? settings.customMessage.substring(0, 60) + (settings.customMessage.length > 60 ? '…' : '')
          : (isJa ? '*(デフォルト)*' : '*(default)*'),
        inline: false,
      }
    )
    .setColor(0x5865f2)
    .setFooter({ text: 'Hayonero2' });

  const rows: ActionRowBuilder<any>[] = [];

  // Row 1: Channel select
  const channelSelect = new ChannelSelectMenuBuilder()
    .setCustomId('setup_channel_select')
    .setPlaceholder(isJa ? '通知チャンネルを選択してください' : 'Select notification channel')
    .addChannelTypes(ChannelType.GuildText)
    .setMinValues(0)
    .setMaxValues(1);
  if (settings.channelId) {
    channelSelect.setDefaultChannels([settings.channelId]);
  }
  rows.push(new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channelSelect));

  // Row 2: Mention target type select
  const isOnline = settings.mentionTarget === 'online';
  const isRole = typeof settings.mentionTarget === 'string' && settings.mentionTarget.startsWith('role:');
  const isNone = !settings.mentionTarget || settings.mentionTarget === 'none';

  const mentionTargetSelect = new StringSelectMenuBuilder()
    .setCustomId('setup_mention_target')
    .setPlaceholder(isJa ? 'メンション対象を選択' : 'Select mention target')
    .addOptions([
      {
        label: isJa ? 'オンラインユーザー全員' : 'All online users',
        description: isJa ? 'オンライン・退席中・取り込み中のユーザー' : 'Online, idle, and DND users',
        value: 'online',
        emoji: '🌐',
        default: isOnline,
      },
      {
        label: isJa ? 'ロールでメンション' : 'Mention by role',
        description: isJa ? '特定のロールをメンション' : 'Mention a specific role',
        value: 'role',
        emoji: '🎭',
        default: isRole,
      },
      {
        label: isJa ? 'メンションなし' : 'No mention',
        description: isJa ? 'メンションを無効にする' : 'Disable mentions',
        value: 'none',
        emoji: '🔕',
        default: isNone,
      },
    ]);
  rows.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(mentionTargetSelect));

  // Row 3 (conditional): Role select when target type is 'role'
  if (isRole) {
    const roleSelect = new RoleSelectMenuBuilder()
      .setCustomId('setup_role_select')
      .setPlaceholder(isJa ? 'メンションするロールを選択' : 'Select role to mention')
      .setMinValues(1)
      .setMaxValues(1);
    if (settings.mentionTarget && settings.mentionTarget.startsWith('role:')) {
      const roleId = settings.mentionTarget.slice(5);
      if (roleId) roleSelect.setDefaultRoles([roleId]);
    }
    rows.push(new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(roleSelect));
  }

  // Next row: Enable/Disable + Time & Message buttons
  const enableBtn = new ButtonBuilder()
    .setCustomId('setup_enable')
    .setLabel(isJa ? '有効化' : 'Enable')
    .setStyle(settings.enabled ? ButtonStyle.Success : ButtonStyle.Secondary);
  const disableBtn = new ButtonBuilder()
    .setCustomId('setup_disable')
    .setLabel(isJa ? '無効化' : 'Disable')
    .setStyle(!settings.enabled ? ButtonStyle.Danger : ButtonStyle.Secondary);
  const timeMsgBtn = new ButtonBuilder()
    .setCustomId('setup_time_msg')
    .setLabel(isJa ? '⏰ 時刻・メッセージ設定' : '⏰ Time & Message')
    .setStyle(ButtonStyle.Primary);
  rows.push(
    new ActionRowBuilder<ButtonBuilder>().addComponents(enableBtn, disableBtn, timeMsgBtn)
  );

  // Last row: Mention ON/OFF
  const mentionOnBtn = new ButtonBuilder()
    .setCustomId('setup_mention_on')
    .setLabel(isJa ? '🔔 メンションON' : '🔔 Mention ON')
    .setStyle(settings.mentionEnabled ? ButtonStyle.Success : ButtonStyle.Secondary);
  const mentionOffBtn = new ButtonBuilder()
    .setCustomId('setup_mention_off')
    .setLabel(isJa ? '🔕 メンションOFF' : '🔕 Mention OFF')
    .setStyle(!settings.mentionEnabled ? ButtonStyle.Danger : ButtonStyle.Secondary);
  rows.push(
    new ActionRowBuilder<ButtonBuilder>().addComponents(mentionOnBtn, mentionOffBtn)
  );

  return { embeds: [embed], components: rows };
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!(await checkAdminPermission(interaction))) return;

  const guildId = interaction.guildId!;
  const settings = getSettings(guildId);
  const { embeds, components } = buildSetupMessage(settings);

  await interaction.reply({ embeds, components, ephemeral: true });
}
