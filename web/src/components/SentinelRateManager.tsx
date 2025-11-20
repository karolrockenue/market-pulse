import { useState, useRef, CSSProperties, useEffect, useMemo } from 'react';
import { Lock, User, Archive, AlertTriangle, ChevronLeft, ChevronRight, Zap, Activity, Calendar as CalendarIcon, DollarSign, TrendingUp, Settings, Info, PlayCircle, Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

// Import the styled shadcn/ui components
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Button } from './ui/button';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { format, addDays, isWithinInterval } from 'date-fns';
import { Input } from './ui/input';
import { OccupancyVisualizer } from './OccupancyVisualizer';

interface CalendarDay {
  date: string; // YYYY-MM-DD
  rate: number; // Our database's rate (Manual or AI)
  source: 'AI' | 'Manual' | 'External';
  liveRate: number; // The "live" rate from PMS
  
  // Fields to replicate mock data for UI rules
  dayOfWeek: string;
  dayOfWeekShort: string; // [NEW] e.g., 'sun', 'mon'
  dayNumber: number;
  month: string;
  isFrozen: boolean;

  // Mock data fields from prototype
  occupancy: number;
  adr: number;

  // [NEW] Real data fields
  guardrailMin: number;
  floorRateLMF: number | null; // Null if not active
}

// [NEW] Helper to format a Date object to YYYY-MM-DD
// [NEW] Helper to format a Date object to YYYY-MM-DD
// [FIX] Use date-fns format to ensure consistency with local timezone logic used elsewhere
// [FIX] Use UTC string construction to match Backend API exactly (YYYY-MM-DD)
const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

// --- NEW: Calculator Interfaces & Logic ---
interface Campaign {
  id: string;
  slug: string;
  name: string;
  discount: number;
  startDate: Date | undefined;
  endDate: Date | undefined;
  active: boolean;
}

interface CalculatorState {
  multiplier: number;
  campaigns: Campaign[];
  mobileActive: boolean;
  mobilePercent: number;
  nonRefundableActive: boolean;
  nonRefundablePercent: number;
  countryRateActive: boolean;
  countryRatePercent: number;
  testStayDate: Date | undefined;
}

const isCampaignValidForDate = (testDate: Date | undefined, camp: Campaign) => {
    if (!testDate || !camp.active || !camp.startDate || !camp.endDate) return false;
    try {
      return isWithinInterval(testDate, { start: camp.startDate, end: camp.endDate });
    } catch {
      return false;
    }
};

const calculateSellRate = (pmsRate: number, geniusPct: number, state: CalculatorState, dateStr: string) => {
    if (!pmsRate) return 0;
    const cellDate = new Date(dateStr);

    // 1. Apply Multiplier (Assume LiveRate is the PMS rate input)
    let currentRate = pmsRate * state.multiplier;

    // 2. Apply Non-Ref
    if (state.nonRefundableActive) {
        currentRate = currentRate * (1 - Number(state.nonRefundablePercent) / 100);
    }

    // 3. Check Deep Deals
    const deepDeal = state.campaigns.find(c => ['black-friday', 'limited-time'].includes(c.slug) && isCampaignValidForDate(cellDate, c));

    if (deepDeal) {
        currentRate = currentRate * (1 - Number(deepDeal.discount) / 100);
    } else {
        // A. Genius
        if (geniusPct > 0) {
            currentRate = currentRate * (1 - Number(geniusPct) / 100);
        }
        // B. Campaign
        const validStandard = state.campaigns.filter(c => !['black-friday', 'limited-time'].includes(c.slug) && isCampaignValidForDate(cellDate, c));
        if (validStandard.length > 0) {
             const best = validStandard.reduce((p, c) => (p.discount > c.discount) ? p : c);
             currentRate = currentRate * (1 - Number(best.discount) / 100);
        }
        // C. Mobile
        const isMobileBlocked = !!deepDeal || validStandard.some(c => ['early-deal', 'late-escape', 'getaway-deal'].includes(c.slug));
        if (state.mobileActive && !isMobileBlocked) {
             currentRate = currentRate * (1 - Number(state.mobilePercent) / 100);
        }
        // D. Country
        if (state.countryRateActive) { 
             currentRate = currentRate * (1 - Number(state.countryRatePercent) / 100);
        }
    }
    return currentRate;
};

export function SentinelRateManager({ allHotels = [] }: { allHotels: any[] }) {
  // --- Component State ---
const [activeSentinelHotels, setActiveSentinelHotels] = useState<any[]>([]);
  // [MODIFIED] Initialize from localStorage to persist selection across navigation
  const [selectedHotelId, setSelectedHotelId] = useState<string>(() => {
    return localStorage.getItem('sentinel_last_hotel_id') || '';
  });
  // [NEW] State to hold the map of hotel_id -> pms_property_id
  // [NEW] State to hold the map of hotel_id -> pms_property_id
  const [pmsIdMap, setPmsIdMap] = useState<Record<string, string>>({});
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [nightsToView, setNightsToView] = useState('30');
  
  // [NEW] State for the 365-day calendar data
  const [calendarData, setCalendarData] = useState<CalendarDay[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // [MODIFIED] Manual overrides now use the date string (YYYY-MM-DD) as the key
// [MODIFIED] State is now split:
  const [savedOverrides, setSavedOverrides] = useState<Record<string, number>>({}); // Holds "padlocked" rates from DB
  const [pendingOverrides, setPendingOverrides] = useState<Record<string, number>>({}); // Holds new changes not yet submitted
  const [editingCell, setEditingCell] = useState<string | null>(null); // Uses date string
  
const [hoveredColumn, setHoveredColumn] = useState<string | null>(null); // Uses date string
  
  // [NEW] Calculator State
  const [activeCalculatorState, setActiveCalculatorState] = useState<CalculatorState | null>(null);
  const [activeGeniusPct, setActiveGeniusPct] = useState<number>(0);
  // In web/src/components/SentinelRateManager.tsx
  const isEscaping = useRef(false);
  const [hiddenRows, setHiddenRows] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);


  // --- Data Fetching and Memoization ---

// [Replace With]
  // [MODIFIED] Effect to fetch active Sentinel hotels AND the PMS ID map
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch configs and ID map in parallel
        const [configResponse, idMapResponse] = await Promise.all([
          fetch('/api/sentinel/configs'),
          fetch('/api/sentinel/pms-property-ids') // [NEW] Fetch the ID map
        ]);

        if (!configResponse.ok) throw new Error('Failed to fetch configs');
        if (!idMapResponse.ok) throw new Error('Failed to fetch PMS ID map');

        const configResult = await configResponse.json();
        const idMapResult = await idMapResponse.json();

        // Set the ID map state
        if (idMapResult.success && idMapResult.data) {
          setPmsIdMap(idMapResult.data);
        }

// Set the active hotels state
        const configs = (configResult && Array.isArray(configResult.data)) ? configResult.data : [];
        setActiveSentinelHotels(configs);
        
        if (configs.length > 0) {
          // [MODIFIED] Check if the stored ID is valid for the current user's list
          const storedId = localStorage.getItem('sentinel_last_hotel_id');
          const isStoredValid = storedId && configs.some(c => c.hotel_id.toString() === storedId);

          if (isStoredValid) {
            setSelectedHotelId(storedId as string);
          } else if (!selectedHotelId) {
            // Only default to first if no valid selection exists
            const defaultId = configs[0].hotel_id.toString();
            setSelectedHotelId(defaultId);
            localStorage.setItem('sentinel_last_hotel_id', defaultId);
          }
        }
      } catch (error) {
        console.error("Error fetching Sentinel data:", error);
      }
    };
    fetchData();
  }, []); // Runs once on component mount

  // [MODIFIED] Memoized data for the selected hotel
