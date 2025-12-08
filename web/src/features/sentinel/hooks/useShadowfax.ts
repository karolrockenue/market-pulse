import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { 
  getShadowfaxProperties, 
  runShadowfaxScrape 
} from '../api/sentinel.api';
import { ShadowfaxProperty } from '../api/types';

// Types specific to the View State
export type ResultState = 'idle' | 'loading' | 'success' | 'error';

export interface CellResult {
  hotelId: string;
  date: string; // 'yyyy-MM-dd'
  state: ResultState;
  price?: string;
  roomName?: string;
  error?: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const useShadowfax = () => {
  const [properties, setProperties] = useState<ShadowfaxProperty[]>([]);
  const [isLoadingProperties, setIsLoadingProperties] = useState(true);
  
  // UI State
  const [selectedHotels, setSelectedHotels] = useState<string[]>([]);
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [liveLog, setLiveLog] = useState<string[]>(['> Idle']);
  const [cellResults, setCellResults] = useState<CellResult[]>([]);
  const [isScraping, setIsScraping] = useState(false);

  // 1. Fetch Properties on Mount
  useEffect(() => {
    const fetchProps = async () => {
      try {
        const data = await getShadowfaxProperties();
        setProperties(data);
      } catch (error: any) {
        console.error(error);
        toast.error('Failed to load properties');
      } finally {
        setIsLoadingProperties(false);
      }
    };
    fetchProps();
  }, []);

  // 2. The Batch Scraper Engine
  const runBatchScrape = useCallback(async () => {
    // Dedup dates
    const uniqueDates = selectedDates.filter((date, index, self) => 
      index === self.findIndex((d) => format(d, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd'))
    ).sort((a, b) => a.getTime() - b.getTime());

    if (!selectedHotels.length || !uniqueDates.length || isScraping) return;

    setIsScraping(true);

    // Build Queue
    const jobs: { hotelId: string; date: Date }[] = [];
    selectedHotels.forEach(hotelId => {
      uniqueDates.forEach(date => {
        jobs.push({ hotelId, date });
      });
    });

    // Init Results
    const initialResults: CellResult[] = jobs.map(job => ({
      hotelId: job.hotelId,
      date: format(job.date, 'yyyy-MM-dd'),
      state: 'loading' as ResultState,
    }));
    setCellResults(initialResults);
    setLiveLog([`> shadowfax.run({ hotels: ${selectedHotels.length}, dates: ${uniqueDates.length} })`, `✓ Batch initialized...`]);

    // Process Queue (Sequential with Delay)
    let jobIndex = 0;
    for (const job of jobs) {
      const { hotelId, date } = job;
      const dateString = format(date, 'yyyy-MM-dd');
      const hotelName = properties.find(p => p.property_id === hotelId)?.property_name || hotelId;

      setLiveLog(prev => [...prev, `> [${jobIndex + 1}/${jobs.length}] Scraping ${hotelName} for ${dateString}...`]);

      try {
        const result = await runShadowfaxScrape(hotelId, dateString);

        // Update Grid
        setCellResults(prev => prev.map(r => 
          r.hotelId === hotelId && r.date === dateString
            ? { ...r, state: 'success', price: result.price, roomName: result.roomName }
            : r
        ));
        setLiveLog(prev => [...prev, `✓ SUCCESS: Found ${result.price}`]);

      } catch (error: any) {
        setCellResults(prev => prev.map(r => 
          r.hotelId === hotelId && r.date === dateString
            ? { ...r, state: 'error', error: error.message }
            : r
        ));
        setLiveLog(prev => [...prev, `X ERROR: ${error.message}`]);
      }

      jobIndex++;
      if (jobIndex < jobs.length) await sleep(3000); // 3s Throttle
    }

    setIsScraping(false);
    setLiveLog(prev => [...prev, `✓ Batch complete.`, `> Idle`]);
    toast.success('Batch scrape complete');
  }, [selectedHotels, selectedDates, isScraping, properties]);

  return {
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
  };
};