// web/src/features/reports/api/reports.api.ts

import axios from 'axios';
import { 
  ReportData, 
  ReportParams, 
  Schedule, 
  CreateSchedulePayload 
} from './types';

const BASE_URL = '/api/metrics';

/**
 * Generates a report by fetching Range + Competitor data and merging them manually.
 * This replicates the exact logic from the original OldReportTable.tsx.
 */
export const generateReport = async (params: ReportParams): Promise<ReportData> => {
  const { 
    hotelId, 
    startDate, 
    endDate, 
    granularity = 'daily', 
    includeTaxes = false, 
    metrics = [] 
  } = params;

  // 1. Determine fetch needs based on selected metrics
  // (If metrics array is empty, we fetch both to be safe, or default to hotel)
  const fetchHotelMetrics = metrics.length === 0 || metrics.some(m => !m.startsWith('market-'));
  const fetchMarketMetrics = metrics.length === 0 || metrics.some(m => m.startsWith('market-'));

  // 2. Define Tax Aliases (Logic from OldReportTable)
  const hotelAdrAlias = includeTaxes ? 'your_gross_adr' : 'your_net_adr';
  const hotelRevparAlias = includeTaxes ? 'your_gross_revpar' : 'your_net_revpar';
  const hotelRevenueAlias = includeTaxes ? 'your_gross_revenue' : 'your_net_revenue';
  
  const marketAdrAlias = includeTaxes ? 'market_gross_adr' : 'market_net_adr';
  const marketRevparAlias = includeTaxes ? 'market_gross_revpar' : 'market_net_revpar';
  const marketRevenueAlias = includeTaxes ? 'market_gross_revenue' : 'market_net_revenue';

  try {
    const requests = [];
    
    // Prepare requests
    if (fetchHotelMetrics) {
      requests.push(
        axios.get(`${BASE_URL}/range`, {
          params: { propertyId: hotelId, startDate, endDate, granularity }
        })
      );
    } else {
      requests.push(Promise.resolve({ data: { metrics: [] } }));
    }

    if (fetchMarketMetrics) {
      requests.push(
        axios.get(`${BASE_URL}/competitors`, {
          params: { propertyId: hotelId, startDate, endDate, granularity }
        })
      );
    } else {
      requests.push(Promise.resolve({ data: { metrics: [] } }));
    }

    // Execute in parallel
    const [hotelRes, marketRes] = await Promise.all(requests);
    
    const yourHotelData = hotelRes.data || { metrics: [] };
    const marketData = marketRes.data || { metrics: [] };

    // 3. Merge Logic (The "Brain" from OldReportTable)
    const dataMap = new Map<string, any>();

    // Process Hotel Data
    if (yourHotelData.metrics) {
      yourHotelData.metrics.forEach((row: any) => {
        const date = (row.period).substring(0, 10);
        if (!dataMap.has(date)) dataMap.set(date, { period: date });
        const entry = dataMap.get(date);
        
        entry['occupancy'] = parseFloat(row.your_occupancy_direct) || 0;
        entry['adr'] = parseFloat(row[hotelAdrAlias]) || 0;
        entry['revpar'] = parseFloat(row[hotelRevparAlias]) || 0;
        entry['total-revenue'] = parseFloat(row[hotelRevenueAlias]) || 0;
        entry['rooms-sold'] = parseInt(row.your_rooms_sold, 10) || 0;
        entry['capacity-count'] = parseInt(row.your_capacity_count, 10) || 0;
        entry['rooms-unsold'] = entry['capacity-count'] - entry['rooms-sold'];
      });
    }

    // Process Market Data
    if (marketData.metrics) {
      marketData.metrics.forEach((row: any) => {
        const date = (row.period).substring(0, 10);
        if (!dataMap.has(date)) dataMap.set(date, { period: date });
        const entry = dataMap.get(date);

        entry['market-occupancy'] = parseFloat(row.market_occupancy) || 0;
        entry['market-adr'] = parseFloat(row[marketAdrAlias]) || 0;
        entry['market-revpar'] = parseFloat(row[marketRevparAlias]) || 0;
        entry['market-total-revenue'] = parseFloat(row[marketRevenueAlias]) || 0;
      });
    }

    // 4. Sort & Flatten
    const mergedData = Array.from(dataMap.values()).sort(
      (a, b) => new Date(a.period).getTime() - new Date(b.period).getTime()
    );

    // Return structure matching ReportData interface
    return {
      title: 'Performance Report',
      headers: [], // Not strictly used by dumb component, can be ignored
      rows: mergedData
    };

  } catch (error: any) {
    console.error("API Error generating report:", error);
    throw error;
  }
};

// --- Existing Schedule Functions (Unchanged) ---

export const fetchSchedules = async (hotelId: string): Promise<Schedule[]> => {
  const response = await axios.get(`${BASE_URL}/reports/scheduled`, {
    params: { hotel_id: hotelId }
  });
  return response.data;
};

export const createSchedule = async (payload: CreateSchedulePayload): Promise<Schedule> => {
  const apiPayload = { ...payload, propertyId: payload.hotelId };
  const response = await axios.post(`${BASE_URL}/reports/scheduled`, apiPayload);
  return response.data;
};

export const deleteSchedule = async (scheduleId: string): Promise<void> => {
  await axios.delete(`${BASE_URL}/reports/scheduled/${scheduleId}`);
};

export const fetchReportTypes = async (): Promise<string[]> => {
  return ['performance-metrics', 'year-on-year', 'performance-vs-budget']; 
};