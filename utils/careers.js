const path = require('node:path');
const {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  FileUploadBuilder,
  LabelBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
  ModalBuilder,
  SeparatorBuilder,
  StringSelectMenuBuilder,
  TextDisplayBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const { SeparatorSpacingSize } = require('discord-api-types/v10');

const CAREERS_BANNER = path.join(__dirname, '..', 'assets', 'careers.png');
const APPLICATION_CHANNEL_ID = '1561539883569512578';
const EXECUTIVE_BOARD_ROLE_ID = '1552196838969573387';
const applicationsInProgress = new Set();

function careerImage() {
  return new MediaGalleryBuilder().addItems(
    new MediaGalleryItemBuilder().setURL('attachment://orchid-careers.png'),
  );
}

function makeCareersPanel() {
  const container = new ContainerBuilder()
    .setAccentColor(0xb320d1)
    .addMediaGalleryComponents(careerImage())
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(
      '# Careers\n' +
      'Welcome to **Orchid Customs** careers. You can apply for positions in our Creative Department and Support Department when applications are open.\n\n' +
      '## Requirements\n' +
      '• Past experience in designing or support.\n' +
      '• Professionalism and activity.\n' +
      '• At least 13 years of age.\n' +
      '• Membership in our Roblox community to be paid.\n\n' +
      'Click an application to open the form.',
    ));

  return container
    .addActionRowComponents(new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('careers:designer')
        .setLabel('Designer Application')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('careers:support')
        .setLabel('Support Department')
        .setStyle(ButtonStyle.Secondary),
    ))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('-# Orchid Management • Careers'));
}

function makeDesignerModal() {
  const fields = new StringSelectMenuBuilder()
    .setCustomId('application:fields')
    .setPlaceholder('Select your fields')
    .setMinValues(1)
    .setMaxValues(6)
    .addOptions(
      { label: 'Bot', value: 'bot' },
      { label: 'Logo', value: 'logo' },
      { label: 'Banner', value: 'banner' },
      { label: 'Liveries', value: 'liveries' },
      { label: 'Discord Services', value: 'discord-services' },
      { label: 'Clothing', value: 'clothing' },
    );

  const modal = new ModalBuilder()
    .setCustomId('careers:designer-submit')
    .setTitle('Designer Application')
    .addLabelComponents(new LabelBuilder()
      .setLabel('What fields would you like to apply for?')
      .setStringSelectMenuComponent(fields))
    .addLabelComponents(new LabelBuilder()
      .setLabel('Profile details')
      .setDescription('Add Roblox, timezone, availability, portfolio link, and strengths. Don’t share passwords.')
      .setTextInputComponent(new TextInputBuilder()
        .setCustomId('profile')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Roblox, timezone, availability, portfolio link, strengths/areas to improve')
        .setRequired(true)
        .setMaxLength(1200)))
    .addLabelComponents(new LabelBuilder()
      .setLabel('What is your past experience?')
      .setDescription('Please be as descriptive as possible.')
      .setTextInputComponent(new TextInputBuilder()
        .setCustomId('experience')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(1200)))
    .addLabelComponents(new LabelBuilder()
      .setLabel('Why do you want to work at Orchid Customs?')
      .setDescription('Tell us why you would be a good fit.')
      .setTextInputComponent(new TextInputBuilder()
        .setCustomId('motivation')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(1200)));

  const upload = new FileUploadBuilder()
    .setCustomId('work-samples')
    .setMinValues(2)
    .setMaxValues(10)
    .setRequired(true);
  modal.addLabelComponents(new LabelBuilder()
    .setLabel('Portfolio Files')
    .setDescription('Upload 2–10 work photos. Please wait for HR to review your application.')
    .setFileUploadComponent(upload));
  return modal;
}

function parseProfile(profileText) {
  const values = {};
  for (const line of profileText.split(/\r?\n/)) {
    const splitAt = line.indexOf(':');
    if (splitAt > 0) {
      values[line.slice(0, splitAt).trim().toLowerCase()] = line.slice(splitAt + 1).trim();
    }
  }
  return values;
}

