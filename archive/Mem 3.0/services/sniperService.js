const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const zlib = require('zlib');
const robloxApi = require('./robloxApi');
const config = require('../config');

// Singleton state for the sniper
const state = {
  isRunning: false,
  currentPage: null,
  playerCount: [0, 0],
  tokenCount: [0, 0],
  serverList: [[], []],  // [active, inactive]
  usersData: {},
  isPaging: false,
  startTime: 0,
  statusMessage: null,
  statusInterval: null,
  interaction: null,
  gameId: null,
  userIds: []
};

// Helper functions
function deduplicate(arr) {
  return [...new Set(arr)];
}

class SniperService {
  /**
   * Check if a snipe is currently running
   * @returns {boolean} - True if running
   */
  isRunning() {
    return state.isRunning;
  }

  /**
   * Stop the current snipe operation
   */
  stopSnipe() {
    state.isRunning = false;
    
    if (state.statusInterval) {
      clearInterval(state.statusInterval);
      state.statusInterval = null;
    }
    
    this.updateFinalStatus();
  }

  /**
   * Update the status message with final results
   */
  async updateFinalStatus() {
    if (!state.statusMessage) return;
    
    try {
      const finalEmbed = new EmbedBuilder()
        .setTitle('Search Complete')
        .setColor(config.colors.SUCCESS)
        .setDescription(`Completed search for users ${state.userIds.join(', ')} in game ${state.gameId}`)
        .addFields(
          { name: 'Servers Checked', value: `${state.serverList[1].length}`, inline: true },
          { name: 'Players Scanned', value: `${state.playerCount[0]}`, inline: true },
          { name: 'Tokens Checked', value: `${state.tokenCount[1]}`, inline: true }
        )
        .setFooter({ text: 'Roblox Stream Sniper Bot' });
      
      await state.statusMessage.edit({ embeds: [finalEmbed], components: [] });
    } catch (error) {
      console.error('Error updating final status:', error);
    }
  }

  /**
   * Start the server paging process
   * @returns {Promise<void>}
   */
  async pagingLogic() {
    console.log("[PAGING] Started!");
    state.isPaging = true;
    
    let cursor = "";
    while (cursor !== null && state.isRunning) {
      const page = await robloxApi.getServerPage(state.gameId, cursor);
      if (!page) break;
      
      state.currentPage = page;
      
      for (const server of page.data) {
        state.serverList[0].push({
          Tokens: server.playerTokens,
          ID: server.id
        });
        
        state.playerCount[0] += server.playing;
        state.playerCount[1] += server.maxPlayers;
        state.tokenCount[0] += server.playerTokens.length;
      }
      
      cursor = page.nextPageCursor;
    }
    
    state.isPaging = false;
    console.log("[PAGING] Stopped! (no more servers?)");
  }

  /**
   * Start the user verification process
   * @returns {Promise<void>}
   */
  async verifierLogic() {
    console.log("[VERIFIER] Acquiring target thumbnails...");
    
    const result = await robloxApi.getUserThumbnails(state.userIds);
    if (!result) {
      console.error("[VERIFIER] Failed to acquire thumbnails");
      state.isRunning = false;
      return;
    }
    
    for (const user of result.data) {
      const userId = user.targetId;
      const imageState = user.state;
      
      if (imageState !== "Completed") {
        console.log(`[VERIFIER] Failed to acquire thumbnail for ${userId}, state: ${imageState}`);
      } else {
        console.log(`[VERIFIER] Acquired thumbnail for ${userId}, state: ${imageState}`);
        state.usersData[user.imageUrl] = userId;
      }
    }
    
    console.log("[VERIFIER] Starting server checks...");
    
    // Process servers in batches
    const inactiveServers = state.serverList[1];
    const activeServers = state.serverList[0];
    
    while (state.isRunning && Object.keys(state.usersData).length > 0) {
      if (activeServers.length > 0) {
        const tokenToServer = {};
        
        let server = activeServers.shift();
        while (Object.keys(tokenToServer).length < config.TOKEN_BATCH_SIZE && server) {
          if (server.Tokens && server.Tokens.length > 0) {
            const token = server.Tokens.pop();
            tokenToServer[token] = server;
            
            if (server.Tokens.length <= 0) {
              inactiveServers.push(server);
              server = activeServers.length > 0 ? activeServers.shift() : null;
            }
          } else {
            inactiveServers.push(server);
            server = activeServers.length > 0 ? activeServers.shift() : null;
          }
        }
        
        // Put back server if it still has tokens
        if (server && server.Tokens && server.Tokens.length > 0) {
          activeServers.push(server);
        }
        
        // Check batch of tokens
        const results = await robloxApi.checkServers(tokenToServer, state.usersData);
        
        // Update token count
        state.tokenCount[1] += Object.keys(tokenToServer).length;
        
        // Send results for any found users
        if (results.length > 0 && state.interaction) {
          for (const result of results) {
            // Remove from usersData to avoid duplicate findings
            for (const [key, value] of Object.entries(state.usersData)) {
              if (value === result.userId) {
                delete state.usersData[key];
              }
            }
            
            const elapsedMs = Math.round((Date.now() - state.startTime));
            
            const embed = new EmbedBuilder()
              .setTitle('Target Found!')
              .setColor(config.colors.SUCCESS)
              .setDescription(`User ${result.userId} found in ${elapsedMs}ms`)
              .addFields(
                { name: 'Join Command', value: `\`\`\`lua\nRoblox.GameLauncher.joinGameInstance(${state.gameId}, "${result.server.ID}")\n\`\`\`` }
              )
              .setFooter({ text: 'Roblox Stream Sniper Bot' });
            
            const joinButton = new ActionRowBuilder()
              .addComponents(
                new ButtonBuilder()
                  .setLabel('Copy Join Command')
                  .setStyle(ButtonStyle.Primary)
                  .setCustomId(`join_${state.gameId}_${result.server.ID}`)
              );
            
            try {
              await state.interaction.channel.send({ embeds: [embed], components: [joinButton] });
            } catch (err) {
              console.error('Error sending result message:', err);
            }
          }
        }
      } else if (state.isPaging) {
        // Wait for more servers if paging is still active
        await new Promise(resolve => setTimeout(resolve, 100));
      } else {
        // No more servers and paging is done
        break;
      }
    }
    
    console.log("[VERIFIER] No more users to find or stopped");
    
    // Only stop if this wasn't already stopped by user
    if (state.isRunning) {
      state.isRunning = false;
      
      if (state.statusInterval) {
        clearInterval(state.statusInterval);
        state.statusInterval = null;
      }
      
      this.updateFinalStatus();
    }
  }

