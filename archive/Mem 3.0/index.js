const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, Events, GatewayIntentBits } = require('discord.js');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Create a new client instance
const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ] 
});

// Set up commands collection
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  
  // Set a new item in the Collection with the key as the command name and the value as the exported module
  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
  } else {
    console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
  }
}

// Handle slash commands
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = interaction.client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    const errorMessage = { content: 'There was an error executing this command!', ephemeral: true };
    
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorMessage);
    } else {
      await interaction.reply(errorMessage);
    }
  }
});

// Handle button interactions
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton()) return;
  
  // Handle copy join command buttons
  if (interaction.customId.startsWith('join_')) {
    const [_, gameId, serverId] = interaction.customId.split('_');
    const command = `Roblox.GameLauncher.joinGameInstance(${gameId}, "${serverId}")`;
    
    await interaction.reply({ 
      content: `Here's your join command:\n\`\`\`lua\n${command}\n\`\`\`\nCopy this to your browser console on Roblox.com to join the server.`,
      ephemeral: true 
    });
  }
  
  // Handle stop button
  if (interaction.customId === 'stop_snipe') {
    const sniperService = require('./services/sniperService');
    if (sniperService.isRunning()) {
      sniperService.stopSnipe();
      await interaction.reply({ content: '🛑 Stream snipe stopped.', ephemeral: true });
    } else {
      await interaction.reply({ content: '⚠️ No stream snipe is currently running!', ephemeral: true });
    }
  }
});

// When the client is ready, run this code (only once)
client.once(Events.ClientReady, readyClient => {
  console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});

// Log in to Discord with your client's token
client.login(process.env.DISCORD_TOKEN);
