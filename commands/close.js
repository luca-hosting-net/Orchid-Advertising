const { SlashCommandBuilder } = require('discord.js');
const { closeTicket } = require('../utils/tickets');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('close')
    .setDescription('Close the current support ticket with a reason.')
    .addStringOption((option) => option
      .setName('reason')
      .setDescription('Why is this ticket being closed?')
      .setRequired(true)
      .setMaxLength(500)),
  async execute(interaction) {
    return closeTicket(interaction, interaction.options.getString('reason'));
  },
};
