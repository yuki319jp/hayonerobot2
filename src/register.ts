/**
 * Register slash commands with Discord API.
 * Run once: npm run register
 */
import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { commands } from './commands';

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token) throw new Error('DISCORD_TOKEN is not set');
if (!clientId) throw new Error('CLIENT_ID is not set');

const rest = new REST({ version: '10' }).setToken(token);
const body = [...commands.values()].map((c) => c.data.toJSON());

async function register(): Promise<void> {
  if (guildId) {
    // Guild-specific (instant, for development)
    await rest.put(Routes.applicationGuildCommands(clientId!, guildId), { body });
    console.log(`✅ Registered ${body.length} commands to guild ${guildId}`);
  } else {
    // Global (up to 1 hour to propagate)
    await rest.put(Routes.applicationCommands(clientId!), { body });
    console.log(`✅ Registered ${body.length} global commands`);
  }
}

register().catch((err) => {
  console.error('Failed to register commands:', err);
  process.exit(1);
});
