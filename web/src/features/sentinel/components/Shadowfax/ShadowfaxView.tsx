import { useState } from 'react';
import { 
  Building,
  Calendar, 
  Search, 
  Tag, 
  Loader2, 
  AlertTriangle, 
  Wind, 
  Percent,
  Code
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { format } from 'date-fns';
import { useShadowfax } from '../../hooks/useShadowfax';

export function ShadowfaxView() {
  const {
    properties,
    isLoadingProperties,
    selectedHotels,
    setSelectedHotels,
    selectedDates,
    setSelectedDates,
    liveLog,
    cellResults,
    isScraping,
    runBatchScrape
  } = useShadowfax();

  const [applyGeniusDiscount, setApplyGeniusDiscount] = useState(false);
  
  // Helper: Deduplicate dates for display
  const uniqueDates = selectedDates.filter((date, index, self) => 
    index === self.findIndex((d) => format(d, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd'))
  ).sort((a, b) => a.getTime() - b.getTime());

  const handleHotelChange = (id: string) => {
    if (selectedHotels.includes(id)) {
      setSelectedHotels(prev => prev.filter(hotelId => hotelId !== id));
    } else {
      setSelectedHotels(prev => [...prev, id]);
    }
  };

  const getCellResult = (hotelId: string, date: Date) => {
    return cellResults.find(r => r.hotelId === hotelId && r.date === format(date, 'yyyy-MM-dd'));
  };

  const calculateAdjustedPrice = (priceStr: string | undefined, hotelId: string): string | null => {
    if (!priceStr || !applyGeniusDiscount) return null;
    const property = properties.find(p => p.property_id === hotelId);
    const discount = property?.genius_discount_pct || 0;
    if (discount === 0) return null;
    
    const numericPrice = parseFloat(priceStr.replace(/[^0-9.]/g, ''));
    if (isNaN(numericPrice)) return null;

    const currencySymbol = priceStr.match(/[^0-9.]/)?.[0] || '£';
    const adjustedPrice = numericPrice * (1 - discount / 100);
    return `${currencySymbol}${adjustedPrice.toFixed(2)}`;
  };

  const getHotelName = (hotelId: string) => {
    return properties.find(h => h.property_id === hotelId)?.property_name;
  };

  return (
    <div style={{ minHeight: '100vh', background: '#1d1d1c', position: 'relative', overflow: 'hidden' }}>
      
      {/* Background Gradients (Toned Down) */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom right, rgba(57,189,248,0.02), transparent, rgba(250,255,106,0.02))' }}></div>
      <div style={{ 
        position: 'absolute', 
        inset: 0, 
        backgroundImage: 'linear-gradient(rgba(57,189,248,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(57,189,248,0.015) 1px, transparent 1px)', 
        backgroundSize: '64px 64px' 
      }}></div>

      <div style={{ position: 'relative', zIndex: 10, padding: '3rem', maxWidth: '1800px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ marginBottom: '3rem' }}>
          <h1 style={{ color: '#e5e5e5', fontSize: '1.875rem', letterSpacing: '-0.025em', marginBottom: '0.5rem' }}>Shadowfax Intelligence</h1>
          <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>Live Price Intelligence Matrix • Real-time Scraper Engine</p>
        </div>

        {/* Configuration Card */}
        <div style={{ marginBottom: '2rem' }}>
          <Card style={{ backgroundColor: '#1a1a1a', borderColor: 'rgba(57, 189, 248, 0.2)', boxShadow: '0 0 30px rgba(57,189,248,0.05)' }}>
            <CardHeader style={{ borderBottom: '1px solid rgba(57,189,248,0.1)', paddingBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ padding: '0.5rem', background: 'rgba(57,189,248,0.1)', borderRadius: '0.5rem' }}>
                  <Wind style={{ width: '1.5rem', height: '1.5rem', color: '#39BDF8' }} />
                </div>
                <div>
                  <CardTitle style={{ color: '#e5e5e5', fontSize: '1.5rem', textTransform: 'uppercase', letterSpacing: '-0.025em' }}>Scrape Configuration</CardTitle>
                  <CardDescription style={{ color: '#9ca3af', marginTop: '0.25rem' }}>Configure targets and date ranges for live price extraction</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent style={{ paddingTop: '1.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '1.5rem', alignItems: 'end' }}>
                  
                  {/* Properties */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <Label className="text-[#9ca3af] text-xs tracking-wide uppercase">Properties ({selectedHotels.length})</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full h-11 justify-start text-left bg-[#1a1a1a] border-[#2a2a2a] text-[#e5e5e5]" disabled={isLoadingProperties}>
                          <Building className="mr-2 h-4 w-4" style={{ color: '#39BDF8' }} />
                          {isLoadingProperties ? <span style={{ color: '#6b7280' }}>Loading...</span> : selectedHotels.length > 0 ? <span>{selectedHotels.length} selected</span> : <span style={{ color: '#6b7280' }}>Select properties</span>}
                        </Button>
                      </PopoverTrigger>
                      {/* FIX: Inline style for background to prevent transparency */}
                      <PopoverContent className="w-80 p-0" align="start" style={{ backgroundColor: '#1a1a1a', borderColor: '#2a2a2a' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxHeight: '300px', overflowY: 'auto', padding: '0.5rem' }}>
                          {properties.map((hotel) => (
                            <div key={hotel.property_id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', borderRadius: '0.25rem' }} className="hover:bg-[#2a2a2a]">
                              <Checkbox id={`hotel-${hotel.property_id}`} checked={selectedHotels.includes(hotel.property_id)} onCheckedChange={() => handleHotelChange(hotel.property_id)} style={{ borderColor: '#39BDF8' }} />
                              <label htmlFor={`hotel-${hotel.property_id}`} style={{ color: '#e5e5e5', flex: 1, fontSize: '0.875rem', cursor: 'pointer' }}>{hotel.property_name}</label>
                            </div>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Dates */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <Label className="text-[#9ca3af] text-xs tracking-wide uppercase">Check-in Dates ({uniqueDates.length})</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full h-11 justify-start text-left bg-[#1a1a1a] border-[#2a2a2a] text-[#e5e5e5]">
                          <Calendar className="mr-2 h-4 w-4" style={{ color: '#39BDF8' }} />
                          {uniqueDates.length > 0 ? <span>{uniqueDates.length} dates selected</span> : <span style={{ color: '#6b7280' }}>Select dates</span>}
                        </Button>
                      </PopoverTrigger>
                      {/* FIX: Inline style for background */}
                      <PopoverContent className="w-auto p-0" align="start" style={{ backgroundColor: '#1a1a1a', borderColor: '#2a2a2a' }}>
                        <CalendarComponent 
                          mode="multiple" 
                          selected={selectedDates} 
                          onSelect={(dates) => setSelectedDates(dates || [])} 
                          initialFocus 
                          style={{ backgroundColor: '#1a1a1a', color: '#e5e5e5', margin: 0 }} 
                          className="rounded-md border-[#2a2a2a]"
                          disabled={(day) => day < new Date(new Date().setHours(0, 0, 0, 0))} 
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Run Button */}
                  <Button onClick={runBatchScrape} disabled={!selectedHotels.length || !uniqueDates.length || isScraping} className="h-11 transition-all" style={{ backgroundImage: 'linear-gradient(to right, #39BDF8, #29ADEE)', color: '#0f0f0f', fontWeight: 600 }}>
                    {isScraping ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                    {isScraping ? 'Matrix Scraping Active...' : 'Run Matrix Scrape'}
                  </Button>
                </div>

                {/* Genius Toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #2a2a2a' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Switch id="member-discount" checked={applyGeniusDiscount} onCheckedChange={setApplyGeniusDiscount} />
                    <Label htmlFor="member-discount" style={{ color: '#e5e5e5', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Percent className="w-4 h-4" style={{ color: '#faff6a' }} /> Member Discount Adjustment
                    </Label>
                  </div>
                </div>

              </div>
            </CardContent>
          </Card>
        </div>

        {/* Results Section */}
        {cellResults.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6rem 0', border: '1px dashed #2a2a2a', borderRadius: '0.5rem', backgroundColor: 'rgba(26,26,26,0.5)' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '4rem', height: '4rem', borderRadius: '50%', backgroundColor: 'rgba(57, 189, 248, 0.1)', marginBottom: '1rem' }}>
                <Tag className="w-8 h-8" style={{ color: '#39BDF8' }} />
              </div>
              <h3 style={{ color: '#e5e5e5', fontSize: '1rem', marginBottom: '0.25rem' }}>Ready to Scrape</h3>
              <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Select properties and dates above to generate the matrix.</p>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            
            {/* Table Card */}
            <Card style={{ backgroundColor: '#1a1a1a', borderColor: '#2a2a2a' }}>
              <CardHeader>
                 <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <CardTitle style={{ color: '#e5e5e5', fontSize: '1.25rem' }}>Intelligence Matrix</CardTitle>
                    <span style={{ color: '#6b7280', fontSize: '0.75rem', fontFamily: 'monospace' }}>{selectedHotels.length} PROPS × {uniqueDates.length} DATES</span>
                  </div>
              </CardHeader>
              <CardContent>
                <div style={{ overflowX: 'auto', border: '1px solid #2a2a2a', borderRadius: '0.5rem' }}>
                  <table style={{ width: '100%' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #2a2a2a', backgroundColor: '#0f0f0f' }}>
                        <th style={{ textAlign: 'left', padding: '1rem 1.5rem', color: '#9ca3af', fontSize: '0.75rem', position: 'sticky', left: 0, backgroundColor: '#0f0f0f', zIndex: 10 }}>PROPERTY</th>
                        {uniqueDates.map((date, idx) => (
                          <th key={idx} style={{ textAlign: 'center', padding: '1rem 1.5rem', color: '#9ca3af', fontSize: '0.75rem', minWidth: '160px', textTransform: 'uppercase' }}>{format(date, 'MMM d')}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {selectedHotels.map((hotelId, index) => (
                        <tr key={hotelId} style={{ borderBottom: '1px solid #2a2a2a', backgroundColor: index % 2 === 0 ? '#1a1a1a' : '#161616' }}>
                          <td style={{ padding: '1.25rem 1.5rem', color: '#e5e5e5', position: 'sticky', left: 0, zIndex: 10, backgroundColor: index % 2 === 0 ? '#1a1a1a' : '#161616', borderRight: '1px solid #2a2a2a', fontWeight: 500 }}>
                            {getHotelName(hotelId) || hotelId}
                          </td>
                          {uniqueDates.map((date, dateIdx) => {
                            const res = getCellResult(hotelId, date);
                            const adj = res?.price ? calculateAdjustedPrice(res.price, hotelId) : null;
                            
                            return (
                              <td key={dateIdx} style={{ padding: '1rem', textAlign: 'center' }}>
                                {res ? (
                                  res.state === 'loading' ? <Loader2 className="w-4 h-4 animate-spin mx-auto text-[#39BDF8]" /> :
                                  res.state === 'error' ? <div className="flex items-center justify-center gap-1 text-red-500 text-xs"><AlertTriangle className="w-3 h-3" /> Err</div> :
                                  <div>
                                    {adj ? (
                                      <>
                                        <div className="text-[#9ca3af] line-through text-[10px]">{res.price}</div>
                                        <div className="text-[#faff6a] text-sm font-medium">{adj}</div>
                                      </>
                                    ) : <div className="text-[#e5e5e5] text-sm font-medium">{res.price}</div>}
                                    <div className="text-[#6b7280] text-[10px] truncate max-w-[120px] mx-auto mt-1">{res.roomName}</div>
                                  </div>
                                ) : <span className="text-[#2a2a2a]">-</span>}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Live Console */}
            <div style={{ backgroundColor: '#000000', border: '1px solid #2a2a2a', borderRadius: '0.5rem', fontFamily: 'monospace', overflow: 'hidden' }}>
              <div style={{ padding: '0.5rem 1rem', backgroundColor: '#1a1a1a', borderBottom: '1px solid #2a2a2a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <Code className="w-3 h-3 text-[#39BDF8]" />
                  <span className="text-[#39BDF8] text-xs font-medium tracking-wide">SYSTEM CONSOLE</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                   <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isScraping ? '#10b981' : '#6b7280', boxShadow: isScraping ? '0 0 8px #10b981' : 'none' }}></div>
                   <span className="text-[#6b7280] text-[10px]">{isScraping ? 'LIVE' : 'IDLE'}</span>
                </div>
              </div>
              <div style={{ padding: '1rem', height: '12rem', overflowY: 'auto', backgroundColor: '#050505' }}>
                {liveLog.length === 0 ? (
                  <div className="text-[#2a2a2a] text-xs italic">Waiting for process start...</div>
                ) : (
                  liveLog.map((line, i) => (
                    <div key={i} style={{ fontSize: '11px', lineHeight: '1.6', color: line.includes('✓') ? '#10b981' : line.includes('X') ? '#ef4444' : line.startsWith('>') ? '#39BDF8' : '#9ca3af' }}>
                      {line}
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}