import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import * as help from './help';
import * as settings from './settings';
import * as setup from './setup';
import * as channelset from './channelset';
import * as message from './message';
import * as mention from './mention';

interface Command {
  data: SlashCommandBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

export const commands: Map<string, Command> = new Map();

for (const cmd of [help, settings, setup, channelset, message, mention] as Command[]) {
  commands.set(cmd.data.name, cmd);
}
