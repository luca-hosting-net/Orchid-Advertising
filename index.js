const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits, MessageFlags } = require('discord.js');
const verification = require('./utils/verification');
const dashboard = require('./utils/dashboard');
const support = require('./utils/support');
const careers = require('./utils/careers');
const { cleanupClosedTickets } = require('./utils/tickets');
require('dotenv').config();

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('Missing DISCORD_TOKEN. Copy .env.example to .env and set your bot token.');
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();

function getJsFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? getJsFiles(fullPath) : entry.isFile() && entry.name.endsWith('.js') ? [fullPath] : [];
  });
}

for (const file of getJsFiles(path.join(__dirname, 'commands'))) {
  const command = require(file);
  if (!command.data?.name || typeof command.execute !== 'function') {
    console.warn(`Skipping ${file}: expected data.name and execute().`);
    continue;
  }
  client.commands.set(command.data.name, command);
}

for (const file of getJsFiles(path.join(__dirname, 'events'))) {
  const event = require(file);
  if (!event.name || typeof event.execute !== 'function') {
    console.warn(`Skipping ${file}: expected name and execute().`);
    continue;
  }
  const handler = (...args) => event.execute(...args, client);
  if (event.once) client.once(event.name, handler);
  else client.on(event.name, handler);
}

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) {
    try {
      await careers.handle(interaction);
      await support.handle(interaction);
      await dashboard.handle(interaction);
      await verification.handle(interaction);
    } catch (error) {
      console.error('Interaction failed:', error);
      const detail = error.rawError?.errors
        ? `${error.rawError.message || error.message}: ${JSON.stringify(error.rawError.errors)}`
        : error.rawError?.message || error.message || 'Unknown error';
      const code = error.code ? ` (${error.code})` : '';
      const reply = {
        content: `That action ran into an error${code}: ${String(detail).slice(0, 700)}`,
        flags: MessageFlags.Ephemeral,
      };
      if (interaction.isRepliable() && (interaction.deferred || interaction.replied)) await interaction.editReply(reply);
      else if (interaction.isRepliable() && !interaction.replied) await interaction.reply(reply);
    }
    return;
  }
  const command = client.commands.get(interaction.commandName);
  if (!command) return;
  try {
    await command.execute(interaction, client);
  } catch (error) {
    console.error(`Command ${interaction.commandName} failed:`, error);
    const reply = { content: 'There was an error while running this command.', flags: MessageFlags.Ephemeral };
    if (interaction.replied || interaction.deferred) await interaction.editReply(reply);
    else await interaction.reply(reply);
  }
});

client.once('ready', (readyClient) => {
  console.log(`Ready: ${readyClient.user.tag} (${readyClient.commands.size} commands loaded)`);
  cleanupClosedTickets(readyClient);
});

client.login(token).catch((error) => {
  console.error('Failed to log in to Discord:', error);
  process.exitCode = 1;
});
