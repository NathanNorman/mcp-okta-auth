/**
 * Authentication Manager
 * Handles Okta SSO authentication and session management
 */

import { chromium, Browser, Page, Cookie } from "playwright";
import { CookieJar } from "tough-cookie";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { logger } from "./utils/logger.js";
import { ServiceConfig, SERVICE_CONFIGS } from "./service-registry.js";

export interface AuthResult {
  success: boolean;
  message: string;
  service?: string;
  cookies?: Cookie[];
  token?: string;
  expiresAt?: Date;
}

export interface AuthStatus {
  okta: {
    authenticated: boolean;
    expiresAt?: Date;
  };
  services: {
    [key: string]: {
      authenticated: boolean;
      hasServiceCookies: boolean;
      expiresAt?: Date;
    };
  };
}

export class AuthManager {
  private cookieJar: CookieJar;
  private browser: Browser | null = null;
  private authDir: string;
  private oktaCookieFile: string;
  private serviceCookieDir: string;

  constructor() {
    this.cookieJar = new CookieJar();
    this.authDir = path.join(os.homedir(), ".mcp-auth");
    this.oktaCookieFile = path.join(this.authDir, "okta-cookies.json");
    this.serviceCookieDir = path.join(this.authDir, "services");
    this.ensureDirectories();
  }

  private async ensureDirectories() {
    await fs.mkdir(this.authDir, { recursive: true });
    await fs.mkdir(this.serviceCookieDir, { recursive: true });
  }

  async authenticate(
    service?: string,
    username?: string,
    forceRefresh: boolean = false
  ): Promise<AuthResult> {
    try {
      // Check existing Okta session
      if (!forceRefresh) {
        const existingAuth = await this.loadOktaCookies();
        if (existingAuth && await this.validateOktaSession(existingAuth)) {
          logger.info("Using existing Okta session");
          
          if (service) {
            // Complete service-specific auth
            return await this.completeServiceAuth(service, existingAuth);
          }
          
          return {
            success: true,
            message: "Okta authentication valid",
            cookies: existingAuth,
          };
        }
      }

      // Perform browser authentication
      return await this.browserAuthenticate(service, username);
    } catch (error) {
      logger.error("Authentication failed:", error);
      return {
        success: false,
        message: `Authentication failed: ${error}`,
      };
    }
  }

  private async browserAuthenticate(
    service?: string,
    username?: string
  ): Promise<AuthResult> {
    let page: Page | null = null;

    try {
      logger.info("Opening browser for Okta authentication");
      
      this.browser = await chromium.launch({
        headless: false,
        args: ["--disable-blink-features=AutomationControlled"],
      });

      page = await this.browser.newPage();

      // Load existing Okta cookies if any
      const existingCookies = await this.loadOktaCookies();
      if (existingCookies) {
        await page.context().addCookies(existingCookies);
      }

      // Navigate to Okta or service URL
      const targetUrl = service
        ? SERVICE_CONFIGS[service]?.url || "https://toasttab.okta.com"
        : "https://toasttab.okta.com";
      
      logger.info(`Navigating to ${targetUrl}`);
      await page.goto(targetUrl, { waitUntil: "networkidle" });

      // Check if redirected to Okta login
      if (page.url().includes("okta.com") && page.url().includes("signin")) {
        logger.info("Okta login required");

        if (username) {
          // Attempt automated login
          await this.attemptAutomatedLogin(page, username);
        } else {
          // Manual login
          console.log("\n" + "=".repeat(50));
          console.log("Please log in manually in the browser");
          console.log("The script will continue once authenticated");
          console.log("=".repeat(50) + "\n");
        }

        // Wait for successful authentication
        await page.waitForFunction(
          () => !window.location.href.includes("signin"),
          { timeout: 120000 }
        );
      }

      // Get all cookies
      const cookies = await page.context().cookies();
      
      // Save Okta cookies
      const oktaCookies = cookies.filter(c => 
        c.domain.includes("okta.com") || c.domain.includes("toasttab.com")
      );
      await this.saveOktaCookies(oktaCookies);

      // If service specified, save service cookies
      if (service && SERVICE_CONFIGS[service]) {
        const serviceDomain = SERVICE_CONFIGS[service].cookieDomain;
        const serviceCookies = cookies.filter(c => c.domain.includes(serviceDomain));
        await this.saveServiceCookies(service, serviceCookies);
      }

      return {
        success: true,
        message: service 
          ? `Authenticated with ${service}` 
          : "Okta authentication successful",
        service,
        cookies: oktaCookies,
      };

    } catch (error) {
      logger.error("Browser authentication error:", error);
      return {
        success: false,
        message: `Browser authentication failed: ${error}`,
      };
    } finally {
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
    }
  }

  private async attemptAutomatedLogin(page: Page, username: string) {
    try {
      await page.fill('input[name="identifier"]', username);
      await page.click('input[type="submit"][value="Next"]');
      
      // Note: Password and MFA must be handled manually for security
      logger.info("Username entered. Please complete login manually.");
    } catch (error) {
      logger.warn("Automated login failed, please login manually:", error);
    }
  }

