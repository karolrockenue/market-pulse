import {
  SentinelConfig,
  RateCalendarDay,
  RateOverrideRow,
  SaveRateOverrideInput,
  AssetConfig,
  HotelHealth,
  FleetHealthSummary,
  FleetHealthResponse,
  RateHistoryEntry,
} from "./types";

// --- RATE HISTORY (read-only audit trail for one calendar cell) ---
// Display-only; never throws into the grid (returns [] on any failure).
export const getRateHistory = async (
  hotelId: string,
  roomTypeId: string,
  stayDate: string,
  limit = 10
): Promise<RateHistoryEntry[]> => {
  try {
    const res = await fetch(
      `/api/sentinel/rate-history/${hotelId}/${roomTypeId}?stayDate=${stayDate}&limit=${limit}`
    );
    if (!res.ok) return [];
    const json = await res.json();
    return json.data || [];
  } catch {
    return [];
  }
};

// --- CONTROL PANEL (CONFIGURATION) ---

export const getConfigs = async (): Promise<Record<string, SentinelConfig>> => {
  const res = await fetch("/api/sentinel/configs");
  if (!res.ok) throw new Error("Failed to fetch configs");
  const json = await res.json();

  // Convert array to Map { hotel_id: config }
  return (json.data || []).reduce(
    (acc: Record<string, SentinelConfig>, cfg: SentinelConfig) => {
      acc[cfg.hotel_id] = cfg;
      return acc;
    },
    {}
  );
};

export const getPmsPropertyIds = async (): Promise<Record<string, string>> => {
  const res = await fetch("/api/sentinel/pms-property-ids");
  if (!res.ok) throw new Error("Failed to fetch PMS IDs");
  const json = await res.json();
  return json.data || {};
};

