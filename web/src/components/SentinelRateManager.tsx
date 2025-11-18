import { useState, useRef, CSSProperties, useEffect, useMemo } from 'react';
import { Lock, User, Archive, AlertTriangle, ChevronLeft, ChevronRight, Zap, Activity, Calendar as CalendarIcon, DollarSign, TrendingUp, Settings, Info, PlayCircle, Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

// Import the styled shadcn/ui components
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Button } from './ui/button';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { format, addDays } from 'date-fns';
import { Input } from './ui/input';

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
const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

export function SentinelRateManager({ allHotels = [] }: { allHotels: any[] }) {
  // --- Component State ---
  const [activeSentinelHotels, setActiveSentinelHotels] = useState<any[]>([]);
// [Replace With]
  const [selectedHotelId, setSelectedHotelId] = useState<string>(''); 
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
          setSelectedHotelId(configs[0].hotel_id.toString());
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
  const handleLoadRates = async (showToast = true, showGridLoader = true) => {
    // [FIX] We get hotel_id from state, not the memo, as memo might be stale
    if (!selectedHotelId) {
      if (showToast) toast.error('No hotel selected.');
      setCalendarData([]); // Clear grid
      return;
    }
    
    // [FIX] Find the base room ID from the *active configs* state
    const currentConfigInState = activeSentinelHotels.find(h => h.hotel_id.toString() === selectedHotelId);
    const base_room_type_id = currentConfigInState?.base_room_type_id;

    if (!base_room_type_id) {
      toast.error('Selected hotel has no "Base Room Type" configured.', {
        description: 'Please set the Base Room Type in the Sentinel ControlPanel.',
      });
      setCalendarData([]); // Clear grid
      return;
    }
    
    const hotel_id = parseInt(selectedHotelId, 10);

if (showGridLoader) 
  setIsLoading(true); // [FIX] Only show grid loader if requested
    setError(null);
    
    // We still clear pending changes on any load
    setPendingOverrides({}); 

    try {
      // --- THIS IS THE REAL FIX ---
      // 1. ALWAYS fetch the main config
      const configResponse = await fetch(`/api/sentinel/config/${hotel_id}`);
      const configResult = await configResponse.json(); // Get the full result

      if (!configResponse.ok || !configResult.success) {
        throw new Error(configResult.message || 'Failed to fetch fresh hotel configuration.');
      }
      
      // [!] CRITICAL FIX: Destructure from 'configResult.data', not the root object
      const configData = configResult.data;
      
      // 2. Destructure the FRESH rules from configData
      const { 
        monthly_min_rates,
        last_minute_floor,
        rate_freeze_period,
        rate_overrides // This is now guaranteed to be the latest from the DB
      } = configData;
      
      // 3. [CRITICAL FIX] Load "padlocked" overrides with a safety check
      if (rate_overrides) {
        setSavedOverrides(rate_overrides);
      } else {
        setSavedOverrides({}); // Use empty object, NOT null
      }
      // --- END FIX ---

      // 4. Generate the 365-day skeleton calendar
      const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
      const dayNamesShort = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
      const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
      const today = new Date(new Date().setHours(0, 0, 0, 0));
      const skeletonCalendar: CalendarDay[] = [];

      // Parse LMF rules from FRESH config
      const lmfEnabled = last_minute_floor?.enabled || false;
      const lmfDays = parseInt(last_minute_floor?.days || '0', 10);
      const lmfRate = parseFloat(last_minute_floor?.rate || '0');
      const lmfDow = new Set(last_minute_floor?.dow || []);
      
      // Get the monthly rates map from FRESH config
      const monthlyRatesMap = monthly_min_rates || {};

      // Get the real freeze period from FRESH config
      const freezePeriod = parseInt(rate_freeze_period || '0', 10);

      for (let i = 0; i < 365; i++) {
        const date = addDays(today, i);
        const dayOfWeekShort = dayNamesShort[date.getUTCDay()];
        const monthKey = monthNames[date.getUTCMonth()].toLowerCase();
        const monthlyMinRate = parseFloat(monthlyRatesMap[monthKey] || '0');
        const isFrozen = i <= freezePeriod;

        let activeFloorRate = null;
        if (
          lmfEnabled &&
          !isFrozen && 
          i <= lmfDays && 
          lmfDow.has(dayOfWeekShort)
        ) {
          activeFloorRate = lmfRate;
        }

        skeletonCalendar.push({
          date: formatDate(date),
          rate: 0,
          source: 'External',
          liveRate: 0,
          dayOfWeek: dayNames[date.getUTCDay()],
          dayOfWeekShort: dayOfWeekShort,
          dayNumber: date.getUTCDate(),
          month: monthNames[date.getUTCMonth()],
          isFrozen: isFrozen,
          occupancy: 60 + Math.random() * 30,
          adr: 170 + Math.random() * 50,
          guardrailMin: monthlyMinRate,
          floorRateLMF: activeFloorRate,
        });
      }

      // 5. Fetch the rate calendar data
      const response = await fetch(`/api/sentinel/rates/${hotel_id}/${base_room_type_id}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to fetch rate calendar.');
      }

      // 6. Create a map of the data
      const savedRateMap = result.data.reduce((acc: any, day: any) => {
        acc[day.date] = {
          rate: parseFloat(day.rate),
          source: day.source,
        };
        return acc;
      }, {});

      // 7. Merge the DB data into the skeleton
      const mergedCalendar = skeletonCalendar.map(day => {
        const savedData = savedRateMap[day.date];
        if (savedData) {
          return {
            ...day,
            rate: savedData.rate,
            source: savedData.source,
          };
        }
        return day;
      });
      
      setCalendarData(mergedCalendar);
      
      if (showToast) {
        // Use the hotel name from state, which is fine for a toast
        const hotelName = currentConfigInState?.property_name || `Hotel ID ${hotel_id}`;
        toast.success(`Rate calendar loaded for ${hotelName}.`);
      }

    } catch (err: any) {
      console.error("Error loading rates:", err);
      setError(err.message);
      toast.error('Failed to load rates', { description: err.message });
      setCalendarData([]); // Clear grid on error
} finally {
      if (showGridLoader) setIsLoading(false); // [FIX] Only clear grid loader if it was shown
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
  const handleSubmitChanges = async () => {
    if (!selectedHotelData || !selectedHotelData.pms_property_id) {
      toast.error('Submitting too fast!', {
        description: 'Wait for all hotel data to load before submitting.',
      });
      console.error('Submit Clicked before pms_property_id was loaded:', selectedHotelData);
      return;
    }
    
    // [MODIFIED] Submit PENDING overrides, not all overrides
    const overrideList = Object.keys(pendingOverrides).map(date => ({
      date: date,
      rate: pendingOverrides[date],
    }));

    if (overrideList.length === 0) {
      toast.info('No new overrides to submit.'); // [MODIFIED]
      return;
    }

    const { hotel_id, pms_property_id, base_room_type_id } = selectedHotelData;

    setIsSubmitting(true);
    try {
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
        throw new Error(result.message || 'Failed to submit changes.');
      }

      toast.success('Changes submitted successfully!', {
        description: `${overrideList.length} rate(s) pushed and "padlocked".`,
      });

// [NEW] Clear the PENDING changes, they are now "saved"
// [NEW] Clear the PENDING changes, they are now "saved"
      setPendingOverrides({});

      // [MODIFIED] AWAIT the reload to get fresh data before finishing
// In SentinelRateManager.tsx
      // [MODIFIED] AWAIT the reload, but pass `false` to prevent the grid loader "jerk"
      await handleLoadRates(false, false);
      console.error("Error submitting changes:", err);
      toast.error('Failed to submit changes', { description: err.message });
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

  // [NEW] Memoized hook to filter the calendar by start date and nights
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
    backgroundColor: '#1a1a1a',
    borderRadius: '8px',
    border: '1px solid #2a2a2a',
    overflow: 'hidden',
  };

  const tableWrapperStyle: CSSProperties = {
    overflowX: 'auto',
  };

  const tableStyle: CSSProperties = {
    width: '100%',
    fontSize: '13px',
    tableLayout: 'fixed',
    minWidth: `${190 + (visibleCalendarData.length * 84)}px`, // Dynamic min-width
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
    width: '190px',
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
    width: '190px',
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
                  onValueChange={setSelectedHotelId}
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

    

        {/* Grid Section */}
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
            {/* [NEW] Loading, Error, and Empty States */}
            {isLoading && (
              <div style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', color: '#9ca3af' }}>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Loading 365-day calendar...</span>
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

                    {/* [NEW] Row 2.3: Data 3 (From Prototype) */}
                    {!hiddenRows.has('data3') && (
                      <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
                        <td style={tdStickyStyle}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '13px', color: '#6b7280' }}>Data 3</span>
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
                              <div style={{ fontSize: '12px', color: '#4a4a48' }}>-</div>
                            </td>
                          );
                        })}
                      </tr>
                    )}


           {/* Row 2.1: Min Rate (Guardrail) */}
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


          {/* Row 2.2: Floor Rate (LMF) */}
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

                    {/* Empty Space Row */}
                    <tr style={{ backgroundColor: '#1A1A1A' }}>
                      <td colSpan={visibleCalendarData.length + 1} style={{ height: '16px' }}></td>
                    </tr>

    {/* Row 4: Effective Rate (This is our local DB rate) */}
                    <tr style={{ borderTop: '1px solid #2a2a2a', borderBottom: '1px solid #2a2a2a' }}>
                      <td style={tdStickyStyle}>
                        <span style={{ fontSize: '13px', color: '#6b7280' }}>Effective Rate</span>
                      </td>
                      {visibleCalendarData.map((day) => {
                        const isSelected = hoveredColumn === day.date;
                        
                        // [FIX] Use the new refactored states
                        const overrideValue = pendingOverrides[day.date] ?? savedOverrides[day.date];
                        const hasAnyOverride = overrideValue !== undefined;
                        const displayRate = hasAnyOverride ? overrideValue : day.rate;
                        
                        return (
              <td 
                            key={day.date}
                            onMouseEnter={() => setHoveredColumn(day.date)}
                            onMouseLeave={() => setHoveredColumn(null)}
                            onClick={() => {
                              if (!day.isFrozen) {
                                // [FIX] This row is for future dev, so we make it non-editable
                                // setEditingCell(day.date);
                              }
                            }}
                            style={{
                              ...getCellStyle(isSelected, hasAnyOverride ? 'rgba(250, 255, 106, 0.05)' : undefined),
                              opacity: day.isFrozen ? 0.4 : 0.2, // [FIX] Lower opacity
                            }}
                          >
                            {editingCell === day.date && !day.isFrozen ? (
                              <input
                                type="text"
                                defaultValue={displayRate}
                                autoFocus
                                onBlur={(e) => {
                                  // This row is non-functional, but we'll leave handler logic
                                  // in case we enable it later.
                                  handleRateChange(day.date, e.target.value);
                                  setEditingCell(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleRateChange(day.date, e.currentTarget.value);
                                    setEditingCell(null);
                                  }
                                  if (e.key === 'Escape') {
                                    setEditingCell(null);
                                  }
                                }}
                                style={inputCellStyle}
                              />
                            ) : (
                              <div style={{ fontSize: '13px', fontFamily: 'monospace', color: '#6b7280' }}>
                                - {/* [FIX] Per user, this is for future dev. */}
                              </div>
                            )}
                          </td>
                );
                      })}
                    </tr>


        {/* Row 5: Live PMS Rate (The "Sentinel" rate) */}
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
                        
                        // [FIX] Use the new refactored states
                        const hasPendingOverride = pendingOverrides[day.date] !== undefined;
                        const overrideValue = pendingOverrides[day.date] ?? savedOverrides[day.date];
                        const hasAnyOverride = overrideValue !== undefined;
                        
                        return (
                          <td 
                            key={day.date}
                            onMouseEnter={() => setHoveredColumn(day.date)}
                            onMouseLeave={() => setHoveredColumn(null)}
                            style={{
                              textAlign: 'center',
                              padding: '16px 8px',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              backgroundColor: isSelected ? 'rgba(57, 189, 248, 0.1)' : 'rgba(57, 189, 248, 0.02)',
                              width: '84px',
                              borderRight: isFirstOfMonth ? '2px solid #2a2a2a' : '1px solid #2a2a2a',
                              // [FIX] Dim this row if day is frozen or has ANY override (pending or saved)
                              opacity: hasAnyOverride || day.isFrozen ? 0.4 : 1,
                            }}
                          >
                            <div style={{ fontSize: '14px', color: '#39BDF8', fontWeight: 600 }}>
                              £{day.liveRate}
                            </div>
                          </td>
                        );
                      })}
                    </tr>

                    {/* Empty Space Row */}
                    <tr style={{ backgroundColor: '#1A1A1A' }}>
                      <td colSpan={visibleCalendarData.length + 1} style={{ height: '16px' }}></td>
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
              <span>Scroll horizontally to view all days • Click 'Effective Rate' to override • 'Live PMS Rate' is for certification</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}