  private async completeServiceAuth(
    service: string,
    oktaCookies: Cookie[]
  ): Promise<AuthResult> {
    const config = SERVICE_CONFIGS[service];
    if (!config) {
      return {
        success: false,
        message: `Unknown service: ${service}`,
      };
    }

    // For now, return that Okta auth is ready
    // Service-specific auth would be completed when the service is accessed
    return {
      success: true,
      message: `Okta authenticated. Run service-specific auth for ${service}`,
      service,
      cookies: oktaCookies,
    };
  }

  async checkAuthStatus(): Promise<AuthStatus> {
    const status: AuthStatus = {
      okta: { authenticated: false },
      services: {},
    };

    // Check Okta auth
    const oktaCookies = await this.loadOktaCookies();
    if (oktaCookies && await this.validateOktaSession(oktaCookies)) {
      status.okta.authenticated = true;
      // Extract expiration from cookies if available
    }

    // Check each service
    for (const service of Object.keys(SERVICE_CONFIGS)) {
      const serviceCookies = await this.loadServiceCookies(service);
      status.services[service] = {
        authenticated: status.okta.authenticated,
        hasServiceCookies: serviceCookies.length > 0,
      };
    }

    return status;
  }

  async getServiceToken(service: string): Promise<any> {
    const config = SERVICE_CONFIGS[service];
    if (!config) {
      throw new Error(`Unknown service: ${service}`);
    }

    const serviceCookies = await this.loadServiceCookies(service);
    if (serviceCookies.length === 0) {
      return {
        success: false,
        message: `No authentication found for ${service}`,
      };
    }

    // Extract token based on service type
    if (config.sessionType === "token") {
      const tokenCookie = serviceCookies.find(c => 
        c.name.toLowerCase().includes("token") || 
        c.name.toLowerCase().includes("session")
      );
      return {
        success: true,
        service,
        token: tokenCookie?.value,
        cookies: serviceCookies,
      };
    }

    return {
      success: true,
      service,
      cookies: serviceCookies,
    };
  }

  async refreshSession(): Promise<AuthResult> {
    // Check if session needs refresh
    const oktaCookies = await this.loadOktaCookies();
    if (!oktaCookies || !await this.validateOktaSession(oktaCookies)) {
      return await this.authenticate(undefined, undefined, true);
    }

    return {
      success: true,
      message: "Session still valid",
      cookies: oktaCookies,
    };
  }

  async copySession(fromService: string, toService: string): Promise<AuthResult> {
    // Load Okta cookies
    const oktaCookies = await this.loadOktaCookies();
    if (!oktaCookies) {
      return {
        success: false,
        message: "No Okta session found",
      };
    }

    // For backward compatibility with existing services
    const legacyPaths: { [key: string]: string } = {
      datahub: path.join(os.homedir(), ".mcp-datahub", "cookies.json"),
      splunk: path.join(os.homedir(), ".mcp-splunk", "cookies.json"),
      zeppelin: path.join(os.homedir(), ".mcp-zeppelin", "cookies.json"),
    };

    // Copy to legacy location if it exists
    if (legacyPaths[toService]) {
      try {
        const dir = path.dirname(legacyPaths[toService]);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(
          legacyPaths[toService],
          JSON.stringify(oktaCookies, null, 2)
        );
        logger.info(`Copied Okta session to ${toService} (legacy path)`);
      } catch (error) {
        logger.warn(`Failed to copy to legacy path: ${error}`);
      }
    }

    return {
      success: true,
      message: `Okta session copied to ${toService}`,
    };
  }

  async clearAuth(service?: string): Promise<AuthResult> {
    if (!service || service === "all") {
      // Clear everything
      await fs.rm(this.authDir, { recursive: true, force: true });
      await this.ensureDirectories();
      return {
        success: true,
        message: "All authentication cleared",
      };
    }

    // Clear specific service
    const serviceFile = path.join(this.serviceCookieDir, `${service}.json`);
    await fs.rm(serviceFile, { force: true });
    
    return {
      success: true,
      message: `Authentication cleared for ${service}`,
    };
  }

  private async loadOktaCookies(): Promise<Cookie[] | null> {
    try {
      const data = await fs.readFile(this.oktaCookieFile, "utf-8");
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  private async saveOktaCookies(cookies: Cookie[]): Promise<void> {
    await fs.writeFile(this.oktaCookieFile, JSON.stringify(cookies, null, 2));
    await fs.chmod(this.oktaCookieFile, 0o600);
  }

  private async loadServiceCookies(service: string): Promise<Cookie[]> {
    try {
      const file = path.join(this.serviceCookieDir, `${service}.json`);
      const data = await fs.readFile(file, "utf-8");
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  private async saveServiceCookies(service: string, cookies: Cookie[]): Promise<void> {
    const file = path.join(this.serviceCookieDir, `${service}.json`);
    await fs.writeFile(file, JSON.stringify(cookies, null, 2));
    await fs.chmod(file, 0o600);
  }

  private async validateOktaSession(cookies: Cookie[]): Promise<boolean> {
    // Check if any critical Okta cookies are expired
    const now = Date.now() / 1000;
    const sessionCookie = cookies.find(c => 
      c.name === "JSESSIONID" || c.name === "idx"
    );
    
    if (!sessionCookie) {
      return false;
    }

    if (sessionCookie.expires && sessionCookie.expires < now) {
      return false;
    }

    // Could make an API call to validate, but for now assume valid
    return true;
  }
}