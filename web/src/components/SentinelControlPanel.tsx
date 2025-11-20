import { useState, CSSProperties } from 'react';
import { 
  Plus, 
  Edit, 
  PlayCircle, 
  Trash2, 
  Globe2, 
HelpCircle, 
  ChevronDown, 
  ChevronUp,
  ChevronsUpDown,
  Check,
  Search, // <-- [NEW] Added import
  Loader2 // <-- [NEW] Import loader icon
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from './ui/accordion';
import { Switch } from './ui/switch';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from './ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';
import { Toaster, toast } from 'sonner'; // <-- [NEW] Added import
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from './ui/command';
import { useEffect, useMemo } from 'react'; // <-- [NEW] Import hooks

// [NEW] Define the structure of the prop from App.tsx
// [NEW] Define the structure of the prop from App.tsx
// [NEW] Define the structure of the prop from App.tsx
interface Hotel {
  hotel_id: number;
  property_name: string;
  is_rockenue_managed: boolean;
  pms_property_id?: string; // <-- [FIX] Add this field as optional
  // ... other fields we don't need yet
}

// [NEW] Define the interface for the component's props
interface SentinelControlPanelProps {
  allHotels: Hotel[];
}

// [NEW] Define the structure of the config from our DB
interface SentinelConfig {
  hotel_id: number;
  sentinel_enabled: boolean;
  guardrail_min: number;
  guardrail_max: number;
  // ... all other "Rules" and "Facts"
}

// [NEW] Define the merged object we will use to render the UI
interface ManagedHotel extends Hotel {
  config: SentinelConfig | null; // A hotel may not have a config yet
}

// [NEW] Define the shape of our "Rules" (the form fields)
// We'll use this for our new state.
interface HotelRulesState {
  sentinel_enabled: boolean;
  guardrail_min: string;
  guardrail_max: string;
  rate_freeze_period: string;
  base_room_type_id: string;
  
  // JSONB fields
  last_minute_floor: {
    enabled: boolean;
    rate: string;
    days: string;
    dow: string[];
  };
room_differentials: any[]; // Simplified for now
  monthly_min_rates: Record<string, string>;
  monthly_aggression: Record<string, string>;

  // [NEW] Add a place to store the real room types
  pms_room_types: any; 
}

// [NEW] Define the shape of our "Rules" (the form fields)
// We'll use this for our new state.
interface HotelRulesState {
  sentinel_enabled: boolean;
  guardrail_min: string;
  guardrail_max: string;
  rate_freeze_period: string;
  base_room_type_id: string;
  
  // JSONB fields
  last_minute_floor: {
    enabled: boolean;
    rate: string;
    days: string;
    dow: string[];
  };
  room_differentials: any[]; // Simplified for now
  monthly_min_rates: Record<string, string>;
  monthly_aggression: Record<string, string>;
}

interface WebhookStatus {
  id: string;
  propertyName: string;
  status: 'success' | 'error';
}

// [MODIFIED] Component now accepts props
export function SentinelControlPanel({ allHotels }: SentinelControlPanelProps) {
  // Rate Certification State
  // [MODIFIED] Default to empty, will be set by user
  const [propertyId, setPropertyId] = useState('');
  const [rateId, setRateId] = useState(''); // <-- [MODIFIED] Renamed from roomTypeId
  const [date, setDate] = useState('');
  const [rate, setRate] = useState('');
  const [apiResponse, setApiResponse] = useState('');
  const [isTestingRate, setIsTestingRate] = useState(false);
  const [isFetchingPlans, setIsFetchingPlans] = useState(false); // <-- [NEW] Transplanted state
  const [jobId, setJobId] = useState('143018500'); // <-- [NEW] Transplanted state
  const [isCheckingStatus, setIsCheckingStatus] = useState(false); // <-- [NEW] Transplanted state
// [NEW] This one state object will replace all the individual form states.
  // It holds the "Rules" (form data) for each hotel, indexed by hotel_id.
  const [hotelConfigState, setHotelConfigState] = useState<Record<string, HotelRulesState>>({});

  // [MODIFIED] This state is purely for UI (it controls all accordions)
  // and does not need to be per-hotel. We keep it.
  const [roomDifferentialsExpanded, setRoomDifferentialsExpanded] = useState(false);
const [hotelToActivate, setHotelToActivate] = useState('');
  const [isComboOpen, setIsComboOpen] = useState(false);

// Manual events state
  const [londonEvents, setLondonEvents] = useState([
    { id: '1', date: '2024-07-15', name: 'Wimbledon Finals', impact: 'High Demand' },
    { id: '2', date: '2024-12-31', name: 'New Year\'s Eve', impact: 'High Demand' },
  ]);

  // [NEW] Add back the missing states for the "Market Strategy" card
  const [londonAggression, setLondonAggression] = useState({
    jan: 'medium', feb: 'low', mar: 'high', apr: 'medium',
    may: 'high', jun: 'high', jul: 'medium', aug: 'medium',
    sep: 'low', oct: 'medium', nov: 'low', dec: 'high',
  });
  
const [romeEvents, setRomeEvents] = useState([
    { id: '1";', date: '2024-08-15', name: 'Ferragosto', impact: 'High Demand' },
  ]);

// [NEW] Handler for the "Sync with PMS" button
  // [MODIFIED] Function now takes the full hotel object
const handleSyncFacts = async (hotel: any) => { 
    
    // --- [DEBUGGING LOG] ---
    console.log(
      "--- DEBUG: SYNCING HOTEL ---",
      "Internal hotel_id:", hotel.hotel_id, 
      "External pms_property_id:", hotel.pms_property_id
    );
    // --- [END DEBUGGING LOG] ---

    // [CRITICAL FIX] Check if this is a new activation (config doesn't exist in loaded list yet)
    // We capture this BEFORE the await call to ensure we know the state at trigger time.
    const isNewActivation = !sentinelConfigs[hotel.hotel_id];

    setIsSyncing(String(hotel.hotel_id));
    // [FIX 1] Use hotel.property_name for the toast
    const toastId = toast.loading(`Syncing ${hotel.property_name} with PMS...`);

    try {
      // [FIX 2] Call the correct '/api/sentinel/sync' route and send a POST body
      const response = await fetch(`/api/sentinel/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          hotelId: hotel.hotel_id, 
          pmsPropertyId: hotel.pms_property_id // This sends the correct ID (e.g., 302817)
        })
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to sync with PMS.');
      }

      toast.success('Sync complete. Facts updated.', { id: toastId });

      // [FIX 3] Use hotel.hotel_id as the key
      setSentinelConfigs(prev => ({
        ...prev,
        [hotel.hotel_id]: result.data,
      }));

      // [FIX 4] Auto-select the base room after sync
      // Find the ID of the first room, or default to ''
      const pmsRoomTypes = result.data.pms_room_types?.data || [];
      const firstRoomId = pmsRoomTypes.length > 0 ? pmsRoomTypes[0].roomTypeID : '';

      // [FIX 5] Base new rules on CURRENT rules, not defaultRules.
      // This preserves any unsaved changes the user has made to the form.
      const currentRules = hotelConfigState[hotel.hotel_id] || defaultRules;
      
      const newRules: HotelRulesState = {
        ...currentRules, // Start with existing/default state
        
        // [CRITICAL FIX] If this is a new activation, FORCE it to FALSE (OFF).
        // If it's an existing hotel re-syncing, trust the DB result.
        sentinel_enabled: isNewActivation ? false : result.data.sentinel_enabled, 
        
        pms_room_types: result.data.pms_room_types || { data: [] }, // Update the room types
        
        // Auto-select base room ONLY if one isn't already selected
        base_room_type_id: currentRules.base_room_type_id || firstRoomId, 
      };

      setHotelConfigState(prev => ({
        ...prev,
        [hotel.hotel_id]: newRules
      }));

    } catch (error: any) {
      console.error('Sync error:', error);
      toast.error('Sync Failed', { id: toastId, description: error.message });
    } finally {
      setIsSyncing(null);
    }
  };

  // [NEW] Handler for the "Save Changes" button
  const handleSaveRules = async (hotelId: string) => {
    setIsSaving(hotelId);
    const toastId = toast.loading(`Saving rules for ${hotelId}...`);

    // Get the current rules from our form state
    const rulesToSave = hotelConfigState[hotelId];

    try {
      const response = await fetch(`/api/sentinel/config/${hotelId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rulesToSave),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to save rules.');
      }

      toast.success('Rules saved successfully.', { id: toastId });

      // Update the main config list with the saved data
      setSentinelConfigs(prev => ({
        ...prev,
        [hotelId]: result.data,
      }));
      
    } catch (error: any) {
      console.error('Save error:', error);
      toast.error('Save Failed', { id: toastId, description: error.message });
    } finally {
      setIsSaving(null);
    }
  };


  // Add Event Dialog state
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);
  const [newEventDate, setNewEventDate] = useState('');
const [newEventName, setNewEventName] = useState('');
  const [newEventImpact, setNewEventImpact] = useState('High Demand');
  const [activeMarket, setActiveMarket] = useState('london');

  // --- [NEW] Data Loading State ---
  // Stores configs from GET /api/sentinel/configs
  const [sentinelConfigs, setSentinelConfigs] = useState<Record<string, SentinelConfig>>({});
  const [isLoadingConfigs, setIsLoadingConfigs] = useState(true);

  // [NEW] State to track which accordion item is open for styling
// [NEW] State to track which accordion item is open for styling
const [openAccordionItem, setOpenAccordionItem] = useState<string>('');

// [NEW] Loading state for when we fetch a *single* config
const [loadingHotelId, setLoadingHotelId] = useState<string | null>(null);

// [NEW] Loading states for API calls (to show spinners on buttons)
const [isSaving, setIsSaving] = useState<string | null>(null); // Stores the hotel_id being saved
const [isSyncing, setIsSyncing] = useState<string | null>(null); // Stores the hotel_id being synced

// [NEW] State to hold the map of { hotel_id: pms_property_id }
  const [pmsIdMap, setPmsIdMap] = useState<Record<string, string>>({});
  const [isLoadingPmsMap, setIsLoadingPmsMap] = useState(true);

// [NEW] Default "Rules" for a new hotel config
const defaultRules: HotelRulesState = {
  pms_room_types: { data: [] }, // [NEW] Add default
  sentinel_enabled: false,
  // guardrail_min: '100', // <-- REMOVED
  guardrail_max: '400',
rate_freeze_period: '2',
base_room_type_id: '', // [FIX] Default to empty string
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
  }
};

