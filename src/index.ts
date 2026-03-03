import 'dotenv/config';
import {
  Client,
  GatewayIntentBits,
  Interaction,
  Events,
  ModalSubmitInteraction,
} from 'discord.js';
import { initDatabase, getSettings, saveSettings } from './database';
import { commands } from './commands';
import { scheduleAll, rescheduleGuild } from './tasks/nightWarn';
import { t } from './i18n';

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once(Events.ClientReady, (readyClient) => {
  console.log(`✅ Logged in as ${readyClient.user.tag}`);
  scheduleAll(readyClient);
});

client.on(Events.InteractionCreate, async (interaction: Interaction) => {
  if (interaction.isModalSubmit()) {
    await handleModalSubmit(interaction as ModalSubmitInteraction);
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
      rescheduleGuild(client, interaction.guildId);
    }
  } catch (err) {
    console.error(`[Command:${interaction.commandName}]`, err);
    const settings = getSettings(interaction.guildId);
    const errMsg = t(settings.language, 'error.general');
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: errMsg, ephemeral: true });
    } else {
      await interaction.reply({ content: errMsg, ephemeral: true });
    }
  }
});

async function handleModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  if (!interaction.guildId) return;

  if (interaction.customId === 'setup_modal') {
    const guildId = interaction.guildId;
    const settings = getSettings(guildId);
    const lang = settings.language;
    const messages: string[] = [];

    try {
      const languageVal = interaction.fields.getTextInputValue('language').trim().toLowerCase();
      if (languageVal === 'ja' || languageVal === 'en') {
        settings.language = languageVal;
        messages.push(t(languageVal, 'setup.language_set', { lang: languageVal === 'ja' ? '日本語' : 'English' }));
      }

      const enabledVal = interaction.fields.getTextInputValue('enabled').trim().toLowerCase();
      if (enabledVal === 'on' || enabledVal === 'true' || enabledVal === '1') {
        settings.enabled = true;
        messages.push(t(settings.language, 'setup.enabled'));
      } else if (enabledVal === 'off' || enabledVal === 'false' || enabledVal === '0') {
        settings.enabled = false;
        messages.push(t(settings.language, 'setup.disabled'));
      }

      const warnTimeVal = interaction.fields.getTextInputValue('warn_time').trim();
      const timeMatch = warnTimeVal.match(/^(\d{1,2}):(\d{2})$/);
      if (timeMatch) {
        const h = parseInt(timeMatch[1], 10);
        const m = parseInt(timeMatch[2], 10);
        if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
          settings.warnHour = h;
          settings.warnMinute = m;
          messages.push(`⏰ ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
        } else {
          messages.push(t(settings.language, 'error.invalid_time'));
        }
      } else {
        messages.push(t(settings.language, 'error.invalid_time'));
      }

      const channelIdVal = interaction.fields.getTextInputValue('channel_id').trim();
      if (channelIdVal) {
        settings.channelId = channelIdVal;
        messages.push(t(settings.language, 'setup.channel_set', { channel: `<#${channelIdVal}>` }));
      } else {
        settings.channelId = null;
        messages.push(t(settings.language, 'setup.channel_cleared'));
      }

      const customMsgVal = interaction.fields.getTextInputValue('custom_message').trim();
      settings.customMessage = customMsgVal || null;

      saveSettings(settings);
      rescheduleGuild(client, guildId);

      await interaction.reply({ content: messages.join('\n'), ephemeral: true });
    } catch (err) {
      console.error('[ModalSubmit:setup_modal]', err);
      await interaction.reply({ content: t(lang, 'error.general'), ephemeral: true });
    }
  }
}

async function main(): Promise<void> {
  await initDatabase();
  console.log('✅ Database initialized');

  const token = process.env.DISCORD_TOKEN;
  if (!token) throw new Error('DISCORD_TOKEN is not set in environment');

  await client.login(token);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