function reviewContainer(data, samples) {
  const value = (key) => data.profile[key] || 'Not provided';
  const portfolio = data.profile['portfolio link'];
  const portfolioStatus = portfolio && portfolio.toLowerCase() !== 'none' ? 'Provided' : 'Not yet provided';
  const safePortfolio = portfolio && portfolio.toLowerCase() !== 'none' && URL.canParse(portfolio) && /^https?:$/.test(new URL(portfolio).protocol)
    ? `<${portfolio}>`
    : 'Not yet provided';
  const gallery = new MediaGalleryBuilder().addItems(samples.map((sample, index) =>
    new MediaGalleryItemBuilder()
      .setURL(sample.url)
      .setDescription(`Work sample ${index + 1}: ${sample.name}`),
  ));

  return new ContainerBuilder()
    .setAccentColor(0x1f8b75)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(
      `<@&${EXECUTIVE_BOARD_ROLE_ID}>\n` +
      '# New Application\n' +
      `**Applicant:** <@${data.user.id}>\n` +
      '**Studio:** Creative Studio\n' +
      `**Applying for:** ${data.fields.map((field) => ({
        'discord-services': 'Discord Services',
      }[field] || field.charAt(0).toUpperCase() + field.slice(1))).join(', ')}`,
    ))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(
      '## Application answers\n' +
      `**Discord username / ID:** ${data.user.username} / ${data.user.id}\n\n` +
      `**Roblox username:** ${value('roblox username')}\n\n` +
      `**Timezone:** ${value('timezone')}\n\n` +
      `**Availability:** ${value('availability')}\n\n` +
      `**Portfolio status:** ${portfolioStatus}\n\n` +
      `**Portfolio link:** ${safePortfolio}`,
    ))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(
      `**Relevant experience**\n${data.experience}\n\n` +
      `**Why should we accept you?**\n${data.motivation}\n\n` +
      `**Strengths and areas to improve**\n${value('strengths and areas to improve')}`,
    ))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(
      `**Work samples:** ${samples.length} image(s) attached\n\n**Additional notes:** None`,
    ))
    .addMediaGalleryComponents(gallery)
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`application:accept:${data.user.id}`)
        .setLabel('Accept')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`application:deny:${data.user.id}`)
        .setLabel('Deny')
        .setStyle(ButtonStyle.Danger),
    ));
}

function getRoleIds(interaction) {
  const roles = interaction.member?.roles;
  return Array.isArray(roles) ? roles : [...(roles?.cache?.keys() || [])];
}

