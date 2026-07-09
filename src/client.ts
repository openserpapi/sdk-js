import { inferBackend, resolveBaseUrl } from "./backend";
import { CloudOnlyError, OssOnlyError } from "./errors";
import { request, type QueryValue } from "./request";
import type {
  CacheStats,
  CircuitBreakerStatsResponse,
  ExtractParams,
  ExtractResult,
  HealthStatus,
  ImageEnvelope,
  ImageParams,
  JsonExtractParams,
  JsonImageParams,
  JsonMegaImageParams,
  JsonMegaSearchParams,
  JsonParseParams,
  JsonSearchParams,
  LastResponse,
  MegaEnginesResponse,
  MegaImageParams,
  MegaSearchEnvelope,
  MegaSearchParams,
  OpenSERPConfig,
  ParseParams,
  ReadinessStatus,
  SearchEnvelope,
  SearchParams,
  StatsResponse,
  ProxyStats,
  TextExtractParams,
  TextImageParams,
  TextMegaImageParams,
  TextMegaSearchParams,
  TextParseParams,
  TextSearchParams,
} from "./types/public";
import type {
  CloudAccount,
  EnginesCapabilities,
  EnginesStatus,
  Pricing,
} from "./types/cloud";

export class OpenSERP {
  readonly config: OpenSERPConfig;
  lastResponse?: LastResponse;

  constructor(config: OpenSERPConfig = {}) {
    this.config = { ...config };
  }

  get backend() {
    return inferBackend(this.config);
  }

  get baseUrl() {
    return resolveBaseUrl(this.config);
  }

  search(params: JsonSearchParams): Promise<SearchEnvelope>;
  search(params: TextSearchParams): Promise<string>;
  search(params: SearchParams): Promise<SearchEnvelope | string>;
  search(params: SearchParams): Promise<SearchEnvelope | string> {
    const { engine, format, ...query } = params;
    return this.get<SearchEnvelope | string>(`/${engine}/search`, query, format);
  }

  image(params: JsonImageParams): Promise<ImageEnvelope>;
  image(params: TextImageParams): Promise<string>;
  image(params: ImageParams): Promise<ImageEnvelope | string>;
  image(params: ImageParams): Promise<ImageEnvelope | string> {
    const { engine, format, ...query } = params;
    return this.get<ImageEnvelope | string>(`/${engine}/image`, query, format);
  }

  megaSearch(params: JsonMegaSearchParams): Promise<MegaSearchEnvelope>;
  megaSearch(params: TextMegaSearchParams): Promise<string>;
  megaSearch(params: MegaSearchParams): Promise<MegaSearchEnvelope | string>;
  megaSearch(params: MegaSearchParams): Promise<MegaSearchEnvelope | string> {
    const { format, ...query } = params;
    return this.get<MegaSearchEnvelope | string>("/mega/search", query, format);
  }

  extract(params: JsonExtractParams): Promise<ExtractResult>;
  extract(params: TextExtractParams): Promise<string>;
  extract(params: ExtractParams): Promise<ExtractResult | string>;
  extract(params: ExtractParams): Promise<ExtractResult | string> {
    const { format, ...query } = params;
    return this.get<ExtractResult | string>("/extract", query, format);
  }

  fastSearch(params: Omit<JsonMegaSearchParams, "mode">): Promise<MegaSearchEnvelope>;
  fastSearch(params: Omit<TextMegaSearchParams, "mode">): Promise<string>;
  fastSearch(params: Omit<MegaSearchParams, "mode">): Promise<MegaSearchEnvelope | string>;
  fastSearch(params: Omit<MegaSearchParams, "mode">): Promise<MegaSearchEnvelope | string> {
    const { format, ...query } = { ...params, mode: "fast" };
    return this.get<MegaSearchEnvelope | string>("/mega/search", query, format);
  }

  anySearch(params: Omit<JsonMegaSearchParams, "mode">): Promise<MegaSearchEnvelope>;
  anySearch(params: Omit<TextMegaSearchParams, "mode">): Promise<string>;
  anySearch(params: Omit<MegaSearchParams, "mode">): Promise<MegaSearchEnvelope | string>;
  anySearch(params: Omit<MegaSearchParams, "mode">): Promise<MegaSearchEnvelope | string> {
    const { format, ...query } = { ...params, mode: "any" };
    return this.get<MegaSearchEnvelope | string>("/mega/search", query, format);
  }

  megaImage(params: JsonMegaImageParams): Promise<ImageEnvelope>;
  megaImage(params: TextMegaImageParams): Promise<string>;
  megaImage(params: MegaImageParams): Promise<ImageEnvelope | string>;
  megaImage(params: MegaImageParams): Promise<ImageEnvelope | string> {
    const { format, ...query } = params;
    return this.get<ImageEnvelope | string>("/mega/image", query, format);
  }

  fastImage(params: Omit<JsonMegaImageParams, "mode">): Promise<ImageEnvelope>;
  fastImage(params: Omit<TextMegaImageParams, "mode">): Promise<string>;
  fastImage(params: Omit<MegaImageParams, "mode">): Promise<ImageEnvelope | string>;
  fastImage(params: Omit<MegaImageParams, "mode">): Promise<ImageEnvelope | string> {
    const { format, ...query } = { ...params, mode: "fast" };
    return this.get<ImageEnvelope | string>("/mega/image", query, format);
  }

