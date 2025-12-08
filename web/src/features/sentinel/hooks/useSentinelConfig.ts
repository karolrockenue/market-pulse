import { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import { 
  getConfigs, 
  getPmsPropertyIds, 
  getConfig, 
  saveConfig, 
  syncFacts 
} from '../api/sentinel.api';
import { SentinelConfig } from '../api/types';

// Default "Rules" for a new hotel config (Copied from SentinelControlPanel.tsx)
const DEFAULT_RULES: Partial<SentinelConfig> = {
  sentinel_enabled: false,
  guardrail_max: '400',
  rate_freeze_period: '2',
  base_room_type_id: '',
  last_minute_floor: {
    enabled: false,
    rate: '90',
    days: '7',
    dow: ['sun', 'mon']
  },
  room_differentials: [],
  monthly_min_rates: {
    jan: '100', feb: '100', mar: '100', apr: '100',
    may: '100', jun: '100', jul: '100', aug: '100',
    sep: '100', oct: '100', nov: '100', dec: '100',
  },
  monthly_aggression: {
    jan: 'medium', feb: 'medium', mar: 'medium', apr: 'medium',
    may: 'medium', jun: 'medium', jul: 'medium', aug: 'medium',
    sep: 'medium', oct: 'medium', nov: 'medium', dec: 'medium',
  },
  pms_room_types: { data: [] }
};

export const useSentinelConfig = (allHotels: any[]) => {
  // --- Data Stores ---
  const [serverConfigs, setServerConfigs] = useState<Record<string, SentinelConfig>>({});
  const [pmsIdMap, setPmsIdMap] = useState<Record<string, string>>({});
  
  // --- Form State (The "Rules" being edited) ---
  const [formState, setFormState] = useState<Record<string, Partial<SentinelConfig>>>({});

  // --- UI State ---
  const [isLoading, setIsLoading] = useState(true);
  const [loadingHotelId, setLoadingHotelId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState<string | null>(null);

  // 1. Fetch Initial Data (Configs + PMS IDs)
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      try {
        const [configs, ids] = await Promise.all([getConfigs(), getPmsPropertyIds()]);
        setServerConfigs(configs);
        setPmsIdMap(ids);
      } catch (error) {
        console.error('Failed to load Sentinel data:', error);
        toast.error('Failed to load configuration data.');
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  // 2. Computed Lists (Active vs Available)
  const { availableHotels, activeHotels } = useMemo(() => {
    const available = [];
    const active = [];

    if (!allHotels) return { availableHotels: [], activeHotels: [] };

    // Filter for Rockenue Managed
    const managedHotels = allHotels.filter(h => h.is_rockenue_managed);

    for (const hotel of managedHotels) {
      // Merge ID map
      const merged = {
        ...hotel,
        pms_property_id: pmsIdMap[hotel.hotel_id] ?? hotel.pms_property_id,
      };

      const configSummary = serverConfigs[merged.hotel_id];
      const formRules = formState[merged.hotel_id];

      // Check if Synced (Must have room types)
      const isSynced = configSummary && 
                       configSummary.pms_room_types?.data && 
                       configSummary.pms_room_types.data.length > 0;

      if (isSynced) {
        // Merge Server Data + Local Form Edits
        const fullConfig = { ...configSummary, ...formRules };

        // Calculate Status Flags
        const hasFloorRate = fullConfig.last_minute_floor?.enabled === true;
        const freezeDays = parseInt(fullConfig.rate_freeze_period || '0', 10);
        
        active.push({
          ...merged,
          config: fullConfig,
          status: {
            hasFloorRate,
            hasRateFreeze: freezeDays > 0,
            hasDifferentials: (fullConfig.room_differentials || []).length > 0
          }
        });
      } else {
        available.push(merged);
      }
    }

    return { 
      availableHotels: available, 
      activeHotels: active.sort((a, b) => a.property_name.localeCompare(b.property_name)) 
    };
  }, [allHotels, serverConfigs, pmsIdMap, formState]);

  // 3. Load Config for a Specific Hotel (Accordion Open)
  const loadHotelRules = async (hotelId: string) => {
    if (formState[hotelId]) return; // Already loaded

    setLoadingHotelId(hotelId);
    try {
      const data = await getConfig(hotelId);
      
      let rulesToSet: Partial<SentinelConfig>;

if (data) {
        // Merge DB data with defaults to ensure fields exist
        rulesToSet = {
          sentinel_enabled: data.sentinel_enabled,
          guardrail_max: String(data.guardrail_max ?? DEFAULT_RULES.guardrail_max),
          rate_freeze_period: String(data.rate_freeze_period ?? DEFAULT_RULES.rate_freeze_period),
          base_room_type_id: data.base_room_type_id || '',
          last_minute_floor: {
            enabled: data.last_minute_floor?.enabled || false,
            rate: String(data.last_minute_floor?.rate ?? DEFAULT_RULES.last_minute_floor?.rate),
            days: String(data.last_minute_floor?.days ?? DEFAULT_RULES.last_minute_floor?.days),
            dow: data.last_minute_floor?.dow || DEFAULT_RULES.last_minute_floor?.dow || [],
          },
          room_differentials: data.room_differentials || [],
          monthly_min_rates: { ...DEFAULT_RULES.monthly_min_rates, ...data.monthly_min_rates },
          monthly_aggression: { ...DEFAULT_RULES.monthly_aggression, ...data.monthly_aggression },
          pms_room_types: data.pms_room_types || { data: [] }
        };
      } else {
        rulesToSet = DEFAULT_RULES;
      }

      setFormState(prev => ({ ...prev, [hotelId]: rulesToSet }));
    } catch (error) {
      console.error(error);
      toast.error('Failed to load hotel rules.');
    } finally {
      setLoadingHotelId(null);
    }
  };

  // 4. Handle Field Updates (Deep Merge)
  const updateRule = (hotelId: string, path: string, value: any) => {
    setFormState(prev => {
      const newConfig = JSON.parse(JSON.stringify(prev[hotelId] || DEFAULT_RULES));
      
      // Update nested property using path string (e.g. "last_minute_floor.rate")
      let current = newConfig;
      const parts = path.split('.');
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) current[parts[i]] = {};
        current = current[parts[i]];
      }
      current[parts[parts.length - 1]] = value;

      return { ...prev, [hotelId]: newConfig };
    });
  };

  // 5. Actions: Sync & Save
  const activateHotel = async (hotelId: string, pmsPropertyId: string) => {
    setIsSyncing(hotelId);
    const toastId = toast.loading('Syncing with PMS...');
    try {
      const data = await syncFacts(hotelId, pmsPropertyId);
      
      // Update Server Configs
      setServerConfigs(prev => ({ ...prev, [hotelId]: data }));
      
      // Init Form State
      setFormState(prev => ({ 
        ...prev, 
        [hotelId]: { 
          ...(prev[hotelId] || DEFAULT_RULES),
          sentinel_enabled: false, // Force disabled on new activation
          pms_room_types: data.pms_room_types,
          base_room_type_id: data.pms_room_types?.data?.[0]?.roomTypeID || ''
        } 
      }));
      
      toast.success('Sync complete.', { id: toastId });
    } catch (error: any) {
      toast.error('Sync failed', { id: toastId, description: error.message });
    } finally {
      setIsSyncing(null);
    }
  };

const saveRules = async (hotelId: string) => {
    setIsSaving(hotelId);
    const toastId = toast.loading('Saving rules...');
    try {
      let rules = { ...formState[hotelId] };
      if (!rules) throw new Error('No rules to save');

      // Sanitize numeric inputs (prevent empty strings causing 500s)
      if (rules.rate_freeze_period === '') rules.rate_freeze_period = '0';
      if (rules.guardrail_max === '') rules.guardrail_max = '0';
      if (rules.last_minute_floor) {
        // Create a shallow copy of last_minute_floor to avoid mutating state directly
        rules.last_minute_floor = { ...rules.last_minute_floor };
        if (rules.last_minute_floor.rate === '') rules.last_minute_floor.rate = '0';
        if (rules.last_minute_floor.days === '') rules.last_minute_floor.days = '0';
      }

const data = await saveConfig(hotelId, rules as SentinelConfig);
      setServerConfigs(prev => ({ ...prev, [hotelId]: data }));
      
      // Update local form state with the sanitized/saved data to ensure consistency
      setFormState(prev => ({ ...prev, [hotelId]: data }));

      toast.success('Configuration saved successfully.', { id: toastId });
    } catch (error: any) {
      console.error(error);
      toast.error('Failed to save configuration.', { id: toastId, description: error.message });
    } finally {
      setIsSaving(null);
    }
  };

  return {
    // State
    isLoading,
    loadingHotelId,
    isSaving,
    isSyncing,
    availableHotels,
    activeHotels,
    formState,
    
    // Actions
    loadHotelRules,
    updateRule,
    activateHotel,
    saveRules
  };
};