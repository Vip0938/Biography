const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Get information on how to use the Roblox Stream Sniper bot'),
  
  async execute(interaction) {
    const helpEmbed = new EmbedBuilder()
      .setTitle('Roblox Stream Sniper Bot - Help')
      .setColor(config.colors.PRIMARY)
      .setDescription('This bot helps you find specific Roblox users in games.')
      .addFields(
        { 
          name: '/snipe <gameId> <userIds>',
          value: 'Start searching for users in a game\n' +
                 '- `gameId`: The Roblox game ID you want to search in\n' + 
                 '- `userIds`: A comma-separated list of Roblox user IDs to find',
          inline: false 
        },
        { 
          name: 'How It Works',
          value: 'The bot will scan all servers of the specified game and look for the target users. ' +
                 'When a user is found, it will provide a command to join their game server.',
          inline: false 
        },
        { 
          name: 'About Stream Sniping',
          value: 'This tool is for educational purposes. Please use responsibly and respect Roblox\'s Terms of Service.',
          inline: false 
        }
      )
      .setFooter({ text: 'Roblox Stream Sniper Bot' });
    
    await interaction.reply({ embeds: [helpEmbed] });
  },
};
