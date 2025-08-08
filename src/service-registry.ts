/**
 * Service Registry
 * Configuration for Toast services that use Okta SSO
 */

export interface ServiceConfig {
  name: string;
  url: string;
  cookieDomain: string;
  sessionType: "cookie" | "token";
  description: string;
  legacyPath?: string; // For backward compatibility
}

export const SERVICE_CONFIGS: { [key: string]: ServiceConfig } = {
  datahub: {
    name: "DataHub",
    url: "https://datahub.eng.toasttab.com",
    cookieDomain: "datahub.eng.toasttab.com",
    sessionType: "cookie",
    description: "Toast's metadata platform",
    legacyPath: "~/.mcp-datahub/cookies.json",
  },
  splunk: {
    name: "Splunk Cloud",
    url: "https://toast.splunkcloud.com",
    cookieDomain: "toast.splunkcloud.com",
    sessionType: "token",
    description: "Log aggregation and monitoring",
    legacyPath: "~/.mcp-splunk/cookies.json",
  },
  zeppelin: {
    name: "Zeppelin",
    url: "https://zeppelin-okta.eng.toasttab.com",
    cookieDomain: "zeppelin-okta.eng.toasttab.com",
    sessionType: "cookie",
    description: "Interactive data analytics notebooks",
    legacyPath: "~/.mcp-zeppelin/cookies.json",
  },
  // Add more services as needed
};

export class ServiceRegistry {
  listServices(): ServiceConfig[] {
    return Object.values(SERVICE_CONFIGS);
  }

  getService(name: string): ServiceConfig | undefined {
    return SERVICE_CONFIGS[name.toLowerCase()];
  }

  isValidService(name: string): boolean {
    return name.toLowerCase() in SERVICE_CONFIGS;
  }

  getServiceNames(): string[] {
    return Object.keys(SERVICE_CONFIGS);
  }
}