import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import {
  CaptchaError,
  CloudOnlyError,
  OpenSERP,
  OssOnlyError,
  RateLimitError,
} from "../src";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  vi.useRealTimers();
});
afterAll(() => server.close());

const searchBody = {
  query: {
    text: "openserp",
    lang: "EN",
    region: "US",
    engines_requested: ["google"],
  },
  meta: {
    request_id: "req_123",
    requested_at: "2026-05-24T00:00:00Z",
    took_ms: 12,
    engines_failed: [],
    version: "2.1",
  },
  results: [
    {
      id: "s_1",
      rank: 1,
      type: "organic",
      title: "OpenSERP",
      url: "https://openserp.org",
      display_url: "openserp.org",
      snippet: "Search API",
      domain: "openserp.org",
      position: { absolute: 1 },
      engine: "google",
    },
  ],
  pagination: {
    page: 1,
    has_more: false,
  },
};

const extractBody = {
  url: "https://openserp.org",
  title: "OpenSERP",
  description: "Search API",
  markdown: "# OpenSERP\n\nSearch API",
  text: "OpenSERP\n\nSearch API",
  headings: [{ level: 1, text: "OpenSERP" }],
  links: [{ text: "Docs", url: "https://openserp.org/docs" }],
  canonical: "https://openserp.org",
  lang: "en",
  schema_org: [{ "@type": "WebSite", name: "OpenSERP" }],
  og_tags: { "og:title": "OpenSERP" },
  meta: {
    mode_used: "llms_txt",
    fetched_at: "2026-06-01T00:00:00Z",
    bytes: 1024,
    took_ms: 34,
  },
};

