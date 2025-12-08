import { useState } from 'react';
import { toast } from 'sonner';
import { adminApi } from '../api/admin.api';

export function useHotelSync() {
  const [syncingHotelId, setSyncingHotelId] = useState<number | null>(null);
  const [fullSyncingHotelId, setFullSyncingHotelId] = useState<number | null>(null);

  const handleSyncInfo = async (hotelId: number) => {
    setSyncingHotelId(hotelId);
    const toastId = toast.loading('Starting hotel info sync...');

    try {
      await adminApi.syncHotelInfo(hotelId);
      toast.success('Hotel info sync complete.', { id: toastId });
    } catch (error: any) {
      toast.error(`Sync failed: ${error.message}`, { id: toastId });
    } finally {
      setSyncingHotelId(null);
    }
  };

  const handleFullSync = async (hotelId: number) => {
    if (!window.confirm(`Are you sure you want to run a full 5-year sync? This will re-import all data.`)) {
      return;
    }

    setFullSyncingHotelId(hotelId);
    const toastId = toast.loading('Starting 5-year full data sync... This may take several minutes.');

    try {
      await adminApi.initialSync(hotelId);
      toast.success('Full 5-year sync complete.', { id: toastId, duration: 5000 });
    } catch (error: any) {
      toast.error(`Full sync failed: ${error.message}`, { id: toastId, duration: 5000 });
    } finally {
      setFullSyncingHotelId(null);
    }
  };

  // Logic for Category Change (from HotelManagementTable)
  const handleCategoryChange = async (hotelId: number, newCategory: string) => {
    const toastId = toast.loading('Updating category...');
    try {
      await adminApi.updateHotelCategory(hotelId, newCategory);
      toast.success('Category updated successfully.', { id: toastId });
    } catch (error: any) {
      toast.error(`Error: ${error.message}`, { id: toastId });
    }
  };

  return {
    syncingHotelId,
    fullSyncingHotelId,
    handleSyncInfo,
    handleFullSync,
    handleCategoryChange
  };
}