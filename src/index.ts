import 'dotenv/config';
import {
  ActionRowBuilder,
  AnySelectMenuInteraction,
  ButtonInteraction,
  ChannelSelectMenuInteraction,
  Client,
  GatewayIntentBits,
  Interaction,
  Events,
  MessageComponentInteraction,
  ModalBuilder,
  ModalSubmitInteraction,
  RoleSelectMenuBuilder,
  RoleSelectMenuInteraction,
  StringSelectMenuInteraction,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { initDatabase, getSettingsAsync, saveSettingsAsync } from './database';
import { commands } from './commands';
import { scheduleAll, rescheduleGuild } from './tasks/nightWarn';
import { t } from './i18n';
import { buildSetupMessage } from './commands/setup';
import { checkAdminPermission } from './utils/permissions';
import { audit, AuditAction } from './services/audit';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
  ],
});

client.once(Events.ClientReady, (readyClient) => {
  console.log(`✅ Logged in as ${readyClient.user.tag}`);
  scheduleAll(readyClient).catch(console.error);
});

client.on(Events.InteractionCreate, async (interaction: Interaction) => {
  if (interaction.isModalSubmit()) {
    await handleModalSubmit(interaction as ModalSubmitInteraction);
    return;
  }

  // Handle setup component interactions
  if (
    (interaction.isButton() ||
      interaction.isChannelSelectMenu() ||
      interaction.isStringSelectMenu() ||
      interaction.isRoleSelectMenu()) &&
    interaction.customId.startsWith('setup_')
  ) {
    await handleSetupComponent(interaction as AnySelectMenuInteraction | ButtonInteraction);
    return;
  }

  // Handle per-schedule message: select menu
  if (interaction.isStringSelectMenu() && interaction.customId === 'message_schedule_select') {
    await handleMessageScheduleSelect(interaction as StringSelectMenuInteraction);
    return;
  }

  // Handle per-schedule message: quick-set button from /schedule set
  if (interaction.isButton() && interaction.customId.startsWith('schedule_set_msg:')) {
    await handleScheduleSetMsgButton(interaction as ButtonInteraction);
    return;
  }

  // Handle skip button from /schedule set prompt
  if (interaction.isButton() && interaction.customId === 'schedule_set_msg_skip') {
    await (interaction as ButtonInteraction).update({ content: '✅', components: [] });
    return;
  }

  if (!interaction.isChatInputCommand()) return;
  if (!interaction.guildId) {
    await interaction.reply({ content: 'This bot only works in servers.', ephemeral: true });
    return;
  }

  const command = commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);

    // After any settings-mutating command, reschedule the guild's cron task
    if (['setup', 'channelset', 'mention', 'schedule'].includes(interaction.commandName)) {
      await rescheduleGuild(client, interaction.guildId);
    }
  } catch (err) {
    console.error(`[Command:${interaction.commandName}]`, err);
    const settings = await getSettingsAsync(interaction.guildId);
    const errMsg = t(settings.language, 'error.general');
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: errMsg, ephemeral: true });
    } else {
      await interaction.reply({ content: errMsg, ephemeral: true });
    }
  }
});

