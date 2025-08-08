#!/usr/bin/env tsx
/**
 * CLI tool for authentication
 */

import { AuthManager } from "../auth-manager.js";

async function main() {
  const authManager = new AuthManager();
  
  console.log("🚀 Toast MCP Okta Authentication");
  console.log("=".repeat(50));
  
  const service = process.argv[2];
  const username = process.env.OKTA_USERNAME;
  
  const result = await authManager.authenticate(service, username);
  
  if (result.success) {
    console.log("\n✅ Authentication successful!");
    if (result.token) {
      console.log(`Token: ${result.token.substring(0, 40)}...`);
    }
    if (service) {
      console.log(`\nService ${service} is now authenticated.`);
    }
  } else {
    console.error("\n❌ Authentication failed:", result.message);
    process.exit(1);
  }
}

main().catch(console.error);