  /**
   * Update the status message with current progress
   */
  async updateStatusMessage() {
    if (!state.isRunning || !state.statusMessage) return;
    
    const page = state.currentPage;
    const pagePrev = page && page.previousPageCursor;
    const pageNext = page && page.nextPageCursor;
    
    const prevCrc = pagePrev ? 
      zlib.crc32(Buffer.from(pagePrev)).toString(16).padStart(8, '0').toUpperCase() : 
      '00000000';
    
    const nextCrc = pageNext ? 
      zlib.crc32(Buffer.from(pageNext)).toString(16).padStart(8, '0').toUpperCase() : 
      '00000000';
    
    const statusEmbed = new EmbedBuilder()
      .setTitle('Roblox Stream Snipe')
      .setColor(config.colors.PRIMARY)
      .setDescription(`Searching for users: ${state.userIds.join(', ')} in game: ${state.gameId}`)
      .addFields(
        { name: 'Status', value: state.isPaging ? 'Paging servers...' : 'Checking players...', inline: false },
        { name: 'Servers', value: `${state.serverList[0].length}/${state.serverList[1].length}`, inline: true },
        { name: 'Players', value: `${state.playerCount[0]}/${state.playerCount[1]}`, inline: true },
        { name: 'Tokens', value: `${state.tokenCount[0]}/${state.tokenCount[1]}`, inline: true },
        { name: 'Page (CRC32)', value: `${prevCrc}->${nextCrc}`, inline: false },
        { name: 'Targets Remaining', value: `${Object.keys(state.usersData).length}`, inline: false }
      )
      .setFooter({ text: 'Roblox Stream Sniper Bot' });
    
    const stopButton = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setLabel('Stop Search')
          .setStyle(ButtonStyle.Danger)
          .setCustomId('stop_snipe')
      );
    
    try {
      await state.statusMessage.edit({ embeds: [statusEmbed], components: [stopButton] });
    } catch (error) {
      console.error('Error updating status message:', error);
    }
  }

  /**
   * Start a new stream snipe operation
   * @param {Object} interaction - Discord interaction
   * @param {string} gameId - Roblox game ID
   * @param {string[]} userIds - Array of Roblox user IDs
   */
  async startSnipe(interaction, gameId, userIds) {
    if (state.isRunning) {
      await interaction.reply({
        content: '⚠️ A stream snipe is already in progress! Use the Stop button to stop it first.',
        ephemeral: true
      });
      return;
    }
    
    // Reset state
    state.isRunning = true;
    state.currentPage = null;
    state.playerCount = [0, 0];
    state.tokenCount = [0, 0];
    state.serverList = [[], []];
    state.usersData = {};
    state.isPaging = false;
    state.startTime = Date.now();
    state.interaction = interaction;
    state.gameId = gameId;
    state.userIds = userIds;
    
    // Create initial status message
    const statusEmbed = new EmbedBuilder()
      .setTitle('Roblox Stream Snipe')
      .setColor(config.colors.PRIMARY)
      .setDescription(`Searching for users: ${userIds.join(', ')} in game: ${gameId}`)
      .addFields(
        { name: 'Status', value: 'Starting...', inline: false },
        { name: 'Servers', value: '0/0', inline: true },
        { name: 'Players', value: '0/0', inline: true },
        { name: 'Tokens', value: '0/0', inline: true }
      )
      .setFooter({ text: 'Use the Stop button to stop the search' });
    
    const stopButton = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setLabel('Stop Search')
          .setStyle(ButtonStyle.Danger)
          .setCustomId('stop_snipe')
      );
    
    await interaction.reply({ embeds: [statusEmbed], components: [stopButton] });
    state.statusMessage = await interaction.fetchReply();
    
    // Start status updater
    state.statusInterval = setInterval(() => this.updateStatusMessage(), config.STATUS_UPDATE_INTERVAL);
    
    // Start the main processes
    try {
      // Start paging and verification (equivalent to the Python threads)
      Promise.all([
        this.pagingLogic(),
        this.verifierLogic()
      ]).catch(error => {
        console.error('Error in stream snipe process:', error);
        state.isRunning = false;
        interaction.followUp({
          content: '❌ An error occurred during the stream snipe process.',
          ephemeral: true
        });
      });
    } catch (error) {
      console.error('Error starting stream snipe process:', error);
      state.isRunning = false;
      interaction.followUp({
        content: '❌ An error occurred starting the stream snipe process.',
        ephemeral: true
      });
    }
  }
}

module.exports = new SniperService();