async function handleSetupComponent(
  interaction: AnySelectMenuInteraction | ButtonInteraction
): Promise<void> {
  if (!interaction.guildId) return;

  // Permission check for setup components
  if (!(await checkAdminPermission(interaction as MessageComponentInteraction))) return;

  const guildId = interaction.guildId;
  const settings = await getSettingsAsync(guildId);
  const customId = interaction.customId;

  try {
    if (customId === 'setup_channel_select') {
      const sel = interaction as ChannelSelectMenuInteraction;
      settings.channelId = sel.values[0] ?? null;
      await saveSettingsAsync(settings);
      await rescheduleGuild(client, guildId);
    } else if (customId === 'setup_mention_target') {
      const sel = interaction as StringSelectMenuInteraction;
      const value = sel.values[0];
      if (value === 'online') {
        settings.mentionTarget = 'online';
        await saveSettingsAsync(settings);
      } else if (value === 'none') {
        settings.mentionTarget = null;
        await saveSettingsAsync(settings);
      } else if (value === 'role') {
        // Show RoleSelectMenu but don't save incomplete value to DB yet
        const isJa = settings.language === 'ja';
        const roleSelect = new RoleSelectMenuBuilder()
          .setCustomId('setup_role_select')
          .setPlaceholder(isJa ? 'メンションするロールを選択' : 'Select role to mention')
          .setMinValues(1)
          .setMaxValues(1);
        
        const row = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(roleSelect);
        await (interaction as StringSelectMenuInteraction).update({ components: [row] });
        return; // Don't save incomplete 'role:' to DB
      }
    } else if (customId === 'setup_role_select') {
      const sel = interaction as RoleSelectMenuInteraction;
      settings.mentionTarget = `role:${sel.values[0]}`;
      await saveSettingsAsync(settings);
    } else if (customId === 'setup_enable') {
      settings.enabled = true;
      await saveSettingsAsync(settings);
      await rescheduleGuild(client, guildId);
    } else if (customId === 'setup_disable') {
      settings.enabled = false;
      await saveSettingsAsync(settings);
      await rescheduleGuild(client, guildId);
    } else if (customId === 'setup_mention_on') {
      settings.mentionEnabled = true;
      await saveSettingsAsync(settings);
    } else if (customId === 'setup_mention_off') {
      settings.mentionEnabled = false;
      await saveSettingsAsync(settings);
    } else if (customId === 'setup_time_msg') {
      // Open modal for time and message configuration
      const isJa = settings.language === 'ja';
      const warnTime = `${String(settings.warnHour).padStart(2, '0')}:${String(settings.warnMinute).padStart(2, '0')}`;

      const modal = new ModalBuilder()
        .setCustomId('setup_config_modal')
        .setTitle(isJa ? '時刻・メッセージ設定' : 'Time & Message Settings');

      const warnTimeInput = new TextInputBuilder()
        .setCustomId('warn_time')
        .setLabel(isJa ? '警告時刻 (HH:MM)' : 'Warning Time (HH:MM)')
        .setStyle(TextInputStyle.Short)
        .setValue(warnTime)
        .setMinLength(4)
        .setMaxLength(5)
        .setRequired(true);

      const customMessageInput = new TextInputBuilder()
        .setCustomId('custom_message')
        .setLabel(
          isJa ? 'カスタムメッセージ（空でデフォルト）' : 'Custom message (empty = default)'
        )
        .setStyle(TextInputStyle.Paragraph)
        .setValue(settings.customMessage ?? '')
        .setMaxLength(500)
        .setRequired(false);

      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(warnTimeInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(customMessageInput)
      );

      await (interaction as ButtonInteraction).showModal(modal);
      return; // do not call interaction.update() after showModal
    }

    // Update the setup message with refreshed settings
    const updatedSettings = await getSettingsAsync(guildId);
    const { embeds, components } = buildSetupMessage(updatedSettings);
    await (interaction as MessageComponentInteraction).update({ embeds, components });
  } catch (err) {
    console.error(`[SetupComponent:${customId}]`, err);
    try {
      const errMsg = t(settings.language, 'error.general');
      // After showModal, interaction cannot be replied to; skip error reply
      if (customId === 'setup_time_msg') {
        return;
      }
      // For other components, check state before replying
      if ((interaction as MessageComponentInteraction).replied || (interaction as MessageComponentInteraction).deferred) {
        await (interaction as MessageComponentInteraction).followUp({ content: errMsg, ephemeral: true });
      } else {
        await (interaction as MessageComponentInteraction).reply({ content: errMsg, ephemeral: true });
      }
    } catch (_) { /* ignore */ }
  }
}

