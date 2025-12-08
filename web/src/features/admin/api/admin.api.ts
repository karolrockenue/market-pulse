import { Hotel, ScheduledReport, SystemStatus, SyncResponse } from './types';

export const adminApi = {
  // Fetch all hotels (Admin Dashboard)
  getHotels: async (): Promise<Hotel[]> => {
    const res = await fetch('/api/hotels');
    if (!res.ok) throw new Error('Failed to fetch hotels');
    return res.json();
  },

  // Fetch unique management groups
  getManagementGroups: async (): Promise<string[]> => {
    const res = await fetch('/api/hotels/management-groups');
    if (!res.ok) throw new Error('Failed to fetch management groups');
    return res.json();
  },

  // Fetch system health status (last refresh time)
  getSystemStatus: async (): Promise<SystemStatus> => {
    const res = await fetch('/api/metrics/metadata/last-refresh');
    if (!res.ok) throw new Error('Failed to fetch system status');
    return res.json();
  },

  // Fetch all scheduled reports (Admin view)
  getScheduledReports: async (): Promise<ScheduledReport[]> => {
    const res = await fetch('/api/metrics/reports/scheduled');
    if (!res.ok) throw new Error('Failed to fetch scheduled reports');
    return res.json();
  },

  // Update Hotel Category
  updateHotelCategory: async (hotelId: number, category: string): Promise<SyncResponse> => {
    const res = await fetch('/api/admin/update-hotel-category', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hotelId, category }),
    });
    return res.json();
  },

  // Update Management Info (Rockenue Managed / Group)
  updateManagementInfo: async (
    hotelId: number, 
    field: 'is_rockenue_managed' | 'management_group', 
    value: string | boolean | null
  ): Promise<SyncResponse> => {
    const res = await fetch('/api/hotels/management', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hotelId, field, value }),
    });
    return res.json();
  },

  // Sync Hotel Info (Light Sync - Name, Rooms, etc.)
  syncHotelInfo: async (propertyId: number): Promise<SyncResponse> => {
    const res = await fetch('/api/admin/sync-hotel-info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ propertyId }),
    });
    return res.json();
  },

  // Initial Sync (Heavy 5-year Sync)
  initialSync: async (propertyId: number): Promise<SyncResponse> => {
    const res = await fetch('/api/admin/initial-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ propertyId }),
    });
    return res.json();
  }
};