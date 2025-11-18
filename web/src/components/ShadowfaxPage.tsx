import { useState, useEffect } from 'react';
import { 
  Building, 
  Calendar, 
  Search, 
  Tag, 
  Loader2, 
  CheckCircle, 
  AlertTriangle, 
  Wind, 
  RefreshCw, 
Percent,
  Code
} from 'lucide-react';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar as CalendarComponent } from './ui/calendar';
import { Checkbox } from './ui/checkbox';
import { Switch } from './ui/switch';
import { Input } from './ui/input';
import { format } from 'date-fns';
import { toast } from 'sonner';

// --- Types ---
// --- Types ---

type Property = {
  property_id: string; // Changed from number to string (UUID)
  property_name: string;
  genius_discount_pct: number; // Added per-hotel discount
};

type ResultState = 'idle' | 'loading' | 'success' | 'error';

interface CellResult {
  hotelId: string; // This is the property_id
  date: string; // 'yyyy-MM-dd'
  state: ResultState;
  price?: string;
  roomName?: string;
  error?: string;
}

// A helper function to create a delay
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// --- Component ---

export function ShadowfaxPage() {
  // --- State ---
  
  // Real data state
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoadingProperties, setIsLoadingProperties] = useState(true);

// UI state from prototype
// UI state from prototype
// UI state from prototype
  const [selectedHotels, setSelectedHotels] = useState<string[]>([]);
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [liveLog, setLiveLog] = useState<string[]>(['> Idle']); // [NEW] For live logging

  const [cellResults, setCellResults] = useState<CellResult[]>([]);
  const [applyGeniusDiscount, setApplyGeniusDiscount] = useState(false); // Renamed
  const [isScraping, setIsScraping] = useState(false);
  
  // --- Data Fetching ---

