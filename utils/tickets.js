const path = require('node:path');
const {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  OverwriteType,
  PermissionFlagsBits,
} = require('discord.js');
const SUPPORT_ROLE_ID = '1552819101741879366';
const EXECUTIVE_ROLE_ID = '1552196838969573387';
const CLOSED_TICKETS_CHANNEL_ID = '1565624090142965760';
const ASSISTANCE_BANNER = path.join(__dirname, '..', 'assets', 'assistance.png');
const deletionTimers = new Map();

function getTicketInfo(channel) {
  if (channel?.type !== ChannelType.GuildText || !channel.topic) return null;
  const marker = channel.topic.indexOf('orchid-ticket;');
  if (marker < 0) return null;
  const openerText = channel.topic.slice(0, marker).replace(/^Opened by\s*/, '').replace(/\s*\|\s*$/, '');
  const fields = Object.fromEntries(channel.topic.slice(marker + 'orchid-ticket;'.length).split(';').map((part) => {
    const separator = part.indexOf('=');
    return separator < 0 ? [part, ''] : [part.slice(0, separator), part.slice(separator + 1)];
  }));
  if (!/^\d+$/.test(fields.owner || '') || !['open', 'closed'].includes(fields.status)) return null;
  return { ownerId: fields.owner, openerText, claimedId: fields.claimed || 'none', status: fields.status };
}

function isSupportStaff(interaction) {
  if (interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) return true;
  const roles = interaction.member?.roles;
  if (Array.isArray(roles)) {
    return roles.includes(SUPPORT_ROLE_ID) || roles.includes(EXECUTIVE_ROLE_ID);
  }
  return Boolean(roles?.cache?.has(SUPPORT_ROLE_ID) || roles?.cache?.has(EXECUTIVE_ROLE_ID));
}

function deleteTicketLater(channel, reason, delay = 5_000) {
  if (deletionTimers.has(channel.id)) return;
  const timer = setTimeout(() => {
    deletionTimers.delete(channel.id);
    channel.delete(reason).catch((error) => {
      console.error(`Could not delete closed ticket ${channel.id}:`, error);
    });
  }, delay);
  deletionTimers.set(channel.id, timer);
}

function cleanupClosedTickets(client) {
  for (const guild of client.guilds.cache.values()) {
    for (const channel of guild.channels.cache.values()) {
      const ticket = getTicketInfo(channel);
      if (ticket?.status === 'closed') {
        deleteTicketLater(channel, 'Removing a closed support ticket after bot restart', 1_000);
      }
    }
  }
}

async function createTranscript(channel) {
  const messages = [];
  let before;
  const maxMessages = 3_000;
  while (messages.length < maxMessages) {
    const batch = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) });
    if (!batch.size) break;
    messages.push(...batch.values());
    before = batch.last().id;
    if (batch.size < 100) break;
  }

  const sorted = messages.slice(0, maxMessages).sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  const transcriptMessages = sorted.map((message) => {
    const lines = [
      `[${new Date(message.createdTimestamp).toISOString()}] ${message.author.tag} (${message.author.id})`,
      (message.content || '[No text content]').slice(0, 1_000),
    ];
    if (message.content?.length > 1_000) lines.push('[Message text truncated]');
    for (const attachment of message.attachments.values()) {
      lines.push(`Attachment: ${attachment.name || 'file'} — ${attachment.url}`);
    }
    for (const embed of message.embeds) {
      const embedText = [embed.title, embed.description].filter(Boolean).join('\n');
      if (embedText) lines.push(`Embed: ${embedText}`);
    }
    return lines.join('\n');
  }).join('\n\n────────────────────────────────────────\n\n');
  const truncated = messages.length >= maxMessages ? '\n\n[Transcript limited to the latest 3,000 messages.]' : '';
  const transcript = [
    'ORCHID CUSTOMS — TICKET TRANSCRIPT',
    `Channel: ${channel.name} (${channel.id})`,
    `Generated: ${new Date().toISOString()}`,
    '',
    transcriptMessages || 'No messages were available for this transcript.',
    truncated,
  ].join('\n');
  return Buffer.from(transcript, 'utf8');
}

