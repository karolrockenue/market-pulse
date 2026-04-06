import { useState, useEffect, useCallback } from "react";
import type { DistributionGridData, GridStatus, GridCell } from "../api/types";
import * as api from "../api/distribution.api";

export function useDistributionGrid() {
  const [data, setData] = useState<DistributionGridData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const grid = await api.fetchGrid();
      setData(grid);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateCellStatus = useCallback(async (
    hotelId: number,
    channelId: number,
    status: GridStatus,
    suspensionReason?: string,
    suspendedBy?: string,
  ) => {
    // Optimistic update
    setData(prev => {
      if (!prev) return prev;
      const newGrid = { ...prev.grid };
      if (!newGrid[hotelId]) newGrid[hotelId] = {};
      newGrid[hotelId] = {
        ...newGrid[hotelId],
        [channelId]: {
          status,
          suspension_reason: status === "suspended" ? (suspensionReason || null) : null,
          suspended_by: status === "suspended" ? (suspendedBy || null) : null,
          suspended_at: status === "suspended" ? new Date().toISOString() : null,
        },
      };
      return { ...prev, grid: newGrid };
    });

    try {
      await api.updateGridCell({
        hotel_id: hotelId,
        channel_id: channelId,
        status,
        suspension_reason: suspensionReason,
        suspended_by: suspendedBy,
      });
    } catch (err) {
      await load();
      throw err;
    }
  }, [load]);

  return {
    hotels: data?.hotels || [],
    channels: data?.channels || [],
    grid: data?.grid || {},
    loading,
    error,
    updateCellStatus,
    refresh: load,
  };
}
