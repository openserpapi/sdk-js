import { expect, test } from "vitest";
import { OpenSERP } from "../src";

test.each([
  { config: { apiKey: "osk_live_test" }, expected: "https://api.openserp.org/v1/context" },
  { config: { baseUrl: "http://localhost:7000" }, expected: "http://localhost:7000/context" },
])("context posts JSON on Cloud and OSS and exposes billing ($expected)", async ({ config, expected }) => {
  const result = { context: "[c1] Evidence", partial: true, billing: { credits_used: 4, credits_remaining: 96 } };
  const client = new OpenSERP({ ...config, fetch: async (url, init) => {
    expect(String(url)).toBe(expected);
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ query: "replication", queries: ["DDL"], engines: ["google"], extract_mode: "fast", max_sources: 2, max_fetches: 3, max_tokens: 500 });
    const headers = new Headers(init?.headers);
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("X-Admin-Secret")).toBeNull();
    if ("apiKey" in config) expect(headers.get("Authorization")).toBe("Bearer osk_live_test");
    return Response.json(result, { headers: { "X-Credits-Used": "4", "X-Credits-Remaining": "96" } });
  } });
  expect(await client.context({ query: "replication", queries: ["DDL"], engines: ["google"], extractMode: "fast", maxSources: 2, maxFetches: 3, maxTokens: 500 })).toEqual(result);
  expect(client.lastResponse?.credits?.used).toBe(4);
});

test("context preserves preview-denied errors and never retries a paid call", async () => {
  let calls = 0;
  const client = new OpenSERP({ apiKey: "osk_live_test", retry: () => true, fetch: async () => {
    calls++;
    return Response.json({ error: "not_found", code: 404, message: "Not found." }, { status: 404 });
  } });
  await expect(client.context({ query: "test" })).rejects.toMatchObject({ status: 404, code: "not_found" });
  expect(calls).toBe(1);
});