// [Replace With]
  // [MODIFIED] Memoized data for the selected hotel
// [Replace With]
  // [MODIFIED] Memoized data for the selected hotel
  const selectedHotelData = useMemo(() => {
    const config = activeSentinelHotels.find(h => h.hotel_id.toString() === selectedHotelId);
    if (!config) return null;
    
    // Get name from allHotels, but get PMS ID from the new pmsIdMap
    const details = allHotels.find(h => h.hotel_id === config.hotel_id);
    const pmsId = pmsIdMap[config.hotel_id] || null;
    
    return {
      hotel_id: config.hotel_id,
      base_room_type_id: config.base_room_type_id,
      property_name: details ? details.property_name : `Hotel ID: ${config.hotel_id}`,
      pms_property_id: pmsId,
      config: config // [NEW] Pass the entire config object
    };
  }, [selectedHotelId, activeSentinelHotels, allHotels, pmsIdMap]);

  // [NEW] Memoized list for the hotel dropdown
  const hotelDropdownList = useMemo(() => {
    return activeSentinelHotels.map(config => {
      const hotelDetails = allHotels.find(h => h.hotel_id === config.hotel_id);
      return {
        hotel_id: config.hotel_id,
        property_name: hotelDetails ? hotelDetails.property_name : `Hotel ID: ${config.hotel_id}`
      };
    });
  }, [activeSentinelHotels, allHotels]);

// [MODIFIED] Handler for the "Load Rates" button
// [MODIFIED] Handler for the "Load Rates" button
// [MODIFIED] Handler for the "Load Rates" button
 // In SentinelRateManager.tsx
// [MODIFIED] Added 'keepPending' flag to support smooth submit transitions
  const handleLoadRates = async (showToast = true, showGridLoader = true, keepPending = false) => {
    if (!selectedHotelId) {
      if (showToast) toast.error('No hotel selected.');
      setCalendarData([]); 
      return;
    }
    
    const currentConfigInState = activeSentinelHotels.find(h => h.hotel_id.toString() === selectedHotelId);
    const base_room_type_id = currentConfigInState?.base_room_type_id;

    if (!base_room_type_id) {
      toast.error('Selected hotel has no "Base Room Type" configured.');
      setCalendarData([]);
      return;
    }
    
    const hotel_id = parseInt(selectedHotelId, 10);
    if (showGridLoader) setIsLoading(true);
    setError(null);
    
    if (!keepPending) setPendingOverrides({});

    try {
      // Define the 365-day window for stats
// [FIX] Define 365-day window using UTC to align with Backend
      const today = new Date();
      const utcToday = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
      const endOfWindow = new Date(utcToday);
      endOfWindow.setUTCDate(utcToday.getUTCDate() + 365);
      
      const startStr = utcToday.toISOString().split('T')[0];
      const endStr = endOfWindow.toISOString().split('T')[0];

   // 1. PARALLEL FETCH: Config, Assets, and Dashboard Stats via Reports API
      const [configResponse, assetResponse, statsResponse] = await Promise.all([
        fetch(`/api/sentinel/config/${hotel_id}`),
        fetch('/api/property-hub/assets'),
        // [UPDATED] Use Reports API (POST) to get robust data and avoid 500 errors
        fetch('/api/reports/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                propertyId: hotel_id,
                startDate: startStr,
                endDate: endStr,
                granularity: 'daily',
                metrics: {
                    hotel: ['rooms-sold', 'rooms-unsold', 'adr'] 
                },
                includeTaxes: true // This forces Gross ADR
            })
        })
      ]);

      // Process Config
      const configResult = await configResponse.json();
      if (!configResponse.ok || !configResult.success) throw new Error(configResult.message || 'Failed to fetch configuration.');
      const configData = configResult.data;

      // Process Assets (Calculator Settings)
      if (assetResponse.ok) {
        const assets = await assetResponse.json();
        const match = assets.find((a: any) => String(a.market_pulse_hotel_id) === String(hotel_id));
        if (match) {
            const s = match.calculator_settings || {};
            setActiveCalculatorState({
                multiplier: match.strategic_multiplier ? parseFloat(match.strategic_multiplier) : 1.3,
                campaigns: s.campaigns ? s.campaigns.map((c: any) => ({
                    ...c,
                    startDate: c.startDate ? new Date(c.startDate) : undefined,
                    endDate: c.endDate ? new Date(c.endDate) : undefined,
                    active: c.active ?? true
                })) : [],
                mobileActive: s.mobile?.active ?? true,
                mobilePercent: s.mobile?.percent ?? 10,
                nonRefundableActive: s.nonRef?.active ?? true,
                nonRefundablePercent: s.nonRef?.percent ?? 15,
                countryRateActive: s.country?.active ?? false,
                countryRatePercent: s.country?.percent ?? 5,
                testStayDate: undefined
            });
            setActiveGeniusPct(match.genius_discount_pct || 0);
        } else {
            setActiveCalculatorState(null);
        }
      }

      // Process Stats (Create a Map: Date -> { occ, adr })
      const statsMap: Record<string, { occupancy: number; adr: number }> = {};
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        
        if (Array.isArray(statsData)) {
            statsData.forEach((row: any) => {
    // Reports API returns "period" e.g. "2023-10-27 00:00:00+00" (Postgres format)
                // We split by space to extract just the date part.
       // [FIX] Use substring for robust date extraction (works with 'T' or space separator)
                const dateKey = row.period.substring(0, 10);
                
                // Calculate Occupancy Manually to avoid DB errors
                const sold = parseFloat(row['rooms-sold']) || 0;
                const unsold = parseFloat(row['rooms-unsold']) || 0;
                const totalCap = sold + unsold;
                const calculatedOcc = totalCap > 0 ? (sold / totalCap) * 100 : 0;

                statsMap[dateKey] = {
                    occupancy: calculatedOcc,
                    adr: parseFloat(row['adr']) || 0
                };
            });
        }
      }
      // 3. GENERATE SKELETON
      const { monthly_min_rates, last_minute_floor, rate_freeze_period, rate_overrides } = configData;
      setSavedOverrides(rate_overrides || {});

      const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
      const dayNamesShort = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
      const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
      const skeletonCalendar: CalendarDay[] = [];

      const lmfEnabled = last_minute_floor?.enabled || false;
      const lmfDays = parseInt(last_minute_floor?.days || '0', 10);
      const lmfRate = parseFloat(last_minute_floor?.rate || '0');
      const lmfDow = new Set(last_minute_floor?.dow || []);
      const monthlyRatesMap = monthly_min_rates || {};
      const freezePeriod = parseInt(rate_freeze_period || '0', 10);

