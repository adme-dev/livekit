# Quick Setup Guide

## 🚀 Your MCP Server is Ready!

Your LiveKit Render MCP server is built and configured with your API key.

## Setup Steps

### For Cursor IDE

1. **Copy the configuration:**
   ```bash
   cp example-configs/cursor-config.json ~/.cursor/mcp.json
   ```

   Or manually add to `~/.cursor/mcp.json`:
   ```json
   {
     "mcpServers": {
       "livekit-render": {
         "command": "node",
         "args": ["/Users/paulgiurin/Documents/GitHub/livekit/mcp-server/dist/index.js"],
         "env": {
           "RENDER_API_KEY": "rnd_yAz6XPYCDOa1v32cVQojstVv1M6v"
         }
       }
     }
   }
   ```

2. **Restart Cursor**

3. **Test with natural language:**
   - "List my Render services"
   - "Show me my LiveKit status"
   - "Get logs from my LiveKit service"

### For Claude Desktop

1. **Find your config file:**
   - **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

2. **Add the configuration:**
   ```json
   {
     "mcpServers": {
       "livekit-render": {
         "command": "node",
         "args": ["/Users/paulgiurin/Documents/GitHub/livekit/mcp-server/dist/index.js"],
         "env": {
           "RENDER_API_KEY": "rnd_yAz6XPYCDOa1v32cVQojstVv1M6v"
         }
       }
     }
   }
   ```

3. **Restart Claude Desktop**

## Available Commands

Once configured, you can use natural language like:

- **"List my Render services"** - See all your services
- **"Get my LiveKit service status"** - Check LiveKit health
- **"Show me recent logs from my LiveKit service"** - View logs
- **"Restart my LiveKit service"** - Restart the service
- **"Diagnose my LiveKit configuration"** - Troubleshoot issues
- **"Update environment variables for my service"** - Modify config

## Troubleshooting

If the MCP server doesn't work:

1. **Ensure the server is built:**
   ```bash
   cd /Users/paulgiurin/Documents/GitHub/livekit/mcp-server
   npm run build
   ```

2. **Test the server:**
   ```bash
   node test-server.js
   ```

3. **Check your AI tool supports MCP** and restart it after configuration

## Your API Key

Your Render API key is: `rnd_yAz6XPYCDOa1v32cVQojstVv1M6v`

**Keep this secure!** This key grants access to your entire Render account.

---

🎉 **Ready to manage your LiveKit deployment with AI assistance!**
