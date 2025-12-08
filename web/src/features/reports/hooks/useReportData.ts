// web/src/features/reports/hooks/useReportData.ts

import { useState, useCallback } from 'react';
import { generateReport } from '../api/reports.api';
import { ReportData, ReportParams } from '../api/types';

interface UseReportDataReturn {
  data: ReportData | null;
  loading: boolean;
  error: string | null;
  runReport: (params: ReportParams) => Promise<void>;
  clearReport: () => void;
}

export const useReportData = (): UseReportDataReturn => {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const runReport = useCallback(async (params: ReportParams) => {
    setLoading(true);
    setError(null);
    setData(null);

    try {
      const result = await generateReport(params);
      setData(result);
    } catch (err: any) {
      console.error('Failed to generate report:', err);
      setError(err.response?.data?.message || 'Failed to generate report. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const clearReport = useCallback(() => {
    setData(null);
    setError(null);
  }, []);

  return {
    data,
    loading,
    error,
    runReport,
    clearReport
  };
};