for (let i = 0; i < 365; i++) {
        // [FIX] Generate dates in UTC
        const date = new Date(utcToday);
        date.setUTCDate(utcToday.getUTCDate() + i);
        
        const dateStr = date.toISOString().split('T')[0];
        const dayOfWeekShort = dayNamesShort[date.getUTCDay()];
        const monthKey = monthNames[date.getUTCMonth()].toLowerCase();
        const monthlyMinRate = parseFloat(monthlyRatesMap[monthKey] || '0');
        const isFrozen = i <= freezePeriod;

        let activeFloorRate = null;
        if (lmfEnabled && !isFrozen && i <= lmfDays && lmfDow.has(dayOfWeekShort)) activeFloorRate = lmfRate;
        
        // Lookup real stats or default to 0
        const daysStats = statsMap[dateStr] || { occupancy: 0, adr: 0 };

        skeletonCalendar.push({
          date: dateStr,
          rate: 0,
          source: 'External',
          liveRate: 0,
          dayOfWeek: dayNames[date.getUTCDay()],
          dayOfWeekShort: dayOfWeekShort,
          dayNumber: date.getUTCDate(),
          month: monthNames[date.getUTCMonth()],
          isFrozen: isFrozen,
          occupancy: daysStats.occupancy, // [UPDATED] Real data
          adr: daysStats.adr,             // [UPDATED] Real data
          guardrailMin: monthlyMinRate,
          floorRateLMF: activeFloorRate,
        });
      }

      // 4. FETCH & MERGE RATES
      const ratesResponse = await fetch(`/api/sentinel/rates/${hotel_id}/${base_room_type_id}`);
      const ratesResult = await ratesResponse.json();
      if (!ratesResponse.ok || !ratesResult.success) throw new Error(ratesResult.message || 'Failed to fetch rates.');

      const savedRateMap = ratesResult.data.reduce((acc: any, day: any) => {
        acc[day.date] = {
          rate: parseFloat(day.rate),
          source: day.source,
          liveRate: parseFloat(day.liveRate || 0),
        };
        return acc;
      }, {});

      const mergedCalendar = skeletonCalendar.map(day => {
        const savedData = savedRateMap[day.date];
        if (savedData) {
          return {
            ...day,
            rate: savedData.rate,
            source: savedData.source,
            liveRate: savedData.liveRate,
          };
        }
        return day;
      });
      
      setCalendarData(mergedCalendar);

      if (showToast) {
        const hotelName = currentConfigInState?.property_name || `Hotel ID ${hotel_id}`;
        toast.message(`Rate calendar loaded`, {
          description: `Live data for ${hotelName}`,
          icon: <Zap className="w-4 h-4 text-[#39BDF8]" />,
          style: {
            backgroundColor: '#0f151a',
            border: '1px solid rgba(57, 189, 248, 0.3)',
            color: '#e5e5e5',
          }
        });
      }

    } catch (err: any) {
      console.error("Error loading rates:", err);
      setError(err.message);
      toast.error('Failed to load rates', { description: err.message });
      setCalendarData([]);
    } finally {
      if (showGridLoader) setIsLoading(false);
    }
  };

  // [ADD THIS NEW FUNCTION]
  const handleOverrideKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    date: string,
    index: number
  ) => {
    // Helper function to save the current value
    const saveValue = () => {
      const value = e.currentTarget.value.trim();
      if (value === '' || value === '-') {
        handleRateClear(date);
      } else {
        handleRateChange(date, value);
      }
    };

    if (e.key === 'Tab') {
      e.preventDefault(); // Stop default browser tab
      saveValue(); // Save the cell you're leaving

      if (e.shiftKey) {
        // --- Move Left (Shift+Tab) ---
        const prevIndex = index - 1;
        if (prevIndex >= 0) {
          const prevDay = visibleCalendarData[prevIndex];
          setEditingCell(`override-${prevDay.date}`);
        } else {
          setEditingCell(null); // Tabbing off the front
        }
      } else {
        // --- Move Right (Tab) ---
        const nextIndex = index + 1;
        if (nextIndex < visibleCalendarData.length) {
          const nextDay = visibleCalendarData[nextIndex];
          setEditingCell(`override-${nextDay.date}`);
        } else {
          setEditingCell(null); // Tabbing off the end
        }
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      saveValue();
      setEditingCell(null); // Stop editing
// In web/src/components/SentinelRateManager.tsx
    } else if (e.key === 'Escape') {
      e.preventDefault();
      isEscaping.current = true; // Set flag
      setEditingCell(null); // Stop editing
    }
  };
  // [NEW] Handler for the "Submit Changes" button
// [Replace With]
 // [NEW] Optimistic "Fire-and-Forget" Submit Handler
  const handleSubmitChanges = async () => {
    if (!selectedHotelData || !selectedHotelData.pms_property_id) {
      toast.error('Wait for data to load.');
      return;
    }

    // 1. Snapshot the data to submit
    const overridesToSubmit = { ...pendingOverrides };
    const overrideList = Object.keys(overridesToSubmit).map(date => ({
      date: date,
      rate: overridesToSubmit[date],
    }));

    if (overrideList.length === 0) return;

    const { hotel_id, pms_property_id, base_room_type_id } = selectedHotelData;

    // 2. OPTIMISTIC UPDATE: Update UI immediately (Turn Yellow -> Blue)
    // We trust the queue will handle it.
    setSavedOverrides(prev => ({ ...prev, ...overridesToSubmit }));
    setPendingOverrides({}); // Clear pending to reset the button
    
    // Show a non-blocking toast
    toast.message('Syncing...', {
      description: `Queuing ${overrideList.length} rate updates in background.`,
    });

    setIsSubmitting(true);

    try {
      // 3. Call the "Producer" API (This returns instantly now)
      const response = await fetch('/api/sentinel/overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hotelId: hotel_id,
          pmsPropertyId: pms_property_id,
          roomTypeId: base_room_type_id,
          overrides: overrideList,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to queue changes.');
      }

// 4. Success Feedback (Sentinel Style)
      toast.message('Updates Queued', {
        description: 'The Sentinel Worker is processing your rates.',
        icon: <Zap className="w-4 h-4 text-[#39BDF8]" />,
        style: {
          backgroundColor: '#0f151a', // Dark blue-grey tint
          border: '1px solid rgba(57, 189, 248, 0.3)',
          color: '#e5e5e5',
        }
      });

      // Note: We do NOT reload rates here. 
      // The local UI is already up to date via the Optimistic Update.

    } catch (err: any) {
      console.error("Error submitting changes:", err);
      
      // Revert Strategy (Optional but recommended):
      // In a full prod app, we might revert the savedOverrides here.
      // For now, we alert the user to refresh.
      toast.error('Queue Failed', { 
        description: 'Please refresh the page to verify data.',
      });
      
      // Restore the pending overrides so user doesn't lose work
      setPendingOverrides(overridesToSubmit);
    } finally {
      setIsSubmitting(false);
    }
  };

// [MODIFIED] Rate change handlers now use date string as key
  const handleRateChange = (date: string, value: string) => {
    const numValue = parseFloat(value.replace('£', ''));
    if (!isNaN(numValue) && numValue > 0) {
      setPendingOverrides(prev => ({ ...prev, [date]: numValue })); // [MODIFIED]
    }
  };

  const handleRateClear = (date: string) => {
    setPendingOverrides(prev => { // [MODIFIED]
      const newOverrides = { ...prev };
      delete newOverrides[date];
      return newOverrides;
    });
  };

// [NEW] Memoized hook to filter the calendar by start date and nights (Grid View)
  const visibleCalendarData = useMemo(() => {
    const startIndex = calendarData.findIndex(day => day.date === formatDate(startDate));
    if (startIndex === -1) {
      // If start date isn't in data, try to find the first day *after* it
      const formattedStartDate = formatDate(startDate);
      const firstAvailableIndex = calendarData.findIndex(day => day.date >= formattedStartDate);
      if (firstAvailableIndex === -1) return [];
      
      const endIndex = Math.min(firstAvailableIndex + parseInt(nightsToView, 10), calendarData.length);
      return calendarData.slice(firstAvailableIndex, endIndex);
    }
    
    const endIndex = Math.min(startIndex + parseInt(nightsToView, 10), calendarData.length);
    return calendarData.slice(startIndex, endIndex);
  }, [calendarData, startDate, nightsToView]);

  // [NEW] Visualizer specific dataset (Always 90 days)
  const visualizerData = useMemo(() => {
    const startIndex = calendarData.findIndex(day => day.date === formatDate(startDate));
    const daysToShow = 90;

    if (startIndex === -1) {
      const formattedStartDate = formatDate(startDate);
      const firstAvailableIndex = calendarData.findIndex(day => day.date >= formattedStartDate);
      if (firstAvailableIndex === -1) return [];
      
      const endIndex = Math.min(firstAvailableIndex + daysToShow, calendarData.length);
      return calendarData.slice(firstAvailableIndex, endIndex);
    }
    
    const endIndex = Math.min(startIndex + daysToShow, calendarData.length);
    return calendarData.slice(startIndex, endIndex);
  }, [calendarData, startDate]);

const toggleRowVisibility = (rowId: string) => {
    setHiddenRows(prev => {
      const newHidden = new Set(prev);
      if (newHidden.has(rowId)) {
        newHidden.delete(rowId);
      } else {
        newHidden.add(rowId);
      }
      return newHidden;
    });
  };

  // [NEW] Calculate the index for the visualizer based on the hovered date string in the grid
  const hoveredDayIndex = useMemo(() => {
    if (!hoveredColumn) return null;
    return visibleCalendarData.findIndex(day => day.date === hoveredColumn);
  }, [hoveredColumn, visibleCalendarData]);

  // Styles
  const containerStyle: CSSProperties = {
    minHeight: '100vh',
    backgroundColor: '#1d1d1c',
    position: 'relative',
    overflow: 'hidden',
  };

  const backgroundGradientStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(to bottom right, rgba(57, 189, 248, 0.05), transparent, rgba(250, 255, 106, 0.05))',
  };

  const gridOverlayStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    backgroundImage: 'linear-gradient(rgba(57, 189, 248, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(57, 189, 248, 0.03) 1px, transparent 1px)',
    backgroundSize: '64px 64px',
  };

  const contentWrapperStyle: CSSProperties = {
    position: 'relative',
    zIndex: 10,
    padding: '32px',
    maxWidth: '1800px',
    margin: '0 auto',
  };

  const headerStyle: CSSProperties = {
    marginBottom: '24px',
  };

  const titleStyle: CSSProperties = {
    color: '#e5e5e5',
    fontSize: '24px',
    letterSpacing: '-0.025em',
    marginBottom: '4px',
  };

  const subtitleStyle: CSSProperties = {
    color: '#9ca3af',
    fontSize: '12px',
  };

  const cardStyle: CSSProperties = {
    backgroundColor: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: '8px',
    marginBottom: '24px',
    padding: '20px',
  };

  const flexBetweenStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: '16px',
  };

  const flexRowStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '16px',
  };

  const formGroupStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  };

  const labelStyle: CSSProperties = {
    color: '#9ca3af',
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  };

  const gridSectionStyle: CSSProperties = {
    backgroundColor: '#1a1a1a',
    borderRadius: '8px',
    border: '1px solid #2a2a2a',
    padding: '16px',
  };

  const rowVisibilityContainerStyle: CSSProperties = {
    marginBottom: '16px',
    padding: '12px',
    backgroundColor: '#1A1A1A',
    border: '1px solid #2a2a2a',
    borderRadius: '8px',
  };

  const rowVisibilityInnerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  };

  const rowVisibilityLeftStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '24px',
  };

  const rowVisibilityLabelStyle: CSSProperties = {
    fontSize: '12px',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  };

  const rowVisibilityButtonsStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  };

  const getToggleButtonStyle = (isHidden: boolean): CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 10px',
    borderRadius: '4px',
    fontSize: '12px',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s',
    backgroundColor: isHidden ? '#2a2a2a' : 'rgba(57, 189, 248, 0.1)',
    color: isHidden ? '#6b7280' : '#39BDF8',
  });

