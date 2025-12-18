import { useState, useEffect, useCallback } from "react";
import {
  fetchDashboardSummary,
  type DashboardData,
} from "../api/dashboard.api";

export function useDashboardData(
  propertyId: string | number | null,
  city: string | undefined
) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    // If essential params are missing, wait for them to populate (keep loading)
    if (!propertyId || !city) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Ensure propertyId is treated as a number for the API if needed,
      // though fetch handles query params as strings anyway.
      const id = Number(propertyId);
      const result = await fetchDashboardSummary(id, city);
      setData(result);
    } catch (err: any) {
      console.error("Error loading dashboard data:", err);
      setError(err.message || "Failed to load dashboard data");
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [propertyId, city]);

  // Initial fetch when props change
  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    data,
    isLoading,
    error,
    refresh: loadData, // Expose refresh for manual updates
  };
}
