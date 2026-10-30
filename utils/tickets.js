const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  MessageFlags,
  OverwriteType,
  PermissionFlagsBits,
} = require('discord.js');
const SUPPORT_ROLE_ID = '1552819101741879366';
const EXECUTIVE_ROLE_ID = '1552196838969573387';
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
    content: `The user that does the close request has requested to close this ticket.\n**Requested by:** <@${interaction.user.id}>\n**Reason:** ${reason.trim()}`,
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
