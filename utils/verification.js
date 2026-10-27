const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  MessageFlags,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');

const challenges = new Map();
const CHALLENGE_TTL_MS = 2 * 60 * 1000;

async function handle(interaction) {
  if (interaction.isButton() && interaction.customId === 'verification:start') {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'Verification only works in a server.', flags: MessageFlags.Ephemeral });
    }

    const first = 2 + Math.floor(Math.random() * 8);
    const second = 2 + Math.floor(Math.random() * 8);
    challenges.set(interaction.user.id, {
      answer: String(first + second),
      guildId: interaction.guildId,
      expiresAt: Date.now() + CHALLENGE_TTL_MS,
    });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('verification:answer')
        .setLabel('Enter CAPTCHA answer')
        .setStyle(ButtonStyle.Primary),
    );
    return interaction.reply({
      content: `CAPTCHA: What is **${first} + ${second}**? This challenge expires in 2 minutes.`,
      components: [row],
      flags: MessageFlags.Ephemeral,
    });
  }

  if (interaction.isButton() && interaction.customId === 'verification:answer') {
    const challenge = challenges.get(interaction.user.id);
    if (!challenge || challenge.guildId !== interaction.guildId || challenge.expiresAt < Date.now()) {
      challenges.delete(interaction.user.id);
      return interaction.reply({ content: 'Your challenge expired. Press Verify to get a new one.', flags: MessageFlags.Ephemeral });
    }

    const modal = new ModalBuilder()
      .setCustomId('verification:submit')
      .setTitle('CAPTCHA verification')
      .addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('answer')
          .setLabel('Enter the answer')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(3),
      ));
    return interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId === 'verification:submit') {
    const challenge = challenges.get(interaction.user.id);
    if (!challenge || challenge.guildId !== interaction.guildId || challenge.expiresAt < Date.now()) {
      challenges.delete(interaction.user.id);
      return interaction.reply({ content: 'Your challenge expired. Press Verify to get a new one.', flags: MessageFlags.Ephemeral });
    }

    if (interaction.fields.getTextInputValue('answer').trim() !== challenge.answer) {
      challenges.delete(interaction.user.id);
      return interaction.reply({ content: 'That answer was incorrect. Press Verify to try a new challenge.', flags: MessageFlags.Ephemeral });
    }

    const roleId = process.env.VERIFIED_ROLE_ID;
    if (!roleId) {
      return interaction.reply({ content: 'Verification is not configured yet. Ask a server administrator to set VERIFIED_ROLE_ID.', flags: MessageFlags.Ephemeral });
    }

    const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
    const botMember = interaction.guild.members.me;
    if (!role || !botMember?.permissions.has('ManageRoles') || botMember.roles.highest.comparePositionTo(role) <= 0) {
      return interaction.reply({ content: 'I cannot assign the verified role. Check that it exists and is below my highest role, and that I have Manage Roles.', flags: MessageFlags.Ephemeral });
    }

    try {
      await interaction.member.roles.add(role, 'Passed server CAPTCHA verification');
      challenges.delete(interaction.user.id);
      return interaction.reply({ content: 'CAPTCHA passed. You are verified!', flags: MessageFlags.Ephemeral });
    } catch (error) {
      console.error('Could not assign verified role:', error);
      return interaction.reply({ content: 'I could not assign your verified role. Please contact a server administrator.', flags: MessageFlags.Ephemeral });
    }
  }
}

module.exports = { handle };