async function submitApplication(interaction) {
  const files = interaction.fields.getUploadedFiles('work-samples', true);
  const samples = [...files.values()];
  if (samples.length < 2 || samples.length > 10) {
    return interaction.reply({ content: 'Upload between 2 and 10 work samples.', flags: MessageFlags.Ephemeral });
  }
  const imageSamples = samples.filter((file) =>
    file.contentType?.startsWith('image/') || /\.(png|jpe?g|gif|webp|avif|bmp)$/i.test(file.name),
  );
  if (imageSamples.length !== samples.length) {
    return interaction.reply({ content: 'Every work sample must be an image (PNG, JPG, GIF, WebP, AVIF, or BMP). Please submit the form again with image files only.', flags: MessageFlags.Ephemeral });
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const channel = await interaction.guild.channels.fetch(APPLICATION_CHANNEL_ID).catch(() => null);
  if (!channel?.isTextBased() || typeof channel.send !== 'function') {
    return interaction.editReply({ content: `The application-pending channel ${APPLICATION_CHANNEL_ID} could not be found or is not a text channel.` });
  }
  const executiveRole = await interaction.guild.roles.fetch(EXECUTIVE_BOARD_ROLE_ID).catch(() => null);
  if (!executiveRole) {
    return interaction.editReply({ content: 'The Executive Board role could not be found. Ask an administrator to check its role ID.' });
  }

  const fields = interaction.fields.getStringSelectValues('application:fields');
  const profileText = interaction.fields.getTextInputValue('profile').trim();
  const experience = interaction.fields.getTextInputValue('experience').trim();
  const motivation = interaction.fields.getTextInputValue('motivation').trim();
  const data = { user: interaction.user, fields, profile: parseProfile(profileText), experience, motivation };
  const panel = reviewContainer(data, imageSamples);

  try {
    await channel.send({
      components: [panel],
      flags: MessageFlags.IsComponentsV2,
      allowedMentions: { roles: [executiveRole.id], users: [] },
    });
  } catch (error) {
    console.error('Could not post designer application:', error);
    return interaction.editReply({ content: 'I could not send your application to the pending channel. Please contact an administrator.' });
  }

  return interaction.editReply({
    content: 'Your application has been submitted. Please wait patiently for a member of HR to read it.',
  });
}

async function handleDecision(interaction) {
  if (!getRoleIds(interaction).includes(EXECUTIVE_BOARD_ROLE_ID)) {
    return interaction.reply({ content: 'Only the Executive Board can accept or deny applications.', flags: MessageFlags.Ephemeral });
  }

  const messageId = interaction.message.id;
  if (applicationsInProgress.has(messageId)) {
    return interaction.reply({ content: 'A decision is already being processed for this application.', flags: MessageFlags.Ephemeral });
  }
  const container = interaction.message.components[0]?.toJSON?.();
  if (!container || container.type !== 17) {
    return interaction.reply({ content: 'This application panel is invalid or no longer pending.', flags: MessageFlags.Ephemeral });
  }
  const buttonRows = container.components.filter((component) => component.type === 1);
  const decisionButtons = buttonRows.flatMap((row) => row.components).filter((button) =>
    button.custom_id?.startsWith('application:accept:') || button.custom_id?.startsWith('application:deny:'),
  );
  if (!decisionButtons.length || decisionButtons.every((button) => button.disabled)) {
    return interaction.reply({ content: 'This application has already been decided.', flags: MessageFlags.Ephemeral });
  }

  applicationsInProgress.add(messageId);
  const accepted = interaction.customId.startsWith('application:accept:');
  const applicantId = interaction.customId.split(':')[2];
  for (const button of decisionButtons) button.disabled = true;
  const title = container.components.find((component) => component.type === 10);
  if (title) title.content += `\n\n**Application status:** ${accepted ? 'Accepted' : 'Denied'}`;

  try {
    await interaction.update({ components: [container] });
    try {
      const applicant = await interaction.client.users.fetch(applicantId);
      await applicant.send(accepted
        ? 'Your application for Orchid Customs has been accepted, congratulations!'
        : 'Unfortunately your application for Orchid Customs has been denied. Please apply again in 3 hours.');
      return interaction.followUp({ content: `Application ${accepted ? 'accepted' : 'denied'} and the applicant was notified.`, flags: MessageFlags.Ephemeral });
    } catch (error) {
      console.warn(`Application decision was recorded, but the applicant ${applicantId} could not be DM'd:`, error);
      return interaction.followUp({ content: `Application ${accepted ? 'accepted' : 'denied'}, but I could not DM the applicant. Their DMs may be closed.`, flags: MessageFlags.Ephemeral });
    }
  } finally {
    applicationsInProgress.delete(messageId);
  }
}

async function handle(interaction) {
  if (interaction.isButton()) {
    if (interaction.customId === 'careers:open') {
      return interaction.reply({
        files: [new AttachmentBuilder(CAREERS_BANNER, { name: 'orchid-careers.png' })],
        components: [makeCareersPanel()],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });
    }
    if (interaction.customId === 'careers:designer') {
      return interaction.showModal(makeDesignerModal());
    }
    if (interaction.customId === 'careers:support') {
      return interaction.reply({ content: 'Support Department applications are not open right now. Please check back later.', flags: MessageFlags.Ephemeral });
    }
    if (interaction.customId.startsWith('application:accept:') || interaction.customId.startsWith('application:deny:')) {
      return handleDecision(interaction);
    }
  }

  if (interaction.isModalSubmit() && interaction.customId === 'careers:designer-submit') {
    if (!interaction.guild) {
      return interaction.reply({ content: 'Designer applications can only be submitted from a server.', flags: MessageFlags.Ephemeral });
    }
    return submitApplication(interaction);
  }
}

module.exports = { handle, makeCareersPanel, makeDesignerModal, parseProfile, reviewContainer };
