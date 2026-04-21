import { useEffect, useRef, useState } from "react";
import { getHotelHealth, getFleetHealthSummary } from "../api/sentinel.api";
import type { HotelHealth, FleetHealthSummary } from "../api/types";

const POLL_MS = 60_000;

/**
 * Polls /api/sentinel/health/hotel/:hotelId every 60s for the admin-only
 * hotel header pill. Returns null while loading or on error — the pill
 * renders nothing rather than degrading into a misleading state.
 */
export function useHotelSentinelHealth(hotelId: number | null, enabled: boolean) {
  const [health, setHealth] = useState<HotelHealth | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || hotelId == null) {
      setHealth(null);
      return;
    }
    let cancelled = false;
    const tick = () =>
      getHotelHealth(hotelId)
        .then(h => { if (!cancelled) setHealth(h); })
        .catch(() => { if (!cancelled) setHealth(null); });
    tick();
    timerRef.current = window.setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      if (timerRef.current != null) window.clearInterval(timerRef.current);
    };
  }, [hotelId, enabled]);

  return health;
}

/**
 * Polls /api/sentinel/health/fleet/summary every 60s for the admin-only
 * sidebar Sentinel dot.
 */
export function useFleetSentinelHealth(enabled: boolean) {
  const [summary, setSummary] = useState<FleetHealthSummary | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      setSummary(null);
      return;
    }
    let cancelled = false;
    const tick = () =>
      getFleetHealthSummary()
        .then(s => { if (!cancelled) setSummary(s); })
        .catch(() => { if (!cancelled) setSummary(null); });
    tick();
    timerRef.current = window.setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      if (timerRef.current != null) window.clearInterval(timerRef.current);
    };
  }, [enabled]);

  return summary;
}
