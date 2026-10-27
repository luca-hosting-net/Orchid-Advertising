const { ChannelType, MessageFlags, PermissionFlagsBits } = require('discord.js');
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
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  await interaction.editReply({ content: 'Closing this ticket…' });

  const closeReason = reason.trim();
  const channel = interaction.channel;
  await channel.permissionOverwrites.edit(ticket.ownerId, {
    SendMessages: false,
    AddReactions: false,
  }, `Ticket closed by ${interaction.user.tag}: ${closeReason}`);
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

  if (interaction.customId.startsWith('ticket:close:')) {
    return closeTicket(interaction, 'Closed using the ticket button.');
  }
}

module.exports = { cleanupClosedTickets, closeTicket, getTicketInfo, handle, isSupportStaff };
