const path = require('node:path');
const {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  SeparatorBuilder,
  StringSelectMenuBuilder,
  TextDisplayBuilder,
  TextInputBuilder,
  TextInputStyle,
  LabelBuilder,
  WebhookClient,
} = require('discord.js');
const { SeparatorSpacingSize } = require('discord-api-types/v10');
const { getTicketInfo, handle: handleTicket } = require('./tickets');
const { makeDashboardContainer } = require('../commands/dashboard');

const DASHBOARD_BANNER = path.join(__dirname, '..', 'assets', 'dasboard.png');
const MARKETPLACE_BANNER = path.join(__dirname, '..', 'assets', 'portfolio (2).png');
const MARKETPLACE_FOOTER = path.join(__dirname, '..', 'assets', 'marketplace-footer.png');
const SUPPORT_CATEGORY_ID = '1562205751814922290';
const SUPPORT_ROLE_ID = '1552819101741879366';
const EXECUTIVE_ROLE_ID = '1552196838969573387';
const MARKETPLACE_CATEGORY_ID = '1564360187891032144';
const faqResponseTokens = new Map();

function marketplacePanel(category = 'ads') {
  const base = new ContainerBuilder()
    .setAccentColor(0xb320d1)
    .addMediaGalleryComponents(panelImage('marketplace-banner.png'))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

  const descriptions = {
    ads: '# Advertisements & Sponsored Giveaways\n\nGame pass links are not available yet. After purchasing a package, open the Marketplace Panel and select **Claim Purchase** to receive your package. Once claimed, you will be added to the queue. Please note that queue times may vary based on demand.\n\n---\n**Everyone Ping**\nBuy an everyone ping for your server — perfect for promoting a sponsored giveaway or running a paid advertisement.\n\n---\n**Here Ping**\nPurchase a here ping for your server — ideal for promoting a sponsored giveaway or running a paid advertisement.\n\n---\n**Paid Channel**\nGet your own custom channel on the server for 30 days — perfect for hosting giveaways and running advertisements.\n\n---\n**Priority & Instant Postage**\nPriority can skip a large portion of the giveaway queue. Instant Postage means your advertisement or sponsored giveaway will be posted within 12 hours of purchase. If there is more than one ahead in the queue, it may take up to 24 hours.',
    membership: '# Our Membership\n\nExplore membership options and benefits in our Roblox group. Open a Marketplace ticket if you need help choosing or have a question.',
    donations: '# Donations\n\nDonations support the community and help us continue running events and giveaways. Open a Marketplace ticket if you have a question before donating.',
    booster: '# Booster Perks\n\nThank you for boosting the server! Open a Marketplace ticket if you need help with your booster perks.',
  };

  base.addTextDisplayComponents(new TextDisplayBuilder().setContent(descriptions[category] || descriptions.ads));
  if (category === 'ads') {
    base.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
      .addActionRowComponents(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('marketplace:ticket:Priority').setLabel('Purchase Priority').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('marketplace:ticket:Instant Postage').setLabel('Purchase Instant Postage').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('marketplace:ticket:Marketplace Purchase').setLabel('Purchase').setStyle(ButtonStyle.Primary),
      ));
  }

  return base.addMediaGalleryComponents(panelImage('marketplace-footer.png'));
}

function makeMarketplacePanel() {
  return new ContainerBuilder()
    .setAccentColor(0x29252b)
    .addMediaGalleryComponents(panelImage('marketplace-banner.png'))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(
      '# Marketplace\n' +
      'Explore our store with our wide range of products, ranging from advertisements all the way to our carefully designed memberships. Please note that we don\'t offer any refunds no matter the circumstances.',
    ))
    .addActionRowComponents(new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('marketplace:category')
        .setPlaceholder('Browse our products!')
        .addOptions(
          { label: 'Advertisements & Sponsored Giveaways', value: 'ads' },
          { label: 'Our Membership', value: 'membership' },
          { label: 'Donations', value: 'donations' },
          { label: 'Booster Perks', value: 'booster' },
        ),
    ))
    .addActionRowComponents(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('marketplace:claim').setLabel('Claim Purchase').setEmoji('🎁').setStyle(ButtonStyle.Primary),
    ))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addMediaGalleryComponents(panelImage('marketplace-footer.png'));
}

function marketplaceFiles() {
  return [
    new AttachmentBuilder(MARKETPLACE_BANNER, { name: 'marketplace-banner.png' }),
    new AttachmentBuilder(MARKETPLACE_FOOTER, { name: 'marketplace-footer.png' }),
  ];
}

function panelImage(filename = 'orchid-dashboard.png') {
  return new MediaGalleryBuilder().addItems(
    new MediaGalleryItemBuilder().setURL(`attachment://${filename}`),
  );
}