useEffect(() => {
    // Fetches the real list of properties from the API
    const fetchProperties = async () => {
      try {
        const response = await fetch('/api/scraper/sentinel-properties'); //
        if (!response.ok) {
          throw new Error('Failed to fetch properties');
        }
        const data: Property[] = await response.json();
        setProperties(data);
      } catch (error: any) {
        console.error("Error fetching properties:", error);
        toast.error('Failed to load properties', { description: error.message });
      } finally {
        setIsLoadingProperties(false);
      }
    };
    fetchProperties();
  }, []);

  // --- Handlers & Logic ---

  // Deduplicate dates based on formatted date string
  const uniqueDates = selectedDates.filter((date, index, self) => 
    index === self.findIndex((d) => format(d, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd'))
  ).sort((a, b) => a.getTime() - b.getTime()); // Also sort them

  const handleHotelChange = (id: string) => {
    if (selectedHotels.includes(id)) {
      setSelectedHotels(prev => prev.filter(hotelId => hotelId !== id));
    } else {
      setSelectedHotels(prev => [...prev, id]);
    }
  };

  const getCellResult = (hotelId: string, date: Date): CellResult | undefined => {
    return cellResults.find(r => r.hotelId === hotelId && r.date === format(date, 'yyyy-MM-dd'));
  };

// Calculates the adjusted price based on the "Genius" toggle
  const calculateAdjustedPrice = (priceStr: string | undefined, hotelId: string): string | null => {
    if (!priceStr || !applyGeniusDiscount) return null; // Use new state name

    // 1. Find the property's specific discount rate
    const property = properties.find(p => p.property_id === hotelId);
    const discount = property?.genius_discount_pct || 0;

    if (discount === 0) return null; // Don't show adjusted price if discount is zero
    
    // 2. Price may come in as '£149' or '$149' or just '149'
    const numericPrice = parseFloat(priceStr.replace(/[^0-9.]/g, ''));
    if (isNaN(numericPrice)) return null;

    const currencySymbol = priceStr.match(/[^0-9.]/)?.[0] || '£';
    
    // 3. Calculate adjusted price
    const adjustedPrice = numericPrice * (1 - discount / 100);
    
    return `${currencySymbol}${adjustedPrice.toFixed(2)}`;
  };

  // Main function to run the throttled scrape
  const handleCheckPrice = async () => {
    if (!selectedHotels.length || !uniqueDates.length || isScraping) return;

    setIsScraping(true);

    // 1. Build the job queue
    const jobs: { hotelId: string; date: Date }[] = [];
    selectedHotels.forEach(hotelId => {
      uniqueDates.forEach(date => {
        jobs.push({
          hotelId,
          date,
        });
      });
    });

// 2. Initialize all combinations as 'loading'
    const initialResults: CellResult[] = jobs.map(job => ({
      hotelId: job.hotelId,
      date: format(job.date, 'yyyy-MM-dd'),
      state: 'loading' as ResultState,
    }));
    setCellResults(initialResults);
    
    // [NEW] Clear log and start batch command
    setLiveLog([`> shadowfax.run({ hotels: ${selectedHotels.length}, dates: ${uniqueDates.length} })`, `✓ Batch initialized...`]);

    // 3. Process the queue sequentially (Frontend Throttling)
    let jobIndex = 0; // [NEW]
    for (const job of jobs) {
      const { hotelId, date } = job;
      const dateString = format(date, 'yyyy-MM-dd');
      
      // [NEW] Add "Scraping..." log message
      const logMsg = `> [${jobIndex + 1}/${jobs.length}] Scraping ${getHotelName(hotelId)} for ${dateString}...`;
      setLiveLog(prev => [...prev, logMsg]);

      try {
        const response = await fetch('/api/scraper/get-price', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hotelId: hotelId, // Send the string UUID directly
            checkinDate: dateString,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'The scrape failed for an unknown reason.');
        }

        // Normalize data shape (from original file)
        let normalizedData = data;
        if (data.price && typeof data.price === 'object' && data.price.price) {
          normalizedData = data.price;
        }

// Update this specific cell to 'success'
        setCellResults(prevResults => 
          prevResults.map(result => 
            result.hotelId === hotelId && result.date === dateString
              ? {
                  ...result,
                  state: 'success',
                  price: normalizedData.price, // API returns price with currency
                  roomName: normalizedData.roomName,
                }
              : result
          )
        );

        // [NEW] Add success log
        setLiveLog(prev => [...prev, `✓ SUCCESS: Found ${normalizedData.price} for ${getHotelName(hotelId)}`]);

      } catch (error: any) {
        // Update this specific cell to 'error'
        setCellResults(prevResults => 
          prevResults.map(result => 
            result.hotelId === hotelId && result.date === dateString
              ? {
                  ...result,
                  state: 'error',
                  error: error.message,
                }
              : result
          )
        );

 

        // [NEW] Add error log
        setLiveLog(prev => [...prev, `X ERROR: Failed for ${getHotelName(hotelId)}: ${error.message}`]);
      }
      
      jobIndex++; // [NEW] Increment job index

      // 4. Wait for the 3-second cooldown before the next job
      await sleep(3000); 
    }

setIsScraping(false);
    // [NEW] Add final log messages
    setLiveLog(prev => [...prev, `✓ Batch complete.`, `> Idle`]); 
    toast.success('Batch scrape complete', {
      description: `Processed ${jobs.length} total scrapes.`,
    });
  };

// Helper to get hotel name from ID
  const getHotelName = (hotelId: string) => {
    return properties.find(h => h.property_id === hotelId)?.property_name;
  }

  // --- Render ---

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#1d1d1c', position: 'relative', overflow: 'hidden' }}>
      {/* Animated background gradient */}
      <div style={{ position: 'absolute', inset: '0px', backgroundImage: 'linear-gradient(to bottom right, rgba(57, 189, 248, 0.05), transparent, rgba(250, 255, 106, 0.05))' }}></div>
      
      {/* Grid overlay */}
      <div style={{ position: 'absolute', inset: '0px', backgroundImage: 'linear-gradient(rgba(57,189,248,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(57,189,248,0.03)_1px,transparent_1px)', backgroundSize: '64px 64px' }}></div>

      <div style={{ position: 'relative', zIndex: 10 }}>
        {/* Hero Header */}
        <div style={{ borderBottom: '1px solid #2a2a2a', backgroundColor: 'rgba(29, 29, 28, 0.8)', backdropFilter: 'blur(4px)' }}>
          <div style={{ paddingLeft: '3rem', paddingRight: '3rem', paddingTop: '1.5rem', paddingBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: '2.5rem', height: '2.5rem', backgroundImage: 'linear-gradient(to bottom right, #39BDF8, #29ADEE)', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Wind className="w-6 h-6" style={{ color: '#0f0f0f' }} />
              </div>
              <div>
                <h1 style={{ color: '#e5e5e5', fontSize: '1.875rem', lineHeight: '2.25rem', letterSpacing: '-0.025em' }}>SHADOWFAX</h1>
                <p style={{ color: '#39BDF8', fontSize: '0.75rem', lineHeight: '1rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Live Price Intelligence Matrix</p>
              </div>
            </div>
          </div>
        </div>

        {/* Configuration Panel - Top Horizontal */}
        <div style={{ borderBottom: '1px solid #2a2a2a', backgroundColor: 'rgba(29, 29, 28, 0.6)', backdropFilter: 'blur(4px)' }}>
          <div style={{ paddingLeft: '3rem', paddingRight: '3rem', paddingTop: '1.5rem', paddingBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '1.5rem', alignItems: 'end' }}>
              {/* Hotel Multi-Select */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <Label className="text-[#9ca3af] text-xs tracking-wide uppercase">
                  Properties ({selectedHotels.length})
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full h-11 justify-start text-left bg-[#1a1a1a] border-[#2a2a2a] text-[#e5e5e5] hover:bg-[#1a1a1a] hover:border-[#39BDF8]/50 hover:text-[#e5e5e5]"
                      disabled={isLoadingProperties}
                    >
                      <Building className="mr-2 h-4 w-4" style={{ color: '#39BDF8' }} />
                      {isLoadingProperties ? (
                        <span style={{ color: '#6b7280' }}>Loading properties...</span>
                      ) : selectedHotels.length > 0 ? (
                        <span style={{ color: '#e5e5e5' }}>{selectedHotels.length} selected</span>
                      ) : (
                        <span style={{ color: '#6b7280' }}>Select properties</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent 
                    className="w-80" 
                    style={{ backgroundColor: '#1a1a1a', borderColor: '#2a2a2a' }} 
                    align="start"
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxHeight: '300px', overflowY: 'auto' }}>
                {properties.map((hotel) => (
                 <div
                          key={hotel.property_id}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', borderRadius: '0.25rem', transition: 'background-color 150ms', cursor: 'pointer' }}
                          className="hover:bg-[#2a2a2a]/50" // This hover is fine
                          // onClick handler REMOVED to prevent double-firing
                        >
                          <Checkbox
                            id={`hotel-${hotel.property_id}`}
                            checked={selectedHotels.includes(hotel.property_id)}
                            onCheckedChange={() => handleHotelChange(hotel.property_id)}
                            // className removed to use default (working) styles
                          />
                          <label
                            htmlFor={`hotel-${hotel.property_id}`}
                            style={{ color: '#e5e5e5', cursor: 'pointer', flex: 1, fontSize: '0.875rem', lineHeight: '1.25rem' }}
                          >
                            {hotel.property_name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Date Multi-Select */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <Label className="text-[#9ca3af] text-xs tracking-wide uppercase">
                  Check-in Dates ({uniqueDates.length})
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full h-11 justify-start text-left bg-[#1a1a1a] border-[#2a2a2a] text-[#e5e5e5] hover:bg-[#1a1a1a] hover:border-[#39BDF8]/50 hover:text-[#e5e5e5]"
                    >
                      <Calendar className="mr-2 h-4 w-4" style={{ color: '#39BDF8' }} />
                      {uniqueDates.length > 0 ? (
                        <span style={{ color: '#e5e5e5' }}>{uniqueDates.length} dates selected</span>
                      ) : (
                        <span style={{ color: '#6b7280' }}>Select dates</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent 
                    className="w-auto" 
                    style={{ padding: 0, backgroundColor: '#1a1a1a', borderColor: '#2a2a2a' }} 
                    align="start"
                  >
                    <CalendarComponent
                      mode="multiple"
                      selected={selectedDates}
                      onSelect={(dates) => setSelectedDates(dates || [])}
                      initialFocus
                      style={{ backgroundColor: '#1a1a1a', color: '#e5e5e5' }}
                      disabled={(day) => day < new Date(new Date().setHours(0, 0, 0, 0))}
                    />
                  </PopoverContent>
                </Popover>
              </div>

  {/* Action Button */}
              <Button
                onClick={handleCheckPrice}
                disabled={!selectedHotels.length || !uniqueDates.length || isScraping}
                className="h-11 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                style={{
                  height: '2.75rem',
                  backgroundImage: 'linear-gradient(to right, #39BDF8, #29ADEE)',
                  color: '#0f0f0f',
                  boxShadow: '0 10px 15px -3px rgba(57, 189, 248, 0.2), 0 4px 6px -4px rgba(57, 189, 248, 0.2)'
                }}
              >
                {isScraping ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Search className="w-4 h-4 mr-2" />
                )}
                {isScraping ? 'Scraping...' : 'Run Matrix Scrape'}
              </Button>
            </div>

{/* Member Discount Adjustment */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #2a2a2a' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
           <Switch
                  id="member-discount"
                  checked={applyGeniusDiscount}
                  onCheckedChange={setApplyGeniusDiscount}
                  // className removed to use default (working) styles
                />
                <Label htmlFor="member-discount" style={{ color: '#e5e5e5', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Percent className="w-4 h-4" style={{ color: '#faff6a' }} />
                  Member Discount Adjustment
                </Label>
              </div>
              
              {/* Input block is now removed */}

              {applyGeniusDiscount && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', paddingLeft: '0.75rem', paddingRight: '0.75rem', paddingTop: '0.25rem', paddingBottom: '0.25rem', backgroundColor: 'rgba(250, 255, 106, 0.1)', border: '1px solid rgba(250, 255, 106, 0.2)', borderRadius: '9999px', marginLeft: 'auto' }}>
                  <Percent className="w-3 h-3" style={{ color: '#faff6a' }} />
                  <span style={{ color: '#faff6a', fontSize: '0.75rem', lineHeight: '1rem' }}>Applying hotel-specific Genius discounts</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Results Grid - Full Width */}
        <div style={{ padding: '3rem' }}>
          {cellResults.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: '8rem', paddingBottom: '8rem' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '6rem', height: '6rem', borderRadius: '9999px', backgroundColor: 'rgba(42, 42, 42, 0.3)', marginBottom: '1.5rem', border: '1px solid #2a2a2a' }}>
                  <Tag className="w-12 h-12" style={{ color: '#2a2a2a' }} strokeWidth={1.5} />
                </div>
                <h3 style={{ color: '#6b7280', fontSize: '1.25rem', lineHeight: '1.75rem', marginBottom: '0.5rem' }}>Awaiting Configuration</h3>
                <p style={{ color: 'rgba(107, 114, 128, 0.6)', fontSize: '0.875rem', lineHeight: '1.25rem', maxWidth: '28rem', margin: '0 auto' }}>
                  Select properties and dates to see the price intelligence matrix
                </p>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ color: '#e5e5e5', fontSize: '1.25rem', lineHeight: '1.75rem', marginBottom: '0.25rem' }}>Price Intelligence Matrix</h3>
                  <p style={{ color: '#6b7280', fontSize: '0.875rem', lineHeight: '1.25rem' }}>
                    {selectedHotels.length} {selectedHotels.length === 1 ? 'property' : 'properties'} × {uniqueDates.length} {uniqueDates.length === 1 ? 'date' : 'dates'} = {cellResults.length} data points
                  </p>
                </div>
                {isScraping && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', paddingLeft: '0.75rem', paddingRight: '0.75rem', paddingTop: '0.25rem', paddingBottom: '0.25rem', backgroundColor: 'rgba(57, 189, 248, 0.1)', border: '1px solid rgba(57, 189, 248, 0.2)', borderRadius: '9999px' }}>
                    <div className="w-1.5 h-1.5 bg-[#39BDF8] rounded-full animate-pulse"></div>
                    <span style={{ color: '#39BDF8', fontSize: '0.75rem', lineHeight: '1rem', letterSpacing: '0.05em' }}>LIVE SCRAPING</span>
                  </div>
                )}
              </div>

              {/* Grid Table */}
              <div style={{ overflowX: 'auto' }}>
                <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '0.5rem', overflow: 'hidden' }}>
                  <table style={{ width: '100%' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #2a2a2a', backgroundColor: '#0f0f0f' }}>
                        <th style={{ textAlign: 'left', padding: '1rem 1.5rem', color: '#9ca3af', fontSize: '0.75rem', lineHeight: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em', position: 'sticky', left: 0, backgroundColor: '#0f0f0f', zIndex: 10 }}>
                          Property
                        </th>
                        {uniqueDates.map((date, idx) => (
                          <th key={`header-${format(date, 'yyyy-MM-dd')}-${idx}`} style={{ textAlign: 'center', padding: '1rem 1.5rem', color: '#9ca3af', fontSize: '0.75rem', lineHeight: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em', minWidth: '200px' }}>
                            {format(date, 'MMM d, yyyy')}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {selectedHotels.map((hotelId, index) => {
                        const rowBgColor = index % 2 === 0 ? '#1a1a1a' : '#161616';
                        return (
                          <tr key={hotelId} style={{ borderBottom: '1px solid #2a2a2a', backgroundColor: rowBgColor }}>
                            <td style={{ padding: '1.25rem 1.5rem', color: '#e5e5e5', position: 'sticky', left: 0, zIndex: 10, backgroundColor: rowBgColor }}>
                              {getHotelName(hotelId) || `Property ID: ${hotelId}`}
                            </td>
                            {uniqueDates.map((date, dateIdx) => {
                              const cellResult = getCellResult(hotelId, date);
                              return (
                                <td key={`${hotelId}-${format(date, 'yyyy-MM-dd')}-${dateIdx}`} style={{ padding: '1.25rem 1.5rem', verticalAlign: 'top' }}>
                                  {cellResult ? (
                                    <div>
                                      {cellResult.state === 'loading' && (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: '#39BDF8' }}>
                                          <Loader2 className="w-4 h-4 animate-spin" />
                                          <span style={{ fontSize: '0.875rem', lineHeight: '1.25rem' }}>Scraping...</span>
                                        </div>
                                      )}
                                      
                                      {cellResult.state === 'success' && cellResult.price && (
                                        <div style={{ textAlign: 'center' }}>
                                          {(() => {
                                            const adjustedPrice = calculateAdjustedPrice(cellResult.price, hotelId);
                                            
                                            return adjustedPrice ? (
                                              <div>
                                                <div style={{ color: '#9ca3af', fontSize: '0.875rem', lineHeight: '1.25rem', marginBottom: '0.25rem', fontVariantNumeric: 'tabular-nums', textDecoration: 'line-through' }}>
                                                  {cellResult.price}
                                                </div>
                                                <div style={{ color: '#faff6a', fontSize: '1.25rem', lineHeight: '1.75rem', marginBottom: '0.25rem', fontVariantNumeric: 'tabular-nums' }}>
                                                  {adjustedPrice}
                                                </div>
                                              </div>
                                            ) : (
                                              <div style={{ color: '#e5e5e5', fontSize: '1.25rem', lineHeight: '1.75rem', marginBottom: '0.25rem', fontVariantNumeric: 'tabular-nums' }}>
                                                {cellResult.price}
                                              </div>
                                            );
                                          })()}
                                          <div style={{ color: '#6b7280', fontSize: '0.75rem', lineHeight: '1rem', marginBottom: '0.5rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {cellResult.roomName}
                                          </div>
                                          <CheckCircle className="w-4 h-4" style={{ color: '#10b981', margin: '0 auto' }} />
                                        </div>
                                      )}
                                      
                                      {cellResult.state === 'error' && (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: '#ef4444' }}>
                                          <AlertTriangle className="w-4 h-4" />
                                          <span style={{ fontSize: '0.875rem', lineHeight: '1.25rem' }}>Failed</span>
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <div style={{ textAlign: 'center', color: '#6b7280', fontSize: '0.875rem', lineHeight: '1.25rem' }}>—</div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
  </div>
              </div>

            {/* [NEW] Live "SYSTEM CONSOLE" Log Output (Prototype Design) */}
              <div style={{
                marginTop: '1.5rem',
                backgroundColor: '#1a1a1a',
                border: '1px solid #2a2a2a',
                borderRadius: '0.5rem',
                overflow: 'hidden',
                fontFamily: 'monospace'
              }}>
                {/* Header Bar */}
                <div style={{
                  padding: '0.5rem 1rem', // px-4 py-2
                  backgroundColor: '#0f0f0f',
                  borderBottom: '1px solid #2a2a2a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Code style={{ width: '0.75rem', height: '0.75rem', color: '#39BDF8' }} />
                    <span style={{ fontSize: '0.75rem', lineHeight: '1rem', color: '#39BDF8' }}>
                      SYSTEM CONSOLE
                    </span>
                  </div>
                  <span style={{ fontSize: '0.75rem', lineHeight: '1rem', color: '#6b7280' }}>
                    LIVE
                  </span>
                </div>
                
                {/* Log Content */}
                <div style={{
                  padding: '1rem',
                  height: '16rem', // h-64
                  overflowY: 'auto'
                }}>
                  {liveLog.map((line, index) => {
                    // New rendering logic from prototype
                    let color = '#6b7280'; // Default (gray)
                    if (line.includes('✓ SUCCESS')) {
                      color = '#10b981'; // Green
                    } else if (line.includes('X ERROR')) {
                      color = '#ef4444'; // Red
                    } else if (line.startsWith('>')) {
                      color = '#39BDF8'; // Blue
                    }

                    return (
                      <div
                        key={index}
                        style={{
                          fontSize: '0.75rem', // text-xs
                          lineHeight: '1.65', // leading-relaxed
                          color: color,
                          whiteSpace: 'pre-wrap'
                        }}
                      >
                        {line}
                      </div>
                    );
                  })}
                </div>
              </div>
              
            </div>
          )}
        </div>
      </div>
    </div>
  );
}