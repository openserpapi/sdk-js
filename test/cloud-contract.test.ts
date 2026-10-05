import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, expect, test } from "vitest";
import { OpenSERP, RateLimitError, SERPError } from "../src";
import { errorFromResponse } from "../src/errors";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

test.each(["json", "markdown", "text", "ndjson"] as const)(
  "preserves Cloud errors when format=%s",
  async (format) => {
    let calls = 0;
    server.use(http.get("https://api.openserp.org/v1/google/search", () => {
      calls += 1;
      return HttpResponse.json({
        error: "engine_unavailable", code: 503, message: "Engine temporarily unavailable.",
        retry_after: 60,
      }, { status: 503, headers: { "Retry-After": "60", "X-Request-Id": "req_outage" } });
    }));
    const client = new OpenSERP({ apiKey: "osk_live_test" });
    await expect(client.search({ engine: "google", text: "test", format })).rejects.toMatchObject({
      status: 503, code: "engine_unavailable", requestId: "req_outage", retryAfter: 60,
    });
    expect(calls).toBe(1);
  },
);

test("preserves unsupported-filter errors and rate-limit types for text requests", async () => {
  const client = new OpenSERP({ apiKey: "osk_live_test" });
  for (const [status, code] of [[400, "invalid_request"], [429, "rate_limited"]] as const) {
    server.use(http.get("https://api.openserp.org/v1/bing/search", () => HttpResponse.json({
      error: code, code: status, request_id: "req_filter", message: "Request rejected.",
    }, { status })));
    const pending = client.search({ engine: "bing", text: "test", date: "20250101..20251231", format: "text" });
    await expect(pending).rejects.toBeInstanceOf(status === 429 ? RateLimitError : SERPError);
    await expect(pending).rejects.toMatchObject({ status, code, requestId: "req_filter" });
  }
});

test.each([
  ["45", 60, 45], [null, 60, 60], ["invalid", 60, 60], ["0", 60, 0],
  [null, -1, undefined], [null, true, undefined], [null, "", undefined],
] as const)("reads retry delay from header %s and body %s", (header, body, expected) => {
  expect(errorFromResponse(503, { error: "engine_unavailable", retry_after: body }, undefined, header).retryAfter)
    .toBe(expected);
});

test.each(["anySearch", "fastSearch"] as const)("%s forwards paging and accepts compact metadata", async (method) => {
  server.use(http.get("https://api.openserp.org/v1/mega/search", ({ request }) => {
    const url = new URL(request.url);
    expect(url.searchParams.get("start")).toBe("10");
    expect(url.searchParams.get("mode")).toBe(method === "anySearch" ? "any" : "fast");
    expect(url.searchParams.get("engines")).toBe("google,bing");
    expect(request.headers.get("authorization")).toBe("Bearer osk_live_test");
    return HttpResponse.json({
      query: { text: "test", engines_requested: ["google", "bing"] },
      meta: { request_id: "req_page", engine_used: "bing" },
      results: [{ title: "Page 2", url: "https://example.com", engine: "bing" }],
      pagination: { page: 2, has_more: true, next_start: 20 },
    }, { headers: { "X-Engine-Used": "bing", "X-Request-Id": "req_page", "X-Credits-Used": "1" } });
  }));
  const client = new OpenSERP({ apiKey: "osk_live_test" });
  const page = await client[method]({ text: "test", engines: ["google", "bing"], limit: 10, start: 10 });
  expect(page.meta.engine_used).toBe("bing");
  expect(page.meta.engines_tried).toBeUndefined();
  expect(page.meta.engines_skipped).toBeUndefined();
  expect(page.pagination.next_start).toBe(20);
  expect(client.lastResponse?.engineUsed).toBe("bing");
});

test("returns authenticated engine status", async () => {
  server.use(http.get("https://api.openserp.org/v1/engines/status", () => HttpResponse.json({
    engines: { google: { status: "operational", latency_ms: 100 } },
  })));
  const status = await new OpenSERP({ apiKey: "osk_live_test" }).enginesStatus();
  expect(status).toEqual({ engines: { google: { status: "operational", latency_ms: 100 } } });
});

test("accepts anonymous overall status", async () => {
  server.use(http.get("https://api.openserp.org/v1/engines/status", ({ request }) => {
    expect(request.headers.get("authorization")).toBeNull();
    return HttpResponse.json({ overall: "degraded" });
  }));
  await expect(new OpenSERP({ backend: "cloud", baseUrl: "https://api.openserp.org/v1" }).enginesStatus())
    .resolves.toEqual({ overall: "degraded" });
});
