// Bot configuration
module.exports = {
  // Maximum number of concurrent requests to Roblox API
  MAX_CONCURRENT_REQUESTS: 20,
  
  // Update interval for status messages (in ms)
  STATUS_UPDATE_INTERVAL: 2000,
  
  // Batch size for server token checks
  TOKEN_BATCH_SIZE: 100,
  
  // Colors for embeds
  colors: {
    PRIMARY: 0x0099ff,
    SUCCESS: 0x00ff00,
    ERROR: 0xff0000
  }
};
