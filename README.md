# MCP Okta Authentication Server

> 🔐 Centralized Okta SSO authentication for Toast MCP servers

**⚠️ Internal Toast Tool - Not for External Distribution**

## Overview

The MCP Okta Auth server provides centralized authentication management for all Toast MCP servers (DataHub, Splunk, Zeppelin, etc.). Instead of each MCP server implementing its own Okta authentication, this server handles it once and shares sessions across all services.

## Features

- 🔑 **Single Sign-On**: Authenticate once, use everywhere
- 🔄 **Session Management**: Automatic session refresh and validation
- 🎯 **Service Registry**: Pre-configured Toast services
- 🔗 **Session Sharing**: Copy sessions between services
- 📊 **Status Monitoring**: Check auth status for all services
- 🛡️ **Secure Storage**: Encrypted cookie storage with proper permissions

## Installation

```bash
# Clone the repository
git clone https://github.toasttab.com/nathannorman-toast/mcp-okta-auth.git
cd mcp-okta-auth

# Install dependencies
npm install

# Setup (installs Playwright browsers)
npm run setup
```

## Usage

### CLI Commands

```bash
# Check authentication status
npm run status

# Authenticate with Okta
npm run auth

# Authenticate for specific service
npm run auth datahub
npm run auth splunk
npm run auth zeppelin

# Build TypeScript
npm run build

# Start MCP server
npm start
```

### Claude Desktop Configuration

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "okta-auth": {
      "command": "node",
      "args": [
        "/Users/YOUR_USERNAME/mcp-okta-auth/dist/index.js"
      ]
    }
  }
}
```

## MCP Tools

### `authenticate`
Authenticate with Okta SSO for Toast services.

**Parameters:**
- `service` (optional): Target service (datahub, splunk, zeppelin)
- `username` (optional): Okta username
- `forceRefresh` (optional): Force re-authentication

### `check_auth_status`
Check authentication status for all services.

### `get_service_token`
Get authentication token/cookies for a specific service.

**Parameters:**
- `service`: Service name (required)

### `refresh_session`
Refresh Okta session before it expires.

### `copy_session`
Copy Okta session from one authenticated service to another.

**Parameters:**
- `fromService`: Source service with valid auth
- `toService`: Target service to copy auth to

### `clear_auth`
Clear authentication for a service or all services.

**Parameters:**
- `service` (optional): Service to clear, or "all"

### `list_services`
List all registered Toast services and their configurations.

## Architecture

```
mcp-okta-auth/
├── src/
│   ├── index.ts              # MCP server entry point
│   ├── auth-manager.ts       # Core authentication logic
│   ├── service-registry.ts   # Service configurations
│   ├── cli/                  # CLI tools
│   │   ├── authenticate.ts   # Auth CLI
│   │   └── status.ts         # Status CLI
│   └── utils/
│       └── logger.ts         # Logging utility
├── dist/                     # Compiled JavaScript
└── package.json
```

## How It Works

1. **Initial Authentication**: User authenticates once through browser
2. **Cookie Storage**: Okta cookies saved to `~/.mcp-auth/`
3. **Session Sharing**: Other MCP servers can use the shared Okta session
4. **Service Auth**: Each service still needs service-specific cookies, but Okta login is skipped

## Supported Services

- **DataHub**: `datahub.eng.toasttab.com`
- **Splunk Cloud**: `toast.splunkcloud.com`
- **Zeppelin**: `zeppelin-okta.eng.toasttab.com`

## Security

- Cookies stored with `600` permissions (owner read/write only)
- Never commit cookie files to version control
- Sessions expire after 4-12 hours (configurable by Toast IT)

## Migration Guide

### For MCP Server Developers

1. Remove Playwright and authentication code from your MCP server
2. Add dependency on mcp-okta-auth tools
3. Use `get_service_token` to retrieve authentication

### For End Users

1. Install mcp-okta-auth
2. Run `npm run auth` once
3. All MCP servers now have Okta authentication!

## Troubleshooting

### "No Okta session found"
Run `npm run auth` to authenticate

### "Service cookies not found"
You have Okta auth but need to complete service-specific auth

### Browser doesn't open
Check that you're not running in Docker/SSH

## Development

```bash
# Run in development mode
npm run dev

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format
```

## Contributing

This is an internal Toast tool. For issues or improvements:
- Create an issue in the GitHub repository
- Contact Nathan Norman on Slack

## License

Copyright © 2024 Toast, Inc. All rights reserved.
Internal use only - not for external distribution.