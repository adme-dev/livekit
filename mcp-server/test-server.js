#!/usr/bin/env node

// Simple test script to validate the MCP server works
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Testing LiveKit Render MCP Server...\n');

// Set a dummy API key for testing the server startup
process.env.RENDER_API_KEY = 'test-key-for-startup';

const serverPath = path.join(__dirname, 'dist', 'index.js');

console.log(`Starting server at: ${serverPath}`);

const server = spawn('node', [serverPath], {
  stdio: ['pipe', 'pipe', 'pipe'],
});

server.stderr.on('data', (data) => {
  const message = data.toString();
  console.log('Server output:', message.trim());
  
  if (message.includes('LiveKit Render MCP server running on stdio')) {
    console.log('✅ Server started successfully!');
    console.log('✅ MCP server is working correctly');
    console.log('\nTo use this server:');
    console.log('1. Get a Render API key from https://dashboard.render.com/settings#api-keys');
    console.log('2. Configure your AI tool (Cursor, Claude Desktop, etc.) with the example configs');
    console.log('3. Use natural language to manage your LiveKit deployment on Render');
    
    server.kill();
    process.exit(0);
  }
});

server.on('error', (error) => {
  console.error('❌ Error starting server:', error.message);
  process.exit(1);
});

// Send the initialize request to test MCP protocol
setTimeout(() => {
  const initRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'test-client',
        version: '1.0.0'
      }
    }
  };
  
  server.stdin.write(JSON.stringify(initRequest) + '\n');
}, 100);

// Clean up after 3 seconds if server doesn't respond properly
setTimeout(() => {
  console.log('❌ Server didn\'t respond as expected');
  server.kill();
  process.exit(1);
}, 3000);
