const { SlashCommandBuilder } = require('discord.js');
const { closeTicket } = require('../utils/tickets');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('close-request')
    .setDescription('Close a support request with a reason.')
    .addStringOption((option) => option
      .setName('reason')
      .setDescription('Why is this support request being closed?')
      .setRequired(true)
      .setMaxLength(500)),
  async execute(interaction) {
    return closeTicket(interaction, interaction.options.getString('reason'));
  },
};
