import type { DebugEvent, OpenSERPConfig } from "./types/public";

export type DebugLevel = "off" | "info" | "verbose";

type DebugSink = (event: DebugEvent) => void;

/** Resolved debug configuration: the active level and where events go. */
export interface DebugReporter {
  level: DebugLevel;
  emit(event: DebugEvent): void;
}

const NO_OP: DebugReporter = {
  level: "off",
  emit() {},
};

/**
 * Resolves the effective debug behaviour from config (falling back to the
 * OPENSERP_DEBUG env var). Returns a no-op reporter when debugging is off so
 * callers can emit unconditionally without a hot-path branch of their own.
 */
export function resolveDebug(config: OpenSERPConfig): DebugReporter {
  const setting = config.debug ?? envDebug();

  if (!setting) {
    return NO_OP;
  }

  if (typeof setting === "function") {
    // A custom sink always sees verbose detail; it decides what to keep.
    return { level: "verbose", emit: guard(setting) };
  }

  const level: DebugLevel = setting === "verbose" ? "verbose" : "info";
  return { level, emit: consoleSink };
}

function envDebug(): boolean | "verbose" | undefined {
  // Guarded so the SDK still works in browsers / runtimes without `process`.
  const value =
    typeof process !== "undefined" ? process.env?.OPENSERP_DEBUG : undefined;
  if (!value) {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "verbose") {
    return "verbose";
  }
  if (normalized === "1" || normalized === "true") {
    return true;
  }
  return undefined;
}

/** Wraps a user-provided sink so a thrown logger never breaks a request. */
function guard(sink: DebugSink): DebugSink {
  return (event) => {
    try {
      sink(event);
    } catch {
      // A broken debug logger must not take down the actual request.
    }
  };
}

const consoleSink: DebugSink = (event) => {
  switch (event.type) {
    case "request":
      console.error(`[openserp] → ${event.method} ${event.url}`);
      if (event.headers) {
        console.error("[openserp]   headers:", event.headers);
      }
      break;
    case "response": {
      const engine = event.engineUsed ? ` engine=${event.engineUsed}` : "";
      const reqId = event.requestId ? ` request-id=${event.requestId}` : "";
      console.error(
        `[openserp] ← ${event.status} ${event.method} ${event.url} (${event.durationMs}ms)${engine}${reqId}`,
      );
      if (event.headers) {
        console.error("[openserp]   headers:", event.headers);
      }
      break;
    }
    case "error":
      console.error(
        `[openserp] ✕ ${event.method} ${event.url} (${event.durationMs}ms):`,
        event.error,
      );
      break;
  }
};

/** Snapshots headers into a plain object, redacting Authorization. */
export function dumpHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of headers) {
    out[key] = key.toLowerCase() === "authorization" ? "Bearer ***" : value;
  }
  return out;
}
