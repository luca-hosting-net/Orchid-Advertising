const fs = require('node:fs');
const path = require('node:path');
const { REST, Routes } = require('discord.js');
require('dotenv').config();

const { DISCORD_TOKEN: token, CLIENT_ID: clientId, GUILD_ID: guildId } = process.env;
if (!token || !clientId) {
  console.error('Set DISCORD_TOKEN and CLIENT_ID in .env before deploying commands.');
  process.exit(1);
}

function getJsFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? getJsFiles(fullPath) : entry.isFile() && entry.name.endsWith('.js') ? [fullPath] : [];
  });
}

const commands = [];
for (const file of getJsFiles(path.join(__dirname, 'commands'))) {
  const command = require(file);
  if (!command.data?.toJSON || typeof command.execute !== 'function') {
    console.warn(`Skipping ${file}: expected a SlashCommandBuilder data object and execute().`);
    continue;
  }
  commands.push(command.data.toJSON());
}

const rest = new REST({ version: '10' }).setToken(token);
const route = guildId
  ? Routes.applicationGuildCommands(clientId, guildId)
  : Routes.applicationCommands(clientId);

(async () => {
  try {
    await rest.put(route, { body: commands });
    console.log(`Deployed ${commands.length} ${guildId ? 'guild' : 'global'} slash command(s).`);
  } catch (error) {
    console.error('Failed to deploy slash commands:', error);
    process.exitCode = 1;
  }
})();
