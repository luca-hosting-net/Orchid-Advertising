const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('verify')
    .setDescription('Post the CAPTCHA verification panel in this channel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({ content: 'Run this command in a server channel.', flags: MessageFlags.Ephemeral });
    }

    const panel = new EmbedBuilder()
      .setColor(0x8b5cf6)
      .setTitle('Server verification')
      .setDescription('Press the button below to complete a quick CAPTCHA and unlock the server.');
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('verification:start')
        .setLabel('Verify')
        .setStyle(ButtonStyle.Success),
    );

    await interaction.channel.send({ embeds: [panel], components: [row] });
    await interaction.reply({ content: 'Verification panel posted.', flags: MessageFlags.Ephemeral });
  },
};
