const path = require('node:path');
const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, AttachmentBuilder, ButtonStyle } = require('discord.js');
const {
  ActionRowBuilder,
  ButtonBuilder,
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  SeparatorBuilder,
  StringSelectMenuBuilder,
  TextDisplayBuilder,
} = require('@discordjs/builders');
const { SeparatorSpacingSize } = require('discord-api-types/v10');

const dashboardBanner = path.join(__dirname, '..', 'assets', 'dasboard.png');

function makeDashboardContainer() {
  const container = new ContainerBuilder()
    .setAccentColor(0xb320d1)
    .addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder().setURL('attachment://orchid-dashboard.png'),
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        '# Orchid Customs\n' +
        'Welcome to **Orchid Customs**, creating a immense experience to your custom creations. We were founded on **August 26th 2026** and aim to provide high-quality, affordable products for all clients. Not only orders, but fun events and giveaways for all of our community.\n\n' +
        'Explore our Guidelines and Terms Of Service.',
      ),
    );

  const linkButtons = [
    new ButtonBuilder()
      .setLabel('Roblox Group')
      .setStyle(ButtonStyle.Link)
      .setURL('https://www.roblox.com/share/g/61223993'),
  ];

  container.addActionRowComponents(new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('support:open')
      .setLabel('Contact Support')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('careers:open')
      .setLabel('Careers')
      .setStyle(ButtonStyle.Secondary),
    ...linkButtons,
  ));

  return container
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('dashboard:index')
        .setPlaceholder('Information Index')
        .addOptions(
          { label: 'Guidelines', value: 'guidelines', description: 'Read the community guidelines.' },
          { label: 'Terms Of Service', value: 'terms-of-service', description: 'Read the terms of service.' },
        ),
    ))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('-# Orchid Management • Creativity, blooming'));
}

module.exports = {
  makeDashboardContainer,
  data: new SlashCommandBuilder()
    .setName('dashboard')
    .setDescription('Post the Orchid Management dashboard.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({ content: 'Run this command in a server channel.', flags: MessageFlags.Ephemeral });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await interaction.channel.send({
      files: [new AttachmentBuilder(dashboardBanner, { name: 'orchid-dashboard.png' })],
      components: [makeDashboardContainer()],
      flags: MessageFlags.IsComponentsV2,
    });
    await interaction.editReply({ content: 'Dashboard posted.' });
  },
};
