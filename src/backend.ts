import type { Backend, OpenSERPConfig } from "./types/public";

export const OSS_BASE_URL = "http://localhost:7000";
export const CLOUD_BASE_URL = "https://api.openserp.org/v1";

export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

export function resolveBaseUrl(config: OpenSERPConfig): string {
  if (config.baseUrl) {
    return normalizeBaseUrl(config.baseUrl);
  }

  if (config.apiKey) {
    return CLOUD_BASE_URL;
  }

  return OSS_BASE_URL;
}

export function inferBackend(config: Pick<OpenSERPConfig, "apiKey" | "baseUrl" | "backend">): Backend {
  if (config.backend) {
    return config.backend;
  }

  if (config.baseUrl) {
    try {
      if (new URL(config.baseUrl).hostname === "api.openserp.org") {
        return "cloud";
      }
    } catch {
      if (config.baseUrl.includes("api.openserp.org")) {
        return "cloud";
      }
    }
  }

  if (config.apiKey) {
    return "cloud";
  }

  return "oss";
}