function createFaqPanel() {
  return new ContainerBuilder()
    .setAccentColor(0xb320d1)
    .addMediaGalleryComponents(panelImage())
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(
      '# Frequently Asked Questions\n' +
      '**Q:** What’s your paid advertisement queue? How can I claim it?\n' +
      '**A:** You can view all of our information via our marketplace channel, including the queue, how to claim it, and exact approximate dates. Don’t open a ticket for this issue.\n\n' +
      '---\n' +
      '**Q:** What should I do if my designer isn’t responding? Do I spam ping them?\n' +
      '**A:** Spamming your designer will get your order closed — no refunds. We suggest opening a ticket and a creative supervisor will assist you.\n\n' +
      '---\n' +
      '**Q:** A member of your community needs to be blacklisted, can I report them?\n' +
      '**A:** We don’t accept reports outside of our server unless Orchid Customs is specifically included or a member of our staff is involved in breaking ToS.\n\n' +
      '---\n' +
      '**Q:** Are you guys accepting applications for designers and support?\n' +
      '**A:** We are actively looking for applications for designers and Support Staff.',
    ))
    .addActionRowComponents(new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('support:ticket')
        .setLabel("This didn't answer my question.")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('support:cancel')
        .setLabel('Cancel Support Request')
        .setStyle(ButtonStyle.Secondary),
    ));
}

function makeTicketModal() {
  return new ModalBuilder()
    .setCustomId('support:submit')
    .setTitle('Open a Support Ticket')
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(
      '⚠️ This form will be submitted to Orchid Management. Do not share passwords or other sensitive information.',
    ))
    .addLabelComponents(new LabelBuilder()
      .setLabel('Reason for opening this ticket')
      .setDescription('Please be as descriptive as possible')
      .setTextInputComponent(new TextInputBuilder()
        .setCustomId('reason')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(1000)))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(
      '⚠️ Do not ping staff after submitting. Please wait patiently for a response.',
    ));
}

function ticketName(username, userId) {
  const slug = username.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 65);
  return `ticket-${slug || 'member'}-${userId.slice(-5)}`.slice(0, 100);
}

async function createTicket(interaction, reason, categoryId = SUPPORT_CATEGORY_ID, ticketType = 'General Support') {
  const category = await interaction.guild.channels.fetch(categoryId).catch(() => null);
  if (!category || category.type !== ChannelType.GuildCategory) {
    return interaction.editReply({
      content: `The configured ticket category ${categoryId} could not be found. Ask a server administrator to check the category ID.`,
    });
  }

  const duplicate = category.children.cache.find((channel) => {
    const ticket = getTicketInfo(channel);
    return ticket?.ownerId === interaction.user.id && ticket.status === 'open';
  });
  if (duplicate) {
    return interaction.editReply({ content: `You already have an open support ticket: ${duplicate}.` });
  }

  const [supportRole, executiveRole] = await Promise.all([
    interaction.guild.roles.fetch(SUPPORT_ROLE_ID).catch(() => null),
    interaction.guild.roles.fetch(EXECUTIVE_ROLE_ID).catch(() => null),
  ]);
  if (!supportRole || !executiveRole) {
    return interaction.editReply({
      content: 'The configured Support Staff or Executive role was not found in this server. Check the role IDs.',
    });
  }

  const permissionOverwrites = [
    { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: interaction.user.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles],
    },
  ];
  const botId = interaction.client.user.id;
  permissionOverwrites.push({
    id: botId,
    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels],
  });
  for (const role of [supportRole, executiveRole]) {
    permissionOverwrites.push({
      id: role.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
    });
  }

  const channel = await interaction.guild.channels.create({
    name: ticketName(interaction.user.username, interaction.user.id),
    type: ChannelType.GuildText,
    parent: category.id,
    topic: `Opened by ${interaction.user.username} | orchid-ticket;owner=${interaction.user.id};claimed=none;status=open`,
    permissionOverwrites,
    reason: `Support ticket opened by ${interaction.user.tag}`,
  });

  const roleTag = `<@&${supportRole.id}>\n`;
  const createdAt = `<t:${Math.floor(interaction.user.createdTimestamp / 1000)}:D>`;
  const ticketPanel = new ContainerBuilder()
    .setAccentColor(0x1f8b75)
    .addMediaGalleryComponents(panelImage())
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(
      `${roleTag}# ${interaction.guild.name} Support\n` +
      `## ${ticketType} Ticket\n` +
      (ticketType === 'Marketplace' ? 'Please explain what you want to purchase and include any relevant details. Our team will help with the next steps.\n\n' : 'Hello, thank you for reaching out! A member of staff will be with you as soon as possible. Please refrain from pinging them, as they have already been notified.\n\n') +
      '---\n' +
      '## Ticket Details\n' +
      `**Category:** ${ticketType}\n**Reason:** ${reason.replace(/\n/g, '\n> ') || 'No reason provided.'}\n\n` +
      '---\n' +
      '## User Information\n' +
      `**User:** <@${interaction.user.id}>\n` +
      `**Account Created:** ${createdAt}\n` +
      `**User ID:** ${interaction.user.id}`,
    ))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`ticket:claim:${interaction.user.id}`)
        .setLabel('Claim')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`ticket:close:${interaction.user.id}`)
        .setLabel('Close')
        .setStyle(ButtonStyle.Danger),
    ));

  try {
    await channel.send({
      files: [new AttachmentBuilder(DASHBOARD_BANNER, { name: 'orchid-dashboard.png' })],
      components: [ticketPanel],
      flags: MessageFlags.IsComponentsV2,
      allowedMentions: { roles: [supportRole.id], users: [] },
    });
  } catch (error) {
    await channel.delete('Ticket panel could not be created');
    throw error;
  }

  return interaction.editReply({ content: `Your support ticket is ready: ${channel}.` });
}