// [NEW] This function is called when an accordion is opened
const loadConfigForHotel = async (hotelId: string) => {
  // 1. Check if we already have this hotel's data in our state
  if (hotelConfigState[hotelId]) {
    setOpenAccordionItem(hotelId); // Just open it
    return;
  }

  // 2. We don't have it, so show a loader and fetch it
  setLoadingHotelId(hotelId);
  setOpenAccordionItem(hotelId); // Open it while it loads

  try {
    const response = await fetch(`/api/sentinel/config/${hotelId}`);
    const result = await response.json();

    if (!response.ok) throw new Error(result.message || 'Failed to fetch config');

    let rulesToSet: HotelRulesState;

    if (result.data) {
      // 3A. Config exists in DB. Use it.
      // We must merge DB data with defaults to ensure all fields exist
      // and convert numbers/nulls to strings for the form.
      const dbConfig = result.data;
      rulesToSet = {
        sentinel_enabled: dbConfig.sentinel_enabled || false,
        // guardrail_min: String(dbConfig.guardrail_min || defaultRules.guardrail_min), // <-- REMOVED
        guardrail_max: String(dbConfig.guardrail_max || defaultRules.guardrail_max),
        rate_freeze_period: String(dbConfig.rate_freeze_period || defaultRules.rate_freeze_period),
        base_room_type_id: dbConfig.base_room_type_id || '',
        last_minute_floor: {
          enabled: dbConfig.last_minute_floor?.enabled || false,
          rate: String(dbConfig.last_minute_floor?.rate || defaultRules.last_minute_floor.rate),
          days: String(dbConfig.last_minute_floor?.days || defaultRules.last_minute_floor.days),
          dow: dbConfig.last_minute_floor?.dow || defaultRules.last_minute_floor.dow,
        },
room_differentials: Array.isArray(dbConfig.room_differentials) ? dbConfig.room_differentials : [],
        monthly_min_rates: { ...defaultRules.monthly_min_rates, ...dbConfig.monthly_min_rates },
        monthly_aggression: { ...defaultRules.monthly_aggression, ...dbConfig.monthly_aggression },

        // [NEW] Store the real room types in the form state
        pms_room_types: dbConfig.pms_room_types || { data: [] },
      };
    } else {
      // 3B. No config exists in DB. Use defaults.
      rulesToSet = defaultRules;
    }

    // 4. Save the loaded/default rules into our "map" state
    setHotelConfigState(prev => ({
      ...prev,
      [hotelId]: rulesToSet
    }));

  } catch (error) {
console.error(`Error loading config for ${hotelId}:`, error);
toast.error(`Failed to load config for hotel ${hotelId}.`);
setOpenAccordionItem(''); // Close accordion on error
} finally {
    setLoadingHotelId(null);
  }
};
// --- [NEW] Fetch PMS Property ID Map ---
// --- DEBUG 1: Log the raw prop from App.tsx ---
  useEffect(() => {
    console.log('[DEBUG 1] allHotels prop from App.tsx:', allHotels);
  }, [allHotels]);
// --- [NEW] Fetch PMS Property ID Map ---
  useEffect(() => {
    const fetchPmsIdMap = async () => {
      try {
        const response = await fetch('/api/sentinel/pms-property-ids');
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.message || 'Failed to fetch PMS ID map');
        }
// --- DEBUG 2: Log the raw data from our API endpoint ---
        console.log('[DEBUG 2] Data from /api/sentinel/pms-property-ids:', result.data);
        
        setPmsIdMap(result.data);
      } catch (error) {
        console.error('Error fetching PMS ID map:', error);
        toast.error('Failed to load PMS property IDs.');
      } finally {
        setIsLoadingPmsMap(false); // <-- [THE FIX]
      }
    };

    fetchPmsIdMap();
  }, []); // Runs once on component mount
  // --- [NEW] Fetch All Sentinel Configurations ---
  useEffect(() => {
    const fetchAllConfigs = async () => {
      setIsLoadingConfigs(true);
      try {
        const response = await fetch('/api/sentinel/configs'); // Our new endpoint
        const data = await response.json();
        
        if (!response.ok || !data.success) {
          throw new Error(data.message || 'Failed to fetch configs');
        }

        // Convert the array of configs into a Map (object) indexed by hotel_id
        // for fast lookups. e.g., { "123": { ...config for 123 } }
        const configMap = data.data.reduce((acc: Record<string, SentinelConfig>, config: SentinelConfig) => {
          acc[config.hotel_id] = config;
          return acc;
        }, {});

        setSentinelConfigs(configMap);
        
      } catch (error) {
        console.error('Error fetching Sentinel configs:', error);
        toast.error('Failed to load hotel configurations.');
      } finally {
        setIsLoadingConfigs(false);
      }
    };

    fetchAllConfigs();
  }, []); // Runs once on component mount

// [NEW] Calculate which hotels are available for activation vs. already active
  const { availableHotels, activeHotels } = useMemo(() => {
    const available = [];
    const active = [];

    if (!allHotels) return { availableHotels: [], activeHotels: [] }; // Guard

    // 1. Filter for only "Rockenue Managed" hotels
    const managedHotelsList = allHotels.filter(
      (hotel) => hotel.is_rockenue_managed,
    );

    for (const hotel of managedHotelsList) {
      // 2. Merge with our PMS ID map
      const mergedHotel = {
        ...hotel,
        pms_property_id: pmsIdMap[hotel.hotel_id] ?? hotel.pms_property_id,
      };

      // 3. Check if a config *summary* exists from our initial load
      const configSummary = sentinelConfigs[mergedHotel.hotel_id];

      // 4. Check if a *full config* (with rules) exists in our form state
      const configRules = hotelConfigState[mergedHotel.hotel_id];

      // [CRITICAL FIX] Strict Active Check
      // We only move a hotel to the "Active" accordion if it has synced PMS data.
      // If a row exists but pms_room_types is null (created by Property Hub), 
      // we treat it as still "Available" for activation.
      const isSynced = configSummary && 
                       configSummary.pms_room_types && 
                       Array.isArray(configSummary.pms_room_types.data) &&
                       configSummary.pms_room_types.data.length > 0;

      if (isSynced) {
        // Config exists and has data. Add it to the active list.
        const fullConfig = { ...configSummary, ...configRules };

        // --- Calculate status booleans ---
        const hasFloorRate = fullConfig.last_minute_floor?.enabled === true;
        const rateFreezePeriod = parseInt(String(fullConfig.rate_freeze_period || '0'), 10);
        const hasRateFreeze = rateFreezePeriod > 0;
        
        const differentials = fullConfig.room_differentials || [];
        const hasDifferentials = Array.isArray(differentials) && differentials.length > 0;

        active.push({
          ...mergedHotel,
          config: fullConfig,
          status: {
            hasFloorRate,
            hasRateFreeze,
            hasDifferentials,
          }
        });
      } else {
        // No config OR incomplete "Ghost" config. Add to Available list.
        available.push(mergedHotel);
      }
    }

    // 5. Sort the active hotels by name
    active.sort((a, b) => a.property_name.localeCompare(b.property_name));

    return { availableHotels: available, activeHotels: active };
  }, [allHotels, sentinelConfigs, pmsIdMap, hotelConfigState]);


  // ... (Prototype's helper functions: formatEventDate, handleAddEvent, handleAggressionClick) ...

  // ... (Prototype's helper functions: formatEventDate, handleAddEvent, handleAggressionClick) ...
  const formatEventDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = date.getDate();
    const month = date.toLocaleDateString('en-GB', { month: 'long' });
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  };

  const handleAddEvent = () => {
    if (!newEventDate || !newEventName) return;
    const newEvent = {
      id: Date.now().toString(),
      date: newEventDate,
      name: newEventName,
      impact: newEventImpact,
    };
    if (activeMarket === 'london') {
      setLondonEvents(prev => [...prev, newEvent]);
    } else {
      setRomeEvents(prev => [...prev, newEvent]);
    }
    setNewEventDate('');
    setNewEventName('');
    setNewEventImpact('High Demand');
    setIsAddEventOpen(false);
  };