async function sendClosureReport(interaction, ticket, closeReason, originalChannelName) {
  const logChannel = await interaction.client.channels.fetch(CLOSED_TICKETS_CHANNEL_ID).catch(() => null);
  if (!logChannel || ![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(logChannel.type)) {
    throw new Error(`Closed-ticket log channel ${CLOSED_TICKETS_CHANNEL_ID} was not found or is not a text channel.`);
  }

  const channel = interaction.channel;
  const transcript = await createTranscript(channel);
  const transcriptName = `transcript-${channel.name.replace(/[^a-z0-9-]/gi, '-').slice(0, 80)}.txt`;
  const closedAt = Math.floor(Date.now() / 1000);
  const embed = new EmbedBuilder()
    .setColor(0x49b8e9)
    .setTitle('Orchid Customs | Ticket Closed')
    .setImage('attachment://assistance.png')
    .addFields(
      { name: 'Ticket', value: `${originalChannelName} (${channel.id})`, inline: false },
      { name: 'Department', value: channel.parent?.name || 'Support', inline: true },
      { name: 'Opened By', value: `<@${ticket.ownerId}>`, inline: true },
      { name: 'Claimed By', value: ticket.claimedId === 'none' ? 'Unclaimed' : `<@${ticket.claimedId}>`, inline: true },
      { name: 'Closed By', value: `<@${interaction.user.id}>`, inline: true },
      { name: 'Closed', value: `<t:${closedAt}:F>`, inline: true },
      { name: 'Original Reason', value: closeReason.slice(0, 1024) || 'No reason provided.', inline: false },
      { name: 'Transcript', value: 'Full conversation attached below.', inline: false },
    );

  await logChannel.send({
    embeds: [embed],
    files: [new AttachmentBuilder(ASSISTANCE_BANNER, { name: 'assistance.png' })],
    allowedMentions: { parse: [] },
  });
  await logChannel.send({
    content: `📄 Transcript for **${originalChannelName}** is attached below.`,
    files: [new AttachmentBuilder(transcript, { name: transcriptName })],
    allowedMentions: { parse: [] },
  });
}

async function closeTicket(interaction, reason) {
  const ticket = getTicketInfo(interaction.channel);
  if (!ticket) {
    return interaction.reply({ content: 'This command only works inside an Orchid support ticket.', flags: MessageFlags.Ephemeral });
  }
  if (interaction.user.id !== ticket.ownerId && !isSupportStaff(interaction)) {
    return interaction.reply({ content: 'Only the ticket opener or support staff can close this ticket.', flags: MessageFlags.Ephemeral });
  }
  if (ticket.status !== 'open') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await interaction.editReply({ content: 'This ticket is already closed. Its channel will be deleted in 5 seconds.' });
    deleteTicketLater(interaction.channel, 'Deleting an already-closed support ticket');
    return;
  }
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  }
  await interaction.editReply({ content: 'Closing this ticket…' });

  const closeReason = reason.trim();
  const channel = interaction.channel;
  const originalChannelName = channel.name;
  await channel.permissionOverwrites.edit(ticket.ownerId, {
    SendMessages: false,
    AddReactions: false,
  }, {
    type: OverwriteType.Member,
    reason: `Ticket closed by ${interaction.user.tag}: ${closeReason}`,
  });
  await channel.setTopic(`Opened by ${ticket.openerText} | orchid-ticket;owner=${ticket.ownerId};claimed=${ticket.claimedId};status=closed`);
  if (!channel.name.startsWith('closed-')) {
    await channel.setName(`closed-${channel.name}`.slice(0, 100));
  }
  await channel.send({
    content: `🔒 Ticket closed by <@${interaction.user.id}>.\n**Reason:** ${closeReason}`,
    allowedMentions: { users: [interaction.user.id] },
  });

  try {
    await sendClosureReport(interaction, ticket, closeReason, originalChannelName);
  } catch (error) {
    console.error(`Could not send the closure report for ticket ${channel.id}:`, error);
  }

  const confirmation = `Ticket closed. Reason: ${closeReason}`;
  await interaction.editReply({ content: `${confirmation} This ticket channel will be deleted in 5 seconds.` });
  deleteTicketLater(channel, `Closed ticket deleted: ${closeReason}`);
}

