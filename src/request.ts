import { dumpHeaders, resolveDebug } from "./debug";
import { TimeoutError, errorFromResponse } from "./errors";
import type { LastResponse, OpenSERPConfig, ResponseFormat } from "./types/public";

export type QueryValue =
  | string
  | number
  | boolean
  | readonly string[]
  | undefined
  | null;

export interface RequestOptions {
  method?: "GET" | "POST" | undefined;
  path: string;
  query?: Record<string, QueryValue> | undefined;
  headers?: HeadersInit | undefined;
  body?: BodyInit | null | undefined;
  format?: ResponseFormat | undefined;
}

export interface RequestContext {
  baseUrl: string;
  config: OpenSERPConfig;
  setLastResponse(response: LastResponse): void;
}

export async function request<T>(
  context: RequestContext,
  options: RequestOptions,
): Promise<T> {
  let attempt = 0;

  for (;;) {
    try {
      return await requestOnce<T>(context, options);
    } catch (err) {
      const shouldRetry = await context.config.retry?.(err, attempt);
      if (!shouldRetry) {
        throw err;
      }
      attempt += 1;
    }
  }
}

async function requestOnce<T>(
  { baseUrl, config, setLastResponse }: RequestContext,
  options: RequestOptions,
): Promise<T> {
  const fetchImpl = config.fetch ?? globalThis.fetch;
  if (!fetchImpl) {
    throw new TypeError("OpenSERP SDK requires a fetch implementation.");
  }

  const url = new URL(`${baseUrl}${options.path}`);
  appendQuery(url, options.query);

  const headers = new Headers();
  headers.set("X-OpenSERP-Client", "sdk-js");
  for (const [key, value] of new Headers(config.headers)) {
    headers.set(key, value);
  }
  if (config.apiKey) {
    headers.set("Authorization", `Bearer ${config.apiKey}`);
  }
  for (const [key, value] of new Headers(options.headers)) {
    headers.set(key, value);
  }

  const debug = resolveDebug(config);
  const method = options.method ?? "GET";
  if (debug.level !== "off") {
    debug.emit({
      type: "request",
      method,
      url: url.toString(),
      ...(debug.level === "verbose" ? { headers: dumpHeaders(headers) } : {}),
    });
  }

  const timeoutMs = config.timeoutMs ?? 30_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  let response: Response;
  try {
    const init: RequestInit = {
      method,
      headers,
      signal: controller.signal,
    };
    if (options.body !== undefined) {
      init.body = options.body;
    }

    response = await fetchImpl(url, init);
  } catch (err) {
    const error = isAbortError(err) ? new TimeoutError(timeoutMs, err) : err;
    if (debug.level !== "off") {
      debug.emit({
        type: "error",
        method,
        url: url.toString(),
        durationMs: Date.now() - startedAt,
        error,
      });
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }

  const last = readLastResponse(response);
  setLastResponse(last);
  if (debug.level !== "off") {
    debug.emit({
      type: "response",
      method,
      url: url.toString(),
      status: response.status,
      engineUsed: last.engineUsed,
      requestId: last.requestId,
      durationMs: Date.now() - startedAt,
      ...(debug.level === "verbose" ? { headers: dumpHeaders(response.headers) } : {}),
    });
  }

  const body = await readBody(response, options.format);
  if (!response.ok) {
    throw errorFromResponse(response.status, body, response.headers.get("x-request-id") ?? undefined);
  }

  return body as T;
}

function appendQuery(url: URL, query: Record<string, QueryValue> | undefined): void {
  if (!query) {
    return;
  }

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) {
      continue;
    }
    const encoded = Array.isArray(value) ? value.join(",") : String(value);
    url.searchParams.set(key, encoded);
  }
}

async function readBody(response: Response, format?: ResponseFormat): Promise<unknown> {
  if (response.status === 204) {
    return undefined;
  }

  if (format && format !== "json") {
    return response.text();
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function readLastResponse(response: Response): LastResponse {
  const credits = {
    used: numberHeader(response.headers, "x-credits-used"),
    remaining: numberHeader(response.headers, "x-credits-remaining"),
  };
  const hasCredits = credits.used !== undefined || credits.remaining !== undefined;

  return {
    status: response.status,
    requestId: response.headers.get("x-request-id") ?? undefined,
    credits: hasCredits ? credits : undefined,
    engineUsed: response.headers.get("x-engine-used") ?? undefined,
    fallbackEngine: response.headers.get("x-fallback-engine") ?? undefined,
    cache: response.headers.get("x-cache") ?? undefined,
    proxyMode: response.headers.get("x-proxy-mode") ?? undefined,
    proxyTag: response.headers.get("x-proxy-tag") ?? undefined,
    proxyUsed: response.headers.get("x-proxy-used") ?? undefined,
    networkBytes: numberHeader(response.headers, "x-network-bytes"),
    browserProfileId: response.headers.get("x-browser-profile-id") ?? undefined,
    headers: response.headers,
  };
}

function numberHeader(headers: Headers, name: string): number | undefined {
  const value = headers.get(name);
  if (value === null || value === "") {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}