// [NEW] This one function handles ALL form field changes for ANY hotel
// [NEW] This one function handles ALL form field changes for ANY hotel
  const handleConfigChange = (hotelId: string, field: string, value: any) => {


    setHotelConfigState(prev => {
      // Create a deep copy of the hotel's specific config
      const newConfig = JSON.parse(JSON.stringify(prev[hotelId]));

      // This logic lets us update nested fields like 'last_minute_floor.rate'
      let current = newConfig;
      const parts = field.split('.');
      
      for (let i = 0; i < parts.length - 1; i++) {
        // Create nested objects if they don't exist
        if (!current[parts[i]]) {
          current[parts[i]] = {};
        }
        current = current[parts[i]];
      }
      current[parts[parts.length - 1]] = value;

      // Return the updated state map
      return {
        ...prev,
        [hotelId]: newConfig
      };
    });
  };
  
  // [NEW] This function is now per-hotel
  const toggleDayOfWeek = (hotelId: string, day: string) => {
    setHotelConfigState(prev => {
      const newConfig = JSON.parse(JSON.stringify(prev[hotelId]));
      const dow = newConfig.last_minute_floor.dow;
      
      if (dow.includes(day)) {
        newConfig.last_minute_floor.dow = dow.filter((d: string) => d !== day);
      } else {
        newConfig.last_minute_floor.dow.push(day);
      }
      
      return { ...prev, [hotelId]: newConfig };
    });
  };

  // [MODIFIED] This function now accepts a hotelId
  const handleAggressionClick = (hotelId: string, monthValue: string) => {
    // [MODIFIED] Use the new master state
    const currentLevel = hotelConfigState[hotelId]?.monthly_aggression?.[monthValue] || 'low';
    let next = 'low';
    if (currentLevel === 'low') next = 'medium';
    else if (currentLevel === 'medium') next = 'high';
    else if (currentLevel === 'high') next = 'low';
    
    // [MODIFIED] Update the state using the master handler
    setHotelConfigState(prev => {
      const newConfig = JSON.parse(JSON.stringify(prev[hotelId]));
      newConfig.monthly_aggression[monthValue] = next;
      return {
        ...prev,
        [hotelId]: newConfig
      };
    });
  };
  
  // [REMOVED] The mock 'properties' array is no longer needed.
  // [NEW] Handler for changes to the room_differentials inputs
const handleDifferentialChange = (hotelId: string, roomTypeId: string, field: 'operator' | 'value', newValue: string) => {
  setHotelConfigState(prev => {
// Deep copy the hotel's config
            const newConfig = JSON.parse(JSON.stringify(prev[hotelId]));
            
            // [FIX] Ensure room_differentials is an array before we .find
            if (!Array.isArray(newConfig.room_differentials)) {
              newConfig.room_differentials = [];
            }
            
            // Find the differential rule for this room
            let rule = newConfig.room_differentials.find((r: any) => r.roomTypeId === roomTypeId);

    // If no rule exists, create a default one
    if (!rule) {
      rule = { roomTypeId: roomTypeId, operator: '+', value: '0' };
      newConfig.room_differentials.push(rule);
    }

    // Update the field
    rule[field] = newValue;

    // Return the updated state
    return {
      ...prev,
      [hotelId]: newConfig
    };
  });
};


  // [MODIFIED] This function is from the prototype, but our inline styles will use it
  const getAggressionColor = (level: string) => {
    switch (level) {
      case 'low':
        return {
          bg: 'rgba(16,185,129,0.1)',
          text: '#10b981',
          border: 'rgba(16,185,129,0.3)',
        };
      case 'medium':
        return {
          bg: 'rgba(250,255,106,0.1)',
          text: '#faff6a',
          border: 'rgba(250,255,106,0.3)',
        };
      case 'high':
        return {
          bg: 'rgba(239,68,68,0.1)',
          text: '#ef4444',
          border: 'rgba(239,68,68,0.3)',
        };
      default:
        return {
          bg: 'rgba(156,163,175,0.1)',
          text: '#9ca3af',
          border: 'rgba(156,163,175,0.3)',
        };
    }
  };

  // Mock data for webhooks
  const [webhooks] = useState<WebhookStatus[]>([
    { id: '1', propertyName: 'The Grand Hotel', status: 'success' },
    { id: '2', propertyName: 'Seaside Luxury Resort', status: 'error' },
    { id: '3', propertyName: 'Downtown Business Suites', status: 'success' },
  ]);

  // --- [NEW] Transplanted API Handlers ---

  const handleFetchRatePlans = async () => {
    if (!propertyId) {
      toast.error('Property ID is required to fetch rate plans.');
      return;
    }
    setIsFetchingPlans(true);
    setApiResponse('');
    try {
      const response = await fetch(`/api/sentinel/get-rate-plans/${propertyId}`);
      const data = await response.json();
      setApiResponse(JSON.stringify(data, null, 2));
      if (data.success) {
        toast.success('Rate plans fetched successfully.');
      } else {
        toast.error(data.message || 'Failed to fetch rate plans.');
      }
    } catch (error) {
      console.error('Fetch Rate Plans Error:', error);
      const errorMsg = (error as Error).message;
      setApiResponse(JSON.stringify({ success: false, error: errorMsg }, null, 2));
      toast.error('An error occurred while fetching rate plans.');
    } finally {
      setIsFetchingPlans(false);
    }
  };

  const handleTestPostRate = async () => { // <-- [MODIFIED] Replaced mock function
    setIsTestingRate(true);
    setApiResponse('');
    try {
      const response = await fetch('/api/sentinel/test-post-rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          rateId, // <-- Use our state
          date,
          rate: parseFloat(rate),
        }),
      });
      const data = await response.json();
      setApiResponse(JSON.stringify(data, null, 2));
      if (data.success) {
        toast.success(`Rate update queued! Job ID: ${data.data?.jobReferenceID}`);
        if (data.data?.jobReferenceID) {
          setJobId(data.data.jobReferenceID);
        }
      } else {
        toast.error(data.message || 'Failed to post rate.');
      }
    } catch (error) {
      console.error('Post Rate Error:', error);
      const errorMsg = (error as Error).message;
      setApiResponse(JSON.stringify({ success: false, error: errorMsg }, null, 2));
      toast.error('An error occurred while posting the rate.');
    } finally {
      setIsTestingRate(false);
    }
  };

  const handleCheckJobStatus = async () => { // <-- [NEW] Transplanted function
    if (!jobId || !propertyId) {
      toast.error('Property ID and Job ID are required to check status.');
      return;
    }
    setIsCheckingStatus(true);
    setApiResponse('');
    try {
      const response = await fetch(`/api/sentinel/job-status/${propertyId}/${jobId}`);
      const data = await response.json();
      setApiResponse(JSON.stringify(data, null, 2));
      if (data.success) {
        toast.success('Job status fetched successfully.');
      } else {
        toast.error(data.message || 'Failed to fetch job status.');
      }
    } catch (error) {
      console.error('Check Job Status Error:', error);
      const errorMsg = (error as Error).message;
      setApiResponse(JSON.stringify({ success: false, error: errorMsg }, null, 2));
      toast.error('An error occurred while fetching the job status.');
} finally {
      setIsCheckingStatus(false);
    }
  };
  // --- End Transplanted API Handlers ---

