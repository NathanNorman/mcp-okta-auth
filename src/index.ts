#!/usr/bin/env node
/**
 * MCP Okta Authentication Server
 * Centralized authentication service for Toast MCP servers
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { AuthManager } from "./auth-manager.js";
import { ServiceRegistry } from "./service-registry.js";
import { logger } from "./utils/logger.js";

// Initialize server
const server = new Server(
  {
    name: "mcp-okta-auth",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Initialize managers
const authManager = new AuthManager();
const serviceRegistry = new ServiceRegistry();

// Tool definitions
const TOOLS: Tool[] = [
  {
    name: "authenticate",
    description: "Authenticate with Okta SSO for Toast services",
    inputSchema: {
      type: "object",
      properties: {
        service: {
          type: "string",
          description: "Target service (datahub, splunk, zeppelin). If not specified, only Okta auth is performed.",
          enum: ["datahub", "splunk", "zeppelin"],
        },
        username: {
          type: "string",
          description: "Okta username (optional, will prompt if not provided)",
        },
        forceRefresh: {
          type: "boolean",
          description: "Force re-authentication even if valid session exists",
          default: false,
        },
      },
    },
  },
  {
    name: "check_auth_status",
    description: "Check authentication status for all services",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_service_token",
    description: "Get authentication token/cookies for a specific service",
    inputSchema: {
      type: "object",
      properties: {
        service: {
          type: "string",
          description: "Service name",
          enum: ["datahub", "splunk", "zeppelin"],
        },
      },
      required: ["service"],
    },
  },
  {
    name: "refresh_session",
    description: "Refresh Okta session before it expires",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "copy_session",
    description: "Copy Okta session from one authenticated service to another",
    inputSchema: {
      type: "object",
      properties: {
        fromService: {
          type: "string",
          description: "Source service with valid auth",
          enum: ["datahub", "splunk", "zeppelin"],
        },
        toService: {
          type: "string",
          description: "Target service to copy auth to",
          enum: ["datahub", "splunk", "zeppelin"],
        },
      },
      required: ["fromService", "toService"],
    },
  },
  {
    name: "clear_auth",
    description: "Clear authentication for a service or all services",
    inputSchema: {
      type: "object",
      properties: {
        service: {
          type: "string",
          description: "Service to clear (omit to clear all)",
          enum: ["datahub", "splunk", "zeppelin", "all"],
        },
      },
    },
  },
  {
    name: "list_services",
    description: "List all registered Toast services and their configurations",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: TOOLS,
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "authenticate": {
        const result = await authManager.authenticate(
          args?.service as string | undefined,
          args?.username as string | undefined,
          args?.forceRefresh as boolean
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "check_auth_status": {
        const status = await authManager.checkAuthStatus();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(status, null, 2),
            },
          ],
        };
      }

      case "get_service_token": {
        const token = await authManager.getServiceToken(args.service as string);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(token, null, 2),
            },
          ],
        };
      }

      case "refresh_session": {
        const result = await authManager.refreshSession();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "copy_session": {
        const result = await authManager.copySession(
          args.fromService as string,
          args.toService as string
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "clear_auth": {
        const result = await authManager.clearAuth(args?.service as string);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "list_services": {
        const services = serviceRegistry.listServices();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(services, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    logger.error(`Tool execution failed: ${name}`, error);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              error: true,
              message: error instanceof Error ? error.message : String(error),
            },
            null,
            2
          ),
        },
      ],
    };
  }
});

// Start server
async function main() {
  logger.info("Starting MCP Okta Auth Server...");
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  logger.info("MCP Okta Auth Server running on stdio");
}

main().catch((error) => {
  logger.error("Failed to start server:", error);
  process.exit(1);
});