  anyImage(params: Omit<JsonMegaImageParams, "mode">): Promise<ImageEnvelope>;
  anyImage(params: Omit<TextMegaImageParams, "mode">): Promise<string>;
  anyImage(params: Omit<MegaImageParams, "mode">): Promise<ImageEnvelope | string>;
  anyImage(params: Omit<MegaImageParams, "mode">): Promise<ImageEnvelope | string> {
    const { format, ...query } = { ...params, mode: "any" };
    return this.get<ImageEnvelope | string>("/mega/image", query, format);
  }

  parseGoogle(params: JsonParseParams): Promise<SearchEnvelope>;
  parseGoogle(params: TextParseParams): Promise<string>;
  parseGoogle(params: ParseParams): Promise<SearchEnvelope | string>;
  parseGoogle(params: ParseParams): Promise<SearchEnvelope | string> {
    this.assertOss("parseGoogle");
    return this.parse("/google/parse", params);
  }

  parseBing(params: JsonParseParams): Promise<SearchEnvelope>;
  parseBing(params: TextParseParams): Promise<string>;
  parseBing(params: ParseParams): Promise<SearchEnvelope | string>;
  parseBing(params: ParseParams): Promise<SearchEnvelope | string> {
    this.assertOss("parseBing");
    return this.parse("/bing/parse", params);
  }

  health(): Promise<HealthStatus> {
    this.assertOss("health");
    return this.get<HealthStatus>("/health");
  }

  ready(): Promise<ReadinessStatus> {
    this.assertOss("ready");
    return this.get<ReadinessStatus>("/ready");
  }

  stats(): Promise<StatsResponse> {
    this.assertOss("stats");
    return this.get<StatsResponse>("/stats");
  }

  cacheStats(): Promise<CacheStats> {
    this.assertOss("cacheStats");
    return this.get<CacheStats>("/stats/cache");
  }

  proxyStats(): Promise<ProxyStats> {
    this.assertOss("proxyStats");
    return this.get<ProxyStats>("/stats/proxy");
  }

  circuitBreakerStats(): Promise<CircuitBreakerStatsResponse> {
    this.assertOss("circuitBreakerStats");
    return this.get<CircuitBreakerStatsResponse>("/stats/cb");
  }

  engines(): Promise<MegaEnginesResponse> {
    this.assertOss("engines");
    return this.get<MegaEnginesResponse>("/mega/engines");
  }

  me(): Promise<CloudAccount> {
    this.assertCloud("me");
    return this.get<CloudAccount>("/me");
  }

  pricing(): Promise<Pricing> {
    this.assertCloud("pricing");
    return this.get<Pricing>("/pricing");
  }

  enginesStatus(): Promise<EnginesStatus> {
    this.assertCloud("enginesStatus");
    return this.get<EnginesStatus>("/engines/status");
  }

  enginesCapabilities(): Promise<EnginesCapabilities> {
    this.assertCloud("enginesCapabilities");
    return this.get<EnginesCapabilities>("/engines/capabilities");
  }

  private parse(path: string, params: ParseParams): Promise<SearchEnvelope | string> {
    return request<SearchEnvelope | string>(this.requestContext(), {
      method: "POST",
      path,
      query: params.format ? { format: params.format } : undefined,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
      body: params.html,
      format: params.format,
    });
  }

  private get<T>(
    path: string,
    query?: Record<string, QueryValue>,
    format?: SearchParams["format"],
  ): Promise<T> {
    const { query: cleanQuery, headers } = splitQueryAndHeaders({
      ...query,
      format,
    });

    return request<T>(this.requestContext(), {
      path,
      query: cleanQuery,
      headers,
      format,
    });
  }

  private requestContext() {
    return {
      baseUrl: this.baseUrl,
      config: this.config,
      setLastResponse: (response: LastResponse) => {
        this.lastResponse = response;
      },
    };
  }

  private assertCloud(method: string): void {
    if (this.backend !== "cloud") {
      throw new CloudOnlyError(method);
    }
  }

  private assertOss(method: string): void {
    if (this.backend !== "oss") {
      throw new OssOnlyError(method);
    }
  }
}

function splitQueryAndHeaders(query: Record<string, QueryValue>): {
  query: Record<string, QueryValue>;
  headers: HeadersInit;
} {
  const {
    useProxy,
    proxyUrl,
    proxyCountry,
    proxyClass,
    proxyProvider,
    proxySessionId,
    tenant,
    extractMode,
    minRunes,
    useLlmsTxt,
    ...cleanQuery
  } = query;
  const headers: Record<string, string> = {};

  addHeader(headers, "X-Use-Proxy", useProxy);
  addHeader(headers, "X-Proxy-URL", proxyUrl);
  addHeader(headers, "X-Proxy-Country", proxyCountry);
  addHeader(headers, "X-Proxy-Class", proxyClass);
  addHeader(headers, "X-Proxy-Provider", proxyProvider);
  addHeader(headers, "X-Proxy-Session-ID", proxySessionId);
  addHeader(headers, "X-Tenant", tenant);

  addQuery(cleanQuery, "extract_mode", extractMode);
  addQuery(cleanQuery, "min_runes", minRunes);
  addQuery(cleanQuery, "use_llms_txt", useLlmsTxt);

  return { query: cleanQuery, headers };
}

function addHeader(headers: Record<string, string>, name: string, value: QueryValue): void {
  if (value === undefined || value === null) {
    return;
  }
  headers[name] = Array.isArray(value) ? value.join(",") : String(value);
}

function addQuery(query: Record<string, QueryValue>, name: string, value: QueryValue): void {
  if (value === undefined || value === null) {
    return;
  }
  query[name] = value;
}
