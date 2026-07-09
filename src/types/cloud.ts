export interface CreditInfo {
  used?: number | undefined;
  remaining?: number | undefined;
}

export interface CloudAccount {
  id?: string;
  email?: string;
  created_at?: string;
  credits_remaining?: number;
  plan?: string;
  [key: string]: unknown;
}

export interface Price {
  credits?: number;
  price_usd?: number;
}

export interface Pricing {
  credit_price_usd?: number;
  search?: Price;
  extract?: Price;
  mega_search?: Price;
  image_search?: Price;
  any_search?: Price;
  fast_search?: Price;
  any_image?: Price;
  fast_image?: Price;
  [key: string]: unknown;
}

export type EngineStatusValue = "operational" | "loaded" | "down" | "unknown";
export type OverallStatus = "operational" | "degraded" | "down" | "unknown";

export interface EngineStatus {
  status?: EngineStatusValue;
  latency_ms?: number;
}

export type EnginesStatus =
  | { overall: OverallStatus }
  | { engines: Record<string, EngineStatus> };

export interface EngineCapability {
  web?: boolean;
  image?: boolean;
  fallback_web?: boolean;
  fallback_image?: boolean;
}

export interface ModeCapability {
  web?: boolean;
  image?: boolean;
}

export interface EnginesCapabilities {
  engines?: Record<string, EngineCapability>;
  modes?: Record<string, ModeCapability>;
  [key: string]: unknown;
}