export const getConfig = async (
  hotelId: string
): Promise<SentinelConfig | null> => {
  const res = await fetch(`/api/sentinel/config/${hotelId}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Failed to fetch config");
  return json.data;
};

export const saveConfig = async (
  hotelId: string,
  config: Partial<SentinelConfig>
): Promise<SentinelConfig> => {
  const res = await fetch(`/api/sentinel/config/${hotelId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Failed to save config");
  return json.data;
};

export const syncPreview = async (
  hotelId: number | string,
  pmsPropertyId: string
) => {
  const res = await fetch("/api/sentinel/sync-preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hotelId, pmsPropertyId }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Preview failed");
  return json.data;
};

export const syncFacts = async (
  hotelId: number | string,
  pmsPropertyId: string,
  selectedRateId?: string
) => {
  const res = await fetch("/api/sentinel/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hotelId, pmsPropertyId, selectedRateId }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Sync failed");
  return json.data;
};

// [NEW] Max Rates API
export const getDailyMaxRates = async (hotelId: string) => {
  const res = await fetch(`/api/sentinel/max-rates/${hotelId}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Failed to fetch max rates");
  return json.data || {};
};

export const saveDailyMaxRates = async (
  hotelId: string,
  rates: Record<string, string>
) => {
  const res = await fetch(`/api/sentinel/max-rates/${hotelId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rates }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Failed to save max rates");
  return json;
};

// [NEW] Min Rates API (daily floor overrides)
export const getDailyMinRates = async (hotelId: string) => {
  const res = await fetch(`/api/sentinel/min-rates/${hotelId}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Failed to fetch min rates");
  return json.data || {};
};

export const saveDailyMinRates = async (
  hotelId: string,
  rates: Record<string, number | null>
) => {
  const res = await fetch(`/api/sentinel/min-rates/${hotelId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rates }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Failed to save min rates");
  return json;
};

// --- RATE MANAGER (PRICING) ---

export const getRateCalendar = async (
  hotelId: string,
  roomTypeId: string
): Promise<RateCalendarDay[]> => {
  const res = await fetch(`/api/sentinel/rates/${hotelId}/${roomTypeId}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Failed to fetch rates");
  return json.data || [];
};

export const getPreviewRates = async (
  hotelId: string,
  baseRoomTypeId: string,
  startDate: string,
  days: number = 365
): Promise<RateCalendarDay[]> => {
  const res = await fetch("/api/sentinel/preview-rate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hotelId, baseRoomTypeId, startDate, days }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Failed to fetch preview rates");
  return json.data || [];
};

// --- PMS Override endpoints (single canonical save path) -------------------

export const getRateOverrides = async (
  hotelId: string | number,
  start?: string,
  end?: string
): Promise<RateOverrideRow[]> => {
  const qs = new URLSearchParams();
  if (start) qs.set("start", start);
  if (end) qs.set("end", end);
  const res = await fetch(
    `/api/sentinel/rate-overrides/${hotelId}${qs.toString() ? `?${qs}` : ""}`
  );
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Failed to fetch rate overrides");
  return json.overrides || [];
};

export const saveRateOverrides = async (
  hotelId: string | number,
  overrides: SaveRateOverrideInput[]
): Promise<{ saved: number; queued: number; rejected: any[] }> => {
  const res = await fetch(`/api/sentinel/rate-overrides/${hotelId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ overrides }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Failed to save overrides");
  return json;
};

export const deleteRateOverrides = async (
  hotelId: string | number,
  dates: string[]
): Promise<{ deleted: number }> => {
  const res = await fetch(`/api/sentinel/rate-overrides/${hotelId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dates }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Failed to delete overrides");
  return json;
};

// Accept AI predictions without pinning — releases any existing override rows
// for these dates and triggers a recalc + PMS push at the engine's current
// view. Use this when the user's intent is "let AI manage these dates", not
// "freeze this price". See sentinel.router.js /apply-ai-rates handler.
export const applyAiRates = async (
  hotelId: string | number,
  dates: string[]
): Promise<{
  released: number;
  predictionsMarked: number;
  totalQueued: number;
  debounced?: boolean;
  lastRunSecondsAgo?: number;
}> => {
  const res = await fetch(`/api/sentinel/apply-ai-rates/${hotelId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dates }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || json.error || "Failed to apply AI rates");
  return json;
};

export const getDailyPickup = async (
  hotelId: string,
  startDate: string,
  endDate: string,
  days: number = 1
): Promise<{ date: string; pickup: number }[]> => {
  const params = new URLSearchParams({
    propertyId: hotelId,
    startDate,
    endDate,
    days: days.toString(),
  });
  const res = await fetch(`/api/metrics/pickup?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch pickup data");
  return await res.json();
};

// --- PROPERTY HUB (ASSETS) ---

export const getAssets = async (): Promise<AssetConfig[]> => {
  const res = await fetch("/api/hotels/assets");
  if (!res.ok) throw new Error("Failed to fetch assets");
  return await res.json();
};

export const updateAsset = async (
  assetId: string,
  data: Partial<AssetConfig>
) => {
  const res = await fetch(`/api/hotels/assets/${assetId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update asset");
  return await res.json();
};

// --- NOTIFICATIONS ---

export const getNotifications = async () => {
  const res = await fetch("/api/sentinel/notifications");
  const json = await res.json();
  return json.data || [];
};

export const markNotificationsRead = async (ids?: string[]) => {
  await fetch("/api/sentinel/notifications/mark-read", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
};

export const deleteNotification = async (id: string) => {
  await fetch(`/api/sentinel/notifications/${id}`, { method: "DELETE" });
};

export const getAiPredictions = async (
  hotelId: string
): Promise<
  {
    room_type_id: number;
    stay_date: string;
    suggested_rate: string | number;
    confidence_score: number;
  }[]
> => {
  const res = await fetch(`/api/sentinel/predictions/${hotelId}`);
  const json = await res.json();
  if (!res.ok) throw new Error("Failed to fetch AI predictions");
  return json.data || [];
};

export const getSentinelStatus = async (hotelId: string) => {
  const res = await fetch(`/api/sentinel/status/${hotelId}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Failed to fetch status");
  return json.data;
};

export const triggerSentinelRun = async (
  hotelId: string,
  startDate?: string,
  endDate?: string,
  mode: "PREDICTION" | "LIVE" = "PREDICTION"
) => {
  // We use the new DGX Proxy endpoint
  const res = await fetch("/api/sentinel/trigger-dgx", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hotelId, startDate, endDate, mode }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Failed to trigger Sentinel AI");
  return json;
};

// --- SENTINEL HEALTH (admin-only) ---

export const getHotelHealth = async (hotelId: number | string): Promise<HotelHealth> => {
  const res = await fetch(`/api/sentinel/health/hotel/${hotelId}`);
  if (!res.ok) throw new Error(`Failed to fetch hotel health (${res.status})`);
  return res.json();
};

export const getFleetHealthSummary = async (): Promise<FleetHealthSummary> => {
  const res = await fetch("/api/sentinel/health/fleet/summary");
  if (!res.ok) throw new Error(`Failed to fetch fleet health (${res.status})`);
  return res.json();
};

export const getFleetHealth = async (): Promise<FleetHealthResponse> => {
  const res = await fetch("/api/sentinel/health/fleet");
  if (!res.ok) throw new Error(`Failed to fetch fleet health (${res.status})`);
  return res.json();
};