async function handle(interaction) {
  if (interaction.isStringSelectMenu() && interaction.customId === 'marketplace:category') {
    return interaction.reply({
      files: marketplaceFiles(),
      components: [marketplacePanel(interaction.values[0])],
      flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    });
  }

  if (interaction.isButton()) {
    if (interaction.customId === 'marketplace:claim') {
      if (!interaction.guild) {
        return interaction.reply({ content: 'Marketplace tickets can only be opened in a server.', flags: MessageFlags.Ephemeral });
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      return createTicket(interaction, 'Marketplace purchase claim', MARKETPLACE_CATEGORY_ID, 'Marketplace');
    }

    if (interaction.customId.startsWith('marketplace:ticket:')) {
      if (!interaction.guild) {
        return interaction.reply({ content: 'Marketplace tickets can only be opened in a server.', flags: MessageFlags.Ephemeral });
      }
      const purchaseType = interaction.customId.slice('marketplace:ticket:'.length);
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      return createTicket(interaction, `Marketplace purchase: ${purchaseType}`, MARKETPLACE_CATEGORY_ID, 'Marketplace');
    }

    if (interaction.customId === 'support:open') {
      const faq = createFaqPanel();
      await interaction.reply({
        files: [new AttachmentBuilder(DASHBOARD_BANNER, { name: 'orchid-dashboard.png' })],
        components: [faq],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });
      const faqMessage = await interaction.fetchReply().catch(() => null);
      if (faqMessage) {
        faqResponseTokens.set(faqMessage.id, {
          token: interaction.token,
          expiresAt: Date.now() + 14 * 60 * 1000,
        });
      }
      return;
    }

    if (interaction.customId === 'support:ticket') {
      return interaction.showModal(makeTicketModal());
    }

    if (interaction.customId === 'support:cancel') {
      const saved = faqResponseTokens.get(interaction.message.id);
      faqResponseTokens.delete(interaction.message.id);
      await interaction.deferUpdate();
      if (saved && saved.expiresAt > Date.now()) {
        try {
          const webhook = new WebhookClient({ id: interaction.applicationId, token: saved.token });
          await webhook.deleteMessage(interaction.message.id);
          webhook.destroy();
          return;
        } catch (error) {
          console.warn('Could not delete the original FAQ response; restoring the dashboard view.', error);
        }
      }
      const attachments = interaction.message.attachments.map((attachment) => ({
        id: attachment.id,
        filename: attachment.name,
      }));
      try {
        return await interaction.editReply({
          attachments,
          components: [makeDashboardContainer()],
        });
      } catch {
        return;
      }
    }

    if (interaction.customId.startsWith('ticket:claim:') || interaction.customId.startsWith('ticket:close:')) {
      return handleTicket(interaction);
    }
  }

  if (interaction.isModalSubmit() && interaction.customId === 'support:submit') {
    if (!interaction.guild) {
      return interaction.reply({ content: 'Support tickets can only be opened in a server.', flags: MessageFlags.Ephemeral });
    }
    const reason = interaction.fields.getTextInputValue('reason').trim();
    if (reason.length < 10) {
      return interaction.reply({ content: 'Please provide at least 10 characters so the support team can help you.', flags: MessageFlags.Ephemeral });
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    return createTicket(interaction, reason);
  }
}

module.exports = { handle, makeMarketplacePanel, marketplaceFiles };
