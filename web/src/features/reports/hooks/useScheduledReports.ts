// web/src/features/reports/hooks/useScheduledReports.ts

import { useState, useCallback } from 'react';
import { fetchSchedules, createSchedule, deleteSchedule } from '../api/reports.api';
import { Schedule, CreateSchedulePayload } from '../api/types';

interface UseScheduledReportsReturn {
  schedules: Schedule[];
  loading: boolean;
  error: string | null;
  loadSchedules: (hotelId: string) => Promise<void>;
  addSchedule: (payload: CreateSchedulePayload) => Promise<void>;
  removeSchedule: (scheduleId: string, hotelId: string) => Promise<void>;
}

export const useScheduledReports = (): UseScheduledReportsReturn => {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadSchedules = useCallback(async (hotelId: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSchedules(hotelId);
      setSchedules(data);
    } catch (err: any) {
      console.error('Failed to load schedules:', err);
      setError('Could not load active schedules.');
    } finally {
      setLoading(false);
    }
  }, []);

  const addSchedule = useCallback(async (payload: CreateSchedulePayload) => {
    setLoading(true);
    setError(null);
    try {
      await createSchedule(payload);
      // Refresh list after adding
      await loadSchedules(payload.hotelId);
    } catch (err: any) {
      console.error('Failed to create schedule:', err);
      setError(err.response?.data?.message || 'Failed to create schedule.');
      throw err; // Re-throw so UI can close modal on success
    } finally {
      setLoading(false);
    }
  }, [loadSchedules]);

  const removeSchedule = useCallback(async (scheduleId: string, hotelId: string) => {
    setLoading(true);
    setError(null);
    try {
      await deleteSchedule(scheduleId);
      // Refresh list after deleting
      await loadSchedules(hotelId);
    } catch (err: any) {
      console.error('Failed to delete schedule:', err);
      setError('Failed to delete schedule.');
    } finally {
      setLoading(false);
    }
  }, [loadSchedules]);

  return {
    schedules,
    loading,
    error,
    loadSchedules,
    addSchedule,
    removeSchedule
  };
};