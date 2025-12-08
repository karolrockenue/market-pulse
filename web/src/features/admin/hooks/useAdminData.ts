import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { sentinelToast } from '../../../components/ui/sentinel-toast';
import { adminApi } from '../api/admin.api';
import { Hotel, ScheduledReport, SystemStatus } from '../api/types';

export function useAdminData() {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [managementGroups, setManagementGroups] = useState<string[]>([]);
  const [scheduledReports, setScheduledReports] = useState<ScheduledReport[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAllData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [hotelsData, groupsData, reportsData, statusData] = await Promise.all([
        adminApi.getHotels(),
        adminApi.getManagementGroups(),
        adminApi.getScheduledReports(),
        adminApi.getSystemStatus(),
      ]);

      setHotels(hotelsData);
      setManagementGroups(groupsData);
      setScheduledReports(reportsData);
      setSystemStatus(statusData);
    } catch (error) {
      console.error("Error fetching admin data:", error);
      toast.error("Failed to load admin dashboard data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial Fetch
  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Handler: Update Management Info (Optimistic Update)
  const handleManagementChange = async (
    hotelId: number, 
    field: 'is_rockenue_managed' | 'management_group', 
    value: string | boolean | null
  ) => {
    const toastId = sentinelToast.loading('Updating management info...');

    try {
      await adminApi.updateManagementInfo(hotelId, field, value);

      sentinelToast.success('Management info updated.');
      toast.dismiss(toastId);

      // Optimistic Update
      setHotels(currentHotels =>
        currentHotels.map(hotel =>
          hotel.hotel_id === hotelId
            ? { ...hotel, [field]: value }
            : hotel
        )
      );

      // If a new group was added, update the list
      if (
        field === 'management_group' &&
        typeof value === 'string' &&
        value.trim() !== '' &&
        !managementGroups.includes(value)
      ) {
        setManagementGroups(prev => [...prev, value].sort());
      }

    } catch (error: any) {
      toast.dismiss(toastId);
      sentinelToast.error('Update failed', error.message);
    }
  };

  return {
    hotels,
    managementGroups,
    scheduledReports,
    systemStatus,
    isLoading,
    refreshData: fetchAllData,
    handleManagementChange
  };
}