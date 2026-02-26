import {
  ActionRowBuilder,
  ChatInputCommandInteraction,
  ModalBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { getSettings, saveSettings } from '../database';
import { t } from '../i18n';
import { checkAdminPermission } from '../utils/permissions';

export const data = new SlashCommandBuilder()
  .setName('setup')
  .setDescription('Bot setup / Botの設定')
  .setDescriptionLocalizations({ ja: 'Botの設定', 'en-US': 'Bot setup' })
  .addBooleanOption((o) =>
    o
      .setName('form')
      .setDescription('Open interactive setup form / フォームで設定する')
      .setDescriptionLocalizations({ ja: 'フォームで設定する', 'en-US': 'Open interactive setup form' })
  )
  .addStringOption((o) =>
    o
      .setName('language')
      .setDescription('Bot language / 言語選択')
      .setDescriptionLocalizations({ ja: '言語選択', 'en-US': 'Bot language' })
      .addChoices(
        { name: '日本語', value: 'ja' },
        { name: 'English', value: 'en' }
      )
  )
  .addBooleanOption((o) =>
    o
      .setName('enabled')
      .setDescription('Enable or disable warnings / 警告の有効・無効')
      .setDescriptionLocalizations({ ja: '警告の有効・無効', 'en-US': 'Enable or disable warnings' })
  )
  .addIntegerOption((o) =>
    o
      .setName('warn_hour')
      .setDescription('Warning hour (0-23) / 警告時刻（時・0-23）')
      .setDescriptionLocalizations({ ja: '警告時刻（時・0-23）', 'en-US': 'Warning hour (0-23)' })
      .setMinValue(0)
      .setMaxValue(23)
  )
  .addIntegerOption((o) =>
    o
      .setName('warn_minute')
      .setDescription('Warning minute (0-59) / 警告時刻（分・0-59）')
      .setDescriptionLocalizations({ ja: '警告時刻（分・0-59）', 'en-US': 'Warning minute (0-59)' })
      .setMinValue(0)
      .setMaxValue(59)
  )
  .addChannelOption((o) =>
    o
      .setName('channel')
      .setDescription('Warning channel (leave empty to clear) / 警告チャンネル（空でクリア）')
      .setDescriptionLocalizations({
        ja: '警告チャンネル（空でクリア）',
        'en-US': 'Warning channel (leave empty to clear)',
      })
  )
  .addRoleOption((o) =>
    o
      .setName('allowed_role')
      .setDescription('Role allowed to use admin commands / 管理コマンドを使えるロール')
      .setDescriptionLocalizations({
        ja: '管理コマンドを使えるロール',
        'en-US': 'Role allowed to use admin commands',
      })
  )
  .addBooleanOption((o) =>
    o
      .setName('clear_allowed_role')
      .setDescription('Clear the allowed role setting / コマンド実行ロール設定をクリア')
      .setDescriptionLocalizations({
        ja: 'コマンド実行ロール設定をクリア',
        'en-US': 'Clear the allowed role setting',
      })
  )
  .addBooleanOption((o) =>
    o
      .setName('mention_enabled')
      .setDescription('Enable or disable mentions / メンションの有効・無効')
      .setDescriptionLocalizations({
        ja: 'メンションの有効・無効',
        'en-US': 'Enable or disable mentions',
      })
  )
  .addRoleOption((o) =>
    o
      .setName('mention_role')
      .setDescription('Role to mention / メンションするロール')
      .setDescriptionLocalizations({ ja: 'メンションするロール', 'en-US': 'Role to mention' })
  )
  .addUserOption((o) =>
    o
      .setName('mention_user')
      .setDescription('User to mention (ignored if role set) / メンションするユーザー（ロール優先）')
      .setDescriptionLocalizations({
        ja: 'メンションするユーザー（ロール優先）',
        'en-US': 'User to mention (ignored if role set)',
      })
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!(await checkAdminPermission(interaction))) return;

  const guildId = interaction.guildId!;
  const settings = getSettings(guildId);

  const useForm = interaction.options.getBoolean('form');

  if (useForm) {
    const warnTime = `${String(settings.warnHour).padStart(2, '0')}:${String(settings.warnMinute).padStart(2, '0')}`;

    const modal = new ModalBuilder()
      .setCustomId('setup_modal')
      .setTitle(settings.language === 'ja' ? 'Botセットアップ' : 'Bot Setup');

    const languageInput = new TextInputBuilder()
      .setCustomId('language')
      .setLabel(settings.language === 'ja' ? '言語 (ja / en)' : 'Language (ja / en)')
      .setStyle(TextInputStyle.Short)
      .setValue(settings.language)
      .setMinLength(2)
      .setMaxLength(2)
      .setRequired(true);

    const enabledInput = new TextInputBuilder()
      .setCustomId('enabled')
      .setLabel(settings.language === 'ja' ? '有効 (on / off)' : 'Enabled (on / off)')
      .setStyle(TextInputStyle.Short)
      .setValue(settings.enabled ? 'on' : 'off')
      .setMinLength(2)
      .setMaxLength(3)
      .setRequired(true);

    const warnTimeInput = new TextInputBuilder()
      .setCustomId('warn_time')
      .setLabel(settings.language === 'ja' ? '警告時刻 (HH:MM)' : 'Warning time (HH:MM)')
      .setStyle(TextInputStyle.Short)
      .setValue(warnTime)
      .setMinLength(4)
      .setMaxLength(5)
      .setRequired(true);

    const channelIdInput = new TextInputBuilder()
      .setCustomId('channel_id')
      .setLabel(settings.language === 'ja' ? 'チャンネルID（空でクリア）' : 'Channel ID (empty to clear)')
      .setStyle(TextInputStyle.Short)
      .setValue(settings.channelId ?? '')
      .setRequired(false);

    const customMessageInput = new TextInputBuilder()
      .setCustomId('custom_message')
      .setLabel(settings.language === 'ja' ? 'カスタムメッセージ（空でデフォルト）' : 'Custom message (empty = default)')
      .setStyle(TextInputStyle.Paragraph)
      .setValue(settings.customMessage ?? '')
      .setMaxLength(500)
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(languageInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(enabledInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(warnTimeInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(channelIdInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(customMessageInput),
    );

    await interaction.showModal(modal);
    return;
  }

  // Option-based setup
  const lang = settings.language;
  const language = interaction.options.getString('language') as 'ja' | 'en' | null;
  const enabled = interaction.options.getBoolean('enabled');
  const warnHour = interaction.options.getInteger('warn_hour');
  const warnMinute = interaction.options.getInteger('warn_minute');
  const channel = interaction.options.getChannel('channel');
  const allowedRole = interaction.options.getRole('allowed_role');
  const clearAllowedRole = interaction.options.getBoolean('clear_allowed_role');
  const mentionEnabled = interaction.options.getBoolean('mention_enabled');
  const mentionRole = interaction.options.getRole('mention_role');
  const mentionUser = interaction.options.getUser('mention_user');

  const messages: string[] = [];

  if (language !== null) {
    settings.language = language;
    messages.push(
      t(language, 'setup.language_set', { lang: language === 'ja' ? '日本語' : 'English' })
    );
  }
  if (enabled !== null) {
    settings.enabled = enabled;
    messages.push(t(settings.language, enabled ? 'setup.enabled' : 'setup.disabled'));
  }
  if (warnHour !== null) settings.warnHour = warnHour;
  if (warnMinute !== null) settings.warnMinute = warnMinute;
  if (warnHour !== null || warnMinute !== null) {
    messages.push(`⏰ ${String(settings.warnHour).padStart(2, '0')}:${String(settings.warnMinute).padStart(2, '0')}`);
  }
  if (channel !== null) {
    settings.channelId = channel.id;
    messages.push(t(settings.language, 'setup.channel_set', { channel: `<#${channel.id}>` }));
  }
  if (clearAllowedRole) {
    settings.allowedRoleId = null;
    messages.push(t(settings.language, 'setup.role_cleared'));
  } else if (allowedRole !== null) {
    settings.allowedRoleId = allowedRole.id;
    messages.push(t(settings.language, 'setup.role_set', { role: `<@&${allowedRole.id}>` }));
  }
  if (mentionEnabled !== null) {
    settings.mentionEnabled = mentionEnabled;
    if (mentionEnabled) {
      if (mentionRole) {
        settings.mentionTarget = `role:${mentionRole.id}`;
      } else if (mentionUser) {
        settings.mentionTarget = mentionUser.id;
      }
    }
    messages.push(t(settings.language, 'setup.mention_set'));
  }

  if (messages.length === 0) {
    messages.push(t(lang, 'setup.success'));
  }

  saveSettings(settings);
  await interaction.reply({ content: messages.join('\n'), ephemeral: true });
}
