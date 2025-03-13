const { SlashCommandBuilder } = require('discord.js');
const sniperService = require('../services/sniperService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('snipe')
    .setDescription('Start searching for Roblox users in a game')
    .addStringOption(option =>
      option.setName('gameid')
        .setDescription('The Roblox game ID to search in')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('userids')
        .setDescription('Comma-separated list of Roblox user IDs to find')
        .setRequired(true)),
  
  async execute(interaction) {
    // Get command options
    const gameId = interaction.options.getString('gameid');
    const userIdsString = interaction.options.getString('userids');
    
    // Validate game ID
    if (!/^\d+$/.test(gameId)) {
      await interaction.reply({
        content: '⚠️ Game ID must be a number!',
        ephemeral: true
      });
      return;
    }
    
    // Parse and validate user IDs
    const userIds = userIdsString
      .split(',')
      .map(id => id.trim())
      .filter(id => id.length > 0);
    
    // Deduplicate user IDs
    const uniqueUserIds = [...new Set(userIds)];
    
    // Check if we have valid user IDs
    if (uniqueUserIds.length === 0) {
      await interaction.reply({
        content: '⚠️ Please provide at least one valid user ID.',
        ephemeral: true
      });
      return;
    }
    
    // Validate each user ID
    for (const userId of uniqueUserIds) {
      if (!/^\d+$/.test(userId)) {
        await interaction.reply({
          content: `⚠️ User ID "${userId}" must be a number!`,
          ephemeral: true
        });
        return;
      }
    }
    
    // Start the snipe operation
    await sniperService.startSnipe(interaction, gameId, uniqueUserIds);
  },
};
