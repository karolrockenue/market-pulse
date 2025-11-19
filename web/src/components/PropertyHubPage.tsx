import { useState, useEffect, Fragment } from 'react';
import { Wind, Calculator, Building2, Check, X, Loader2, ChevronDown, ChevronUp, PoundSterling, Calendar as CalendarIcon, Info, Trash2, Save, Edit2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import { format, isWithinInterval } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';

// --- INTERFACES ---

interface AssetRow {
  id: string;
  asset_name: string;
  market_pulse_hotel_id: string | null;
  sentinel_active: boolean;
  booking_com_url: string | null;
  genius_discount_pct: number | null;
  min_rate: number | null;
  max_rate: number | null;
  // Config fields merged from backend
  strategic_multiplier?: string | number; 
  calculator_settings?: any;
}

interface Campaign {
  id: string;
  slug: string;
  name: string;
  discount: number;
  startDate: Date | undefined;
  endDate: Date | undefined;
  active: boolean;
  isEditing?: boolean; // Controls the "Setup Mode"
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
  targetSellRate: number;
  pmsRate: number;
  testStayDate: Date | undefined;
  editingField: 'pms' | 'target';
}

const DEFAULT_CALCULATOR_STATE: CalculatorState = {
  multiplier: 1.3,
  campaigns: [], 
  mobileActive: true,
  mobilePercent: 10,
  nonRefundableActive: true,
  nonRefundablePercent: 15,
  countryRateActive: false,
  countryRatePercent: 5,
  targetSellRate: 100,
  pmsRate: 0,
  testStayDate: new Date(),
  editingField: 'target'
};

// --- PURE MATH FUNCTIONS ---
// --- PURE MATH FUNCTIONS ---

const isCampaignValidForDate = (testDate: Date | undefined, camp: Campaign) => {
    if (!testDate || !camp.active || !camp.startDate || !camp.endDate) return false;
    try {
      return isWithinInterval(testDate, { start: camp.startDate, end: camp.endDate });
    } catch {
      return false;
    }
};

// DIRECTION: PMS Rate -> Final Sell Rate (The Waterfall)
const calculateSellRate = (pmsRate: number, geniusPct: number, state: CalculatorState) => {
    // 1. Apply Multiplier
    let currentRate = pmsRate * state.multiplier;

    // 2. Apply Non-Ref (Base Modifier)
    if (state.nonRefundableActive) {
        currentRate = currentRate * (1 - Number(state.nonRefundablePercent) / 100);
    }

    // 3. Check Deep Deals
    const deepDeal = state.campaigns.find(c => ['black-friday', 'limited-time'].includes(c.slug) && isCampaignValidForDate(state.testStayDate, c));

    if (deepDeal) {
        // Exclusive Override (Deep Deal applies to Level 1 price)
        currentRate = currentRate * (1 - Number(deepDeal.discount) / 100);
    } else {
        // Sequential Daisy Chain (Genius -> Campaign -> Mobile -> Country)
        
        // A. Genius
        if (geniusPct > 0) {
            currentRate = currentRate * (1 - Number(geniusPct) / 100);
        }

        // B. Campaign (Applies to post-Genius price)
        const validStandard = state.campaigns.filter(c => !['black-friday', 'limited-time'].includes(c.slug) && isCampaignValidForDate(state.testStayDate, c));
        if (validStandard.length > 0) {
             const best = validStandard.reduce((p, c) => (p.discount > c.discount) ? p : c);
             currentRate = currentRate * (1 - Number(best.discount) / 100);
        }
        
        // --- MOBILE RATE OVERRIDE LOGIC (Forward) ---
        // Check for deals that block Mobile Rate (Deep Deals OR specific Standard Campaigns)
        const isMobileBlocked = !!deepDeal || validStandard.some(c => ['early-deal', 'late-escape', 'getaway-deal'].includes(c.slug));

        // Step C: Mobile (Applies to post-Campaign price ONLY IF NOT BLOCKED)
        if (state.mobileActive && !isMobileBlocked) {
             currentRate = currentRate * (1 - Number(state.mobilePercent) / 100);
        }
        // --- END MOBILE RATE OVERRIDE LOGIC ---

        // D. Country
        if (state.countryRateActive) { 
             currentRate = currentRate * (1 - Number(state.countryRatePercent) / 100);
        }
    }

    return currentRate;
};

// DIRECTION: Target Sell Rate -> Required PMS Rate (Reverse Engineering)
const calculateRequiredPMSRate = (targetRate: number, geniusPct: number, state: CalculatorState) => {
    let currentRate = targetRate;

    // 1. Check Deep Deals (Exclusive Override)
    const deepDeal = state.campaigns.find(c => ['black-friday', 'limited-time'].includes(c.slug) && isCampaignValidForDate(state.testStayDate, c));

    if (deepDeal) {
        // Unwind Deep Deal (Exclusive)
        currentRate = currentRate / (1 - Number(deepDeal.discount) / 100);
    } else {
        // Sequential Daisy Chain (Reverse Order: Country -> Mobile -> Campaign -> Genius)
        
        // D. Country
        if (state.countryRateActive) currentRate = currentRate / (1 - Number(state.countryRatePercent) / 100);
        
        // B. Campaign (Need to identify blocking deals before checking Mobile)
        const validStandard = state.campaigns.filter(c => !['black-friday', 'limited-time'].includes(c.slug) && isCampaignValidForDate(state.testStayDate, c));
        
        // --- MOBILE RATE OVERRIDE LOGIC (Reverse) ---
        const isMobileBlocked = !!deepDeal || validStandard.some(c => ['early-deal', 'late-escape', 'getaway-deal'].includes(c.slug));

        // C. Mobile (Unwind ONLY IF NOT BLOCKED)
        if (state.mobileActive && !isMobileBlocked) currentRate = currentRate / (1 - Number(state.mobilePercent) / 100);
        // --- END MOBILE RATE OVERRIDE LOGIC ---
        
        // B. Campaign
        if (validStandard.length > 0) {
             const best = validStandard.reduce((p, c) => (p.discount > c.discount) ? p : c);
             currentRate = currentRate / (1 - Number(best.discount) / 100);
        }

        // A. Genius
        if (geniusPct > 0) currentRate = currentRate / (1 - Number(geniusPct) / 100);
    }

    // 2. Unwind Non-Ref (Base Modifier)
    if (state.nonRefundableActive) {
        currentRate = currentRate / (1 - Number(state.nonRefundablePercent) / 100);
    }

    // 3. Unwind Multiplier
    return currentRate / state.multiplier;
};

// --- INLINE STYLES ---
// --- INLINE STYLES ---
// --- INLINE STYLES ---

// --- INLINE STYLES ---
const styles: { [key: string]: React.CSSProperties } = {
  page: { minHeight: '100vh', backgroundColor: '#1d1d1c', position: 'relative', overflow: 'hidden', color: '#e5e5e5' },
  gradientBg: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundImage: 'linear-gradient(to bottom right, rgba(57, 189, 248, 0.05), transparent, rgba(250, 255, 106, 0.05))', zIndex: 2 },
  contentWrapper: { position: 'relative', zIndex: 10, padding: '3rem' },
  header: { marginBottom: '2rem' },
  h1: { color: '#e5e5e5', fontSize: '1.875rem', lineHeight: '2.25rem', letterSpacing: '-0.025em', marginBottom: '0.5rem' },
  pSub: { color: '#9ca3af', fontSize: '0.875rem', lineHeight: '1.25rem' },
  toolsSection: { marginBottom: '2rem' },
  h2: { color: '#e5e5e5', fontSize: '1.25rem', lineHeight: '1.75rem', marginBottom: '1rem' },
  toolsGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '1.5rem' },
  card: { backgroundColor: '#1a1a1a', borderColor: '#2a2a2a', borderWidth: '1px', cursor: 'pointer' },
  cardDisabled: { backgroundColor: '#1a1a1a', borderColor: '#2a2a2a', borderWidth: '1px', opacity: 0.6, cursor: 'not-allowed' },
  cardHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' },
  cardHeaderContent: { display: 'flex', alignItems: 'center', gap: '0.75rem' },
  toolIconWrapperBase: { width: '2.5rem', height: '2.5rem', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  toolIconWrapperShadowfax: { backgroundImage: 'linear-gradient(to bottom right, #39BDF8, #29ADEE)' },
  toolIconWrapperCalc: { backgroundImage: 'linear-gradient(to bottom right, #6b7280, #4b5563)' },
  toolIcon: { width: '1.25rem', height: '1.25rem', color: '#0f0f0f' },
  cardTitle: { color: '#e5e5e5', fontSize: '1.125rem', lineHeight: '1.75rem' },
  cardDescShadowfax: { color: '#39BDF8', fontSize: '0.75rem', lineHeight: '1rem' },
  cardDescCalc: { color: '#6b7280', fontSize: '0.75rem', lineHeight: '1rem' },
  cardP: { color: '#9ca3af', fontSize: '0.875rem', lineHeight: '1.25rem' },
  cardPDisabled: { color: '#6b7280', fontSize: '0.875rem', lineHeight: '1.25rem' },
  tableWrapper: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'separate', borderSpacing: '0' },
  th: { textAlign: 'left', padding: '0.75rem 1rem', color: '#9ca3af', fontSize: '0.75rem', lineHeight: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #2a2a2a' },
  thCenter: { textAlign: 'center', padding: '0.75rem 1rem', color: '#9ca3af', fontSize: '0.75rem', lineHeight: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #2a2a2a' },
  trBase: { borderBottom: '1px solid #2a2a2a', backgroundColor: 'transparent', transition: 'background-color 0.2s' },
  trActive: { backgroundColor: '#1f1f1f', borderBottom: '1px solid #2a2a2a' },
  td: { paddingTop: '20px', paddingBottom: '20px', paddingLeft: '1rem', paddingRight: '1rem', color: '#e5e5e5' },
  hotelCell: { display: 'flex', alignItems: 'center', gap: '0.5rem' },
  hotelIcon: { width: '1rem', height: '1rem', color: '#39BDF8', flexShrink: 0 },
  hotelName: { color: '#e5e5e5' },
  inputBase: { backgroundColor: '#0f0f0f', borderColor: '#2a2a2a', color: '#e5e5e5', height: '2.25rem' },
  urlCell: { display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', minWidth: '150px' },
  urlStatusIconWrapper: { width: '1.5rem', height: '1.5rem', borderRadius: '9999px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  urlStatusIconWrapperConfigured: { backgroundColor: 'rgba(16, 185, 129, 0.2)' },
  urlStatusIconWrapperNotSet: { backgroundColor: 'rgba(107, 114, 128, 0.2)' },
  urlStatusIconConfigured: { width: '1rem', height: '1rem', color: '#10b981' },
  urlStatusIconNotSet: { width: '1rem', height: '1rem', color: '#6b7280' },
  urlStatusTextConfigured: { color: '#10b981', fontSize: '0.875rem', lineHeight: '1.25rem', marginLeft: '0.5rem' },
  urlStatusTextNotSet: { color: '#6b7280', fontSize: '0.875rem', lineHeight: '1.25rem', marginLeft: '0.5rem' },
  actionCell: { display: 'flex', justifyContent: 'center' },
  manageButton: { backgroundColor: '#0f0f0f', borderColor: '#2a2a2a', color: '#9ca3af', height: '2.25rem' },
  loaderWrapper: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '16rem' },
  loaderIcon: { width: '2rem', height: '2rem', color: '#39BDF8', animation: 'spin 1s linear infinite' },
  loaderText: { marginLeft: '0.75rem', color: '#9ca3af' },
  flexItemsCenter: { display: 'flex', alignItems: 'center' },
  accordionRow: { backgroundColor: 'transparent' },
  accordionContentWrapper: { backgroundColor: '#141414', paddingLeft: '16px', paddingRight: '24px', paddingTop: '24px', paddingBottom: '24px' },
  columnTitle: { color: '#39BDF8', fontSize: '14px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' },
  sectionLabel: { color: '#6b7280', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', display: 'block' },
  inputLabel: { color: '#e5e5e5', fontSize: '12px', marginBottom: '8px', display: 'block' },
  cardBg: { backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '4px', padding: '12px' },
  inputSmall: { width: '100px', height: '28px', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', color: '#e5e5e5', fontSize: '12px', textAlign: 'right' },
  selectTrigger: { backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', color: '#e5e5e5', height: '36px', fontSize: '12px' },
};

interface PropertyHubPageProps {
  onViewChange: (view: string) => void;
}

export function PropertyHubPage({ onViewChange }: PropertyHubPageProps) {
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editedValues, setEditedValues] = useState<Record<string, Partial<AssetRow>>>({});
  const [editingUrlId, setEditingUrlId] = useState<string | null>(null);
  const [expandedAssetId, setExpandedAssetId] = useState<string | null>(null);
  const [hoveredAssetId, setHoveredAssetId] = useState<string | null>(null);
  
  const [calculatorStates, setCalculatorStates] = useState<Record<string, CalculatorState>>({});

  useEffect(() => {
    const fetchAssets = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/property-hub/assets');
        if (!response.ok) throw new Error('Failed to fetch assets');
        const data = await response.json();
        setAssets(data);

        // HYDRATE CALCULATOR STATE FROM DB
        const initialCalcStates: Record<string, CalculatorState> = {};
        
        data.forEach((asset: any) => {
            // Parse DB Settings or Fallback to Defaults
            const settings = asset.calculator_settings || {};
            const multiplier = asset.strategic_multiplier ? parseFloat(asset.strategic_multiplier) : 1.3;
            
            // Map JSONB to Local State
            initialCalcStates[asset.id] = {
                multiplier: multiplier,
                campaigns: settings.campaigns ? settings.campaigns.map((c: any) => ({
                    ...c,
                    startDate: c.startDate ? new Date(c.startDate) : undefined,
                    endDate: c.endDate ? new Date(c.endDate) : undefined,
                    isEditing: false // Default to false on load
                })) : [],
                
                mobileActive: settings.mobile?.active ?? true,
                mobilePercent: settings.mobile?.percent ?? 10,
                
                nonRefundableActive: settings.nonRef?.active ?? true,
                nonRefundablePercent: settings.nonRef?.percent ?? 15,
                
                countryRateActive: settings.country?.active ?? false,
                countryRatePercent: settings.country?.percent ?? 5,

                // Calc Logic Defaults
                targetSellRate: 100,
                pmsRate: 0, // Will be calculated below
                testStayDate: new Date(),
                editingField: 'target'
            };

            // Run initial Forward Calc to set the PMS Rate based on the loaded multiplier
           // Run initial Reverse Calc: If target is 100, what is the PMS rate?
            const genius = asset.genius_discount_pct || 0;
            const pmsVal = calculateRequiredPMSRate(100, genius, initialCalcStates[asset.id]);
            initialCalcStates[asset.id].pmsRate = pmsVal;
        });

        setCalculatorStates(initialCalcStates);

      } catch (error) {
        console.error(error);
        toast.error('Could not load Property Hub assets.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchAssets();
  }, []);

  // [UPDATED] saveAssetChanges now accepts an optional explicit state to support instant saves
  const saveAssetChanges = async (assetId: string, updates: Partial<AssetRow>, explicitCalcState?: CalculatorState) => {
    const originalAsset = assets.find(a => a.id === assetId);
    if (!originalAsset) return;
    
    // 1. Get Current Calculator State (use explicit if provided to avoid stale state during async updates)
    const currentCalcState = explicitCalcState || calculatorStates[assetId] || DEFAULT_CALCULATOR_STATE;

    // 2. Prepare the JSONB payload
    const calculatorSettingsPayload = {
        mobile: { active: currentCalcState.mobileActive, percent: currentCalcState.mobilePercent },
        nonRef: { active: currentCalcState.nonRefundableActive, percent: currentCalcState.nonRefundablePercent },
        country: { active: currentCalcState.countryRateActive, percent: currentCalcState.countryRatePercent },
        // Ensure we don't save 'isEditing' to DB (clean it up)
        campaigns: currentCalcState.campaigns.map(({ isEditing, ...rest }) => rest)
    };

    // 3. Merge updates
    const payload = { 
        ...originalAsset, 
        ...updates,
        // Add Calculator Fields to the PUT request
        strategic_multiplier: currentCalcState.multiplier,
        calculator_settings: calculatorSettingsPayload
    };

    setAssets(prev => prev.map(asset => asset.id === assetId ? { ...asset, ...updates } : asset));

    try {
      const response = await fetch(`/api/property-hub/assets/${assetId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      

      if (!response.ok) throw new Error('Failed to save changes');
      const savedAsset = await response.json();
      
      toast.dismiss(); // Dismiss any currently visible toasts
      toast.success('Settings saved successfully'); 
      return true;
    } catch (error) {
      console.error(error);
      toast.dismiss(); // Dismiss any currently visible toasts
      toast.error('Failed to save changes.'); 
      return false;
    }
  };

  const handleInputChange = (assetId: string, field: keyof AssetRow, value: string | number | null) => {
    setEditedValues(prev => ({
      ...prev,
      [assetId]: { ...prev[assetId], [field]: value },
    }));
  };

  const toggleAsset = (assetId: string) => {
    if (expandedAssetId !== assetId) {
      if (!calculatorStates[assetId]) {
        setCalculatorStates(prev => ({
          ...prev,
          [assetId]: { ...DEFAULT_CALCULATOR_STATE }
        }));
      }
      setExpandedAssetId(assetId);
    } else {
      setExpandedAssetId(null);
    }
  };

  const getInputValue = (assetId: string, field: keyof AssetRow, defaultValue: any) => {
    return editedValues[assetId]?.[field] ?? defaultValue;
  };

  // --- CALCULATOR LOGIC ---
  const updateCalculatorState = (assetId: string, updates: Partial<CalculatorState>) => {
    setCalculatorStates(prev => {
        const current = prev[assetId] || DEFAULT_CALCULATOR_STATE;
        const newState = { ...current, ...updates };
        
        let calculatedValue = 0;
        const asset = assets.find(a => a.id === assetId);
        const geniusDiscount = asset ? (getInputValue(asset.id, 'genius_discount_pct', asset.genius_discount_pct ?? 0)) : 0;

if (newState.editingField === 'target') {
             // If I change Target, calculate required PMS
             calculatedValue = calculateRequiredPMSRate(newState.targetSellRate, geniusDiscount, newState);
             newState.pmsRate = calculatedValue;
        } else {
             // If I change PMS, calculate resulting Sell Rate
             calculatedValue = calculateSellRate(newState.pmsRate, geniusDiscount, newState);
             newState.targetSellRate = calculatedValue;
        }
        
        return { ...prev, [assetId]: newState };
    });
  };

  const addCampaign = (assetId: string, slug: string) => {
    const now = new Date();
    let name = 'New Campaign';
    let discount = 10;
    let start = now;
    let end = new Date(now); end.setDate(now.getDate() + 14);

    if(slug === 'late-escape') { name="Late Escape"; discount=30; end.setDate(now.getDate()+7); }
    else if(slug === 'early-deal') { name="Early Deal"; discount=20; start=new Date(now); start.setDate(now.getDate()+30); end=new Date(start); end.setDate(start.getDate()+30); }
    else if(slug === 'basic-deal') { name="Basic Deal"; discount=15; }
    else if(slug === 'black-friday') { name="Black Friday"; discount=40; }

    const newCampaign: Campaign = {
        id: Math.random().toString(36).substr(2, 9),
        slug, name, discount, startDate: start, endDate: end, active: true,
        isEditing: true // Start in edit mode
    };

    setCalculatorStates(prev => {
        const current = prev[assetId] || DEFAULT_CALCULATOR_STATE;
        const newCampaigns = [...current.campaigns, newCampaign];
        const newState = { ...current, campaigns: newCampaigns };
        
        const asset = assets.find(a => a.id === assetId);
        const geniusDiscount = asset ? (getInputValue(asset.id, 'genius_discount_pct', asset.genius_discount_pct ?? 0)) : 0;
        
        // [FIXED] Use new function names
        if (newState.editingField === 'target') {
             newState.pmsRate = calculateRequiredPMSRate(newState.targetSellRate, geniusDiscount, newState);
        } else {
             newState.targetSellRate = calculateSellRate(newState.pmsRate, geniusDiscount, newState);
        }
        
        return { ...prev, [assetId]: newState };
    });
  };

  const updateCampaign = (assetId: string, campId: string, updates: Partial<Campaign>) => {
    setCalculatorStates(prev => {
        const current = prev[assetId] || DEFAULT_CALCULATOR_STATE;
        const newCampaigns = current.campaigns.map(c => c.id === campId ? { ...c, ...updates } : c);
        const newState = { ...current, campaigns: newCampaigns };
        
        const asset = assets.find(a => a.id === assetId);
        const geniusDiscount = asset ? (getInputValue(asset.id, 'genius_discount_pct', asset.genius_discount_pct ?? 0)) : 0;

        // [FIXED] Use new function names
        if (newState.editingField === 'target') {
             newState.pmsRate = calculateRequiredPMSRate(newState.targetSellRate, geniusDiscount, newState);
        } else {
             newState.targetSellRate = calculateSellRate(newState.pmsRate, geniusDiscount, newState);
        }

        return { ...prev, [assetId]: newState };
    });
  };

// [NEW] Helper to save edits (lock the row) AND PERSIST immediately
  const confirmCampaignEdit = (assetId: string, campId: string) => {
    // 1. Calculate the new state synchronously to ensure we send the right data
    const current = calculatorStates[assetId] || DEFAULT_CALCULATOR_STATE;
    const newCampaigns = current.campaigns.map(c => {
        if (c.id === campId) {
            return { ...c, isEditing: false }; // Lock it
        }
        return c;
    });
    const newState = { ...current, campaigns: newCampaigns };

    // 2. Update local UI state
    setCalculatorStates(prev => ({ ...prev, [assetId]: newState }));

    // 3. Persist to Backend immediately
    saveAssetChanges(assetId, {}, newState);
  };

  const removeCampaign = (assetId: string, campId: string) => {
    setCalculatorStates(prev => {
        const current = prev[assetId] || DEFAULT_CALCULATOR_STATE;
        const newCampaigns = current.campaigns.filter(c => c.id !== campId);
        const newState = { ...current, campaigns: newCampaigns };
        
        const asset = assets.find(a => a.id === assetId);
        const geniusDiscount = asset ? (getInputValue(asset.id, 'genius_discount_pct', asset.genius_discount_pct ?? 0)) : 0;
        
        // [FIXED] Use new function names
        if (newState.editingField === 'target') {
             newState.pmsRate = calculateRequiredPMSRate(newState.targetSellRate, geniusDiscount, newState);
        } else {
             newState.targetSellRate = calculateSellRate(newState.pmsRate, geniusDiscount, newState);
        }

        // Also persist deletion immediately for consistency
        saveAssetChanges(assetId, {}, newState);

        return { ...prev, [assetId]: newState };
    });
  };
  return (
    <div style={styles.page} className="property-hub-page-wrapper">
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .property-hub-page-wrapper::before {
          content: ""; position: absolute; top: 0; left: 0; right: 0; bottom: 0;
          background-image: linear-gradient(rgba(57,189,248,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(57,189,248,0.03)_1px,transparent_1px);
          background-size: 64px 64px; z-index: 5; 
        }
        input[type=number]::-webkit-inner-spin-button, 
        input[type=number]::-webkit-outer-spin-button { 
          -webkit-appearance: none; 
          margin: 0; 
        }
        input[type=number] {
          -moz-appearance: textfield;
        }
      `}</style>

      <div style={styles.gradientBg}></div>

      <div style={styles.contentWrapper}>
        <div style={styles.header}>
          <h1 style={styles.h1}>Property Hub</h1>
          <p style={styles.pSub}>Manage all Sentinel AI tools and asset configurations</p>
        </div>

        {/* Tools Grid */}
        <div style={styles.toolsSection}>
          <h2 style={styles.h2}>Tools</h2>
          <div style={styles.toolsGrid}>
            <Card style={styles.card} className="hover:border-[#39BDF8]/50 transition-colors" onClick={() => onViewChange('shadowfax')}>
              <CardHeader>
                <div style={styles.cardHeader}>
                  <div style={styles.cardHeaderContent}>
                    <div style={{...styles.toolIconWrapperBase, ...styles.toolIconWrapperShadowfax}}>
                      <Wind style={styles.toolIcon} />
                    </div>
                    <div>
                      <CardTitle style={styles.cardTitle}>Shadowfax</CardTitle>
                      <CardDescription style={styles.cardDescShadowfax}>Live Price Checker</CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent><p style={styles.cardP}>Run on-demand, live price scrapes.</p></CardContent>
            </Card>

            <Card style={styles.cardDisabled}>
              <CardHeader>
                <div style={styles.cardHeader}>
                  <div style={styles.cardHeaderContent}>
                    <div style={{...styles.toolIconWrapperBase, ...styles.toolIconWrapperCalc}}>
                      <Calculator style={styles.toolIcon} />
                    </div>
                    <div>
                      <CardTitle style={{...styles.cardTitle, color: '#9ca3af'}}>Channel Rate Replicator</CardTitle>
                      <CardDescription style={styles.cardDescCalc}>Predict Final Sell Rates</CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-[#faff6a]/10 text-[#faff6a] border-[#faff6a]/30">Coming Soon</Badge>
                </div>
              </CardHeader>
              <CardContent><p style={styles.cardPDisabled}>Two-way calculator for checking discount stacks.</p></CardContent>
            </Card>
          </div>
        </div>

        {/* Master Asset Configuration Table */}
        <Card style={styles.card}>
          <CardHeader>
            <CardTitle style={styles.h2}>Master Asset Configuration</CardTitle>
            <CardDescription style={styles.pSub}>Configure Sentinel settings and AI boundaries</CardDescription>
          </CardHeader>
          <CardContent>
            <div style={styles.tableWrapper}>
              {isLoading ? (
                <div style={styles.loaderWrapper}><Loader2 style={styles.loaderIcon} /><p style={styles.loaderText}>Loading Assets...</p></div>
              ) : (
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Hotel</th>
                      <th style={styles.th}>Multiplier</th>
                      <th style={styles.thCenter}>Booking.com URL</th>
                      <th style={styles.th}>Active Deals</th>
                      <th style={styles.thCenter}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assets.map((asset) => {
                      const isExpanded = expandedAssetId === asset.id;
                      const isHovered = hoveredAssetId === asset.id;
                      const rowStyle = isExpanded ? styles.trActive : (isHovered ? styles.trActive : styles.trBase);
                      
                      const calcState = calculatorStates[asset.id] || DEFAULT_CALCULATOR_STATE;
                      const geniusDiscount = getInputValue(asset.id, 'genius_discount_pct', asset.genius_discount_pct ?? 0);

                      // Badge Logic
                      const badges = [];
                      if (calcState.multiplier !== 1.0) {
                        badges.push({ label: `x${calcState.multiplier} Multiplier`, type: 'multiplier' });
                      }
                      if (geniusDiscount > 0) badges.push({ label: `Genius (${geniusDiscount}%)`, type: 'genius' });
                      if (calcState.mobileActive) badges.push({ label: `Mobile (${calcState.mobilePercent}%)`, type: 'plan' });
                      if (calcState.nonRefundableActive) badges.push({ label: `Non-Ref (${calcState.nonRefundablePercent}%)`, type: 'plan' });
                      
                      calcState.campaigns.forEach(c => {
                         if(c.active) badges.push({ label: `${c.name} (${c.discount}%)`, type: 'campaign' });
                      });

                     return (
                        <Fragment key={asset.id}>
                          <tr style={rowStyle} onMouseEnter={() => setHoveredAssetId(asset.id)} onMouseLeave={() => setHoveredAssetId(null)}>
                            <td style={styles.td}>
                              <div style={styles.hotelCell}>
                                <Building2 style={styles.hotelIcon} />
                                <span style={styles.hotelName}>{asset.asset_name}</span>
                                {asset.market_pulse_hotel_id ? (
                                  <Badge variant="outline" className="bg-[#10b981]/10 text-[#10b981] border-[#10b981]/30 text-xs">Live</Badge>
                                ) : (
                                  <Badge variant="outline" className="bg-[#6b7280]/10 text-[#6b7280] border-[#6b7280]/30 text-xs">Off-Platform</Badge>
                                )}
                              </div>
                            </td>

                            <td style={styles.td}>
                                <span style={{color: '#e5e5e5'}}>x{calcState.multiplier}</span>
                            </td>

                            <td style={styles.td}>
                              <div style={{ display: 'flex', justifyContent: 'center' }}>
                                {editingUrlId === asset.id ? (
                                  <Input
                                    type="text"
                                    value={getInputValue(asset.id, 'booking_com_url', asset.booking_com_url ?? '')}
                                    onChange={(e) => handleInputChange(asset.id, 'booking_com_url', e.target.value)}
                                    onBlur={() => {
                                      const newValue = editedValues[asset.id]?.booking_com_url;
                                      if (newValue !== undefined && newValue !== asset.booking_com_url) {
                                         saveAssetChanges(asset.id, { booking_com_url: newValue });
                                      }
                                      setEditingUrlId(null);
                                    }}
                                    autoFocus
                                    style={styles.inputBase}
                                    className="focus:border-[#39BDF8]/50"
                                    placeholder="https://booking.com/..."
                                  />
                                ) : (
                                  <div style={styles.urlCell} className="hover:opacity-80 transition-opacity" onClick={() => setEditingUrlId(asset.id)}>
                                    {asset.booking_com_url ? (
                                      <div style={styles.flexItemsCenter}>
                                        <div style={{...styles.urlStatusIconWrapper, ...styles.urlStatusIconWrapperConfigured}}><Check style={styles.urlStatusIconConfigured} /></div>
                                        <span style={styles.urlStatusTextConfigured}>Configured</span>
                                      </div>
                                    ) : (
                                      <div style={styles.flexItemsCenter}>
                                        <div style={{...styles.urlStatusIconWrapper, ...styles.urlStatusIconWrapperNotSet}}><X style={styles.urlStatusIconNotSet} /></div>
                                        <span style={styles.urlStatusTextNotSet}>Not Set</span>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>

                            <td style={styles.td}>
                                <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap'}}>
                                    {badges.map((b, idx) => {
                                        let badgeStyle = {};
                                        if(b.type === 'genius') badgeStyle = {backgroundColor: 'rgba(57, 189, 248, 0.1)', color: '#39BDF8', border: '1px solid rgba(57, 189, 248, 0.3)'};
                                        else if(b.type === 'plan') badgeStyle = {backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)'};
                                        else if(b.type === 'campaign') badgeStyle = {backgroundColor: 'rgba(250, 255, 106, 0.1)', color: '#faff6a', border: '1px solid rgba(250, 255, 106, 0.3)'};
                                        else if(b.type === 'multiplier') badgeStyle = {backgroundColor: 'rgba(249, 115, 22, 0.1)', color: '#f97316', border: '1px solid rgba(249, 115, 22, 0.3)'};
                                        
                                        return <Badge key={idx} variant="outline" style={badgeStyle}>{b.label}</Badge>;
                                    })}
                                </div>
                            </td>

                            <td style={styles.td}>
                              <div style={styles.actionCell}>
                                <Button variant="outline" size="sm" onClick={() => toggleAsset(asset.id)} style={styles.manageButton} className="hover:bg-[#1a1a1a] hover:text-[#39BDF8] hover:border-[#39BDF8]">
                                  {isExpanded ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
                                  {isExpanded ? 'Collapse' : 'Configure'}
                                </Button>
                              </div>
                            </td>
                          </tr>

                          {/* Accordion Row */}
                          {isExpanded && (
                            <tr style={styles.accordionRow}>
                              <td colSpan={5} style={{ padding: 0 }}>
                                <div style={styles.accordionContentWrapper}>
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                                    
                                    {/* LEFT COLUMN: RULES */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                      <h3 style={styles.columnTitle}><span style={{ color: '#39BDF8' }}>●</span> Rules</h3>
                                      
                       {/* Global */}
                                      <div>
                                        <Label style={styles.sectionLabel}>Global</Label>
                                        <div style={styles.cardBg}>
                                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <Label style={{...styles.inputLabel, marginBottom: 0}}>Strategic Multiplier</Label>
                                            <Input type="number" step="0.1" value={calcState.multiplier}
                                                onChange={(e) => updateCalculatorState(asset.id, { multiplier: parseFloat(e.target.value) || 0 })}
                                                style={styles.inputSmall}
                                            />
                                          </div>
                                        </div>
                                      </div>

                                      {/* Rate Plans */}
                                      <div>
                                        <Label style={styles.sectionLabel}>Rate Plans</Label>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <div style={styles.cardBg}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                        <Checkbox checked={calcState.nonRefundableActive} onCheckedChange={(c) => updateCalculatorState(asset.id, { nonRefundableActive: !!c })} style={{borderColor: '#2a2a2a'}} />
                                                        <Label style={{...styles.inputLabel, marginBottom: 0}}>Non-Refundable</Label>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <Input type="number" value={calcState.nonRefundablePercent} onChange={(e) => updateCalculatorState(asset.id, { nonRefundablePercent: parseFloat(e.target.value)||0 })} style={styles.inputSmall} />
                                                        <span style={{ color: '#6b7280', fontSize: '12px' }}>%</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div style={styles.cardBg}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                        <Checkbox checked={calcState.mobileActive} onCheckedChange={(c) => updateCalculatorState(asset.id, { mobileActive: !!c })} style={{borderColor: '#2a2a2a'}} />
                                                        <Label style={{...styles.inputLabel, marginBottom: 0}}>Mobile Rate</Label>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <Input type="number" value={calcState.mobilePercent} onChange={(e) => updateCalculatorState(asset.id, { mobilePercent: parseFloat(e.target.value)||0 })} style={styles.inputSmall} />
                                                        <span style={{ color: '#6b7280', fontSize: '12px' }}>%</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                      </div>

                                      {/* Static Discounts */}
                                      <div>
                                        <Label style={styles.sectionLabel}>Static Discounts</Label>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                          <div style={styles.cardBg}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                        <Checkbox 
                                                            checked={!!geniusDiscount} 
                                                            onCheckedChange={(checked) => {
                                                                const newVal = checked ? (geniusDiscount || 10) : 0;
                                                                handleInputChange(asset.id, 'genius_discount_pct', newVal);
                                                                
                                                                if (calcState.editingField === 'target') {
                                                                    const newPms = runForwardSimulation(calcState.targetSellRate, newVal, calcState);
                                                                    setCalculatorStates(prev => ({ ...prev, [asset.id]: { ...prev[asset.id], pmsRate: newPms } }));
                                                                } else {
                                                                    const newTarget = runBackwardSimulation(calcState.pmsRate, newVal, calcState);
                                                                    setCalculatorStates(prev => ({ ...prev, [asset.id]: { ...prev[asset.id], targetSellRate: newTarget } }));
                                                                }
                                                            }}
                                                            style={{borderColor: '#2a2a2a'}} 
                                                        />
                                                        <Label style={{...styles.inputLabel, marginBottom: 0}}>Genius</Label>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <Input 
                                                            type="number" 
                                                            value={geniusDiscount} 
                                                            onChange={(e) => {
                                                                handleInputChange(asset.id, 'genius_discount_pct', e.target.value ? parseFloat(e.target.value) : null);
                                                                const newGenius = parseFloat(e.target.value) || 0;
                                                                if (calcState.editingField === 'target') {
                                                                    const newPms = runForwardSimulation(calcState.targetSellRate, newGenius, calcState);
                                                                    setCalculatorStates(prev => ({ ...prev, [asset.id]: { ...prev[asset.id], pmsRate: newPms } }));
                                                                } else {
                                                                    const newTarget = runBackwardSimulation(calcState.pmsRate, newGenius, calcState);
                                                                    setCalculatorStates(prev => ({ ...prev, [asset.id]: { ...prev[asset.id], targetSellRate: newTarget } }));
                                                                }
                                                            }}
                                                            onBlur={() => {
                                                              if (editedValues[asset.id]?.genius_discount_pct !== undefined) {
                                                                 saveAssetChanges(asset.id, { genius_discount_pct: editedValues[asset.id]?.genius_discount_pct });
                                                              }
                                                            }}
                                                            style={styles.inputSmall} 
                                                        />
                                                        <span style={{ color: '#6b7280', fontSize: '12px' }}>%</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                      </div>

                                      {/* Campaigns */}
                                      <div>
                                        <Label style={styles.sectionLabel}>Campaigns</Label>
                                        <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
                                            
                                            {/* Campaign List */}
                                            {calcState.campaigns.map((camp) => (
                                                <div 
                                                    key={camp.id} 
                                                    // Conditional Styling for "Edit Mode"
                                                    style={{
                                                        ...styles.cardBg,
                                                        ...(camp.isEditing ? {
                                                            backgroundColor: 'rgba(57, 189, 248, 0.05)',
                                                            border: '1px solid #39BDF8'
                                                        } : {})
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', flexDirection: camp.isEditing ? 'column' : 'row', alignItems: camp.isEditing ? 'flex-start' : 'center', justifyContent: 'space-between', gap: camp.isEditing ? '16px' : '0' }}>
                                                        
                                                        {/* Left: Toggle & Name */}
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: camp.isEditing ? '100%' : 'auto' }}>
                                                            <Checkbox checked={camp.active} onCheckedChange={(c) => updateCampaign(asset.id, camp.id, {active: !!c})} style={{borderColor: '#2a2a2a'}} />
                                                            <Label style={{...styles.inputLabel, marginBottom: 0, color: camp.isEditing ? '#39BDF8' : '#e5e5e5'}}>{camp.name}</Label>
                                                        </div>

                                                        {/* Right: Date Logic & Controls */}
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: camp.isEditing ? '100%' : 'auto', justifyContent: camp.isEditing ? 'space-between' : 'flex-end' }}>
                                                            
                                                            {/* Mode: EDITING */}
                                                            {camp.isEditing ? (
                                                                <div style={{display: 'flex', gap: '16px', width: '100%'}}>
                                                                    {/* Edit Grid */}
                                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: '12px', flex: 1 }}>
                                                                        <div>
                                                                            <Label style={{fontSize: '10px', color: '#9ca3af', marginBottom: '4px'}}>Start Date</Label>
                                                                            <Popover>
                                                                                <PopoverTrigger asChild>
                                                                                    <Button variant="outline" className="w-full h-8 text-xs border-[#39BDF8]/30 bg-[#0f0f0f] text-[#e5e5e5] justify-start text-left font-normal">
                                                                                        <CalendarIcon className="mr-2 h-3 w-3 opacity-50" />
                                                                                        {camp.startDate ? format(camp.startDate, 'MMM d') : 'Pick date'}
                                                                                    </Button>
                                                                                </PopoverTrigger>
                                                                              <PopoverContent className="w-auto p-0 bg-[#1a1a18] border-[#2a2a2a]">
                                                        <Calendar 
                                                            mode="single" 
                                                            selected={camp.startDate} 
                                                            onSelect={(d) => updateCampaign(asset.id, camp.id, {startDate: d})} 
                                                            // [UI FIX] Remove confusing background from 'Today' so only Selected looks selected
                                                            classNames={{
                                                                day_today: "text-[#39BDF8] font-bold"
                                                            }}
                                                        />
                                                    </PopoverContent>
                                                                            </Popover>
                                                                        </div>
                                                                        <div>
                                                                            <Label style={{fontSize: '10px', color: '#9ca3af', marginBottom: '4px'}}>End Date</Label>
                                                                            <Popover>
                                                                                <PopoverTrigger asChild>
                                                                                    <Button variant="outline" className="w-full h-8 text-xs border-[#39BDF8]/30 bg-[#0f0f0f] text-[#e5e5e5] justify-start text-left font-normal">
                                                                                        <CalendarIcon className="mr-2 h-3 w-3 opacity-50" />
                                                                                        {camp.endDate ? format(camp.endDate, 'MMM d') : 'Pick date'}
                                                                                    </Button>
                                                                                </PopoverTrigger>
                                                                             <PopoverContent className="w-auto p-0 bg-[#1a1a18] border-[#2a2a2a]">
                                                        <Calendar 
                                                            mode="single" 
                                                            selected={camp.endDate} 
                                                            onSelect={(d) => updateCampaign(asset.id, camp.id, {endDate: d})} 
                                                            // [UI FIX] Remove confusing background from 'Today' so only Selected looks selected
                                                            classNames={{
                                                                day_today: "text-[#39BDF8] font-bold"
                                                            }}
                                                        />
                                                    </PopoverContent>
                                                                            </Popover>
                                                                        </div>
                                                                        <div>
                                                                            <Label style={{fontSize: '10px', color: '#9ca3af', marginBottom: '4px'}}>End Date</Label>
                                                                            <Popover>
                                                                                <PopoverTrigger asChild>
                                                                                    <Button variant="outline" className="w-full h-8 text-xs border-[#39BDF8]/30 bg-[#0f0f0f] text-[#e5e5e5] justify-start text-left font-normal">
                                                                                        <CalendarIcon className="mr-2 h-3 w-3 opacity-50" />
                                                                                        {camp.endDate ? format(camp.endDate, 'MMM d') : 'Pick date'}
                                                                                    </Button>
                                                                                </PopoverTrigger>
                                                                             <PopoverContent className="w-auto p-0 bg-[#1a1a18] border-[#2a2a2a]">
                                                        <Calendar 
                                                            mode="single" 
                                                            selected={calcState.testStayDate} 
                                                            onSelect={(d) => updateCalculatorState(asset.id, {testStayDate: d})} 
                                                            // [UI FIX] Remove confusing background from 'Today' so only Selected looks selected
                                                            classNames={{
                                                                day_today: "text-[#39BDF8] font-bold"
                                                            }}
                                                        />
                                                    </PopoverContent>
                                                                            </Popover>
                                                                        </div>
                                                                        <div>
                                                                            <Label style={{fontSize: '10px', color: '#9ca3af', marginBottom: '4px'}}>Discount %</Label>
                                                                            <Input 
                                                                                type="number" 
                                                                                value={camp.discount} 
                                                                                onChange={(e) => updateCampaign(asset.id, camp.id, { discount: parseFloat(e.target.value)||0 })} 
                                                                                style={{backgroundColor: '#0f0f0f', height: '32px'}}
                                                                                className="border-[#39BDF8]/30 text-[#e5e5e5] focus:border-[#39BDF8]"
                                                                            />
                                                                        </div>
                                                                    </div>

                                                                    {/* Actions */}
                                                                    <div style={{display: 'flex', alignItems: 'flex-end'}}>
                                                                        <Button 
                                                                            size="sm" 
                                                                            onClick={() => confirmCampaignEdit(asset.id, camp.id)} 
                                                                            className="h-8 bg-[#39BDF8] text-[#0f0f0f] hover:bg-[#29ADEE]"
                                                                        >
                                                                            <Check className="h-4 w-4" />
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                            // Mode: VIEW (Read-Only Dates)
                                                                <>
                                                                    <div style={{fontSize: '11px', color: '#6b7280', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: '1.1'}}>
                                                                        <span 
                                                                            onClick={() => editCampaign(asset.id, camp.id)}
                                                                            style={{cursor: 'pointer', borderBottom: '1px dashed #2a2a2a'}}
                                                                            className="hover:text-[#39BDF8] hover:border-[#39BDF8]"
                                                                        >
                                                                            {camp.startDate ? format(camp.startDate, 'MMM d') : '?'} - {camp.endDate ? format(camp.endDate, 'MMM d') : '?'}
                                                                        </span>
                                                                    </div>

                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                        <Input type="number" value={camp.discount} onChange={(e) => updateCampaign(asset.id, camp.id, { discount: parseFloat(e.target.value)||0 })} style={styles.inputSmall} />
                                                                        <span style={{ color: '#6b7280', fontSize: '12px' }}>%</span>
                                                                    </div>
                                                                    
                                                                    <Button variant="ghost" size="sm" onClick={() => removeCampaign(asset.id, camp.id)} className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-900/20">
                                                                        <X className="h-4 w-4" />
                                                                    </Button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}

                                            {/* Add Campaign Button */}
                                            <Select onValueChange={(val) => addCampaign(asset.id, val)}>
                                                <SelectTrigger style={styles.selectTrigger} className="border-dashed border-[#2a2a2a] text-[#9ca3af] hover:text-[#39BDF8] hover:border-[#39BDF8] transition-colors">
                                                    <SelectValue placeholder="+ Add Campaign" />
                                                </SelectTrigger>
                                                <SelectContent style={{backgroundColor: '#1a1a18', border: '1px solid #262626', color: '#e5e5e5'}}>
                                                    <SelectItem value="late-escape">Late Escape</SelectItem>
                                                    <SelectItem value="early-deal">Early Deal</SelectItem>
                                                    <SelectItem value="basic-deal">Basic Deal</SelectItem>
                                                    <SelectItem value="black-friday">Black Friday</SelectItem>
                                                </SelectContent>
                                            </Select>

                                        </div>
                                      </div>

                                    </div>

                                    {/* RIGHT COLUMN: SIMULATOR */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                        <h3 style={styles.columnTitle}><span style={{ color: '#39BDF8' }}>●</span> Simulator</h3>
                                        
                                        {/* Test Stay Date */}
                                        <div>
                                            <Label style={styles.sectionLabel}>Test Stay Date</Label>
                                            <div style={{...styles.cardBg, display: 'flex', flexDirection: 'column', gap: '8px'}}>
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <Button variant="outline" style={{...styles.inputBase, width: '100%', justifyContent: 'flex-start', paddingLeft: '12px'}}>
                                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                                            {calcState.testStayDate ? format(calcState.testStayDate, 'PPP') : 'Pick a date'}
                                                        </Button>
                                                    </PopoverTrigger>
                                              <PopoverContent className="w-auto p-0 bg-[#1a1a18] border-[#2a2a2a]">
                                                        <Calendar 
                                                            mode="single" 
                                                            selected={calcState.testStayDate} 
                                                            onSelect={(d) => updateCalculatorState(asset.id, {testStayDate: d})} 
                                                            // [UI FIX] Remove confusing background from 'Today' so only Selected looks selected
                                                            classNames={{
                                                                day_today: "text-[#39BDF8] font-bold"
                                                            }}
                                                        />
                                                    </PopoverContent>
                                                </Popover>
                                                {/* Show active campaigns for this date */}
                                                {(() => {
                                                    const activeCamps = calcState.campaigns.filter(c => isCampaignValidForDate(calcState.testStayDate, c));
                                                    if(activeCamps.length > 0) {
                                                        return (
                                                            <div style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                                                                {activeCamps.map(c => (
                                                                    <div key={c.id} style={{color: '#FAFF6A', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px'}}>
                                                                        <span>✓</span> {c.name} Active
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                })()}
                                            </div>
                                        </div>

                                        {/* Two-Way Inputs */}
                                        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px'}}>
                                            <div>
                                                <Label style={styles.inputLabel}>Target Sell Rate</Label>
                                                <div style={{position: 'relative'}}>
                                                    <PoundSterling style={{position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '12px', height: '12px', color: '#39BDF8'}} />
                                                    <Input type="number" 
                                                        value={Math.round(calcState.targetSellRate)}
                                                        onFocus={() => updateCalculatorState(asset.id, { editingField: 'target' })}
                                                        onChange={(e) => updateCalculatorState(asset.id, { targetSellRate: parseFloat(e.target.value)||0 })}
                                                        style={{...styles.inputBase, paddingLeft: '36px'}}
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <Label style={styles.inputLabel}>PMS Rate</Label>
                                                <div style={{position: 'relative'}}>
                                                    <PoundSterling style={{position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '12px', height: '12px', color: '#39BDF8'}} />
                                                    <Input type="number" 
                                                        value={Math.round(calcState.pmsRate)}
                                                        onFocus={() => updateCalculatorState(asset.id, { editingField: 'pms' })}
                                                        onChange={(e) => updateCalculatorState(asset.id, { pmsRate: parseFloat(e.target.value)||0 })}
                                                        style={{...styles.inputBase, paddingLeft: '36px'}}
                                                    />
                                                </div>
                                            </div>
                                        </div>

   {/* Visual Cascade */}
     {/* Visual Cascade */}
                                        {/* Visual Cascade */}
                   {/* Visual Cascade */}
                                        <div>
                                            <Label style={styles.sectionLabel}>
                                                Price Waterfall (Highest → Lowest)
                                            </Label>
                                            <div style={{...styles.cardBg, padding: '16px'}}>
                                                {(() => {
                                                    const steps = [];
                                                    
                                                    // 1. Init Values
                                                    const pmsVal = Number(calcState.pmsRate);
                                                    const multiplierVal = pmsVal * Number(calcState.multiplier);
                                                    
                                                    // Level 0: Multiplier
                                                    let currentRate = multiplierVal;
                                                    steps.push({ 
                                                        label: `Multiplier Rate (Base £${pmsVal.toFixed(2)} × ${calcState.multiplier})`, 
                                                        rate: currentRate, 
                                                        indent: 0 
                                                    });

                                                    // Level 1: Non-Ref (Base Modifier)
                                                    if (calcState.nonRefundableActive) {
                                                        const beforeRate = currentRate;
                                                        currentRate = currentRate * (1 - Number(calcState.nonRefundablePercent) / 100);
                                                        // Calculate diff for display
                                                        const diff = beforeRate - currentRate; 
                                                        steps.push({ label: `Non-Refundable Rate Plan (-${calcState.nonRefundablePercent}%)`, rate: currentRate, indent: 0 });
                                                    }

                                                    // Level 2: Discount Stack (Daisy Chain)
                                                    const deepDeal = calcState.campaigns.find(c => ['black-friday', 'limited-time'].includes(c.slug) && isCampaignValidForDate(calcState.testStayDate, c));

                                                    if (deepDeal) {
                                                        // BRANCH A: Deep Deal (Exclusive)
                                                        currentRate = currentRate * (1 - Number(deepDeal.discount) / 100);
                                                        steps.push({ label: `⚡ ${deepDeal.name} (Exclusive -${deepDeal.discount}%)`, rate: currentRate, indent: 1, isBold: true });
                                                        steps.push({ label: '(Ignores Genius, Mobile & Standard Campaigns)', rate: currentRate, indent: 2, isInfo: true });
                                                    } else {
                                                        // BRANCH B: Sequential Daisy Chain
                                                        
                                                        // Step A: Genius (Applied First)
                                                        const gPct = Number(geniusDiscount);
                                                        if (gPct > 0) {
                                                            currentRate = currentRate * (1 - gPct / 100);
                                                            steps.push({ label: `Genius (-${gPct}%)`, rate: currentRate, indent: 1 });
                                                        }

                                                        // Step B: Standard Campaign (Applied to Post-Genius)
                                                        const validStandard = calcState.campaigns.filter(c => !['black-friday', 'limited-time'].includes(c.slug) && isCampaignValidForDate(calcState.testStayDate, c));
                                                        if (validStandard.length > 0) {
                                                            const best = validStandard.reduce((p, c) => (p.discount > c.discount) ? p : c);
                                                            currentRate = currentRate * (1 - Number(best.discount) / 100);
                                                            steps.push({ label: `${best.name} (-${best.discount}%)`, rate: currentRate, indent: 1 });
                                                        }
// Step C: Mobile (Applied to Post-Campaign)
                                                   const isMobileBlocked = !!deepDeal || validStandard.some(c => ['early-deal', 'late-escape', 'getaway-deal'].includes(c.slug));

                                                        if (calcState.mobileActive && !isMobileBlocked) { 
                                                            currentRate = currentRate * (1 - Number(calcState.mobilePercent) / 100); 
                                                            steps.push({ label: `Mobile Rate (-${calcState.mobilePercent}%)`, rate: currentRate, indent: 1 });
                                                        } else if (calcState.mobileActive && isMobileBlocked) {
                                                            steps.push({ label: `Mobile Rate (BLOCKED by Campaign)`, rate: currentRate, indent: 1, isInfo: true });
                                                        }
                                                        // Step D: Country (Applied to Post-Mobile)
                                                        if (calcState.countryRateActive) { 
                                                            currentRate = currentRate * (1 - Number(calcState.countryRatePercent) / 100); 
                                                            steps.push({ label: `Country Rate (-${calcState.countryRatePercent}%)`, rate: currentRate, indent: 1 });
                                                        }
                                                    }

                                                    // Final Sell Rate
                                                    steps.push({ label: 'Final Sell Rate', rate: currentRate, indent: 0, isFinal: true });
                                                    
                                                    // RENDER LOOP
                                                    return (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontFamily: 'monospace' }}>
                                                            {steps.map((step, i) => (
                                                                <div key={i} style={{ 
                                                                    paddingLeft: `${step.indent * 12}px`, 
                                                                    fontSize: step.isInfo ? '10px' : '12px', 
                                                                    display: 'flex', 
                                                                    justifyContent: 'space-between',
                                                                    color: step.isInfo ? '#6b7280' : (step.isFinal ? '#10b981' : '#e5e5e5'),
                                                                    fontStyle: step.isInfo ? 'italic' : 'normal',
                                                                    borderTop: step.isFinal ? '1px solid #2a2a2a' : 'none',
                                                                    marginTop: step.isFinal ? '8px' : 0,
                                                                    paddingTop: step.isFinal ? '8px' : 0,
                                                                    fontWeight: step.isBold || step.isFinal ? 'bold' : 'normal'
                                                                }}>
                                                                    <span>{step.indent > 0 && !step.isInfo ? '└ ' : ''}{step.label}</span>
                                                                    {!step.isInfo && <span>£{step.rate.toFixed(2)}</span>}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        </div>

                                        {/* Stacking Info Box */}
                                        <div style={{marginTop: '12px', padding: '12px', backgroundColor: 'rgba(57, 189, 248, 0.05)', border: '1px solid rgba(57, 189, 248, 0.2)', borderRadius: '4px'}}>
                                            <h4 style={{color: '#39BDF8', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px'}}>
                                                <Info className="w-3 h-3" /> Stacking Logic
                                            </h4>
                                            <ul style={{listStyleType: 'disc', paddingLeft: '16px', color: '#9ca3af', fontSize: '11px', lineHeight: '1.4'}}>
                                                <li>Deep deals never stack; they apply to base rate.</li>
                                                <li>Genius and campaign deals stack as they are applied.</li>
                                                <li>Genius, targeting, and portfolio deals stack sequentially.</li>
                                                <li>Lowest case scenario is calculated here.</li>
                                            </ul>
                                        </div>

                                    </div>
                                  </div>
                                  
                                  {/* Footer Actions */}
                                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '24px', marginTop: '24px', borderTop: '1px solid #2a2a2a' }}>
                                      <Button variant="outline" onClick={() => toggleAsset(asset.id)} style={{ borderColor: '#2a2a2a', color: '#9ca3af' }}>Cancel</Button>
                                      <Button 
                                        onClick={() => saveAssetChanges(asset.id, {})} 
                                        style={{ backgroundColor: '#39BDF8', color: '#0f0f0f' }}
                                      >
                                        Save Changes
                                      </Button>
                                  </div>

                                </div>
                              </td>
                  </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}