import type { ErrorResponse } from "./types/public";

const API_KEYS_URL = "https://openserp.org/dashboard/keys";
const SUPPORT_HINT = "OpenSERP docs: https://openserp.org/docs | GitHub issues: https://github.com/openserpapi/sdk-js/issues";

export class SERPError extends Error {
  readonly status: number;
  readonly code?: string | undefined;
  readonly reason?: string | undefined;
  readonly requestId?: string | undefined;
  readonly meta?: Record<string, unknown> | undefined;
  readonly response?: ErrorResponse | unknown | undefined;

  constructor(message: string, options: {
    status?: number | undefined;
    code?: string | undefined;
    reason?: string | undefined;
    requestId?: string | undefined;
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

export function errorFromResponse(status: number, body: unknown, requestId?: string): SERPError {
  const data = isErrorResponse(body) ? body : undefined;
  const code = data?.error;
  const message = data?.message ?? `OpenSERP request failed with status ${status}`;
  const options = {
    status,
    code,
    reason: data?.reason,
    requestId: data?.request_id ?? requestId,
    meta: data?.meta as Record<string, unknown> | undefined,
    response: body,
  };

  if (status === 429 || code === "rate_limited") {
    return new RateLimitError(message, options);
  }

  if (code === "captcha_detected") {
    return new CaptchaError(message, options);
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
