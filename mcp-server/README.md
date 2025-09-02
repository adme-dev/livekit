# LiveKit Render MCP Server

A Model Context Protocol (MCP) server for managing your LiveKit deployment on Render.com. This server provides tools to interact with your Render services, specifically tailored for LiveKit deployments.

## Features

- **Service Management**: List, get details, and restart Render services
- **Log Access**: Retrieve recent logs from your services
- **Deploy History**: View deployment history and status
- **Environment Variables**: Update service environment variables
- **LiveKit Status**: Get comprehensive status of your LiveKit deployment
- **Configuration Access**: Access to your render.yaml and config.yaml files

## Installation

### Prerequisites

- Node.js 18 or higher
- A Render.com API key

### Setup

1. Clone or download this MCP server:
   ```bash
   git clone <your-repo-url>
   cd mcp-server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the server:
   ```bash
   npm run build
   ```

4. Get your Render API key from [Render Dashboard > Account Settings > API Keys](https://dashboard.render.com/settings#api-keys)

## Usage

### With Compatible AI Tools

This MCP server can be used with AI tools that support the Model Context Protocol, such as:
- Cursor
- Claude Desktop
- Windsurf
- VS Code with GitHub Copilot
- And more

### Configuration Examples

#### Cursor (`~/.cursor/mcp.json`)

```json
{
  "mcpServers": {
    "livekit-render": {
      "command": "node",
      "args": ["/path/to/livekit-render-mcp-server/dist/index.js"],
      "env": {
        "RENDER_API_KEY": "your-render-api-key-here"
      }
    }
  }
}
```

#### Claude Desktop

Add to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "livekit-render": {
      "command": "node",
      "args": ["/path/to/livekit-render-mcp-server/dist/index.js"],
      "env": {
        "RENDER_API_KEY": "your-render-api-key-here"
      }
    }
  }
}
```

## Available Tools

### Service Management
- `list_services` - List all Render services in your account
- `get_service` - Get details of a specific service
- `restart_service` - Restart a service by triggering a new deploy

### Monitoring
- `get_service_logs` - Get recent logs for a service
- `list_deploys` - List deploy history for a service
- `get_livekit_status` - Get comprehensive LiveKit deployment status

### Configuration
- `update_env_vars` - Update environment variables for a service

## Available Resources

- `file://render.yaml` - Current Render deployment configuration
- `file://config.yaml` - Current LiveKit server configuration

## Example Usage

Once configured with your AI tool, you can use natural language prompts like:

- "Show me all my Render services"
- "Get the logs for my LiveKit service"
- "What's the status of my LiveKit deployment?"
- "Restart my livekit-server service"
- "Update the LIVEKIT_KEYS environment variable"

## Security

**Important**: Your Render API key grants access to all services and workspaces in your account. Keep it secure and only use this MCP server in trusted environments.

## Development

### Scripts

- `npm run build` - Build the TypeScript code
- `npm run dev` - Run in development mode with tsx
- `npm start` - Run the built server

### File Structure

```
mcp-server/
├── src/
│   └── index.ts         # Main server implementation
├── dist/                # Built JavaScript files
├── package.json         # Dependencies and scripts
├── tsconfig.json        # TypeScript configuration
└── README.md           # This file
```

## Troubleshooting

1. **"RENDER_API_KEY environment variable is required"**
   - Make sure you've set the `RENDER_API_KEY` in your MCP configuration

2. **"Render API error: 401"**
   - Check that your API key is valid and hasn't expired

3. **"No LiveKit services found"**
   - Ensure your service names contain "livekit" (case-insensitive)
   - Or use the generic service management tools with specific service IDs

4. **TypeScript errors during build**
   - Make sure you have Node.js 18+ and all dependencies installed
   - Run `npm install` to ensure all packages are up to date

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
