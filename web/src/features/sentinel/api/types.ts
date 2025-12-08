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

// Shadowfax
export interface ShadowfaxProperty {
  property_id: string;
  property_name: string;
  genius_discount_pct: number;
}

export interface ShadowfaxScrapeResult {
  price?: string;
  roomName?: string;
  error?: string;
}
