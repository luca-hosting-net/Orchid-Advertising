const { SlashCommandBuilder, MessageFlags, ButtonStyle } = require('discord.js');
const { ActionRowBuilder, ButtonBuilder } = require('@discordjs/builders');

const ROBLOX_GROUP_URL = process.env.ROBLOX_GROUP_URL || 'https://www.roblox.com/share/g/61223993';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('purchase')
    .setDescription('Find the Roblox group for marketplace purchases.')
    .addStringOption((option) => option
      .setName('item')
      .setDescription('What would you like to purchase?')
      .setRequired(true)
      .addChoices(
        { name: 'Instant Postage', value: 'Instant Postage' },
        { name: 'Priority', value: 'Priority' },
        { name: 'Marketplace Purchase', value: 'Marketplace Purchase' },
      )),

  async execute(interaction) {
    const item = interaction.options.getString('item', true);
    return interaction.reply({
      content: `You selected **${item}**. Visit our Roblox group to find available purchases. If the game pass is not listed yet, it is not available for purchase yet.`,
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel('Open Roblox Group').setStyle(ButtonStyle.Link).setURL(ROBLOX_GROUP_URL),
      )],
      flags: MessageFlags.Ephemeral,
    });
  },
};