const gridContainerStyle: CSSProperties = {
    position: 'relative', // [NEW] Anchor for overlay
    minHeight: '400px',   // [NEW] Prevent collapse
    backgroundColor: '#1a1a1a',
    borderRadius: '8px',
    border: '1px solid #2a2a2a',
    overflow: 'hidden',
  };

const tableWrapperStyle: CSSProperties = {
    overflowX: 'auto',
    paddingBottom: '4px', // Give the scrollbar some breathing room
  };

const tableStyle: CSSProperties = {
    width: '100%',
    fontSize: '13px',
    tableLayout: 'fixed',
    minWidth: `${240 + (visibleCalendarData.length * 84)}px`, // [UPDATED] Increased first col width
  };

const thStyle: CSSProperties = {
    backgroundColor: '#1A1A1A',
    borderBottom: '1px solid #2a2a2a',
    position: 'sticky',
    left: 0,
    textAlign: 'left',
    color: '#9ca3af',
    padding: '12px 16px',
    borderRight: '1px solid #2a2a2a',
    zIndex: 10,
    width: '240px', // [UPDATED] Increased width
  };

  const getColumnHeaderStyle = (isSelected: boolean, isOddMonth: boolean): CSSProperties => ({
    position: 'relative',
    textAlign: 'center',
    padding: '12px 8px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    backgroundColor: isSelected ? 'rgba(58, 58, 53, 0.3)' : isOddMonth ? '#1a1a18' : '#1A1A1A',
    width: '84px',
  });

const tdStickyStyle: CSSProperties = {
    position: 'sticky',
    left: 0,
    backgroundColor: '#1A1A1A',
    color: '#e5e5e5',
    padding: '12px 16px',
    borderRight: '1px solid #2a2a2a',
    zIndex: 10,
    width: '240px', // [UPDATED] Increased width
  };

  const getCellStyle = (isSelected: boolean, additionalBg?: string): CSSProperties => ({
    textAlign: 'center',
    padding: '12px 8px',
    borderRight: '1px solid #2a2a2a',
    cursor: 'pointer',
    transition: 'all 0.2s',
    backgroundColor: isSelected ? 'rgba(57, 189, 248, 0.1)' : additionalBg || 'transparent',
    width: '84px',
  });

  const inputCellStyle: CSSProperties = {
    width: '100%',
    backgroundColor: '#0f0f0f',
    border: '1px solid #2a2a2a',
    textAlign: 'center',
    fontFamily: 'monospace',
    fontSize: '13px',
    color: '#e5e5e5',
    outline: 'none',
    borderRadius: '4px',
    padding: '2px 4px',
  };

