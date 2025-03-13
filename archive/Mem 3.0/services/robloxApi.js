const axios = require('axios');
const zlib = require('zlib');

// Roblox API Service
class RobloxApiService {
  /**
   * Get a page of servers for a Roblox game
   * @param {string} gameId - The Roblox game ID
   * @param {string} cursor - The pagination cursor
   * @returns {Promise<Object>} - Server data
   */
  async getServerPage(gameId, cursor = "") {
    try {
      const response = await axios.get(
        `https://games.roblox.com/v1/games/${gameId}/servers/Public?limit=100&cursor=${cursor}`,
        {
          headers: { 'Accept-Encoding': 'gzip, deflate, br' },
          validateStatus: null
        }
      );
      
      if (response.status === 200) {
        return response.data;
      } else {
        console.error(`Failed to get servers: ${response.status}`);
        return null;
      }
    } catch (error) {
      console.error('Error fetching server page:', error.message);
      return null;
    }
  }

  /**
   * Get user thumbnails for a list of user IDs
   * @param {string[]} userIds - List of Roblox user IDs
   * @returns {Promise<Object>} - User thumbnail data
   */
  async getUserThumbnails(userIds) {
    try {
      const userIdsStr = userIds.join(',');
      const response = await axios.get(
        `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userIdsStr}&size=150x150&format=Png&isCircular=false`,
        {
          validateStatus: null
        }
      );
      
      if (response.status === 200) {
        return response.data;
      } else {
        console.error(`Failed to get thumbnails: ${response.status}`);
        return null;
      }
    } catch (error) {
      console.error('Error fetching thumbnails:', error.message);
      return null;
    }
  }

  /**
   * Check servers using player tokens
   * @param {Object} tokens - Token to server mapping
   * @param {Object} usersData - Image URL to user ID mapping
   * @returns {Promise<Array>} - Found users
   */
  async checkServers(tokens, usersData) {
    try {
      const payload = [];
      const tokenToServer = {};
      
      for (const [token, server] of Object.entries(tokens)) {
        payload.push({
          format: "png",
          requestId: `0:${token}:AvatarHeadshot:150x150:png:regular`,
          size: "150x150",
          targetId: 0,
          token: token,
          type: "AvatarHeadShot"
        });
        tokenToServer[token] = server;
      }
      
      // Skip if no tokens to check
      if (payload.length === 0) {
        return [];
      }
      
      // Compress payload as in Python
      const compressedPayload = zlib.gzipSync(Buffer.from(JSON.stringify(payload)));
      
      const response = await axios.post(
        "https://thumbnails.roblox.com/v1/batch",
        compressedPayload,
        {
          headers: {
            'Accept-Encoding': 'gzip, deflate, br',
            'Content-Encoding': 'gzip',
            'Content-Type': 'application/json'
          },
          validateStatus: null
        }
      );
      
      if (response.status === 200) {
        const results = [];
        
        for (const thumbnail of response.data.data) {
          const imageUrl = thumbnail.imageUrl;
          
          if (usersData[imageUrl]) {
            const token = thumbnail.requestId.split(':')[1];
            const server = tokenToServer[token];
            const userId = usersData[imageUrl];
            
            results.push({
              userId,
              server
            });
          }
        }
        
        return results;
      }
      
      return [];
    } catch (error) {
      console.error('Error checking servers:', error.message);
      return [];
    }
  }
}

module.exports = new RobloxApiService();
