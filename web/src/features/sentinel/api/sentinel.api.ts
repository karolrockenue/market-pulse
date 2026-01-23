import {
  SentinelConfig,
  RateCalendarDay,
  RateOverride,
  AssetConfig,
  ShadowfaxProperty,
  ShadowfaxScrapeResult,
} from "./types";

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

export const syncFacts = async (
  hotelId: number | string,
  pmsPropertyId: string
) => {
  const res = await fetch("/api/sentinel/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hotelId, pmsPropertyId }),
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

export const submitOverrides = async (
  hotelId: string | number,
  pmsPropertyId: string,
  roomTypeId: string,
  overrides: RateOverride[]
) => {
  const res = await fetch("/api/sentinel/overrides", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      hotelId,
      pmsPropertyId,
      roomTypeId,
      overrides,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Failed to submit overrides");
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

// --- SHADOWFAX (MARKET INTEL) ---

export const getShadowfaxProperties = async (): Promise<
  ShadowfaxProperty[]
> => {
  const res = await fetch("/api/market/shadowfax/properties");
  if (!res.ok) throw new Error("Failed to fetch Shadowfax properties");
  return await res.json();
};

export const runShadowfaxScrape = async (
  hotelId: string,
  checkinDate: string
): Promise<ShadowfaxScrapeResult> => {
  const res = await fetch("/api/market/shadowfax/price", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hotelId, checkinDate }),
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Scrape failed");

  // Normalize response shape
  if (json.price && typeof json.price === "object" && json.price.price) {
    return json.price;
  }
  return { price: json.price, roomName: json.roomName };
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
