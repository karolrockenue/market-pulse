// Facts from PMS (Read-Only)
export interface PMSRoomType {
  roomTypeID: string;
  roomTypeName: string;
}

export interface PMSRatePlan {
  rateID: string;
  ratePlanName: string;
  isDerived: boolean;
  roomTypeID: string;
}

// Configuration Rules (Read/Write)
export interface SentinelConfig {
  hotel_id: number;
  sentinel_enabled: boolean;
  is_autopilot_enabled?: boolean; // [FIX] Added missing field
  guardrail_max: string;
  rate_freeze_period: string;
  base_room_type_id: string;

  last_minute_floor: {
    enabled: boolean;
    rate: string;
    days: string;
    dow: string[];
  };

  room_differentials: Array<{
    roomTypeId: string;
    operator: "+" | "-";
    value: string;
  }>;

  monthly_min_rates: Record<string, string>;
  monthly_aggression: Record<string, string>;

  // [FIX] Added missing fields used in ControlPanelView
  daily_max_rates?: Record<string, string>;
  seasonality_profile?: Record<string, string>;

  // [NEW] Flexible Rules Engine
  rules?: {
    strategy_mode?: "maintain" | "sell_every_room";
  };

  // Stored Facts for UI rendering
  pms_room_types?: { data: PMSRoomType[] };
  pms_rate_plans?: { data: PMSRatePlan[] };
}

// Rate Calendar (Merged DB + Live)
export interface RateCalendarDay {
  date: string; // YYYY-MM-DD
  rate: number;
  source: "AI" | "Manual" | "External";
  liveRate: number;

  // Visuals
  dayOfWeek: string;
  dayNumber: number;
  month: string;
  isFrozen: boolean;

  // Metrics
  occupancy: number;
  adr: number;
  guardrailMin: number;
  monthlyMinDefault: number;
  isDailyMinOverride: boolean;
  floorRateLMF: number | null;
  pickup?: number; // [NEW] Daily pickup (Live - Yesterday)
}

// Overrides
export interface RateOverride {
  date: string; // YYYY-MM-DD
  rate: number;
}

// Property Hub Assets
export interface AssetConfig {
  id: string;
  asset_name: string;
  market_pulse_hotel_id: string | null;
  sentinel_active: boolean;
  booking_com_url: string | null;
  genius_discount_pct: number | null;
  strategic_multiplier?: string | number;
  calculator_settings?: any; // JSONB
}

// ── Sentinel Health (Phase A backend; consumed by admin-only L1 pill + L2 page) ──
export type HealthStatus = "green" | "amber" | "red" | "off";

export interface HotelHealth {
  hotel_id: number;
  property_name: string;
  is_disconnected: boolean;
  is_rockenue_managed: boolean;
  autopilot: boolean;
  last_success_at: string | null;
  last_success_rates_count: number | null;
  last_failure_at: string | null;
  last_failure_error: string | null;
  consecutive_failures: number;
  status: HealthStatus;
}

export interface FleetHealthSummary {
  green: number;
  amber: number;
  red: number;
  off: number;
  worst_status: HealthStatus;
}

export interface FleetHealthRow {
  hotel_id: number;
  property_name: string;
  pms_type: string | null;
  is_disconnected: boolean;
  autopilot: boolean;
  last_success_at: string | null;
  last_success_rates_count: number | null;
  last_failure_at: string | null;
  last_failure_error: string | null;
  last_failure_job_id: string | null;
  consecutive_failures: number;
  status: HealthStatus;
  failures_7d: number;
}

export type SparklineCell = "green" | "amber" | "red" | "none";

// { [hotel_id]: { [YYYY-MM-DD]: "green" | "amber" | "red" } }
export type SparklineMap = Record<string, Record<string, SparklineCell>>;

export interface FailureCluster {
  signature: string;
  count: number;
  hotel_count: number;
  hotels: string[];
  latest_at: string;
  sample_error: string;
  job_ids: string[];
}

export interface FleetHealthResponse {
  fleet: FleetHealthRow[];
  sparklines: SparklineMap;
  clusters: FailureCluster[];
}

