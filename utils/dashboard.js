const { MessageFlags, ButtonStyle } = require('discord.js');
const {
  ActionRowBuilder,
  ButtonBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
} = require('@discordjs/builders');

const pages = {
  guidelines: {
    title: 'Guidelines',
    description: [
      '**Respect**\nShow respect to all members. Discrimination and offensive behaviour are not allowed. Harassment is prohibited; breaking this rule could result in a kick.\n\n',
      '**NSFW**\nKeep all content appropriate. Unsafe content and suspicious links are not allowed. Gore or explicit media must not be posted. Breaking this rule can result in a ban.\n\n',
      '**Common Sense**\nUse common sense at all times. Not all rules are listed here, and you may be warned for behaviour not listed. Staff have the final say; arguing with them can result in further punishment.',
    ].join(''),
  },
  'terms-of-service': {
    title: 'Terms of Services',
    description: 'When opening an order or purchasing a course, you automatically agree to all agreements and Terms of Services set by Pulse Customs. Ensure you are up to date with all of these terms before opening an order or purchasing a course.',
    url: 'https://docs.google.com/document/d/1PZ8fZfptWuiSq58_Tb_w64GVOB9Y0iI0IIARtq8h4lg/edit?usp=sharing',
  },
};

async function handle(interaction) {
  if (!interaction.isStringSelectMenu() || interaction.customId !== 'dashboard:index') return;

  const page = pages[interaction.values[0]];
  if (!page) {
    return interaction.reply({ content: 'That dashboard section is unavailable.', flags: MessageFlags.Ephemeral });
  }

  const container = new ContainerBuilder()
    .setAccentColor(0xb320d1)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ${page.title}\n\n${page.description}`));

  if (page.url) {
    container.addActionRowComponents(new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('Read Terms Of Service')
        .setStyle(ButtonStyle.Link)
        .setURL(page.url),
    ));
  }

  container
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('-# Orchid Management • Creativity, blooming'));

  return interaction.reply({
    components: [container],
    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
  });
}

module.exports = { handle };
