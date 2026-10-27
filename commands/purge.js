const { SlashCommandBuilder, MessageFlags } = require('discord.js');

const EXECUTIVE_BOARD_ROLE = 'Executive Board';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Delete a number of recent messages in this channel (Executive Board only).')
    .addIntegerOption((option) => option
      .setName('amount')
      .setDescription('Number of messages to delete (1–100).')
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(100)),

  async execute(interaction) {
    const isExecutiveBoard = interaction.member?.roles?.cache?.some(
      (role) => role.name.toLowerCase() === EXECUTIVE_BOARD_ROLE.toLowerCase(),
    );

    if (!isExecutiveBoard) {
      return interaction.reply({
        content: 'Only members with the Executive Board role can use this command.',
        flags: MessageFlags.Ephemeral,
      });
    }

    if (!interaction.inGuild() || !interaction.channel?.isTextBased()) {
      return interaction.reply({
        content: 'This command can only be used in a server text channel.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const amount = interaction.options.getInteger('amount', true);
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      const deleted = await interaction.channel.bulkDelete(amount, true);
      return interaction.editReply({
        content: `Deleted ${deleted.size} message${deleted.size === 1 ? '' : 's'}. Messages older than 14 days are skipped by Discord.`,
      });
    } catch (error) {
      console.error('Purge command failed:', error);
      return interaction.editReply({
        content: 'I could not delete messages here. Check that I have the Manage Messages permission in this channel.',
      });
    }
  },
};
