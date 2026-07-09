import type { components } from "../generated/oss";
import type { CreditInfo } from "./cloud";

export type Backend = "oss" | "cloud";

export type Engine =
  | "google"
  | "yandex"
  | "baidu"
  | "bing"
  | "duck"
  | "duckduckgo"
  | "ecosia";

export type MegaMode = "balanced" | "any" | "fast";
export type ResponseFormat = "json" | "markdown" | "text" | "ndjson";
export type NonJsonResponseFormat = Exclude<ResponseFormat, "json">;
export type ExtractMode = components["parameters"]["ExtractModeShortQuery"];
export type ExtractModeUsed = NonNullable<
  components["schemas"]["ExtractMeta"]["mode_used"]
>;

export type SearchEnvelope = components["schemas"]["SearchEnvelope"];
export type MegaSearchEnvelope = components["schemas"]["MegaSearchEnvelope"];
export type ImageEnvelope = components["schemas"]["ImageEnvelope"];
export type ExtractedContent = components["schemas"]["ExtractedContent"];
export type ExtractResult = components["schemas"]["ExtractResult"];
export type ExtractHeading = components["schemas"]["ExtractHeading"];
export type ExtractLink = components["schemas"]["ExtractLink"];
export type ExtractMeta = components["schemas"]["ExtractMeta"];
export type SerpFeature = components["schemas"]["SerpFeature"];
export type FeatureItem = components["schemas"]["FeatureItem"];
export type FeatureLink = components["schemas"]["FeatureLink"];
export type ErrorResponse = components["schemas"]["ErrorResponse"];
export type HealthStatus = components["schemas"]["HealthStatus"];
export type ReadinessStatus = components["schemas"]["ReadinessStatus"];
export type StatsResponse = components["schemas"]["StatsResponse"];
export type CacheStats = components["schemas"]["CacheStats"];
export type ProxyStats = components["schemas"]["ProxyStats"];
export type CircuitBreakerStatsResponse =
  components["schemas"]["CircuitBreakerStatsResponse"];
export type MegaEnginesResponse = components["schemas"]["MegaEnginesResponse"];

export interface OpenSERPConfig {
  apiKey?: string | undefined;
  baseUrl?: string | undefined;
  backend?: Backend | undefined;
  timeoutMs?: number | undefined;
  fetch?: typeof fetch | undefined;
  headers?: HeadersInit | undefined;
  retry?: ((err: unknown, attempt: number) => boolean | Promise<boolean>) | undefined;
  /**
   * Logs each request and response to help debug what the SDK actually sends.
   * - `true` / `"info"`: logs method, URL (with query string), and response
   *   status / engine-used / request-id via `console.error`.
   * - `"verbose"`: additionally logs request and response headers
   *   (the `Authorization` header is redacted).
   * - A function: receives a structured {@link DebugEvent} so you can route it
   *   to your own logger instead of the console.
   *
   * Defaults to off. The `OPENSERP_DEBUG` env var (`1`/`true`/`verbose`) enables
   * it when this option is left unset and `process` is available.
   */
  debug?: boolean | "info" | "verbose" | ((event: DebugEvent) => void) | undefined;
}

/** A single request/response lifecycle event emitted when debug is enabled. */
export type DebugEvent =
  | {
      type: "request";
      method: string;
      url: string;
      /** Present only at "verbose" level. Authorization is redacted. */
      headers?: Record<string, string>;
    }
  | {
      type: "response";
      method: string;
      url: string;
      status: number;
      engineUsed?: string | undefined;
      requestId?: string | undefined;
      durationMs: number;
      /** Present only at "verbose" level. */
      headers?: Record<string, string>;
    }
  | {
      type: "error";
      method: string;
      url: string;
      durationMs: number;
      error: unknown;
    };

export interface LastResponse {
  status: number;
  requestId?: string | undefined;
  credits?: CreditInfo | undefined;
  engineUsed?: string | undefined;
  fallbackEngine?: string | undefined;
  cache?: string | undefined;
  proxyMode?: string | undefined;
  proxyTag?: string | undefined;
  proxyUsed?: string | undefined;
  networkBytes?: number | undefined;
  browserProfileId?: string | undefined;
  headers: Headers;
}

export interface SearchParams {
  engine: Engine;
  text?: string;
  lang?: string;
  region?: string;
  date?: string;
  file?: string;
  site?: string;
  limit?: number;
  start?: number;
  filter?: boolean;
  features?: boolean;
  /**
   * Enrich the top web results with cleaned page content. Boolean or integer
   * depth: `false`/`0` disables, `true`/`1` enriches the top result, `N`
   * enriches the top N results (1-5). `extractMode`/`minRunes` imply extraction
   * unless `extract` is `false`/`0`.
   */
  extract?: boolean | number;
  extractMode?: ExtractMode;
  minRunes?: number;
  format?: ResponseFormat;
  useProxy?: string;
  proxyUrl?: string;
  proxyCountry?: string;
  proxyClass?: string;
  proxyProvider?: string;
  proxySessionId?: string;
  tenant?: string;
}

export type ImageParams = SearchParams;

export interface MegaSearchParams extends Omit<SearchParams, "engine"> {
  engines?: Engine[];
  mode?: MegaMode;
  dedupe?: boolean;
  merge?: boolean;
}

export type MegaImageParams = MegaSearchParams;

export interface ParseParams {
  html: string;
  format?: ResponseFormat;
}

export interface ExtractParams {
  url: string;
  mode?: ExtractMode;
  lang?: string;
  minRunes?: number;
  clean?: boolean;
  useLlmsTxt?: boolean;
  format?: ResponseFormat;
  useProxy?: string;
  proxyUrl?: string;
  proxyCountry?: string;
  proxyClass?: string;
  proxyProvider?: string;
  proxySessionId?: string;
  tenant?: string;
}

export type JsonSearchParams = Omit<SearchParams, "format"> & { format?: "json" };
export type TextSearchParams = Omit<SearchParams, "format"> & {
  format: NonJsonResponseFormat;
};
export type JsonImageParams = Omit<ImageParams, "format"> & { format?: "json" };
export type TextImageParams = Omit<ImageParams, "format"> & {
  format: NonJsonResponseFormat;
};
export type JsonMegaSearchParams = Omit<MegaSearchParams, "format"> & {
  format?: "json";
};
export type TextMegaSearchParams = Omit<MegaSearchParams, "format"> & {
  format: NonJsonResponseFormat;
};
export type JsonMegaImageParams = Omit<MegaImageParams, "format"> & {
  format?: "json";
};
export type TextMegaImageParams = Omit<MegaImageParams, "format"> & {
  format: NonJsonResponseFormat;
};
export type JsonParseParams = Omit<ParseParams, "format"> & { format?: "json" };
export type TextParseParams = Omit<ParseParams, "format"> & {
  format: NonJsonResponseFormat;
};
export type JsonExtractParams = Omit<ExtractParams, "format"> & { format?: "json" };
export type TextExtractParams = Omit<ExtractParams, "format"> & {
  format: NonJsonResponseFormat;
};
