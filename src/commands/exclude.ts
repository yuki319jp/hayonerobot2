import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from 'discord.js';
import { getSettings, saveSettings } from '../database';
import { audit, AuditAction } from '../services/audit';

export const data = new SlashCommandBuilder()
  .setName('exclude')
  .setDescription('夜更かし警告メンションの除外設定 / Manage mention exclusion')
  .setDescriptionLocalizations({
    ja: '夜更かし警告メンションの除外設定',
    'en-US': 'Manage mention exclusion for night warnings',
  })
  .addSubcommand((sc) =>
    sc
      .setName('add')
      .setDescription('メンション対象から自分を除外する / Exclude yourself from mentions')
      .setDescriptionLocalizations({
        ja: 'メンション対象から自分を除外する',
        'en-US': 'Exclude yourself from night warning mentions',
      })
  )
  .addSubcommand((sc) =>
    sc
      .setName('remove')
      .setDescription('メンション除外を解除する / Remove yourself from the exclude list')
      .setDescriptionLocalizations({
        ja: 'メンション除外を解除する',
        'en-US': 'Remove yourself from the mention exclude list',
      })
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId!;
  const userId = interaction.user.id;
  const settings = getSettings(guildId);
  const isJa = settings.language === 'ja';
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'add') {
    if (!settings.excludedUserIds.includes(userId)) {
      settings.excludedUserIds.push(userId);
      saveSettings(settings);
      audit(AuditAction.EXCLUDE_ADD, { guildId, actor: userId });
    }
    await interaction.reply({
      content: isJa
        ? '✅ メンション除外リストに追加しました。夜更かし警告でメンションされなくなります。\n除外を解除するには `/exclude remove` を実行してください。'
        : '✅ Added to the mention exclude list. You will no longer be mentioned in night warnings.\nRun `/exclude remove` to undo this.',
      ephemeral: true,
    });
  } else if (subcommand === 'remove') {
    settings.excludedUserIds = settings.excludedUserIds.filter((id) => id !== userId);
    saveSettings(settings);
    audit(AuditAction.EXCLUDE_REMOVE, { guildId, actor: userId });
    await interaction.reply({
      content: isJa
        ? '✅ メンション除外リストから削除しました。夜更かし警告でメンションされるようになります。'
        : '✅ Removed from the mention exclude list. You will now be mentioned in night warnings.',
      ephemeral: true,
    });
  }
}