describe("OpenSERP", () => {
  test("uses OSS mode by default", async () => {
    server.use(
      http.get("http://localhost:7000/google/search", ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get("text")).toBe("openserp");
        expect(url.searchParams.get("limit")).toBe("10");
        expect(url.searchParams.get("region")).toBe("US");
        expect(request.headers.get("authorization")).toBeNull();

        return HttpResponse.json(searchBody, {
          headers: {
            "X-Request-ID": "req_123",
            "X-Engine-Used": "google",
            "X-Cache": "hit",
            "X-Fallback-Engine": "bing",
          },
        });
      }),
    );

    const client = new OpenSERP();
    const response = await client.search({
      engine: "google",
      text: "openserp",
      limit: 10,
      region: "US",
    });

    expect(typeof response).not.toBe("string");
    if (typeof response !== "string") {
      expect(response.results[0]?.title).toBe("OpenSERP");
    }
    expect(client.backend).toBe("oss");
    expect(client.lastResponse?.requestId).toBe("req_123");
    expect(client.lastResponse?.cache).toBe("hit");
    expect(client.lastResponse?.fallbackEngine).toBe("bing");
    expect(client.lastResponse?.credits).toBeUndefined();
  });

  test("uses Cloud base URL and bearer auth when apiKey is present", async () => {
    server.use(
      http.get("https://api.openserp.org/v1/google/search", ({ request }) => {
        expect(request.headers.get("authorization")).toBe("Bearer osk_live_test");
        return HttpResponse.json(searchBody, {
          headers: {
            "X-Credits-Used": "1",
            "X-Credits-Remaining": "4249",
            "X-Engine-Used": "google",
          },
        });
      }),
    );

    const client = new OpenSERP({ apiKey: "osk_live_test" });
    await client.search({ engine: "google", text: "openserp" });

    expect(client.baseUrl).toBe("https://api.openserp.org/v1");
    expect(client.backend).toBe("cloud");
    expect(client.lastResponse?.credits).toEqual({ used: 1, remaining: 4249 });
    expect(client.lastResponse?.engineUsed).toBe("google");
  });

  test("keeps explicit baseUrl and still sends apiKey", async () => {
    server.use(
      http.get("http://localhost:7000/google/search", ({ request }) => {
        expect(request.headers.get("authorization")).toBe("Bearer local_key");
        return HttpResponse.json(searchBody);
      }),
    );

    const client = new OpenSERP({
      apiKey: "local_key",
      baseUrl: "http://localhost:7000/",
    });

    await client.search({ engine: "google", text: "openserp" });
    expect(client.baseUrl).toBe("http://localhost:7000");
    expect(client.backend).toBe("cloud");
  });

  test("supports mega convenience helpers", async () => {
    server.use(
      http.get("http://localhost:7000/mega/search", ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get("mode")).toBe("fast");
        expect(url.searchParams.get("engines")).toBe("google,bing");
        return HttpResponse.json({ ...searchBody, clusters: [] });
      }),
    );

    const client = new OpenSERP();
    await client.fastSearch({ text: "openserp", engines: ["google", "bing"] });
  });

  test("supports embedded extraction on search", async () => {
    server.use(
      http.get("http://localhost:7000/google/search", ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get("extract")).toBe("2");
        expect(url.searchParams.get("extract_mode")).toBe("fast");
        expect(url.searchParams.get("min_runes")).toBe("500");
        return HttpResponse.json({
          ...searchBody,
          results: [
            {
              ...searchBody.results[0],
              extracted: {
                format: "markdown",
                content: "# OpenSERP",
                title: "OpenSERP",
                mode_used: "llms_txt",
                fetched_at: "2026-06-01T00:00:00Z",
              },
            },
          ],
        });
      }),
    );

    const client = new OpenSERP();
    const response = await client.search({
      engine: "google",
      text: "openserp",
      extract: 2,
      extractMode: "fast",
      minRunes: 500,
    });

    expect(typeof response).not.toBe("string");
    if (typeof response !== "string") {
      expect(response.results[0]?.extracted?.mode_used).toBe("llms_txt");
      expect(response.results[0]?.extracted?.content).toBe("# OpenSERP");
    }
  });

  test("extracts one URL and forwards all extraction flags", async () => {
    server.use(
      http.get("https://api.openserp.org/v1/extract", ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get("url")).toBe("https://openserp.org");
        expect(url.searchParams.get("mode")).toBe("fast");
        expect(url.searchParams.get("min_runes")).toBe("800");
        expect(url.searchParams.get("clean")).toBe("false");
        expect(url.searchParams.get("use_llms_txt")).toBe("true");
        expect(url.searchParams.get("lang")).toBe("en");
        expect(url.searchParams.has("proxyUrl")).toBe(false);
        expect(request.headers.get("x-proxy-url")).toBe("http://proxy.example:8080");

        return HttpResponse.json(extractBody, {
          headers: {
            "X-Credits-Used": "1",
            "X-Credits-Remaining": "99",
          },
        });
      }),
    );

    const client = new OpenSERP({ apiKey: "osk_live_test" });
    const response = await client.extract({
      url: "https://openserp.org",
      mode: "fast",
      minRunes: 800,
      clean: false,
      useLlmsTxt: true,
      lang: "en",
      proxyUrl: "http://proxy.example:8080",
    });

    expect(typeof response).not.toBe("string");
    if (typeof response !== "string") {
      expect(response.meta?.mode_used).toBe("llms_txt");
      expect(response.headings?.[0]?.text).toBe("OpenSERP");
      expect(response.links?.[0]?.url).toBe("https://openserp.org/docs");
    }
    expect(client.lastResponse?.credits).toEqual({ used: 1, remaining: 99 });
  });

  test("extract returns text for non-json formats", async () => {
    server.use(
      http.get("http://localhost:7000/extract", ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get("format")).toBe("markdown");
        return new HttpResponse("# OpenSERP", {
          headers: { "Content-Type": "text/markdown" },
        });
      }),
    );

    const client = new OpenSERP();
    await expect(
      client.extract({ url: "https://openserp.org", format: "markdown" }),
    ).resolves.toBe("# OpenSERP");
  });

  test("batch extracts several URLs and forwards region on cloud", async () => {
    server.use(
      http.post("https://api.openserp.org/v1/extract/batch", async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        expect(body.urls).toEqual(["https://a.example", "https://b.example"]);
        expect(body.mode).toBe("rendered");
        expect(body.region).toBe("DE");
        expect(body.min_runes).toBe(400);
        expect(body.use_llms_txt).toBe(true);

        return HttpResponse.json({
          billing: { credits_used: 8, credits_remaining: 92 },
          results: [
            {
              url: "https://a.example",
              page_content: "First page body",
              metadata: { source: "https://a.example", mode_used: "rendered" },
            },
            {
              url: "https://b.example",
              page_content: "",
              error: "fetch failed",
              metadata: { source: "https://b.example", error: "fetch failed" },
            },
          ],
          meta: { requested: 2, succeeded: 1, failed: 1 },
        });
      }),
    );

    const client = new OpenSERP({ apiKey: "osk_live_test" });
    const response = await client.batchExtract({
      urls: ["https://a.example", "https://b.example"],
      mode: "rendered",
      region: "DE",
      minRunes: 400,
      useLlmsTxt: true,
    });

    expect(response.meta).toEqual({ requested: 2, succeeded: 1, failed: 1 });
    expect(response.billing?.credits_used).toBe(8);
    expect(response.results?.[1]?.error).toBe("fetch failed");
  });

  // OSS answers with a bare array (its Open WebUI loader contract). The SDK
  // must present the same shape from both backends.
  test("normalizes the OSS bare-array batch response", async () => {
    server.use(
      http.post("http://localhost:7000/extract/batch", () =>
        HttpResponse.json([
          {
            page_content: "First page body",
            metadata: { source: "https://a.example", mode_used: "fast" },
          },
          {
            page_content: "",
            metadata: { source: "https://b.example", error: "timeout" },
          },
        ]),
      ),
    );

    const client = new OpenSERP();
    const response = await client.batchExtract({
      urls: ["https://a.example", "https://b.example"],
    });

    expect(response.results?.[0]?.url).toBe("https://a.example");
    expect(response.results?.[0]?.error).toBeUndefined();
    expect(response.results?.[1]?.url).toBe("https://b.example");
    expect(response.results?.[1]?.error).toBe("timeout");
    expect(response.meta).toEqual({ requested: 2, succeeded: 1, failed: 1 });
  });

  test("sends OSS proxy controls as headers", async () => {
    server.use(
      http.get("http://localhost:7000/bing/search", ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.has("proxyUrl")).toBe(false);
        expect(request.headers.get("x-use-proxy")).toBe("us");
        expect(request.headers.get("x-proxy-url")).toBe("http://proxy.example:8080");
        expect(request.headers.get("x-proxy-session-id")).toBe("sid-123");
        expect(request.headers.get("x-tenant")).toBe("tenant-a");
        return HttpResponse.json(searchBody);
      }),
    );

    const client = new OpenSERP();
    await client.search({
      engine: "bing",
      text: "openserp",
      useProxy: "us",
      proxyUrl: "http://proxy.example:8080",
      proxySessionId: "sid-123",
      tenant: "tenant-a",
    });
  });

  test("posts parser HTML to OSS-only parse endpoints", async () => {
    server.use(
      http.post("http://localhost:7000/google/parse", async ({ request }) => {
        expect(request.headers.get("content-type")).toContain("text/html");
        expect(await request.text()).toBe("<html></html>");
        return HttpResponse.json(searchBody);
      }),
    );

    const client = new OpenSERP({ baseUrl: "http://localhost:7000" });
    await client.parseGoogle({ html: "<html></html>" });
  });

  test("gates endpoint availability with typed errors", async () => {
    const cloud = new OpenSERP({ apiKey: "osk_live_test" });
    const oss = new OpenSERP();

    expect(() => cloud.stats()).toThrow(OssOnlyError);
    expect(() => oss.me()).toThrow(CloudOnlyError);

    server.use(
      http.get("http://localhost:7000/stats", () =>
        HttpResponse.json({
          cache: { status: false },
          proxy: {
            configured_count: 0,
            healthy_count: 0,
            unhealthy_count: 0,
            request_proxy_url_enabled: false,
            lanes: { active: 0, evicted_lru: 0, cookies_dropped: 0 },
            browser_processes: { active: 0, max: 0, evicted_lru: 0, evicted_idle: 0 },
            tags: {},
            entries: [],
          },
          circuit_breakers: [],
        }),
      ),
    );

    const authenticatedOss = new OpenSERP({
      apiKey: "local_key",
      baseUrl: "http://localhost:7000",
      backend: "oss",
    });
    await expect(authenticatedOss.stats()).resolves.toMatchObject({
      cache: { status: false },
    });
  });

  test("maps rate limit and captcha errors", async () => {
    server.use(
      http.get("http://localhost:7000/google/search", () =>
        HttpResponse.json(
          {
            error: "rate_limited",
            code: 429,
            message: "search engine rate limited the request",
          },
          { status: 429 },
        ),
      ),
    );

    const client = new OpenSERP();
    const request = client.search({ engine: "google", text: "openserp" });
    await expect(request).rejects.toBeInstanceOf(RateLimitError);
    await expect(request).rejects.toThrow("https://github.com/openserpapi/sdk-js/issues");

    server.use(
      http.get("http://localhost:7000/google/search", () =>
        HttpResponse.json(
          {
            error: "captcha_detected",
            code: 503,
            message: "captcha challenge detected",
          },
          { status: 503 },
        ),
      ),
    );

    await expect(client.search({ engine: "google", text: "openserp" })).rejects.toBeInstanceOf(CaptchaError);
  });

  test("uses retry hook without applying a built-in retry policy", async () => {
    let calls = 0;
    server.use(
      http.get("http://localhost:7000/google/search", () => {
        calls += 1;
        if (calls === 1) {
          return HttpResponse.json({ error: "server_error", code: 500 }, { status: 500 });
        }
        return HttpResponse.json(searchBody);
      }),
    );

    const client = new OpenSERP({
      retry: (_err, attempt) => attempt === 0,
    });

    await client.search({ engine: "google", text: "openserp" });
    expect(calls).toBe(2);
  });
});
