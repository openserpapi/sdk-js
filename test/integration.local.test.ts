import { describe, expect, test } from "vitest";
import { OpenSERP, type Engine } from "../src";

describe("local OSS smoke test", () => {
  test.runIf(process.env.OPENSERP_LOCAL_SMOKE === "1")("returns parsed results when an OSS server is already running", async () => {
    const client = new OpenSERP({
      baseUrl: process.env.OPENSERP_BASE_URL ?? "http://localhost:7000",
      timeoutMs: 45_000,
    });

    const response = await client.search({
      engine: (process.env.OPENSERP_SMOKE_ENGINE ?? "bing") as Engine,
      text: "openserp",
      limit: 3,
    });

    expect(typeof response).not.toBe("string");
    if (typeof response !== "string") {
      expect(Array.isArray(response.results)).toBe(true);
    }
  }, 60_000);
});