// [NEW] Style objects for Tabs component to meet "Styling Workaround"
  const tabTriggerStyle: CSSProperties = {
    color: '#9ca3af',
    padding: '0.5rem 1rem', // py-2 px-4
    fontSize: '0.75rem', // text-xs
    textTransform: 'uppercase',
    letterSpacing: '0.05em', // tracking-wider
    border: '1px solid transparent',
    borderRadius: '0.25rem', // Added for visual consistency
  };

  const activeTabTriggerStyle: CSSProperties = {
    ...tabTriggerStyle,
    backgroundColor: 'rgba(57, 189, 248, 0.1)', // data-[state=active]:bg-[#39BDF8]/20
    color: '#39BDF8', // data-[state=active]:text-[#39BDF8]
    borderColor: 'rgba(57, 189, 248, 0.5)', // data-[state=active]:border-[#39BDF8]/50
  };

  return (
<div style={{ minHeight: '100vh', background: '#1d1d1c', position: 'relative', overflow: 'hidden' }}>
  {/* --- PASTE THIS STYLE BLOCK HERE --- */}
      <style>{`
        /* Hide spin buttons for Chrome, Safari, Edge, Opera */
        input[type=number]::-webkit-inner-spin-button, 
        input[type=number]::-webkit-outer-spin-button { 
          -webkit-appearance: none; 
          margin: 0; 
        }
        /* Hide spin buttons for Firefox */
        input[type=number] {
          -moz-appearance: textfield;
        }
      `}</style>
      {/* ----------------------------------- */}
      {/* ... (background styles) ... */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom right, rgba(57,189,248,0.05), transparent, rgba(250,255,106,0.05))' }}></div>
      <div style={{ 
        position: 'absolute', 
        inset: 0, 
        backgroundImage: 'linear-gradient(rgba(57,189,248,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(57,189,248,0.03) 1px, transparent 1px)', 
        backgroundSize: '64px 64px' 
      }}></div>

      <div style={{ position: 'relative', zIndex: 10, padding: '3rem', maxWidth: '1800px', margin: '0 auto' }}>
        {/* Page Header */}
        <div style={{ marginBottom: '3rem' }}>
          <h1 style={{ color: '#e5e5e5', fontSize: '1.875rem', letterSpacing: '-0.025em', marginBottom: '0.5rem' }}>Sentinel AI Control Panel</h1>
          <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>Super Admin • PMS Integration & AI Configuration</p>
        </div>

     {/* --- [NEW] Hotel Activation Component (Styled & Wired-Up) --- */}
        {/* This card only appears if there are hotels to activate */}
        {availableHotels.length > 0 && (
          <div style={{ marginBottom: '2rem' }}>
            <Card style={{ backgroundColor: '#1a1a1a', borderColor: 'rgba(57, 189, 248, 0.2)' }}>
              <CardContent style={{ padding: '1.5rem' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '24px'
                }}>
                  {/* Left: Label (from prototype) */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}>
                    <div style={{
                      padding: '8px',
                      backgroundColor: 'rgba(57, 189, 248, 0.1)',
                      borderRadius: '8px'
                    }}>
                      <div style={{
                        width: '24px',
                        height: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <span style={{
                          color: '#39BDF8',
                          fontWeight: 'bold'
                        }}>{activeHotels.length + 1}</span>
                      </div>
                    </div>
                    <h3 style={{
                      color: '#e5e5e5',
                      fontSize: '24px',
                      textTransform: 'uppercase',
                      letterSpacing: '-0.025em',
                      margin: 0
                    }}>Activate Property</h3>
                  </div>

                  {/* Right: Combobox & Button (Styled) */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px'
                  }}>
                    {/* [STYLED] Combobox */}
                    <div style={{ width: '400px' }}>
                      <Popover open={isComboOpen} onOpenChange={setIsComboOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={isComboOpen}
                            // [FIX] 'className' for layout, 'style' for colors
                            className="w-full justify-between" 
                            style={{ 
                              justifyContent: 'space-between',
                              backgroundColor: '#0f0f0f', 
                              border: '1px solid rgba(57, 189, 248, 0.3)', 
                              color: '#e5e5e5' 
                            }}
                          >
                            {hotelToActivate
                              ? availableHotels.find((hotel) => String(hotel.hotel_id) === hotelToActivate)?.property_name
                              : "Search hotel to activate..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent 
                          // [FIX] 'className' for layout, 'style' for colors
                          className="w-[400px]"
                          style={{ 
                            width: '400px', 
                            padding: 0, 
                            backgroundColor: '#1a1a1a', 
                            border: '1px solid rgba(57, 189, 248, 0.3)' 
                          }} 
                          align="start"
                        >
                          <Command style={{ backgroundColor: '#1a1a1a' }}>
                            <CommandEmpty style={{ color: '#9ca3af', padding: '1.5rem 0', textAlign: 'center', fontSize: '0.875rem' }}>
                              No hotel found.
                            </CommandEmpty>
                            <CommandGroup style={{ backgroundColor: '#1a1a1a', padding: '0.5rem' }}>
                              {availableHotels.map((hotel) => (
                                <CommandItem
                                  key={hotel.hotel_id}
                                  value={String(hotel.hotel_id)}
                                  onSelect={(currentValue) => {
                                    setHotelToActivate(currentValue === hotelToActivate ? "" : currentValue);
                                    setIsComboOpen(false);
                                  }}
                                  // [FIX] Use style for colors
                                  style={{ 
                                    color: '#e5e5e5', 
                                    cursor: 'pointer', 
                                    borderRadius: '0.25rem', 
                                    padding: '0.5rem' 
                                  }}
                                  className="hover:bg-[#161616]" // <-- [FIX] Hover class is fine on shadcn sub-components
                                >
                                  <Check
                                    // [FIX] Use style for layout/color
                                    style={{
                                      marginRight: '0.5rem',
                                      height: '1rem',
                                      width: '1rem',
                                      color: '#39BDF8',
                                      opacity: hotelToActivate === String(hotel.hotel_id) ? 1 : 0
                                    }}
                                  />
                                  {hotel.property_name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* [STYLED] Activate Button */}
                    <Button 
                      disabled={!hotelToActivate || isSyncing !== null}
                      // [FIX] 'className' for status, 'style' for colors
                      className="disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ 
                        backgroundColor: '#39BDF8', 
                        color: '#0f0f0f', 
                        fontWeight: 500 
                      }}
                      onClick={() => {
                        const hotel = availableHotels.find(h => String(h.hotel_id) === hotelToActivate);
                        if (hotel) {
                          handleSyncFacts(hotel);
                          setHotelToActivate('');
                        }
                      }}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Activate & Sync
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        {/* --- End Activation Component --- */}
        {/* --- [FIX] Section 1.5: Market Strategy & Vitals (Wrapped in missing tags) --- */}
        <div style={{ marginBottom: '2rem' }}>
          <Card style={{ backgroundColor: '#1a1a1a', borderColor: 'rgba(57, 189, 248, 0.2)', boxShadow: '0 0 30px rgba(57,189,248,0.1)' }}>
            <CardHeader style={{ borderBottom: '1px solid rgba(57,189,248,0.1)', paddingBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
           <div style={{ padding: '0.5rem', background: 'rgba(57,189,248,0.1)', borderRadius: '0.5rem' }}>
  <Globe2 style={{ width: '1.5rem', height: '1.5rem', color: '#39BDF8' }} />
</div>
                <div>
                  <CardTitle style={{ color: '#e5e5e5', fontSize: '1.5rem', textTransform: 'uppercase', letterSpacing: '-0.025em' }}>Market Strategy & VITALS</CardTitle>
                  <CardDescription style={{ color: '#9ca3af', marginTop: '0.25rem' }}>
                    Global market defaults • Applied to all properties unless overridden
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent style={{ paddingTop: '1.5rem' }}>
      <Tabs 
  value={activeMarket} 
  onValueChange={setActiveMarket} 
  style={{ width: '100%' }}
>
  
<TabsList 
  style={{ 
    backgroundColor: '#0f0f0f',
    display: 'grid',
    gridTemplateColumns: 'repeat(1, 1fr)', // <-- MODIFIED
    border: '1px solid #2a2a2a',
    height: 'auto',
    padding: '0.25rem', // p-1
    gap: '0.25rem', // gap-1
    marginBottom: '1.5rem' // mb-6
  }} 
>
                  <TabsTrigger 
                    value="london"
                    style={activeMarket === 'london' ? activeTabTriggerStyle : tabTriggerStyle}
                  >
                    London
                  </TabsTrigger>
</TabsList>
                {/* London Tab */}
                <TabsContent value="london" style={{ marginTop: '1.5rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    {/* Market Seasonality */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <h3 style={{ color: '#e5e5e5', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.75rem' }}>Market Seasonality</h3>
                      <div style={{ background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '0.5rem', padding: '1rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
                          {Object.entries(londonAggression).map(([monthValue, level]) => {
                            const colors = getAggressionColor(level);
                            return (
                            <button
                              key={monthValue}
                              style={{
                                position: 'relative',
                                padding: '0.75rem',
                                borderRadius: '0.5rem',
                                border: `2px solid ${colors.border}`,
                                background: colors.bg,
                                transition: 'all 0.2s',
                                cursor: 'pointer'
                              }}
                              onClick={() => {
                                setLondonAggression(prev => {
                                  const current = prev[monthValue as keyof typeof prev];
                                  let next = 'low';
                                  if (current === 'low') next = 'medium';
                                  else if (current === 'medium') next = 'high';
                                  else if (current === 'high') next = 'low';
                                  return { ...prev, [monthValue]: next };
                                });
                              }}
                            >
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                                <span style={{ 
                                  fontSize: '0.75rem', 
                                  textTransform: 'uppercase', 
                                  letterSpacing: '0.05em',
                                  color: colors.text
                                }}>
                                  {monthValue.charAt(0).toUpperCase() + monthValue.slice(1, 3)}
                                </span>
                                <div style={{ 
                                  width: '0.375rem', 
                                  height: '0.375rem', 
                                  borderRadius: '50%',
                                  background: colors.text
                                }} />
                              </div>
                            </button>
                            );
                          })}
                        </div>
                        {/* ... (Seasonality Legend) ... */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', paddingTop: '0.75rem', borderTop: '1px solid #2a2a2a' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ width: '0.75rem', height: '0.75rem', borderRadius: '50%', background: '#10b981' }} />
                            <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Low Aggression</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ width: '0.75rem', height: '0.75rem', borderRadius: '50%', background: '#faff6a' }} />
                            <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Medium Aggression</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ width: '0.75rem', height: '0.75rem', borderRadius: '50%', background: '#ef4444' }} />
                            <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>High Aggression</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Manual Events */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <h3 style={{ color: '#e5e5e5', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.75rem' }}>Manual Events</h3>
<Button 
  variant="outline"
  style={{ backgroundColor: '#0f0f0f', borderColor: '#2a2a2a', color: '#e5e5e5', width: 'fit-content' }}
  className="hover:bg-[#39BDF8] hover:text-[#0f0f0f] hover:border-[#39BDF8]"
  onClick={() => {
                          setIsAddEventOpen(true);
                          setActiveMarket('london');
                        }}
                  >
  <Plus style={{ width: '1rem', height: '1rem', marginRight: '0.5rem' }} />
  Add Event
</Button>
                      <div style={{ background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '0.5rem', overflow: 'hidden' }}>
                        <Table>
                 <TableHeader>
  <TableRow className="border-[#2a2a2a] hover:bg-transparent">
    <TableHead style={{ color: '#9ca3af' }}>Date</TableHead>
    <TableHead style={{ color: '#9ca3af' }}>Event Name</TableHead>
    <TableHead style={{ color: '#9ca3af' }}>Impact</TableHead>
    <TableHead style={{ color: '#9ca3af', textAlign: 'right' }}>Actions</TableHead>
  </TableRow>
</TableHeader>
                   <TableBody>
  {londonEvents.map((event) => (
    <TableRow key={event.id} className="border-[#2a2a2a] hover:bg-[#161616]">
      <TableCell style={{ color: '#e5e5e5' }}>{event.date}</TableCell>
      <TableCell style={{ color: '#e5e5e5' }}>{event.name}</TableCell>
      <TableCell>
   <Badge
  variant="outline" 
  style={{
    backgroundColor: 'rgba(239, 68, 68, 0.1)', // bg-[#ef4444]/10
    color: '#ef4444', // text-[#ef4444]
    borderColor: 'rgba(239, 68, 68, 0.3)' // border-[#ef4444]/30
  }}
>
  {event.impact}
</Badge>
                                </TableCell>
                                <TableCell className="text-right">
<Button
  variant="ghost"
  size="sm"
  style={{ color: '#ef4444' }} // text-[#ef4444]
  className="hover:text-[#ef4444] hover:bg-[#ef4444]/10"
  onClick={() => setLondonEvents(prev => prev.filter(e => e.id !== event.id))}
>
    <Trash2 style={{ width: '1rem', height: '1rem' }} />
  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>

                    {/* Market Vitals (Read-Only) */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <h3 style={{ color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '10px' }}>Market Vitals (Read-Only)</h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '0.25rem', padding: '0.5rem', display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                          <span style={{ color: '#9ca3af', fontSize: '10px', textTransform: 'uppercase' }}>Lead</span>
                          <span style={{ color: '#e5e5e5', fontSize: '0.875rem' }}>21d</span>
                        </div>
                        <div style={{ background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '0.25rem', padding: '0.5rem', display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                          <span style={{ color: '#9ca3af', fontSize: '10px', textTransform: 'uppercase' }}>LOS</span>
                          <span style={{ color: '#e5e5e5', fontSize: '0.875rem' }}>2.8n</span>
                        </div>
                        <div style={{ background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '0.25rem', padding: '0.5rem', display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                          <span style={{ color: '#9ca3af', fontSize: '10px', textTransform: 'uppercase' }}>Pace</span>
                          <span style={{ color: '#10b981', fontSize: '0.875rem' }}>+4.2%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>

           
                
              </Tabs>
            </CardContent>
          </Card>
        </div>

{/* Section 2: Sentinel Hotel Management */}
<div style={{ marginBottom: '2rem' }}>
  {/* [NEW] Show a loader while fetching configs OR the ID map */}
  {(isLoadingConfigs || isLoadingPmsMap) && ( // <-- [THE FIX]
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '3rem', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '0.5rem' }}>
      <Loader2 style={{ width: '1.5rem', height: '1.5rem', color: '#39BDF8', animation: 'spin 1s linear infinite' }} />
      <span style={{ color: '#9ca3af', marginLeft: '0.75rem' }}>
        {/* [NEW] Show a dynamic loading message */}
        {isLoadingConfigs ? 'Loading Hotel Configurations...' : 'Loading Property Mappings...'}
      </span>
    </div>
  )}

  {/* [NEW] Only render accordion if loading is done */}
  {(!isLoadingConfigs && !isLoadingPmsMap) && ( // <-- [THE FIX]
    <Accordion
      type="single"
collapsible 
    style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
    value={openAccordionItem}
    // [MODIFIED] Call our new loader function when an accordion is clicked
    onValueChange={(hotelId) => {
      if (hotelId) {
        // 'hotelId' is the string value of the accordion item
        loadConfigForHotel(hotelId);
} else {
    setOpenAccordionItem(''); // Allow closing
}
    }}
  >
{/* [MODIFIED] Loop over the new 'activeHotels' list */}
            {activeHotels.map((
            hotel
            ) => (
<AccordionItem 
                key={hotel.hotel_id}
                value={String(hotel.hotel_id)} // Accordion value must be a string
                style={{ 
                  backgroundColor: '#1a1a1a',
                  // [NEW] Add dynamic left border from prototype
                  borderLeft: `4px solid ${hotel.config?.sentinel_enabled ? 'rgba(16, 185, 129, 0.4)' : 'rgba(250, 255, 106, 0.4)'}`,
                  // [MODIFIED] Change right/top/bottom border based on open state
                  borderRight: `1px solid ${openAccordionItem === String(hotel.hotel_id) ? '#39BDF8' : '#2a2a2a'}`,
                  borderTop: `1px solid ${openAccordionItem === String(hotel.hotel_id) ? '#39BDF8' : '#2a2a2a'}`,
                  borderBottom: `1px solid ${openAccordionItem === String(hotel.hotel_id) ? '#39BDF8' : '#2a2a2a'}`, 
                  borderRadius: '0.5rem', 
                  overflow: 'hidden' 
                }}
              >
              {/* [FIX] This is the correct, clean AccordionTrigger */}
                <AccordionTrigger 
                  // [THE FIX] Set the Property ID for the cert tester
                  // to the EXTERNAL pms_property_id, not the internal hotel_id.
                 
                  style={{ 
                    padding: '1.25rem 1.5rem', // py-5 px-6
                    backgroundColor: '#141414' // [NEW] Set trigger background
                  }}
                  className="hover:no-underline"
                >
                {/* [NEW] This is the transplanted layout from the prototype */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '1.5rem', width: '100%', paddingRight: '1rem', alignItems: 'center' }}>
                    {/* Hotel Name */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <span style={{ color: '#e5e5e5' }}>
                        {hotel.property_name} ({hotel.hotel_id})
                      </span>
                    </div>
                    
                    {/* Status Badge (Active/Paused) */}
                    <Badge 
                      variant="outline" 
                      style={
                        hotel.config?.sentinel_enabled
                          ? { // Active style
                              backgroundColor: 'rgba(16, 185, 129, 0.1)', 
                              color: '#10b981',
                              borderColor: 'rgba(16, 185, 129, 0.3)',
                              whiteSpace: 'nowrap'
                            }
                          : { // Paused style
                              backgroundColor: 'rgba(250, 255, 106, 0.1)',
                              color: '#faff6a',
                              borderColor: 'rgba(250, 255, 106, 0.3)',
                              whiteSpace: 'nowrap'
                            }
                      }
                    >
                      Status: {hotel.config?.sentinel_enabled ? 'Active' : 'Paused'}
                    </Badge>

                    {/* [NEW] Icon Badges */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <TooltipProvider>
                        {/* Floor Rate Icon */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge 
                              variant="outline" 
                              style={
                                hotel.status?.hasFloorRate
                                  ? { // Configured
                                      backgroundColor: 'rgba(57, 189, 248, 0.1)',
                                      color: '#39BDF8',
                                      borderColor: 'rgba(57, 189, 248, 0.3)'
                                    }
                                  : { // Not Configured
                                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                      color: '#ef4444',
                                      borderColor: 'rgba(239, 68, 68, 0.3)'
                                    }
                              }
                            >
                              Floor Rate
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent style={{ backgroundColor: '#1a1a1a', borderColor: '#2a2a2a' }}>
                            <p style={{ fontSize: '12px', color: '#e5e5e5' }}>
                              {hotel.status?.hasFloorRate ? 'Last-Minute Floor Rate is configured' : '⚠ Floor Rate not set'}
                            </p>
                          </TooltipContent>
                        </Tooltip>

                        {/* Rate Freeze Icon */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge 
                              variant="outline" 
                              style={
                                hotel.status?.hasRateFreeze
                                  ? { // Configured
                                      backgroundColor: 'rgba(245, 158, 11, 0.1)',
                                      color: '#f59e0b',
                                      borderColor: 'rgba(245, 158, 11, 0.3)'
                                    }
                                  : { // Not Configured
                                      backgroundColor: 'rgba(74, 74, 72, 0.1)',
                                      color: '#6b7280',
                                      borderColor: 'rgba(74, 74, 72, 0.3)'
                                    }
                              }
                            >
                              Rate Freeze
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent style={{ backgroundColor: '#1a1a1a', borderColor: '#2a2a2a' }}>
                            <p style={{ fontSize: '12px', color: '#e5e5e5' }}>
                              {hotel.status?.hasRateFreeze ? 'Rate Freeze Period is active' : 'No Rate Freeze set'}
                            </p>
                          </TooltipContent>
                        </Tooltip>

                        {/* Differentials Icon */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge 
                              variant="outline" 
                              style={
                                hotel.status?.hasDifferentials
                                  ? { // Configured
                                      backgroundColor: 'rgba(57, 189, 248, 0.1)',
                                      color: '#39BDF8',
                                      borderColor: 'rgba(57, 189, 248, 0.3)'
                                    }
                                  : { // Not Configured
                                      backgroundColor: 'rgba(74, 74, 72, 0.1)',
                                      color: '#6b7280',
                                      borderColor: 'rgba(74, 74, 72, 0.3)'
                                    }
                              }
                            >
                              Differentials
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent style={{ backgroundColor: '#1a1a1a', borderColor: '#2a2a2a' }}>
                            <p style={{ fontSize: '12px', color: '#e5e5e5' }}>
                              {hotel.status?.hasDifferentials ? 'Room Differentials configured' : 'No Differentials set'}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                </AccordionTrigger>

                {/* [FIX] This is the correct AccordionContent, with the form *inside* it */}
                <AccordionContent 
                  style={{ backgroundColor: '#141414', padding: '1.5rem 1rem 1rem 2rem' }}
                >
                  {/* Show loader OR content */}
                  {loadingHotelId === String(hotel.hotel_id) ? (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '3rem' }}>
                      <Loader2 style={{ width: '1.5rem', height: '1.5rem', color: '#39BDF8', animation: 'spin 1s linear infinite' }} />
                      <span style={{ color: '#9ca3af', marginLeft: '0.75rem' }}>Loading Configuration...</span>
                    </div>
                  ) : (
                    <> 
                      {/* [FIX] The entire form content now lives inside the content pane */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        
         {/* Compact Settings + Guardrails Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                          {/* Sentinel AI Status */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '0.5rem' }}>
                            <Label htmlFor={`sentinel-status-${hotel.hotel_id}`} style={{ color: '#e5e5e5', fontSize: '0.875rem' }}>
                              Sentinel AI
                            </Label>
                            <Switch
                              id={`sentinel-status-${hotel.hotel_id}`}
                              checked={hotelConfigState[hotel.hotel_id]?.sentinel_enabled || false}
                              onCheckedChange={(isChecked) => handleConfigChange(String(hotel.hotel_id), 'sentinel_enabled', isChecked)}
                            />
                          </div>
                          
                          {/* [REMOVED] The "Min Rate" div was here */}

                          {/* Max Rate */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                            <Label htmlFor={`max-rate-ceiling-${hotel.hotel_id}`} style={{ color: '#9ca3af', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              Max Rate
                            </Label>
                            <div style={{ position: 'relative' }}>
                              <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: '0.875rem' }}>$</span>
                              <Input
                                id={`max-rate-ceiling-${hotel.hotel_id}`}
                                type="number"
                                value={hotelConfigState[hotel.hotel_id]?.guardrail_max || ''}
                                onChange={(e) => handleConfigChange(String(hotel.hotel_id), 'guardrail_max', e.target.value)}
                                style={{ 
                                  backgroundColor: '#0f0f0f',
                                  paddingLeft: '1.75rem' // [FIX] Added inline padding
                                }}
                                className="border-[#2a2a2a] text-[#e5e5e5] focus:border-[#39BDF8]/50 h-9 text-sm"
                              />
                            </div>
                          </div>
                          {/* Rate Freeze Period */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                              <Label htmlFor={`freeze-period-${hotel.hotel_id}`} style={{ color: '#9ca3af', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Rate Freeze Period
                              </Label>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <HelpCircle style={{ width: '0.75rem', height: '0.75rem', color: '#9ca3af', cursor: 'help' }} />
                                  </TooltipTrigger>
                                  <TooltipContent style={{ backgroundColor: '#1a1a1a', borderColor: '#2a2a2a', maxWidth: '280px' }}>
                                    <p style={{ fontSize: '0.75rem', color: '#e5e5e5' }}>
                                      Sentinel AI will not update rates for arrivals within this many days. Use this to prevent last-minute rate changes.
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                            <div style={{ position: 'relative' }}>
                              <Input
                                id={`freeze-period-${hotel.hotel_id}`}
                                type="number"
                                value={hotelConfigState[hotel.hotel_id]?.rate_freeze_period || ''}
                                onChange={(e) => handleConfigChange(String(hotel.hotel_id), 'rate_freeze_period', e.target.value)}
                                min="0"
                                max="30"
                                style={{ backgroundColor: '#0f0f0f' }}
                                className="border-[#2a2a2a] text-[#e5e5e5] focus:border-[#39BDF8]/50 pr-12 h-9 text-sm"
                              />
                              <span style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: '0.75rem' }}>days</span>
                            </div>
                          </div>
                        </div>

                        {/* Divider */}
                        <div style={{ borderTop: '1px solid #2a2a2a' }}></div>

                        {/* Last-Minute Floor Rate Section */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingTop: '0.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                              <h3 style={{ color: '#e5e5e5', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.75rem' }}>Last-Minute Floor Rate</h3>
                              <p style={{ color: '#9ca3af', fontSize: '10px', marginTop: '0.125rem' }}>Override min rate close to arrival if occupancy is low</p>
                            </div>
                            <Switch
                              checked={hotelConfigState[hotel.hotel_id]?.last_minute_floor?.enabled || false}
                              onCheckedChange={(isChecked) => handleConfigChange(String(hotel.hotel_id), 'last_minute_floor.enabled', isChecked)}
                            />
                          </div>

                          {hotelConfigState[hotel.hotel_id]?.last_minute_floor?.enabled && (
                            <div style={{ background: '#0f0f0f', border: '1px solid rgba(249,115,22,0.3)', borderRadius: '0.5rem', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                              {/* Rate and Days Grid */}
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                                  <Label htmlFor={`last-minute-rate-${hotel.hotel_id}`} style={{ color: '#9ca3af', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Floor Rate
                                  </Label>
                                  <div style={{ position: 'relative' }}>
                                    <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: '0.875rem' }}>$</span>
                                    <Input
                                      id={`last-minute-rate-${hotel.hotel_id}`}
                                      type="number"
                                      value={hotelConfigState[hotel.hotel_id]?.last_minute_floor?.rate || ''}
                                      onChange={(e) => handleConfigChange(String(hotel.hotel_id), 'last_minute_floor.rate', e.target.value)}
                                      style={{ backgroundColor: '#1a1a1a' }}
                                      className="border-[#2a2a2a] text-[#e5e5e5] focus:border-[#f97316]/50 pl-7 h-9 text-sm"
                                    />
                                  </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                                  <Label htmlFor={`last-minute-days-${hotel.hotel_id}`} style={{ color: '#9ca3af', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Activate Within
                                  </Label>
                                  <div style={{ position: 'relative' }}>
                                    <Input
                                      id={`last-minute-days-${hotel.hotel_id}`}
                                      type="number"
                                      value={hotelConfigState[hotel.hotel_id]?.last_minute_floor?.days || ''}
                                      onChange={(e) => handleConfigChange(String(hotel.hotel_id), 'last_minute_floor.days', e.target.value)}
                                      min="1"
                                      max="30"
                                      style={{ backgroundColor: '#1a1a1a' }}
                                      className="border-[#2a2a2a] text-[#e5e5e5] focus:border-[#f97316]/50 pr-12 h-9 text-sm"
                                    />
                                    <span style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: '0.75rem' }}>days</span>
                                  </div>
                                </div>
                              </div>
                              {/* Days of Week Selector */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <Label style={{ color: '#9ca3af', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                  Active Days of Week
                                </Label>
                                <div style={{ display: 'flex', gap: '0.375rem' }}>
                                  {[
                                    { key: 'mon', label: 'Mon' }, { key: 'tue', label: 'Tue' }, { key: 'wed', label: 'Wed' },
                                    { key: 'thu', label: 'Thu' }, { key: 'fri', label: 'Fri' }, { key: 'sat', label: 'Sat' }, { key: 'sun', label: 'Sun' },
                                  ].map((day) => {
                                    const isActive = hotelConfigState[hotel.hotel_id]?.last_minute_floor?.dow.includes(day.key) || false;
                                    const inactiveStyle: CSSProperties = {
                                      flex: 1, padding: '0.5rem', borderRadius: '0.25rem', fontSize: '0.75rem', transition: 'all 0.2s',
                                      border: '2px solid #2a2a2a', background: '#1a1a1a', color: '#9ca3af', cursor: 'pointer'
                                    };
                                    const activeStyle: CSSProperties = {
                                      ...inactiveStyle, border: '2px solid rgba(249,115,22,0.5)', background: 'rgba(249,115,22,0.2)', color: '#f97316',
                                    };
                                    return (
                                      <button
                                        key={day.key}
                                        onClick={() => toggleDayOfWeek(String(hotel.hotel_id), day.key)}
                                        style={isActive ? activeStyle : inactiveStyle}
                                      >
                                        {day.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                              {/* Helper Text */}
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', padding: '0.625rem', background: 'rgba(249,115,22,0.05)', border: '1px solid rgba(249,115,22,0.2)', borderRadius: '0.25rem', color: '#f97316' }}>
                                <div style={{ fontSize: '10px', lineHeight: '1.625' }}>
                                  <span style={{ fontWeight: 600 }}>Strategy:</span> Within {hotelConfigState[hotel.hotel_id]?.last_minute_floor?.days || '?'} days of arrival, AI can drop to ${hotelConfigState[hotel.hotel_id]?.last_minute_floor?.rate || '?'} on{' '}
                                  {(hotelConfigState[hotel.hotel_id]?.last_minute_floor?.dow.length || 0) === 7 ? 'any day' :
                                  (hotelConfigState[hotel.hotel_id]?.last_minute_floor?.dow.length || 0) === 0 ? 'no days (disabled)' :
                                  hotelConfigState[hotel.hotel_id]?.last_minute_floor?.dow.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(', ')} to maximize occupancy.
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Divider */}
                        <div style={{ borderTop: '1px solid #2a2a2a' }}></div>

                        {/* Room Differentials Section */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingTop: '0.5rem' }}>
                          <button 
                            onClick={() => setRoomDifferentialsExpanded(!roomDifferentialsExpanded)}
                            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'opacity 0.2s', cursor: 'pointer', background: 'transparent', border: 'none' }}
                          >
                            <h3 style={{ color: '#e5e5e5', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.75rem' }}>Room Differentials</h3>
                            {roomDifferentialsExpanded ? (
                              <ChevronUp style={{ width: '1rem', height: '1rem', color: '#9ca3af' }} />
                            ) : (
                              <ChevronDown style={{ width: '1rem', height: '1rem', color: '#9ca3af' }} />
                            )}
                          </button>
                    <div style={{ background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '0.5rem', padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            {/* Base room - always visible */}
                            {/* [MODIFIED] Loop over REAL room types from state */}
                            {(hotelConfigState[hotel.hotel_id]?.pms_room_types?.data || [])
                              .filter((room: any) => room.roomTypeID === hotelConfigState[hotel.hotel_id]?.base_room_type_id)
                              .map((room: any) => (
                                <div 
                                  key={room.roomTypeID}
                                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', padding: '0.375rem', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '0.25rem' }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
                                    <RadioGroup 
                                      value={hotelConfigState[hotel.hotel_id]?.base_room_type_id} 
                                      onValueChange={(val) => handleConfigChange(String(hotel.hotel_id), 'base_room_type_id', val)}
                                    >
                                      <div style={{ display: 'flex', alignItems: 'center' }}>
                             <RadioGroupItem
                                          value={room.roomTypeID}
                                          id={`base-${room.roomTypeID}-${hotel.hotel_id}`}
                                          style={{ borderColor: '#39BDF8', color: '#39BDF8', height: '0.75rem', width: '0.75rem' }}
                                        />
                                      </div>
                                    </RadioGroup>
                           <Label htmlFor={`base-${room.roomTypeID}-${hotel.hotel_id}`} style={{ color: '#e5e5e5', cursor: 'pointer', fontSize: '0.75rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {room.roomTypeName}
                                    </Label>
                                    <Badge variant="outline" style={{ backgroundColor: 'rgba(57, 189, 248, 0.1)', color: '#39BDF8', borderColor: 'rgba(57, 189, 248, 0.3)', fontSize: '10px', padding: '0 0.375rem' }}>
                                      Base
                                    </Badge>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Select 
     value={
       (hotelConfigState[hotel.hotel_id]?.room_differentials?.find((r: any) => r.roomTypeId === room.roomTypeID) || {}).operator || '+'
     }
     onValueChange={(newValue) => handleDifferentialChange(String(hotel.hotel_id), room.roomTypeID, 'operator', newValue)}
>
     <SelectTrigger style={{ width: '6rem', backgroundColor: '#0f0f0f' }} className="h-9 border-[#2a2a2a] text-[#e5e5e5] text-sm">
       <SelectValue />
                                      </SelectTrigger>
                </Select>
                                  <div style={{ position: 'relative', width: '5rem' }}>
    <Input
      type="number"
      value={
        (hotelConfigState[hotel.hotel_id]?.room_differentials?.find((r: any) => r.roomTypeId === room.roomTypeID) || {}).value || '15'
      }
  onChange={(e) => handleDifferentialChange(String(hotel.hotel_id), room.roomTypeID, 'value', e.target.value)}
      style={{ backgroundColor: '#0f0f0f' }}
                                        className="border-[#2a2a2a] text-[#e5e5e5] focus:border-[#39BDF8]/50 pr-5 pl-1.5 h-9 text-sm disabled:opacity-50"
                                      />
                                      <span style={{ position: 'absolute', right: '0.375rem', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: '10px' }}>%</span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            
            {/* Other rooms - collapsible */}
                            {roomDifferentialsExpanded && (hotelConfigState[hotel.hotel_id]?.pms_room_types?.data || [])
                              .filter((room: any) => room.roomTypeID !== hotelConfigState[hotel.hotel_id]?.base_room_type_id)
                              .map((room: any) => (
                                <div 
                                  key={room.roomTypeID}
                                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', padding: '0.375rem', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '0.25rem' }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
                                    <RadioGroup 
                                      value={hotelConfigState[hotel.hotel_id]?.base_room_type_id} 
                                      onValueChange={(val) => handleConfigChange(String(hotel.hotel_id), 'base_room_type_id', val)}
                                    >
                                      <div style={{ display: 'flex', alignItems: 'center' }}>
                                      <RadioGroupItem
                                          value={room.roomTypeID}
                                          id={`base-${room.roomTypeID}-${hotel.hotel_id}`}
                                          style={{ borderColor: '#39BDF8', color: '#39BDF8', height: '0.75rem', width: '0.75rem' }}
                                        />
                                      </div>
                                    </RadioGroup>
                                  <Label htmlFor={`base-${room.roomTypeID}-${hotel.hotel_id}`} style={{ color: '#e5e5e5', cursor: 'pointer', fontSize: '0.75rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {room.roomTypeName}
                                    </Label>
                                  </div>
                             <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <Select 
                                      value={
                                        (hotelConfigState[hotel.hotel_id]?.room_differentials?.find((r: any) => r.roomTypeId === room.roomTypeID) || {}).operator || '+'
                                      }
                             onValueChange={(newValue) => handleDifferentialChange(String(hotel.hotel_id), room.roomTypeID, 'operator', newValue)}
                                    >
                                      <SelectTrigger style={{ width: '6rem', backgroundColor: '#0f0f0f' }} className="h-9 border-[#2a2a2a] text-[#e5e5e5] text-sm">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent style={{ backgroundColor: '#1a1a1a', borderColor: '#2a2a2a' }} className="border-[#2a2a2a]">
                                        <SelectItem value="+" className="text-[#e5e5e5] text-xs">+</SelectItem>
                                        <SelectItem value="-" className="text-[#e5e5e5] text-xs">-</SelectItem>
                                      </SelectContent>
                             </Select>
                                  <div style={{ position: 'relative', width: '5rem' }}>
                                      <Input
                                        type="number"
                                        value={
                                          (hotelConfigState[hotel.hotel_id]?.room_differentials?.find((r: any) => r.roomTypeId === room.roomTypeID) || {}).value || '15'
                                     }
                                        onChange={(e) => handleDifferentialChange(String(hotel.hotel_id), room.roomTypeID, 'value', e.target.value)}
                                        style={{ backgroundColor: '#0f0f0f' }}
                                        className="border-[#2a2a2a] text-[#e5e5e5] focus:border-[#39BDF8]/50 pr-5 pl-1.5 h-9 text-sm"
                                      />
                                      <span style={{ position: 'absolute', right: '0.375rem', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: '10px' }}>%</span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>

                        {/* Divider */}
                        <div style={{ borderTop: '1px solid #2a2a2a' }}></div>

                        {/* Monthly Aggression Levels */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingTop: '0.5rem' }}>
                          <h3 style={{ color: '#e5e5e5', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.75rem' }}>Monthly Aggression Levels</h3>
                          <div style={{ background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '0.5rem', padding: '1rem' }}>
                            {/* Visual Month Bar */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '0.5rem' }}>
                              {Object.entries(hotelConfigState[hotel.hotel_id]?.monthly_aggression || {}).map(([monthValue, level]) => {
                                const colors = getAggressionColor(level as string);
                                return (
                                  <button
                                    key={monthValue}
                                    style={{
                                      position: 'relative', padding: '0.75rem', borderRadius: '0.5rem',
                                      border: `2px solid ${colors.border}`, background: colors.bg,
                                      transition: 'all 0.2s', cursor: 'pointer'
                                    }}
                                    onClick={() => handleAggressionClick(String(hotel.hotel_id), monthValue)}
                                  >
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                                      <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: colors.text }}>
                                        {monthValue.charAt(0).toUpperCase() + monthValue.slice(1, 3)}
                                      </span>
                                      <div style={{ width: '0.375rem', height: '0.375rem', borderRadius: '50%', background: colors.text }} />
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                            {/* Legend */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', paddingTop: '0.75rem', borderTop: '1px solid #2a2a2a', marginTop: '1rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <div style={{ width: '0.75rem', height: '0.75rem', borderRadius: '50%', background: '#10b981' }} />
                                <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Low Aggression</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <div style={{ width: '0.75rem', height: '0.75rem', borderRadius: '50%', background: '#faff6a' }} />
                                <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Medium Aggression</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <div style={{ width: '0.75rem', height: '0.75rem', borderRadius: '50%', background: '#ef4444' }} />
                                <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>High Aggression</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Monthly Min Rates */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          <h3 style={{ color: '#e5e5e5', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.75rem' }}>Monthly Min Rates</h3>
                          <div style={{ background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '0.5rem', padding: '1rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '0.5rem' }}>
                              {Object.keys(hotelConfigState[hotel.hotel_id]?.monthly_min_rates || {}).map((monthValue) => (
                                <div key={monthValue} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.375rem' }}>
                                  <span style={{ color: '#9ca3af', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    {monthValue.charAt(0).toUpperCase() + monthValue.slice(1, 3)}
                                  </span>
                                  <div style={{ position: 'relative', width: '100%' }}>
                                    <span style={{ position: 'absolute', left: '0.375rem', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: '10px' }}>$</span>
                                    <Input
                                      type="number"
                                      value={hotelConfigState[hotel.hotel_id]?.monthly_min_rates[monthValue] || ''}
                                      onChange={(e) => handleConfigChange(String(hotel.hotel_id), `monthly_min_rates.${monthValue}`, e.target.value)}
                                      style={{
                                        backgroundColor: '#1a1a1a', borderColor: '#2a2a2a', color: '#e5e5e5',
                                        paddingLeft: '1rem', paddingRight: '0.25rem', height: '1.75rem',
                                        fontSize: '10px', textAlign: 'center'
                                      }}
                                      className="focus:border-[#39BDF8]/50"
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Divider */}
                        <div style={{ borderTop: '1px solid #2a2a2a' }}></div>

            {/* Admin Control Buttons */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingTop: '1rem' }}>
                          <h3 style={{ color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.75rem' }}>Admin Controls</h3>
                          <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <Button 
                              variant="outline" 
                              style={{ backgroundColor: '#161616', borderColor: 'rgba(57, 189, 248, 0.5)', color: '#39BDF8' }}
                        onClick={() => handleSyncFacts(hotel)}
                              disabled={isSyncing === String(hotel.hotel_id)}
                            >
                              {isSyncing === String(hotel.hotel_id) ? (
                                <Loader2 style={{ width: '1rem', height: '1rem', marginRight: '0.5rem', animation: 'spin 1s linear infinite' }} />
                              ) : null}
                              Sync with PMS
                            </Button>
                            <Button variant="outline" style={{ backgroundColor: 'rgba(250, 255, 106, 0.1)', borderColor: 'rgba(250, 255, 106, 0.5)', color: '#faff6a' }}>
                              Re-Push All Rates
                            </Button>
                            <Button variant="outline" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.5)', color: '#ef4444' }}>
                              Force Sync
                            </Button>
                          </div>
                        </div>
{/* Save Button */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '1rem' }}>
                          <Button 
                            style={{ backgroundColor: '#39BDF8', color: '#0f0f0f' }}
                            onClick={() => handleSaveRules(String(hotel.hotel_id))}
                            disabled={isSaving === String(hotel.hotel_id)}
                          >
                            {isSaving === String(hotel.hotel_id) ? (
                              <Loader2 style={{ width: '1rem', height: '1rem', marginRight: '0.5rem', animation: 'spin 1s linear infinite' }} />
                            ) : null}
                            Save Changes
                          </Button>
                        </div>

                      </div>
                    </> 
                  )} {/* [FIX] This closes the ternary AND the missing fragment */}
                </AccordionContent>
  </AccordionItem>
            ))}
          </Accordion>
    )} {/* [NEW] Closes the !isLoadingConfigs conditional render */}
        </div>

        {/* Section 3: Webhook Status (Future) */}
        {/* <-- [MODIFIED] Added inline style */}
<Card style={{ backgroundColor: '#1a1a1a', borderColor: '#2a2a2a' }}>
  <CardHeader>
    <CardTitle style={{ color: '#e5e5e5', fontSize: '1.25rem' }}>PMS Webhook Management</CardTitle>
    <CardDescription style={{ color: '#9ca3af' }}>
      Monitor and manage PMS webhook integration status
    </CardDescription>
  </CardHeader>
          <CardContent>
            <div style={{ border: '1px solid #2a2a2a', borderRadius: '0.5rem', overflow: 'hidden' }}>
              <Table>
        <TableHeader>
  <TableRow className="border-[#2a2a2a] hover:bg-transparent">
    <TableHead style={{ color: '#9ca3af' }}>Property Name</TableHead>
    <TableHead style={{ color: '#9ca3af' }}>Webhook Status</TableHead>
    <TableHead style={{ color: '#9ca3af', textAlign: 'right' }}>Actions</TableHead>
  </TableRow>
</TableHeader>
        <TableBody>
  {webhooks.map((webhook) => (
    <TableRow key={webhook.id} className="border-[#2a2a2a] hover:bg-[#161616]">
      <TableCell style={{ color: '#e5e5e5' }}>{webhook.propertyName}</TableCell>
      <TableCell>
        {webhook.status === 'success' ? (
          <Badge 
            variant="outline" 
            style={{
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              color: '#10b981',
              borderColor: 'rgba(16, 185, 129, 0.3)'
            }}
          >
            Active
          </Badge>
        ) : (
          <Badge 
            variant="outline" 
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              color: '#ef4444',
              borderColor: 'rgba(239, 68, 68, 0.3)'
            }}
          >
            Error
          </Badge>
        )}
      </TableCell>
                      <TableCell className="text-right">
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
         <Button
  variant="ghost"
  size="sm"
  style={{ color: '#39BDF8' }}
  className="hover:text-[#29ADEE] hover:bg-[#39BDF8]/10"
>
  Register
</Button>
<Button
  variant="ghost"
  size="sm"
  style={{ color: '#faff6a' }}
  className="hover:text-[#faff6a]/80 hover:bg-[#faff6a]/10"
>
  Test
</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add Event Dialog */}
      <Dialog open={isAddEventOpen} onOpenChange={setIsAddEventOpen}>
        {/* <-- [MODIFIED] Added inline style */}
        <DialogContent style={{ backgroundColor: '#1a1a1a', borderColor: '#2a2a2a' }} className="bg-[#1a1a1a] border-[#2a2a2a]">
<DialogHeader>
  <DialogTitle style={{ color: '#e5e5e5', fontSize: '1.25rem' }}>Add New Event</DialogTitle>
  <DialogDescription style={{ color: '#9ca3af' }}>
    Add a manual event to the selected market
  </DialogDescription>
</DialogHeader>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* ... (Dialog content: Inputs, Selects) ... */}
<div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
  <Label 
    htmlFor="event-date" 
    style={{ color: '#9ca3af', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}
  >
    Event Date
  </Label>

  <Input
    id="event-date"
    type="date"
    value={newEventDate}
    onChange={(e) => setNewEventDate(e.target.value)}
    style={{ 
      backgroundColor: '#0f0f0f',
      borderColor: '#2a2a2a',
      color: '#e5e5e5'
    }}
    className="focus:border-[#39BDF8]/50"
  />
</div>

<div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
  <Label 
    htmlFor="event-name" 
    style={{ color: '#9ca3af', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}
  >
    Event Name
  </Label>
  <Input
    id="event-name"
    type="text"
    value={newEventName}
    onChange={(e) => setNewEventName(e.target.value)}
    style={{ 
      backgroundColor: '#0f0f0f',
      borderColor: '#2a2a2a',
      color: '#e5e5e5'
    }}
    className="focus:border-[#39BDF8]/50"
  />
</div>
<div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
  <Label 
    htmlFor="event-impact" 
    style={{ color: '#9ca3af', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}
  >
    Event Impact
  </Label>
  <Select
    value={newEventImpact}
    onValueChange={setNewEventImpact}
  >
    <SelectTrigger 
      style={{ 
        width: '100%', 
        height: '2.25rem', 
        backgroundColor: '#0f0f0f', 
        borderColor: '#2a2a2a', 
        color: '#e5e5e5', 
        fontSize: '0.875rem' 
      }}
      className="disabled:opacity-50"
    >
      <SelectValue />
    </SelectTrigger>
   <SelectContent 
  style={{ backgroundColor: '#1a1a1a', borderColor: '#2a2a2a' }}
>
  <SelectItem value="High Demand">High Demand</SelectItem>
  <SelectItem value="Very High Demand">Very High Demand</SelectItem>
</SelectContent>
  </Select>
</div>
          </div>
<DialogFooter>
  <Button
    variant="outline"
    style={{
      backgroundColor: '#0f0f0f',
      borderColor: '#2a2a2a',
      color: '#e5e5e5'
    }}
    className="hover:bg-[#161616] hover:border-[#39BDF8]/50 hover:text-[#39BDF8]"
    onClick={() => setIsAddEventOpen(false)}
  >
    Cancel
  </Button>
  <Button
    style={{ backgroundColor: '#39BDF8', color: '#0f0f0f' }}
    className="hover:bg-[#29ADEE]"
    onClick={handleAddEvent}
  >
    Add Event
  </Button>
</DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}