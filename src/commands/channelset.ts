import {
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { getSettings, saveSettings } from '../database';
import { t } from '../i18n';

export const data = new SlashCommandBuilder()
  .setName('channelset')
  .setDescription('Set the warning channel / 警告チャンネルを設定')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setDescriptionLocalizations({ ja: '警告チャンネルを設定', 'en-US': 'Set the warning channel' })
  .addChannelOption((o) =>
    o
      .setName('channel')
      .setDescription('Target channel (leave empty to clear) / 対象チャンネル（空でクリア）')
      .setDescriptionLocalizations({
        ja: '対象チャンネル（空でクリア）',
        'en-US': 'Target channel (leave empty to clear)',
      })
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId!;
  const settings = getSettings(guildId);
  const lang = settings.language;

  const channel = interaction.options.getChannel('channel');

  if (!channel) {
    settings.channelId = null;
    saveSettings(settings);
    await interaction.reply({ content: t(lang, 'channelset.cleared'), ephemeral: true });
    return;
  }

  settings.channelId = channel.id;
  saveSettings(settings);
  await interaction.reply({
    content: t(lang, 'channelset.success', { channel: `<#${channel.id}>` }),
    ephemeral: true,
  });
}
