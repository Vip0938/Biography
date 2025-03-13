const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const axios = require('axios');
require('dotenv').config();

// Create a new client instance
const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ] 
});

// Bot prefix for commands
const prefix = '!';

// When the client is ready, run this code
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on('messageCreate', async message => {
  if (message.author.bot) return;
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (command === 'find') {
    if (args.length < 2) {
      return message.reply('Please provide both a Roblox User ID and Game ID. Usage: !find [userId] [gameId]');
    }

    const userId = args[0];
    const gameId = args[1];

    try {
      // Send a typing indicator while processing
      message.channel.sendTyping();
      
      // First fetch servers for the game
      const serversResponse = await axios.get(`https://games.roblox.com/v1/games/${gameId}/servers/Public?limit=100`);
      const servers = serversResponse.data.data;
      
      if (!servers || servers.length === 0) {
        return message.reply('No public servers found for this game.');
      }

      // Check each server for the player
      let foundServer = null;
      
      for (const server of servers) {
        try {
          const playersResponse = await axios.get(`https://games.roblox.com/v1/games/${gameId}/servers/Public?cursor=${server.id}`);
          const serverPlayers = playersResponse.data.data[0].playerIds;
          
          if (serverPlayers && serverPlayers.includes(parseInt(userId))) {
            foundServer = server;
            break;
          }
        } catch (error) {
          console.error(`Error checking server ${server.id}:`, error);
          // Continue to next server
        }
      }

      if (!foundServer) {
        return message.reply(`User with ID ${userId} not found in any public server for game ${gameId}.`);
      }

      // Get user info for additional context
      const userInfoResponse = await axios.get(`https://users.roblox.com/v1/users/${userId}`);
      const username = userInfoResponse.data.name;

      // Create an embed with the information
      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('User Found!')
        .setDescription(`Found ${username} (ID: ${userId}) in a server for game ${gameId}`)
        .addFields(
          { name: 'Server ID', value: foundServer.id },
          { name: 'Players', value: `${foundServer.playing}/${foundServer.maxPlayers}` },
          { name: 'Join Script', value: `\`\`\`javascript\nRoblox.GameLauncher.joinGameInstance(${gameId}, "${foundServer.id}")\n\`\`\`` }
        )
        .setTimestamp();

      message.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error finding user:', error);
      message.reply('An error occurred while searching for the user. Please check the IDs and try again.');
    }
  }
});

// Login to Discord with your token
client.login(process.env.DISCORD_TOKEN);