async function handleModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  if (!interaction.guildId) return;

  if (interaction.customId === 'setup_config_modal') {
    const guildId = interaction.guildId;
    const settings = await getSettingsAsync(guildId);

    try {
      const warnTimeVal = interaction.fields.getTextInputValue('warn_time').trim();
      const timeMatch = warnTimeVal.match(/^(\d{1,2}):(\d{2})$/);
      if (timeMatch) {
        const h = parseInt(timeMatch[1], 10);
        const m = parseInt(timeMatch[2], 10);
        if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
          settings.warnHour = h;
          settings.warnMinute = m;
        } else {
          await interaction.reply({
            content: t(settings.language, 'error.invalid_time'),
            ephemeral: true,
          });
          return;
        }
      } else {
        await interaction.reply({
          content: t(settings.language, 'error.invalid_time'),
          ephemeral: true,
        });
        return;
      }

      const customMsgVal = interaction.fields.getTextInputValue('custom_message').trim();
      settings.customMessage = customMsgVal || null;

      await saveSettingsAsync(settings);
      await rescheduleGuild(client, guildId);

      const { embeds, components } = buildSetupMessage(settings);
      // Update original setup message if triggered from a component, otherwise reply
      if (interaction.isFromMessage()) {
        await interaction.update({ embeds, components });
      } else {
        await interaction.reply({ embeds, components, ephemeral: true });
      }
    } catch (err) {
      console.error('[ModalSubmit:setup_config_modal]', err);
      try {
        const errMsg = t(settings.language, 'error.general');
        // Modal submission hasn't sent response yet, safe to reply
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: errMsg, ephemeral: true });
        } else {
          await interaction.reply({ content: errMsg, ephemeral: true });
        }
      } catch (_) { /* ignore */ }
    }
    return;
  }

  // Handle per-schedule message modal submit
  if (interaction.customId.startsWith('schedule_msg_modal:')) {
    const scheduleId = parseInt(interaction.customId.split(':')[1], 10);
    const guildId = interaction.guildId;
    const settings = getSettings(guildId);
    const lang = settings.language;

    try {
      const msgVal = interaction.fields.getTextInputValue('schedule_message').trim();
      // Backend validation: max 1000 chars
      if (msgVal.length > 1000) {
        await interaction.reply({
          content: t(lang, 'error.general'),
          ephemeral: true,
        });
        return;
      }

      const schedule = getScheduleById(scheduleId, guildId);
      if (!schedule) {
        await interaction.reply({ content: t(lang, 'error.general'), ephemeral: true });
        return;
      }

      const formattedTime = `${String(schedule.hour).padStart(2, '0')}:${String(schedule.minute).padStart(2, '0')}`;
      setScheduleMessage(scheduleId, guildId, msgVal || null);
      rescheduleGuild(client, guildId);

      const responseKey = msgVal ? 'message.schedule_set' : 'message.schedule_cleared';
      await interaction.reply({
        content: t(lang, responseKey, { time: formattedTime }),
        ephemeral: true,
      });
    } catch (err) {
      console.error(`[ModalSubmit:schedule_msg_modal:${scheduleId}]`, err);
      try {
        const errMsg = t(getSettings(guildId).language, 'error.general');
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: errMsg, ephemeral: true });
        } else {
          await interaction.reply({ content: errMsg, ephemeral: true });
        }
      } catch (_) { /* ignore */ }
    }
    return;
  }
}

async function handleMessageScheduleSelect(
  interaction: StringSelectMenuInteraction
): Promise<void> {
  if (!interaction.guildId) return;
  if (!(await checkAdminPermission(interaction as MessageComponentInteraction))) return;

  const guildId = interaction.guildId;
  const settings = getSettings(guildId);
  const lang = settings.language;
  const scheduleId = parseInt(interaction.values[0], 10);
  const schedule = getScheduleById(scheduleId, guildId);

  if (!schedule) {
    await interaction.update({ content: t(lang, 'error.general'), components: [] });
    return;
  }

  await showScheduleMessageModal(interaction, schedule.id, schedule.hour, schedule.minute, schedule.customMessage, lang);
}

async function handleScheduleSetMsgButton(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.guildId) return;
  if (!(await checkAdminPermission(interaction as MessageComponentInteraction))) return;

  const guildId = interaction.guildId;
  const settings = getSettings(guildId);
  const lang = settings.language;
  const scheduleId = parseInt(interaction.customId.split(':')[1], 10);
  const schedule = getScheduleById(scheduleId, guildId);

  if (!schedule) {
    await interaction.update({ content: t(lang, 'error.general'), components: [] });
    return;
  }

  await showScheduleMessageModal(interaction, schedule.id, schedule.hour, schedule.minute, schedule.customMessage, lang);
}

async function showScheduleMessageModal(
  interaction: StringSelectMenuInteraction | ButtonInteraction,
  scheduleId: number,
  hour: number,
  minute: number,
  currentMessage: string | null,
  lang: 'ja' | 'en'
): Promise<void> {
  const formattedTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

  const modal = new ModalBuilder()
    .setCustomId(`schedule_msg_modal:${scheduleId}`)
    .setTitle(t(lang, 'message.modal_title', { time: formattedTime }));

  const msgInput = new TextInputBuilder()
    .setCustomId('schedule_message')
    .setLabel(t(lang, 'message.modal_label'))
    .setStyle(TextInputStyle.Paragraph)
    .setValue(currentMessage ?? '')
    .setMaxLength(1000)
    .setRequired(false);

  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(msgInput));
  await interaction.showModal(modal);
}

async function main(): Promise<void> {
  validateEnv();

  await initDatabase();
  console.log('✅ Database initialized');
  audit(AuditAction.DB_INIT, { actor: 'system' });

  const token = process.env.DISCORD_TOKEN;
  if (!token) throw new Error('DISCORD_TOKEN is not set in environment');

  await client.login(token);
}

main().catch(async (err) => {
  console.error('Fatal error:', err);
  await sendAlert('Bot startup failed', {
    severity: 'critical',
    title: 'Startup Error',
    detail: String(err),
  }).catch(() => undefined);
  process.exit(1);
});
