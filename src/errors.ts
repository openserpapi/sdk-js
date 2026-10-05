import type { ErrorResponse } from "./types/public";

const API_KEYS_URL = "https://openserp.org/dashboard/keys";
const SUPPORT_HINT = "OpenSERP docs: https://openserp.org/docs | GitHub issues: https://github.com/openserpapi/sdk-js/issues";

export class SERPError extends Error {
  readonly status: number;
  readonly code?: string | undefined;
  readonly reason?: string | undefined;
  readonly requestId?: string | undefined;
  /** Retry delay in seconds, from Retry-After or the error body. */
  readonly retryAfter?: number | undefined;
  readonly meta?: Record<string, unknown> | undefined;
  readonly response?: ErrorResponse | unknown | undefined;

  constructor(message: string, options: {
    status?: number | undefined;
    code?: string | undefined;
    reason?: string | undefined;
    requestId?: string | undefined;
    retryAfter?: number | undefined;
    meta?: Record<string, unknown> | undefined;
    response?: ErrorResponse | unknown | undefined;
    cause?: unknown | undefined;
  } = {}) {
    super(withSupportHint(message), { cause: options.cause });
    this.name = "SERPError";
    this.status = options.status ?? 0;
    this.code = options.code;
    this.reason = options.reason;
    this.requestId = options.requestId;
    this.retryAfter = options.retryAfter;
    this.meta = options.meta;
    this.response = options.response;
  }
}

export class RateLimitError extends SERPError {
  constructor(message: string, options: ConstructorParameters<typeof SERPError>[1] = {}) {
    super(message, options);
    this.name = "RateLimitError";
  }
}

export class CaptchaError extends SERPError {
  constructor(message: string, options: ConstructorParameters<typeof SERPError>[1] = {}) {
    super(message, options);
    this.name = "CaptchaError";
  }
}

/**
 * Thrown on 402 when the account is out of credits. `topupUrl` points at the
 * dashboard page that accepts card and crypto payments, so an integration can
 * surface a working link instead of a bare error string.
 */
export class InsufficientCreditsError extends SERPError {
  readonly topupUrl?: string | undefined;

  constructor(message: string, options: ConstructorParameters<typeof SERPError>[1] & {
    topupUrl?: string | undefined;
  } = {}) {
    super(message, options);
    this.name = "InsufficientCreditsError";
    this.topupUrl = options.topupUrl;
  }
}

export class CloudOnlyError extends SERPError {
  constructor(method: string) {
    super(`${method} is only available against OpenSERP Cloud. Configure apiKey/baseUrl for https://api.openserp.org/v1 or set client.config.backend = "cloud". Get an API key: ${API_KEYS_URL}`);
    this.name = "CloudOnlyError";
  }
}

export class OssOnlyError extends SERPError {
  constructor(method: string) {
    super(`${method} is only available against a self-hosted OpenSERP server. Configure baseUrl for your OSS server or set client.config.backend = "oss".`);
    this.name = "OssOnlyError";
  }
}

export class TimeoutError extends SERPError {
  constructor(timeoutMs: number, cause?: unknown) {
    super(`OpenSERP request timed out after ${timeoutMs}ms`, {
      code: "request_timeout",
      cause,
    });
    this.name = "TimeoutError";
  }
}

export function errorFromResponse(
  status: number,
  body: unknown,
  requestId?: string,
  retryAfter?: string | null,
): SERPError {
  const data = isErrorResponse(body) ? body : undefined;
  const code = data?.error;
  const message = data?.message ?? `OpenSERP request failed with status ${status}`;
  const options = {
    status,
    code,
    reason: data?.reason,
    requestId: data?.request_id ?? requestId,
    retryAfter: retryDelay(retryAfter) ?? retryDelay(data?.retry_after),
    meta: data?.meta as Record<string, unknown> | undefined,
    response: body,
  };

  if (status === 429 || code === "rate_limited") {
    return new RateLimitError(message, options);
  }

  if (code === "captcha_detected") {
    return new CaptchaError(message, options);
  }

  if (status === 402 || code === "insufficient_credits") {
    const topupUrl = data?.topup_url;
    return new InsufficientCreditsError(message, {
      ...options,
      topupUrl: typeof topupUrl === "string" ? topupUrl : undefined,
    });
  }

  return new SERPError(message, options);
}

function isErrorResponse(body: unknown): body is ErrorResponse {
  return typeof body === "object" && body !== null && "error" in body;
}

function withSupportHint(message: string): string {
  if (message.includes("github.com/openserpapi/sdk-js") || message.includes("openserp.org/docs")) {
    return message;
  }
  return `${message}${message.endsWith(".") ? "" : "."} ${SUPPORT_HINT}`;
}

function retryDelay(value: unknown): number | undefined {
  if (typeof value !== "number" && typeof value !== "string") return undefined;
  if (typeof value === "string" && value.trim() === "") return undefined;
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined;
}
