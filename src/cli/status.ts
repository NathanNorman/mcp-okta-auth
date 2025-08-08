#!/usr/bin/env tsx
/**
 * CLI tool to check authentication status
 */

import { AuthManager } from "../auth-manager.js";

async function main() {
  const authManager = new AuthManager();
  
  console.log("🔍 MCP Authentication Status");
  console.log("=".repeat(50));
  
  const status = await authManager.checkAuthStatus();
  
  // Okta status
  console.log("\n📋 Okta SSO:");
  console.log(`  ${status.okta.authenticated ? "✅" : "❌"} Authenticated: ${status.okta.authenticated}`);
  if (status.okta.expiresAt) {
    console.log(`  ⏰ Expires: ${status.okta.expiresAt}`);
  }
  
  // Service status
  console.log("\n📦 Services:");
  for (const [service, serviceStatus] of Object.entries(status.services)) {
    console.log(`\n  ${service.toUpperCase()}:`);
    console.log(`    ${serviceStatus.authenticated ? "✅" : "❌"} Okta Auth: ${serviceStatus.authenticated}`);
    console.log(`    ${serviceStatus.hasServiceCookies ? "✅" : "❌"} Service Cookies: ${serviceStatus.hasServiceCookies}`);
    if (serviceStatus.expiresAt) {
      console.log(`    ⏰ Expires: ${serviceStatus.expiresAt}`);
    }
  }
  
  console.log("\n" + "=".repeat(50));
  
  // Provide helpful next steps
  const needsAuth = !status.okta.authenticated || 
    Object.values(status.services).some(s => !s.authenticated);
  
  if (needsAuth) {
    console.log("\n💡 To authenticate, run:");
    console.log("   npm run auth");
    console.log("\n   Or for a specific service:");
    console.log("   npm run auth datahub");
    console.log("   npm run auth splunk");
    console.log("   npm run auth zeppelin");
  } else {
    console.log("\n✨ All services authenticated!");
  }
}

main().catch(console.error);