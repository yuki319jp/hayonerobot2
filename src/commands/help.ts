import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';
import { getSettings } from '../database';
import { t } from '../i18n';

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Show help / ヘルプを表示')
  .setDescriptionLocalizations({ ja: 'ヘルプを表示', 'en-US': 'Show help' });

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const settings = getSettings(interaction.guildId!);
  const lang = settings.language;

  const embed = new EmbedBuilder()
    .setTitle(t(lang, 'help.title'))
    .setDescription(t(lang, 'help.description'))
    .addFields(
      { name: 'Commands', value: [
        t(lang, 'help.setup'),
        t(lang, 'help.channelset'),
        t(lang, 'help.message'),
        t(lang, 'help.mention'),
        t(lang, 'help.settings'),
      ].join('\n') }
    )
    .setColor(0x5865f2)
    .setFooter({ text: 'Hayonero2' });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