return (
    <div style={containerStyle}>
      {/* [NEW] Inject Scrollbar Styles */}
      <style>{`
        /* Custom Sentinel Scrollbar */
        ::-webkit-scrollbar {
          height: 8px;
          width: 8px;
        }
        ::-webkit-scrollbar-track {
          background: #1a1a1a;
          border-top: 1px solid #2a2a2a;
        }
        ::-webkit-scrollbar-thumb {
          background: #333;
          border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #39BDF8;
        }
      `}</style>
      <div style={backgroundGradientStyle}></div>
      <div style={gridOverlayStyle}></div>

      <div style={contentWrapperStyle}>
        {/* Page Header */}
        <div style={headerStyle}>
          <h1 style={titleStyle}>Sentinel Rate Manager</h1>
          <p style={subtitleStyle}>Super Admin • 365-Day Rate Calendar • AI + Manual Control</p>
        </div>
        {/* Hotel Selection Card */}
        <div style={cardStyle}>
          <div style={flexBetweenStyle}>
            <div style={flexRowStyle}>
              {/* Hotel Dropdown */}
    <div style={formGroupStyle}>
                <label style={labelStyle}>Select Hotel</label>
                <Select 
                  value={selectedHotelId}
                  onValueChange={(val) => {
                    setSelectedHotelId(val);
                    localStorage.setItem('sentinel_last_hotel_id', val);
                  }}
                >
                  <SelectTrigger 
                    className="w-56 h-9 bg-[#0f0f0f] border-[#2a2a2a] text-[#e5e5e5] text-sm"
                    style={{ backgroundColor: '#0f0f0f', borderColor: '#2a2a2a', color: '#e5e5e5' }}
                  >
                    <SelectValue placeholder="Select hotel..." />
                  </SelectTrigger>
                  <SelectContent 
                    className="bg-[#1a1a18] border-[#2C2C2C] text-[#e5e5e5]"
                    style={{ backgroundColor: '#1a1a18', borderColor: '#2C2C2C' }}
                  >
                    {hotelDropdownList.map((hotel) => (
                      <SelectItem key={hotel.hotel_id} value={hotel.hotel_id.toString()}>
                        {hotel.property_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Start Date Picker */}
              <div style={formGroupStyle}>
                <label style={labelStyle}>Start Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-56 h-9 bg-[#0f0f0f] border-[#2a2a2a] text-[#e5e5e5] text-sm justify-start font-normal hover:bg-[#0f0f0f] hover:text-[#e5e5e5]"
                      style={{ backgroundColor: '#0f0f0f', borderColor: '#2a2a2a', color: '#e5e5e5' }}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(startDate, 'dd MMM yyyy')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent 
                    className="w-auto p-0 bg-[#1a1a18] border-[#2C2C2C] text-[#e5e5e5]"
                    style={{ backgroundColor: '#1a1a18', borderColor: '#2C2C2C' }}
                  >
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={(day) => day && setStartDate(day)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Nights Dropdown */}
              <div style={formGroupStyle}>
                <label style={labelStyle}>Nights</label>
                <Select 
                  value={nightsToView}
                  onValueChange={setNightsToView}
                >
                  <SelectTrigger 
                    className="w-123 h-9 bg-[#0f0f0f] border-[#2a2a2a] text-[#e5e5e5] text-sm"
                    style={{ backgroundColor: '#0f0f0f', borderColor: '#2a2a2a', color: '#e5e5e5' }}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent 
                    className="bg-[#1a1a18] border-[#2C2C2C] text-[#e5e5e5]"
                    style={{ backgroundColor: '#1a1a18', borderColor: '#2C2C2C' }}
                  >
                    <SelectItem value="30">30 Nights</SelectItem>
                    <SelectItem value="60">60 Nights</SelectItem>
                    <SelectItem value="90">90 Nights</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

{/* Load Rates Button */}
  
            <Button
              className="h-9 bg-[#39BDF8] text-[#1d1d1c] hover:bg-[#39BDF8]/90 text-sm"
              style={{ backgroundColor: '#39BDF8', color: '#1d1d1c' }}
              onClick={() => handleLoadRates(true, true)}
              disabled={isLoading || isSubmitting || !selectedHotelId || !selectedHotelData?.base_room_type_id}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Zap className="w-4 h-4 mr-2" />
              )}
              {isLoading ? 'Loading...' : 'Load Rates'}
            </Button>
          </div>
        </div>

    
{/* [MODIFIED] Grid Section - Only renders when data is loaded */}
        {calendarData.length > 0 ? (
          <>
{/* [NEW] Occupancy Visualizer */}
            <OccupancyVisualizer 
              selectedHotel={selectedHotelData?.property_name || 'Selected Hotel'} 
              startDate={startDate}
              hoveredDay={hoveredDayIndex}
              data={visualizerData}
            />

            <div style={gridSectionStyle}>
              {/* Row Visibility Controls */}
              <div style={rowVisibilityContainerStyle}>
            <div style={rowVisibilityInnerStyle}>
              <div style={rowVisibilityLeftStyle}>
                <span style={rowVisibilityLabelStyle}>Row Visibility:</span>
               
         <div style={rowVisibilityButtonsStyle}>
                  {/* [NEW] ADR Toggle from Prototype */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleRowVisibility('adr')}
                    className={hiddenRows.has('adr') ? 'text-[#6b7280]' : 'text-[#39BDF8] bg-[#39BDF8]/10'}
                    style={getToggleButtonStyle(hiddenRows.has('adr'))}
                  >
                    {hiddenRows.has('adr') ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span style={{ marginLeft: '6px' }}>ADR</span>
                  </Button>
                  
                  {/* [NEW] Occupancy Toggle from Prototype */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleRowVisibility('occupancy')}
                    className={hiddenRows.has('occupancy') ? 'text-[#6b7280]' : 'text-[#39BDF8] bg-[#39BDF8]/10'}
                    style={getToggleButtonStyle(hiddenRows.has('occupancy'))}
                  >
                    {hiddenRows.has('occupancy') ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span style={{ marginLeft: '6px' }}>Occupancy</span>
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleRowVisibility('minRate')}
                    className={hiddenRows.has('minRate') ? 'text-[#6b7280]' : 'text-[#39BDF8] bg-[#39BDF8]/10'}
                    style={getToggleButtonStyle(hiddenRows.has('minRate'))}
                  >
                    {hiddenRows.has('minRate') ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span style={{ marginLeft: '6px' }}>Min Rate</span>
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleRowVisibility('floorRate')}
                    className={hiddenRows.has('floorRate') ? 'text-[#6b7280]' : 'text-[#39BDF8] bg-[#39BDF8]/10'}
                    style={getToggleButtonStyle(hiddenRows.has('floorRate'))}
                  >
                    {hiddenRows.has('floorRate') ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                 <span style={{ marginLeft: '6px' }}>Floor Rate</span>
                  </Button>

                  {/* [NEW] Data 1 Toggle from Prototype */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleRowVisibility('data1')}
                    className={hiddenRows.has('data1') ? 'text-[#6b7280]' : 'text-[#39BDF8] bg-[#39BDF8]/10'}
                    style={getToggleButtonStyle(hiddenRows.has('data1'))}
                  >
                    {hiddenRows.has('data1') ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span style={{ marginLeft: '6px' }}>Data 1</span>
                  </Button>

                  {/* [NEW] Data 2 Toggle from Prototype */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleRowVisibility('data2')}
                    className={hiddenRows.has('data2') ? 'text-[#6b7280]' : 'text-[#39BDF8] bg-[#39BDF8]/10'}
                    style={getToggleButtonStyle(hiddenRows.has('data2'))}
                  >
                    {hiddenRows.has('data2') ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span style={{ marginLeft: '6px' }}>Data 2</span>
                  </Button>

                  {/* [NEW] Data 3 Toggle from Prototype */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleRowVisibility('data3')}
                    className={hiddenRows.has('data3') ? 'text-[#6b7280]' : 'text-[#39BDF8] bg-[#39BDF8]/10'}
                    style={getToggleButtonStyle(hiddenRows.has('data3'))}
                  >
                    {hiddenRows.has('data3') ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span style={{ marginLeft: '6px' }}>Data 3</span>
                  </Button>
                </div>
              </div>
{/* Submit Button */}
              <Button
                className="h-9 bg-[#39BDF8] text-[#1d1d1c] hover:bg-[#39BDF8]/90 text-sm"
                style={{ backgroundColor: '#39BDF8', color: '#1d1d1c' }}
                onClick={handleSubmitChanges}
           // [Replace With]
                disabled={
                  isLoading || 
                  isSubmitting || 
                  Object.keys(pendingOverrides).length === 0 || // [MODIFIED]
                  !selectedHotelData?.pms_property_id 
                }
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Lock className="w-4 h-4 mr-2" />
                )}
                {/* [MODIFIED] Count PENDING overrides */ }
                {isSubmitting ? 'Submitting...' : `Submit ${Object.keys(pendingOverrides).length} Change(s)`}
              </Button>
            </div>
          </div>

          {/* Grid Container */}
          <div style={gridContainerStyle}>
 {/* [NEW] Loading Overlay (Graceful) */}
            {isLoading && (
              <div style={{ 
                position: 'absolute',
                inset: 0,
                zIndex: 50, // Above sticky headers
                backgroundColor: 'rgba(26, 26, 26, 0.65)', // Semi-transparent dark
                backdropFilter: 'blur(2px)', // Graceful blur
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: '12px', 
                color: '#39BDF8' // Sentinel Blue
              }}>
                <Loader2 className="w-6 h-6 animate-spin" />
                <span style={{fontSize: '14px', fontWeight: 500, letterSpacing: '0.02em'}}>Syncing 365-Day Calendar...</span>
              </div>
            )}
            {error && !isLoading && (
              <div style={{ height: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', color: '#ef4444' }}>
                <AlertTriangle className="w-5 h-5" />
                <span>Error Loading Rates</span>
                <span style={{ color: '#9ca3af', fontSize: '12px', maxWidth: '600px', textAlign: 'center' }}>{error}</span>
                <Button variant="outline" onClick={handleLoadRates} className="h-8 text-xs">Try Again</Button>
              </div>
            )}


      
              <div style={tableWrapperStyle} ref={scrollRef}>
                <table style={tableStyle}>
            <thead>
                    <tr style={{ backgroundColor: '#1A1A1A', borderBottom: '1px solid #2a2a2a' }}>
                      <th style={thStyle}>
                        <span style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Metric</span>
                      </th>
                      {/* [MODIFIED] Loop over visibleCalendarData, use day.date as key */}
                      {visibleCalendarData.map((day) => {
                        const isSelected = hoveredColumn === day.date;
                        const isFirstOfMonth = day.dayNumber === 1;
                        const monthNumber = new Date(day.date + 'T00:00:00Z').getUTCMonth();
                        const isOddMonth = monthNumber % 2 === 1;
                        
                        // [FIX] Use the new refactored states
                        const hasPendingOverride = pendingOverrides[day.date] !== undefined;
                        const hasSavedOverride = savedOverrides[day.date] !== undefined;
                        const hasAnyOverride = hasPendingOverride || hasSavedOverride;
                        
                        return (
                          <th 
                            key={day.date}
                            onMouseEnter={() => setHoveredColumn(day.date)}
                            onMouseLeave={() => setHoveredColumn(null)}
                            style={{
                              ...getColumnHeaderStyle(isSelected, isOddMonth),
                              borderRight: isFirstOfMonth ? '2px solid #2a2a2a' : '1px solid #2a2a2a',
                            }}
                          >
                            <div style={{ color: '#6b7280', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                              {day.month}
                            </div>
                            <div style={{ fontSize: '12px', color: '#e5e5e5' }}>
                              {day.dayOfWeek}
                            </div>
                            <div style={{ color: '#9ca3af', fontSize: '12px', marginTop: '4px' }}>{day.dayNumber}</div>
                            
                            {/* [FIX] Show icon if pending (yellow) or saved (grey) */}
                            {hasAnyOverride && (
                              <div style={{ position: 'absolute', top: '6px', right: '6px' }}>
                                <User style={{ width: '12px', height: '12px', color: hasPendingOverride ? '#faff6a' : '#9ca3af', opacity: 0.6 }} />
                              </div>
                            )}
                          </th>
                  );
                      })}
                    </tr>

             
                  </thead>
                  <tbody>
{/* Row 0: AI Status */}
                    <tr style={{ borderBottom: '1px solid #2a2a2a', backgroundColor: 'rgba(26, 26, 26, 0.2)' }}>
                      <td style={tdStickyStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '13px', color: '#6b7280' }}>AI Status</span>
                        </div>
                      </td>
                      {/* [MODIFIED] Loop over visibleCalendarData */}
                      {visibleCalendarData.map((day) => {
                        const isSelected = hoveredColumn === day.date;
                        const hasPendingOverride = pendingOverrides[day.date] !== undefined; // [MODIFIED]
                        
                        let statusText = 'AI';
                        let statusColor = '#39BDF8';
                        let bgColor = undefined;
                        
                        // [FIX] Logic order updated
                        if (day.isFrozen) {
                          statusText = 'FROZEN';
                          statusColor = '#f59e0b';
                          bgColor = 'rgba(245, 158, 11, 0.04)';
                        } else if (day.source === 'Manual') { 
                          statusText = 'MANUAL';
                          statusColor = '#9ca3af';
                          bgColor = 'rgba(229, 229, 229, 0.03)';
                        } else if (hasPendingOverride) { // [MODIFIED] Checks pending state
                          statusText = 'PENDING'; // Pending manual override
                          statusColor = '#faff6a';
                          bgColor = 'rgba(250, 255, 106, 0.03)';
                        } else if (day.source === 'External') {
                          statusText = 'EXTERNAL';
                          statusColor = '#6b7280';
                          bgColor = 'rgba(107, 114, 128, 0.03)';
                        } else {
                          // Default to AI
                          statusText = 'AI';
                          statusColor = '#39BDF8';
                          bgColor = 'rgba(57, 189, 248, 0.03)';
                        }
                        
                        return (
                          <td 
                            key={day.date}
                            onMouseEnter={() => setHoveredColumn(day.date)}
                            onMouseLeave={() => setHoveredColumn(null)}
                            style={{
                              ...getCellStyle(isSelected, bgColor),
                              position: 'relative',
                            }}
                          >
                            {/* [FIX] Show lock for Frozen OR Manual */}
                            {(day.isFrozen || day.source === 'Manual') && ( 
                              <div style={{ position: 'absolute', top: '4px', right: '4px' }}>
                                <Lock style={{ width: '10px', height: '10px', color: day.isFrozen ? '#f59e0b' : '#9ca3af', opacity: 0.6 }} />
                              </div>
                            )}
                            <div style={{ fontSize: '9px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.05em', color: statusColor }}>
                              {statusText}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                    {/* [NEW] Row 1: ADR (From Prototype) */}
                    {!hiddenRows.has('adr') && (
                      <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
                        <td style={tdStickyStyle}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <TrendingUp style={{ width: '16px', height: '16px', color: '#9ca3af' }} />
                            <span style={{ fontSize: '13px' }}>ADR</span>
                            <button
                              onClick={() => toggleRowVisibility('adr')}
                              style={{ marginLeft: 'auto', padding: '2px', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '4px' }}
                            >
                              <Eye style={{ width: '14px', height: '14px', color: '#6b7280' }} />
                            </button>
                          </div>
                        </td>
                        {visibleCalendarData.map((day) => {
                          const isSelected = hoveredColumn === day.date;
                          
                          return (
                            <td 
                              key={day.date}
                              onMouseEnter={() => setHoveredColumn(day.date)}
                              onMouseLeave={() => setHoveredColumn(null)}
                              style={{
                                ...getCellStyle(isSelected),
                                opacity: day.isFrozen ? 0.4 : 1,
                              }}
                            >
                              <div style={{ fontSize: '12px', color: '#e5e5e5' }}>
                                £{Math.round(day.adr)}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    )}

                    {/* [NEW] Row 2: Occupancy (From Prototype) */}
                    {!hiddenRows.has('occupancy') && (
                      <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
                        <td style={tdStickyStyle}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Activity style={{ width: '16px', height: '16px', color: '#9ca3af' }} />
                            <span style={{ fontSize: '13px' }}>Occupancy</span>
                            <button
                              onClick={() => toggleRowVisibility('occupancy')}
                              style={{ marginLeft: 'auto', padding: '2px', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '4px' }}
                            >
                              <Eye style={{ width: '14px', height: '14px', color: '#6b7280' }} />
                            </button>
                          </div>
                        </td>
                        {visibleCalendarData.map((day) => {
                          const isSelected = hoveredColumn === day.date;
                          
                          return (
                            <td 
                              key={day.date}
                              onMouseEnter={() => setHoveredColumn(day.date)}
                              onMouseLeave={() => setHoveredColumn(null)}
                              style={{
                                ...getCellStyle(isSelected),
                                opacity: day.isFrozen ? 0.4 : 1,
                              }}
                            >
                              <div style={{ fontSize: '13px', color: day.occupancy > 80 ? '#10b981' : day.occupancy > 60 ? '#faff6a' : '#ef4444' }}>
                                {Math.round(day.occupancy)}%
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    )}

                    {/* [NEW] Row 2.1: Data 1 (From Prototype) */}
                    {!hiddenRows.has('data1') && (
                      <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
                        <td style={tdStickyStyle}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '13px', color: '#6b7280' }}>Data 1</span>
                            <button
                              onClick={() => toggleRowVisibility('data1')}
                              style={{ marginLeft: 'auto', padding: '2px', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '4px' }}
                            >
                              <Eye style={{ width: '14px', height: '14px', color: '#6b7280' }} />
                            </button>
                          </div>
                        </td>
                        {visibleCalendarData.map((day) => {
                          const isSelected = hoveredColumn === day.date;
                          
                          return (
                            <td 
                              key={day.date}
                              onMouseEnter={() => setHoveredColumn(day.date)}
                              onMouseLeave={() => setHoveredColumn(null)}
                              style={getCellStyle(isSelected)}
                            >
                              <div style={{ fontSize: '12px', color: '#4a4a48' }}>-</div>
                            </td>
                          );
                        })}
                      </tr>
                    )}

                    {/* [NEW] Row 2.2: Data 2 (From Prototype) */}
                    {!hiddenRows.has('data2') && (
                      <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
                        <td style={tdStickyStyle}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '13px', color: '#6b7280' }}>Data 2</span>
                            <button
                              onClick={() => toggleRowVisibility('data2')}
                              style={{ marginLeft: 'auto', padding: '2px', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '4px' }}
                            >
                              <Eye style={{ width: '14px', height: '14px', color: '#6b7280' }} />
                            </button>
                          </div>
                        </td>
                        {visibleCalendarData.map((day) => {
                          const isSelected = hoveredColumn === day.date;
                          
                          return (
                            <td 
                              key={day.date}
                              onMouseEnter={() => setHoveredColumn(day.date)}
                              onMouseLeave={() => setHoveredColumn(null)}
                              style={getCellStyle(isSelected)}
                            >
                              <div style={{ fontSize: '12px', color: '#4a4a48' }}>-</div>
                            </td>
                          );
                        })}
                      </tr>
                    )}

{/* [MOVED] Row 2.1: Min Rate (Guardrail) */}
                    {!hiddenRows.has('minRate') && (
                      <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
                        <td style={tdStickyStyle}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '13px', color: '#6b7280' }}>Min Rate (Guardrail)</span>
                            <button
                              onClick={() => toggleRowVisibility('minRate')}
                              style={{ marginLeft: 'auto', padding: '2px', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '4px' }}
                            >
                              <Eye style={{ width: '14px', height: '14px', color: '#6b7280' }} />
                            </button>
                          </div>
                        </td>
                        {visibleCalendarData.map((day) => {
                          const isSelected = hoveredColumn === day.date;
                          
                          return (
                            <td 
                              key={day.date}
                              onMouseEnter={() => setHoveredColumn(day.date)}
                              onMouseLeave={() => setHoveredColumn(null)}
                              style={getCellStyle(isSelected)}
                            >
                              {/* [NEW] Render real data */}
                              <div style={{ fontSize: '12px', color: day.guardrailMin > 0 ? '#6b7280' : '#4a4a48', fontFamily: 'monospace' }}>
                                {day.guardrailMin > 0 ? `£${day.guardrailMin}` : '-'}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    )}


          {/* [MOVED] Row 2.2: Floor Rate (LMF) */}
                    {!hiddenRows.has('floorRate') && (
                      <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
                        <td style={tdStickyStyle}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '13px', color: '#6b7280' }}>Floor Rate (LMF)</span>
                            <button
                              onClick={() => toggleRowVisibility('floorRate')}
                              style={{ marginLeft: 'auto', padding: '2px', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '4px' }}
                            >
                              <Eye style={{ width: '14px', height: '14px', color: '#6b7280' }} />
                            </button>
                          </div>
                        </td>
                        {visibleCalendarData.map((day) => {
                          const isSelected = hoveredColumn === day.date;
                          const isActive = day.floorRateLMF !== null;
                          
                          return (
                            <td 
                              key={day.date}
                              onMouseEnter={() => setHoveredColumn(day.date)}
                              onMouseLeave={() => setHoveredColumn(null)}
                              style={getCellStyle(isSelected, isActive ? 'rgba(249, 115, 22, 0.05)' : undefined)}
                            >
                              {/* [NEW] Render real computed data */}
                              <div style={{ fontSize: '12px', color: isActive ? '#f97316' : '#4a4a48', fontFamily: 'monospace' }}>
                                {isActive ? `£${day.floorRateLMF}` : '-'}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    )}

    {/* [NEW] Separator Row */}
    <tr style={{ height: '12px', backgroundColor: '#1a1a1a' }}>
      <td colSpan={visibleCalendarData.length + 1} style={{ borderBottom: '1px dashed #2a2a2a' }}></td>
    </tr>

{/* [UPDATED] Row 2.3: Current PMS Rates (Renamed) */}
    {!hiddenRows.has('data3') && (
      <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
        <td style={tdStickyStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Zap style={{ width: '14px', height: '14px', color: '#6b7280' }} />
            <span style={{ fontSize: '13px', color: '#6b7280' }}>Current PMS Rates</span>
            <button
              onClick={() => toggleRowVisibility('data3')}
              style={{ marginLeft: 'auto', padding: '2px', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '4px' }}
            >
              <Eye style={{ width: '14px', height: '14px', color: '#6b7280' }} />
            </button>
          </div>
        </td>
        {visibleCalendarData.map((day) => {
          const isSelected = hoveredColumn === day.date;
          return (
            <td 
              key={day.date}
              onMouseEnter={() => setHoveredColumn(day.date)}
              onMouseLeave={() => setHoveredColumn(null)}
              style={getCellStyle(isSelected)}
            >
              <div style={{ fontSize: '12px', color: day.liveRate > 0 ? '#e5e5e5' : '#4a4a48', fontFamily: 'monospace' }}>
                {day.liveRate > 0 ? `£${day.liveRate}` : '-'}
              </div>
            </td>
          );
        })}
      </tr>
    )}

    {/* [MOVED & RENAMED] Current Sell Rate (Calculated) */}
    <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
      <td style={tdStickyStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', color: '#10b981' }}>Current Sell Rate</span>
          <Info style={{ width: '12px', height: '12px', color: '#6b7280' }} />
        </div>
      </td>
      {visibleCalendarData.map((day) => {
        const isSelected = hoveredColumn === day.date;
        // Calculate the rate
        let calculated = 0;
        if (activeCalculatorState && day.liveRate > 0) {
            calculated = calculateSellRate(day.liveRate, activeGeniusPct, activeCalculatorState, day.date);
        }

        return (
          <td 
            key={day.date}
            onMouseEnter={() => setHoveredColumn(day.date)}
            onMouseLeave={() => setHoveredColumn(null)}
            style={{
              ...getCellStyle(isSelected),
              opacity: day.isFrozen ? 0.4 : 1,
            }}
          >
            <div style={{ 
                fontSize: '12px', 
                color: calculated > 0 ? '#10b981' : '#4a4a48', 
                fontFamily: 'monospace',
                fontWeight: calculated > 0 ? 'bold' : 'normal'
            }}>
              {calculated > 0 ? `£${Math.round(calculated)}` : '-'}
            </div>
          </td>
        );
      })}
    </tr>

{/* Old Min/Floor Removed */}
                    {/* Empty Space Row */}
                    <tr style={{ backgroundColor: '#1A1A1A' }}>
                      <td colSpan={visibleCalendarData.length + 1} style={{ height: '16px' }}></td>
                    </tr>

{/* [MOVED] Effective Rate removed from here */}
                    


{/* Row 5: Sentinel AI Rate (Future Placeholder) */}
                    <tr style={{ borderBottom: '2px solid rgba(57, 189, 248, 0.4)', backgroundColor: 'rgba(57, 189, 248, 0.02)' }}>
                      <td style={{ ...tdStickyStyle, padding: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Zap style={{ width: '16px', height: '16px', color: '#39BDF8' }} />
                          <span style={{ fontSize: '13px', fontWeight: 600 }}>Sentinel AI Rate</span>
                        </div>
                      </td>
                      {visibleCalendarData.map((day) => {
                        const isSelected = hoveredColumn === day.date;
                        const isFirstOfMonth = day.dayNumber === 1;
                        
                        return (
                          <td 
                            key={day.date}
                            onMouseEnter={() => setHoveredColumn(day.date)}
                            onMouseLeave={() => setHoveredColumn(null)}
                            style={{
                              textAlign: 'center',
                              padding: '16px 8px',
                              cursor: 'default',
                              transition: 'all 0.2s',
                              backgroundColor: isSelected ? 'rgba(57, 189, 248, 0.1)' : 'rgba(57, 189, 248, 0.02)',
                              width: '84px',
                              borderRight: isFirstOfMonth ? '2px solid #2a2a2a' : '1px solid #2a2a2a',
                            }}
                          >
                            {/* [UPDATED] Empty placeholder for future AI integration */}
                            <div style={{ fontSize: '14px', color: '#4a4a48', fontWeight: 600 }}>
                              -
                            </div>
                          </td>
                        );
                      })}
                    </tr>


{/* Empty Space Row */}
                    <tr style={{ backgroundColor: '#1A1A1A' }}>
                      <td colSpan={visibleCalendarData.length + 1} style={{ height: '16px' }}></td>
                    </tr>

{/* [NEW] Effective Sell Rate (Simulation) */}
    <tr style={{ borderBottom: '1px solid #2a2a2a', backgroundColor: 'rgba(16, 185, 129, 0.05)' }}>
      <td style={tdStickyStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', color: '#10b981' }}>Effective Sell Rate</span>
          <Info style={{ width: '12px', height: '12px', color: '#6b7280' }} />
        </div>
      </td>
      {visibleCalendarData.map((day) => {
        const isSelected = hoveredColumn === day.date;
        
        // Logic: Pending (Yellow) > Saved (White) > AI Rate (Blue)
        // This enables the "Real Time" simulation feeling as soon as you hit enter on an override
        const activeBase = pendingOverrides[day.date] ?? savedOverrides[day.date] ?? day.rate;

        let calculated = 0;
        if (activeCalculatorState && activeBase > 0) {
            calculated = calculateSellRate(activeBase, activeGeniusPct, activeCalculatorState, day.date);
        }

        return (
          <td 
            key={day.date}
            onMouseEnter={() => setHoveredColumn(day.date)}
            onMouseLeave={() => setHoveredColumn(null)}
            style={{
              ...getCellStyle(isSelected),
              opacity: day.isFrozen ? 0.4 : 1,
            }}
          >
            <div style={{ 
                fontSize: '12px', 
                color: calculated > 0 ? '#10b981' : '#4a4a48', 
                fontFamily: 'monospace',
                fontWeight: calculated > 0 ? 'bold' : 'normal'
            }}>
              {calculated > 0 ? `£${Math.round(calculated)}` : '-'}
            </div>
          </td>
        );
      })}
    </tr>

{/* Row 6: Override Row */}
                    <tr style={{ borderTop: '1px solid #2a2a2a', borderBottom: '1px solid #2a2a2a' }}>
                      <td style={tdStickyStyle}>
                        <span style={{ fontSize: '13px', color: '#6b7280' }}>Override</span>
                      </td>
                      {/* [MODIFIED] Added 'index' to the map function */}
                      {visibleCalendarData.map((day, index) => {
                        const isSelected = hoveredColumn === day.date;

                        // [MODIFIED] Read from both states
                        const hasPendingOverride = pendingOverrides[day.date] !== undefined;
                        const overrideValue = pendingOverrides[day.date] ?? savedOverrides[day.date];
                        const hasAnyOverride = overrideValue !== undefined;
                        
                        return (
                          <td 
                            key={day.date}
                            onMouseEnter={() => setHoveredColumn(day.date)}
                            onMouseLeave={() => setHoveredColumn(null)}
                            onClick={() => {
                              if (!day.isFrozen) {
                                setEditingCell(`override-${day.date}`);
                              }
                            }}
                            style={{
                              // [MODIFIED] Show yellow if PENDING, grey if just SAVED
                              ...getCellStyle(isSelected, hasPendingOverride ? 'rgba(250, 255, 106, 0.06)' : (hasAnyOverride ? 'rgba(229, 229, 229, 0.03)' : undefined)),
                              position: 'relative',
                              opacity: day.isFrozen ? 0.4 : 1,
                            }}
                          >
                            {day.isFrozen && (
                              <div style={{ position: 'absolute', top: '4px', right: '4px' }}>
                                <Lock style={{ width: '12px', height: '12px', color: '#f59e0b' }} />
                              </div>
                            )}
                            
                            {editingCell === `override-${day.date}` && !day.isFrozen ? (
                      // In web/src/components/SentinelRateManager.tsx
                           // In web/src/components/SentinelRateManager.tsx
                            <input
                                type="text"
                                defaultValue={overrideValue || ''}
                                placeholder="-"
                                autoFocus
                                onFocus={(e) => e.target.select()}
                                onKeyDown={(e) => handleOverrideKeyDown(e, day.date, index)}
                                onBlur={(e) => {
                                  // Check the "escape" flag
                                  if (isEscaping.current) {
                                    isEscaping.current = false; // Reset the flag
                                    return; // Do not save
                                  }
                                  
                                  // This is the "click away" logic
                                  const value = e.currentTarget.value.trim();
                                  if (value === '' || value === '-') {
                                    handleRateClear(day.date);
                                  } else {
                                    handleRateChange(day.date, value);
                                  }
                                  setEditingCell(null); // Stop editing
                                }}
                                style={inputCellStyle}
                              />
                            ) : (
                              <>
                                {hasAnyOverride ? ( // [MODIFIED]
                                  <div style={{ 
                                    fontSize: '13px', 
                                    fontFamily: 'monospace', 
                                    // [MODIFIED] Yellow for pending, white for saved
                                    color: hasPendingOverride ? '#faff6a' : '#e5e5e5', 
                                    fontWeight: hasPendingOverride ? 'bold' : 'normal' 
                                  }}>
                                    £{overrideValue}
                                  </div>
                                ) : day.isFrozen ? (
                                  <div style={{ fontSize: '9px', color: '#4a4a48' }}>
                                    -
                                  </div>
                                ) : (
                                  <div style={{ fontSize: '12px', color: '#4a4a48' }}>
                                    -
                                  </div>
                                )}
                              </>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
        
 <div style={{ padding: '12px', backgroundColor: '#1A1A1A', borderTop: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#6b7280', fontSize: '12px' }}>
              <Info style={{ width: '14px', height: '14px' }} />
              <span>Scroll to view 365 days • Click 'Override' cells to set manual rates • Live PMS sync active</span>
            </div>
          </div>
        </div>
        </>
        ) : (
          // [NEW] Optional: A clean "Empty State" placeholder
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            height: '400px', 
            border: '1px dashed #2a2a2a', 
            borderRadius: '8px', 
            color: '#6b7280' 
          }}>
            <Zap className="w-12 h-12 mb-4 opacity-20" />
            <p>Select a hotel and click "Load Rates" to begin.</p>
          </div>
        )}
      </div>
    </div>
  );
}