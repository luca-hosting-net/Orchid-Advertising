const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { makeMarketplacePanel, marketplaceFiles } = require('../utils/support');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('marketplace')
    .setDescription('Post the Marketplace panel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({ content: 'Run this command in a server channel.', flags: MessageFlags.Ephemeral });
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      await interaction.channel.send({
        files: marketplaceFiles(),
        components: [makeMarketplacePanel()],
        flags: MessageFlags.IsComponentsV2,
      });
      return interaction.editReply({ content: 'Marketplace panel posted.' });
    } catch (error) {
      console.error('Marketplace panel could not be posted:', error);
      const detail = error.code ? `Discord error ${error.code}` : (error.message || 'unknown error');
      return interaction.editReply({
        content: `I could not post the Marketplace panel (${String(detail).slice(0, 250)}). Check that I can view and send messages in this channel, attach files, and use components.`,
      });
    }
  },
};
