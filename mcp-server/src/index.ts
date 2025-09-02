#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  CallToolRequest,
  ListResourcesRequest,
  ReadResourceRequest,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import fetch from 'node-fetch';
import { readFileSync, existsSync } from 'fs';
import { parse } from 'yaml';

const RENDER_API_BASE = 'https://api.render.com/v1';

interface RenderService {
  id: string;
  name: string;
  type: string;
  status: string;
  slug: string;
  suspended: string | null;
  environment: string;
  serviceDetails: {
    url?: string;
    buildCommand?: string;
    startCommand?: string;
    publishPath?: string;
  };
}

interface RenderDeploy {
  id: string;
  status: string;
  createdAt: string;
  finishedAt?: string;
  commitId?: string;
  commitMessage?: string;
}

class LiveKitRenderMCPServer {
  private server: Server;
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.RENDER_API_KEY || '';
    
    this.server = new Server(
      {
        name: 'livekit-render-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );

    this.setupErrorHandling();
    this.setupToolHandlers();
    this.setupResourceHandlers();
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private async makeRenderAPICall(endpoint: string, options: any = {}): Promise<any> {
    if (!this.apiKey) {
      throw new Error('RENDER_API_KEY environment variable is required');
    }

    const response = await fetch(`${RENDER_API_BASE}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Render API error: ${response.status} ${response.statusText} - ${error}`);
    }

    return response.json();
  }

  private setupToolHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'list_services',
            description: 'List all Render services in your account',
            inputSchema: {
              type: 'object',
              properties: {},
              required: [],
            },
          },
          {
            name: 'get_service',
            description: 'Get details of a specific Render service',
            inputSchema: {
              type: 'object',
              properties: {
                serviceId: {
                  type: 'string',
                  description: 'The ID of the service to get details for',
                },
              },
              required: ['serviceId'],
            },
          },
          {
            name: 'get_service_logs',
            description: 'Get recent logs for a specific service',
            inputSchema: {
              type: 'object',
              properties: {
                serviceId: {
                  type: 'string',
                  description: 'The ID of the service to get logs for',
                },
                limit: {
                  type: 'number',
                  description: 'Number of log entries to retrieve (default: 100)',
                  default: 100,
                },
              },
              required: ['serviceId'],
            },
          },
          {
            name: 'list_deploys',
            description: 'List deploy history for a service',
            inputSchema: {
              type: 'object',
              properties: {
                serviceId: {
                  type: 'string',
                  description: 'The ID of the service to get deploy history for',
                },
                limit: {
                  type: 'number',
                  description: 'Number of deploys to retrieve (default: 10)',
                  default: 10,
                },
              },
              required: ['serviceId'],
            },
          },
          {
            name: 'update_env_vars',
            description: 'Update environment variables for a service',
            inputSchema: {
              type: 'object',
              properties: {
                serviceId: {
                  type: 'string',
                  description: 'The ID of the service to update',
                },
                envVars: {
                  type: 'object',
                  description: 'Object containing environment variable key-value pairs',
                  additionalProperties: {
                    type: 'string',
                  },
                },
              },
              required: ['serviceId', 'envVars'],
            },
          },
          {
            name: 'get_livekit_status',
            description: 'Get comprehensive status of LiveKit deployment including service health and configuration',
            inputSchema: {
              type: 'object',
              properties: {},
              required: [],
            },
          },
          {
            name: 'restart_service',
            description: 'Restart a Render service by triggering a new deploy',
            inputSchema: {
              type: 'object',
              properties: {
                serviceId: {
                  type: 'string',
                  description: 'The ID of the service to restart',
                },
              },
              required: ['serviceId'],
            },
          },
          {
            name: 'diagnose_livekit_config',
            description: 'Diagnose LiveKit configuration issues and suggest fixes',
            inputSchema: {
              type: 'object',
              properties: {},
              required: [],
            },
          },
          {
            name: 'fix_livekit_keys_config',
            description: 'Fix LiveKit keys configuration by updating environment variables',
            inputSchema: {
              type: 'object',
              properties: {
                serviceId: {
                  type: 'string',
                  description: 'The ID of the LiveKit service to fix',
                },
              },
              required: ['serviceId'],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'list_services':
            return await this.listServices();
          
          case 'get_service':
            if (!args || typeof args !== 'object' || !('serviceId' in args)) {
              throw new Error('serviceId is required');
            }
            return await this.getService(args.serviceId as string);
          
          case 'get_service_logs':
            if (!args || typeof args !== 'object' || !('serviceId' in args)) {
              throw new Error('serviceId is required');
            }
            const limit = ('limit' in args && typeof args.limit === 'number') ? args.limit : 100;
            return await this.getServiceLogs(args.serviceId as string, limit);
          
          case 'list_deploys':
            if (!args || typeof args !== 'object' || !('serviceId' in args)) {
              throw new Error('serviceId is required');
            }
            const deployLimit = ('limit' in args && typeof args.limit === 'number') ? args.limit : 10;
            return await this.listDeploys(args.serviceId as string, deployLimit);
          
          case 'update_env_vars':
            if (!args || typeof args !== 'object' || !('serviceId' in args) || !('envVars' in args)) {
              throw new Error('serviceId and envVars are required');
            }
            return await this.updateEnvVars(args.serviceId as string, args.envVars as Record<string, string>);
          
          case 'get_livekit_status':
            return await this.getLiveKitStatus();
          
          case 'restart_service':
            if (!args || typeof args !== 'object' || !('serviceId' in args)) {
              throw new Error('serviceId is required');
            }
            return await this.restartService(args.serviceId as string);
          
          case 'diagnose_livekit_config':
            return await this.diagnoseLiveKitConfig();
          
          case 'fix_livekit_keys_config':
            if (!args || typeof args !== 'object' || !('serviceId' in args)) {
              throw new Error('serviceId is required');
            }
            return await this.fixLiveKitKeysConfig(args.serviceId as string);
          
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  private setupResourceHandlers(): void {
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: [
          {
            uri: 'file://render.yaml',
            name: 'Render Configuration',
            description: 'Current Render deployment configuration',
            mimeType: 'application/x-yaml',
          },
          {
            uri: 'file://config.yaml',
            name: 'LiveKit Configuration',
            description: 'Current LiveKit server configuration',
            mimeType: 'application/x-yaml',
          },
        ],
      };
    });

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request: ReadResourceRequest) => {
      const uri = request.params.uri;
      
      if (uri === 'file://render.yaml') {
        if (existsSync('render.yaml')) {
          const content = readFileSync('render.yaml', 'utf-8');
          return {
            contents: [
              {
                uri,
                mimeType: 'application/x-yaml',
                text: content,
              },
            ],
          };
        }
      } else if (uri === 'file://config.yaml') {
        if (existsSync('config.yaml')) {
          const content = readFileSync('config.yaml', 'utf-8');
          return {
            contents: [
              {
                uri,
                mimeType: 'application/x-yaml',
                text: content,
              },
            ],
          };
        }
      }

      throw new Error(`Resource not found: ${uri}`);
    });
  }

  private async listServices() {
    const response = await this.makeRenderAPICall('/services');
    const services = response.services || [];
    
    return {
      content: [
        {
          type: 'text',
          text: `Found ${services.length} services:\n\n` +
            services.map((service: RenderService) => 
              `• ${service.name} (${service.type})\n` +
              `  ID: ${service.id}\n` +
              `  Status: ${service.status}\n` +
              `  Environment: ${service.environment}\n` +
              `  URL: ${service.serviceDetails?.url || 'N/A'}\n`
            ).join('\n'),
        },
      ],
    };
  }

  private async getService(serviceId: string) {
    const service = await this.makeRenderAPICall(`/services/${serviceId}`);
    
    return {
      content: [
        {
          type: 'text',
          text: `Service Details:\n\n` +
            `Name: ${service.name}\n` +
            `Type: ${service.type}\n` +
            `Status: ${service.status}\n` +
            `Environment: ${service.environment}\n` +
            `Slug: ${service.slug}\n` +
            `URL: ${service.serviceDetails?.url || 'N/A'}\n` +
            `Build Command: ${service.serviceDetails?.buildCommand || 'N/A'}\n` +
            `Start Command: ${service.serviceDetails?.startCommand || 'N/A'}\n` +
            `Suspended: ${service.suspended || 'No'}\n`,
        },
      ],
    };
  }

  private async getServiceLogs(serviceId: string, limit: number = 100) {
    const response = await this.makeRenderAPICall(`/services/${serviceId}/logs?limit=${limit}`);
    const logs = response.logs || [];
    
    return {
      content: [
        {
          type: 'text',
          text: `Recent logs (${logs.length} entries):\n\n` +
            logs.map((log: any) => 
              `[${log.timestamp}] ${log.message}`
            ).join('\n'),
        },
      ],
    };
  }

  private async listDeploys(serviceId: string, limit: number = 10) {
    const response = await this.makeRenderAPICall(`/services/${serviceId}/deploys?limit=${limit}`);
    const deploys = response.deploys || [];
    
    return {
      content: [
        {
          type: 'text',
          text: `Deploy History (${deploys.length} deploys):\n\n` +
            deploys.map((deploy: RenderDeploy) => 
              `• Deploy ${deploy.id}\n` +
              `  Status: ${deploy.status}\n` +
              `  Created: ${deploy.createdAt}\n` +
              `  Finished: ${deploy.finishedAt || 'In progress'}\n` +
              `  Commit: ${deploy.commitId || 'N/A'}\n` +
              `  Message: ${deploy.commitMessage || 'N/A'}\n`
            ).join('\n'),
        },
      ],
    };
  }

  private async updateEnvVars(serviceId: string, envVars: Record<string, string>) {
    const response = await this.makeRenderAPICall(`/services/${serviceId}/env-vars`, {
      method: 'PUT',
      body: JSON.stringify({ envVars }),
    });
    
    return {
      content: [
        {
          type: 'text',
          text: `Environment variables updated successfully for service ${serviceId}\n\n` +
            `Updated variables:\n` +
            Object.entries(envVars).map(([key, value]) => `• ${key}: ${value}`).join('\n'),
        },
      ],
    };
  }

  private async getLiveKitStatus() {
    try {
      const services = await this.makeRenderAPICall('/services');
      const liveKitServices = services.services.filter((service: RenderService) => 
        service.name.toLowerCase().includes('livekit')
      );

      let status = `LiveKit Deployment Status:\n\n`;
      
      if (liveKitServices.length === 0) {
        status += `No LiveKit services found in your Render account.`;
      } else {
        for (const service of liveKitServices) {
          status += `Service: ${service.name}\n`;
          status += `  Type: ${service.type}\n`;
          status += `  Status: ${service.status}\n`;
          status += `  URL: ${service.serviceDetails?.url || 'N/A'}\n`;
          
          // Get recent logs for health check
          try {
            const logsResponse = await this.makeRenderAPICall(`/services/${service.id}/logs?limit=10`);
            const recentLogs = logsResponse.logs || [];
            if (recentLogs.length > 0) {
              status += `  Latest log: ${recentLogs[0].message}\n`;
            }
          } catch (error) {
            status += `  Log retrieval failed: ${error}\n`;
          }
          
          status += `\n`;
        }
      }

      // Check local configuration files
      if (existsSync('../render.yaml')) {
        status += `\nLocal render.yaml configuration found.`;
      }
      
      if (existsSync('../config.yaml')) {
        status += `\nLocal LiveKit config.yaml found.`;
      }

      return {
        content: [
          {
            type: 'text',
            text: status,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to get LiveKit status: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async restartService(serviceId: string) {
    // Trigger a new deploy by making a deploy request
    const response = await this.makeRenderAPICall(`/services/${serviceId}/deploys`, {
      method: 'POST',
      body: JSON.stringify({ clearCache: false }),
    });
    
    return {
      content: [
        {
          type: 'text',
          text: `Service restart initiated successfully!\n\n` +
            `Deploy ID: ${response.id}\n` +
            `Status: ${response.status}\n` +
            `Created: ${response.createdAt}\n\n` +
            `You can monitor the restart progress using the list_deploys tool.`,
        },
      ],
    };
  }

  private async diagnoseLiveKitConfig() {
    let diagnosis = `🔍 LiveKit Configuration Diagnosis\n\n`;
    
    try {
      // Check local files
      if (existsSync('../render.yaml')) {
        diagnosis += `✅ Local render.yaml found\n`;
        try {
          const renderYaml = readFileSync('../render.yaml', 'utf-8');
          const renderConfig = parse(renderYaml);
          
          if (renderConfig.services?.[0]?.envVars) {
            diagnosis += `📋 Environment variables in render.yaml:\n`;
            renderConfig.services[0].envVars.forEach((envVar: any) => {
              diagnosis += `   • ${envVar.key}: ${envVar.value.substring(0, 20)}${envVar.value.length > 20 ? '...' : ''}\n`;
            });
          }
        } catch (error) {
          diagnosis += `❌ Error parsing render.yaml: ${error}\n`;
        }
      } else {
        diagnosis += `❌ Local render.yaml not found\n`;
      }

      if (existsSync('../config.yaml')) {
        diagnosis += `✅ Local config.yaml found\n`;
        try {
          const configYaml = readFileSync('../config.yaml', 'utf-8');
          const config = parse(configYaml);
          
          if (config.keys) {
            const keyCount = Object.keys(config.keys).length;
            diagnosis += `🔑 LiveKit keys in config.yaml: ${keyCount} pairs found\n`;
          } else {
            diagnosis += `❌ No keys section found in config.yaml\n`;
          }
        } catch (error) {
          diagnosis += `❌ Error parsing config.yaml: ${error}\n`;
        }
      } else {
        diagnosis += `❌ Local config.yaml not found\n`;
      }

      // Check services for the error
      const services = await this.makeRenderAPICall('/services');
      const liveKitServices = services.services.filter((service: RenderService) => 
        service.name.toLowerCase().includes('livekit')
      );

      if (liveKitServices.length > 0) {
        for (const service of liveKitServices) {
          diagnosis += `\n🚀 Service: ${service.name} (${service.id})\n`;
          diagnosis += `   Status: ${service.status}\n`;
          
          try {
            const logs = await this.makeRenderAPICall(`/services/${service.id}/logs?limit=20`);
            const errorLogs = logs.logs?.filter((log: any) => 
              log.message.includes('key-file or keys must be provided') ||
              log.message.includes('LIVEKIT_KEYS') ||
              log.message.includes('config')
            ) || [];
            
            if (errorLogs.length > 0) {
              diagnosis += `🔍 Recent error logs:\n`;
              errorLogs.slice(0, 5).forEach((log: any) => {
                diagnosis += `   • ${log.message.trim()}\n`;
              });
            }
          } catch (logError) {
            diagnosis += `❌ Could not retrieve logs: ${logError}\n`;
          }
        }
      }

      diagnosis += `\n💡 **Probable Issue:**\n`;
      diagnosis += `The error "one of key-file or keys must be provided" suggests that:\n`;
      diagnosis += `1. LiveKit can't find API keys in the expected format\n`;
      diagnosis += `2. There might be a conflict between LIVEKIT_KEYS env var and config.yaml\n`;
      diagnosis += `3. The config.yaml file might not be properly mounted or accessible\n\n`;
      
      diagnosis += `🔧 **Recommended Fix:**\n`;
      diagnosis += `Use the 'fix_livekit_keys_config' tool with your service ID to:\n`;
      diagnosis += `• Remove conflicting LIVEKIT_KEYS environment variable\n`;
      diagnosis += `• Ensure config.yaml keys are properly configured\n`;
      diagnosis += `• Set the correct command line arguments for LiveKit\n`;

      return {
        content: [
          {
            type: 'text',
            text: diagnosis,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error during diagnosis: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async fixLiveKitKeysConfig(serviceId: string) {
    try {
      let result = `🔧 Fixing LiveKit Keys Configuration\n\n`;
      
      // Read the local config.yaml to get the proper keys
      if (!existsSync('../config.yaml')) {
        throw new Error('config.yaml file not found. Make sure you are running this from the correct directory.');
      }

      const configYaml = readFileSync('../config.yaml', 'utf-8');
      const config = parse(configYaml);

      if (!config.keys || Object.keys(config.keys).length === 0) {
        throw new Error('No keys found in config.yaml. Please add API keys to your config.yaml file.');
      }

      result += `✅ Found ${Object.keys(config.keys).length} key pairs in config.yaml\n`;

      // Create properly formatted LIVEKIT_KEYS environment variable
      // Format: "key1: secret1, key2: secret2"
      const keyPairs = Object.entries(config.keys as Record<string, string>);
      const livekitKeysValue = keyPairs
        .map(([key, secret]) => `${key}: ${secret}`)
        .join(', ');

      result += `🔑 Formatted keys for LIVEKIT_KEYS environment variable\n`;

      // Update environment variables
      const envVars = {
        'LIVEKIT_KEYS': livekitKeysValue,
        'PORT': '7880'  // Ensure PORT is set correctly
      };

      result += `📝 Updating environment variables...\n`;
      
      await this.updateEnvVars(serviceId, envVars);
      
      result += `✅ Environment variables updated successfully!\n\n`;
      result += `🚀 **Next Steps:**\n`;
      result += `1. The service should automatically redeploy with the new environment variables\n`;
      result += `2. Monitor the deployment logs to ensure LiveKit starts successfully\n`;
      result += `3. Use 'get_service_logs' to check for any remaining errors\n\n`;
      result += `💡 **What was fixed:**\n`;
      result += `• Set LIVEKIT_KEYS environment variable with proper format\n`;
      result += `• Ensured PORT is correctly set to 7880\n`;
      result += `• LiveKit will now use these keys instead of requiring config.yaml\n`;

      return {
        content: [
          {
            type: 'text',
            text: result,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error fixing configuration: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }

  public async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('LiveKit Render MCP server running on stdio');
  }
}

const server = new LiveKitRenderMCPServer();
server.run().catch(console.error);
