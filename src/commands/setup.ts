import {
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { getSettings, saveSettings } from '../database';
import { t } from '../i18n';

export const data = new SlashCommandBuilder()
  .setName('setup')
  .setDescription('Initial bot setup / Botの初期設定')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setDescriptionLocalizations({ ja: 'Botの初期設定', 'en-US': 'Initial bot setup' })
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
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId!;
  const settings = getSettings(guildId);
  const lang = settings.language;

  const language = interaction.options.getString('language') as 'ja' | 'en' | null;
  const enabled = interaction.options.getBoolean('enabled');
  const warnHour = interaction.options.getInteger('warn_hour');
  const warnMinute = interaction.options.getInteger('warn_minute');

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
    messages.push(`⏰ Warning time: ${String(settings.warnHour).padStart(2, '0')}:${String(settings.warnMinute).padStart(2, '0')}`);
  }

  if (messages.length === 0) {
    messages.push(t(lang, 'setup.success'));
  }

  saveSettings(settings);
  await interaction.reply({ content: messages.join('\n'), ephemeral: true });
}
