import 'dotenv/config';
import {
  Client,
  GatewayIntentBits,
  Interaction,
  Events,
} from 'discord.js';
import { initDatabase } from './database';
import { commands } from './commands';
import { scheduleAll, rescheduleGuild } from './tasks/nightWarn';
import { t } from './i18n';
import { getSettings } from './database';

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once(Events.ClientReady, (readyClient) => {
  console.log(`✅ Logged in as ${readyClient.user.tag}`);
  scheduleAll(readyClient);
});

client.on(Events.InteractionCreate, async (interaction: Interaction) => {
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
    if (['setup', 'channelset', 'mention'].includes(interaction.commandName)) {
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

async function main(): Promise<void> {
  initDatabase();
  console.log('✅ Database initialized');

  const token = process.env.DISCORD_TOKEN;
  if (!token) throw new Error('DISCORD_TOKEN is not set in environment');

  await client.login(token);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