async function requestCloseTicket(interaction, reason) {
  const ticket = getTicketInfo(interaction.channel);
  if (!ticket) {
    return interaction.reply({ content: 'This command only works inside an Orchid support ticket.', flags: MessageFlags.Ephemeral });
  }
  if (interaction.user.id !== ticket.ownerId && !isSupportStaff(interaction)) {
    return interaction.reply({ content: 'Only the ticket opener or support staff can request to close this ticket.', flags: MessageFlags.Ephemeral });
  }
  if (ticket.status !== 'open') {
    return interaction.reply({ content: 'This ticket is already closed.', flags: MessageFlags.Ephemeral });
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const requestMessage = await interaction.channel.send({
    content: `<@${ticket.ownerId}> this ticket has been requested to be closed by <@${interaction.user.id}>\n**Reason:** ${reason.trim()}`,
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`ticket:close-request:approve:${ticket.ownerId}`)
        .setLabel('Approve')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`ticket:close-request:deny:${ticket.ownerId}`)
        .setLabel('Deny')
        .setStyle(ButtonStyle.Danger),
    )],
    allowedMentions: { users: [interaction.user.id] },
  });
  return interaction.editReply({ content: `Close request sent: ${requestMessage.url}` });
}

async function handleCloseRequestButton(interaction) {
  const [, , decision, ownerId] = interaction.customId.split(':');
  const ticket = getTicketInfo(interaction.channel);
  if (!ticket || ticket.ownerId !== ownerId || ticket.status !== 'open') {
    return interaction.reply({ content: 'This close request is no longer active.', flags: MessageFlags.Ephemeral });
  }
  if (!isSupportStaff(interaction)) {
    return interaction.reply({ content: 'Only Support Staff or Executive Board can approve or deny close requests.', flags: MessageFlags.Ephemeral });
  }
  if (interaction.message.components.every((row) => row.components.every((button) => button.disabled))) {
    return interaction.reply({ content: 'This close request has already been decided.', flags: MessageFlags.Ephemeral });
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const disabledRows = interaction.message.components.map((row) =>
    ActionRowBuilder.from(row).setComponents(
      ...row.components.map((component) => ButtonBuilder.from(component).setDisabled(true)),
    ),
  );
  await interaction.message.edit({ components: disabledRows });

  if (decision === 'approve') {
    const reason = interaction.message.content.match(/\*\*Reason:\*\* ([\s\S]*)$/)?.[1] || 'Close request approved.';
    await interaction.editReply({ content: 'Close request approved. Closing the ticket…' });
    return closeTicket(interaction, reason);
  }

  await interaction.channel.send({
    content: `<@${interaction.user.id}> has denied this close request. The ticket will remain open.`,
    allowedMentions: { users: [interaction.user.id] },
  });
  return interaction.editReply({ content: 'Close request denied. The ticket remains open.' });
}

async function handle(interaction) {
  if (!interaction.isButton()) return;

  if (interaction.customId.startsWith('ticket:claim:')) {
    const ticket = getTicketInfo(interaction.channel);
    if (!ticket || ticket.status !== 'open') {
      return interaction.reply({ content: 'This ticket is not open.', flags: MessageFlags.Ephemeral });
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    if (!isSupportStaff(interaction)) {
      return interaction.editReply({ content: 'Only support staff can claim this ticket.' });
    }
    if (ticket.claimedId !== 'none') {
      return interaction.editReply({ content: `This ticket has already been claimed by <@${ticket.claimedId}>.` });
    }

    await interaction.channel.setTopic(`Opened by ${ticket.openerText} | orchid-ticket;owner=${ticket.ownerId};claimed=${interaction.user.id};status=open`);
    await interaction.channel.send({
      content: `<@${interaction.user.id}> has claimed this ticket.`,
      allowedMentions: { users: [interaction.user.id] },
    });
    return interaction.editReply({ content: 'You have claimed this ticket.' });
  }

  if (interaction.customId.startsWith('ticket:close-request:')) {
    return handleCloseRequestButton(interaction);
  }

  if (interaction.customId.startsWith('ticket:close:')) {
    return closeTicket(interaction, 'Closed using the ticket button.');
  }
}

module.exports = { cleanupClosedTickets, closeTicket, getTicketInfo, handle, isSupportStaff, requestCloseTicket };
