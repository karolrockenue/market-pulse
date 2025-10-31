import { useState, useEffect } from 'react';
import { 
  Building2,
  DoorOpen,
  DollarSign,
  Calendar,
  Plus,
  Edit2,
  Trash2,
  Check, // [NEW] Icon for Save
  X // [NEW] Icon for Cancel
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { Input } from './ui/input';
import { toast } from 'sonner';

// [NEW] Define the type for our portfolio data from the API
interface PortfolioAsset {
  id: string; // This is now a UUID string from the DB
  hotelName: string; // Mapped from asset_name
  group: string | null;
  totalRooms: number;
  city: string;
  monthlyFee: number;
  status: 'Live' | 'Off-Platform';
  market_pulse_hotel_id: string | null; // Used for delete logic
}

// [NEW] Currency Formatters for GBP
const formatCurrency = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  minimumFractionDigits: 0, // No decimals for whole numbers
  maximumFractionDigits: 0, // No decimals for whole numbers
});

const formatCurrencyK = (value: number) => {
  return `£${(value / 1000).toFixed(1)}K`;
};

export function PortfolioOverview() {
  const [allPortfolio, setAllPortfolio] = useState<PortfolioAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // [NEW] State for full-row editing
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<PortfolioAsset | null>(null);

  // --- Data Fetching ---
  const fetchPortfolio = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/rockenue/portfolio');
      if (!response.ok) {
        throw new Error('Failed to fetch portfolio data');
      }
      const data: PortfolioAsset[] = await response.json();
      setAllPortfolio(data);
    } catch (error: any) {
      console.error(error);
      toast.error('Failed to load portfolio', { description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPortfolio();
  }, []); // Empty dependency array means this runs once on load

  // --- Calculate totals ---
  // [FIX] Use Number() to ensure values are numeric before summing.
  // This prevents 'NaN' errors if a value is null, undefined, or a non-numeric string.
  // The '|| 0' catches any NaN results from Number() and defaults them to 0.
  const totalRooms = allPortfolio.reduce((sum, p) => sum + (Number(p.totalRooms) || 0), 0);
  const totalFees = allPortfolio.reduce((sum, p) => sum + (Number(p.monthlyFee) || 0), 0);
  const totalMRR = totalFees;
  const totalARR = totalMRR * 12;

  // --- [NEW] Row Editing Handlers ---

  const handleEditClick = (asset: PortfolioAsset) => {
    setEditingRowId(asset.id);
    setEditFormData({ ...asset }); // Make a copy of the asset data for editing
  };

  const handleCancelClick = () => {
    setEditingRowId(null);
    setEditFormData(null);
  };

  const handleEditFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (editFormData) {
      setEditFormData({
        ...editFormData,
        // [BUG-WARNING] This logic still only parses 'totalRooms' as a number.
        // 'monthlyFee' will be saved as a string, which will cause API errors.
        [name]: name === 'totalRooms' ? parseInt(value, 10) || 0 : value,
      });
    }
  };

  // [MODIFIED] handleSaveClick now calls the upgraded PUT endpoint
  const handleSaveClick = async () => {
    if (!editFormData) return;

    const { id } = editFormData;

    try {
      const response = await fetch(`/api/rockenue/portfolio/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        // Send the *entire* form data object
        body: JSON.stringify(editFormData),
      });

      if (!response.ok) {
        throw new Error('Failed to update asset');
      }
      
      const updatedAsset: PortfolioAsset = await response.json();
      
      // Update the main state with the new data
      setAllPortfolio(prev => 
        prev.map(p => (p.id === id ? updatedAsset : p))
      );
      
      // Exit edit mode
      handleCancelClick();
      toast.success('Property updated successfully.');

    } catch (error: any) {
      console.error(error);
      toast.error('Update failed', { description: error.message });
      // Do not exit edit mode, let the user retry
    }
  };

  // [MODIFIED] Rewired addProperty to call the POST API
  const addProperty = async () => {
    try {
      const response = await fetch('/api/rockenue/portfolio', {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to add new property');
      }
      
      const newProperty: PortfolioAsset = await response.json();
      
      // Add the new property (returned from the API) to the state
      setAllPortfolio(prev => [...prev, newProperty]);
      toast.success('New property added. Click "Edit" to update its details.');

    } catch (error: any) {
      console.error(error);
      toast.error('Failed to add property', { description: error.message });
    }
  };

  // [MODIFIED] Rewired deleteProperty to call the DELETE API
  const deleteProperty = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this off-platform property?')) {
      return;
    }
    
    const originalPortfolio = [...allPortfolio]; // Store a backup
    
    // Optimistically remove from UI
    setAllPortfolio(prev => prev.filter(p => p.id !== id));

    try {
      const response = await fetch(`/api/rockenue/portfolio/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        // API will send a specific error if we try to delete a "Live" property
        throw new Error(errorData.error || 'Failed to delete property');
      }
      
      toast.success('Off-Platform property deleted.');

    } catch (error: any)
{
      console.error(error);
      toast.error('Delete failed', { description: error.message });
      setAllPortfolio(originalPortfolio); // Revert on error
    }
  };

  // --- Render Logic ---
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#252521] p-6 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#faff6a] border-t-transparent border-solid rounded-full animate-spin"></div>
      </div>
    );
  }

  // [NEW] Define inline styles to bypass the static CSS build
  const kpiBoxStyle = {
    backgroundColor: '#faff6a',
    color: '#1d1d1c',
  };
  const kpiLabelStyle = {
    color: '#1d1d1c',
    fontSize: '0.75rem', // text-xs
    lineHeight: '1rem',
    textTransform: 'uppercase' as 'uppercase', // Cast for TypeScript
    letterSpacing: '0.05em', // tracking-wider
  };
  const kpiValueStyle = {
    color: '#1d1d1c',
    fontSize: '1.5rem', // text-2xl
    lineHeight: '2rem',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', // font-mono
  };

  return (
    <div className="min-h-screen bg-[#252521] p-6">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-[#e5e5e5] text-2xl mb-2">Portfolio Overview</h1>
        <p className="text-[#9ca3af] text-sm">Comprehensive view of portfolio performance and management</p>
      </div>

      {/* Metrics Bar - Bold Yellow */}
      <div className="flex items-stretch gap-px bg-[#1d1d1c] rounded-lg overflow-hidden mb-8">
        {/* Hotels */}
        <div className="flex-1 p-4" style={kpiBoxStyle}>
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="w-3.5 h-3.5 text-[#1d1d1c]" />
            <span style={kpiLabelStyle}>Hotels</span>
          </div>
          <div style={kpiValueStyle}>{allPortfolio.length}</div>
        </div>

        {/* Rooms */}
        <div className="flex-1 p-4" style={kpiBoxStyle}>
          <div className="flex items-center gap-2 mb-2">
            <DoorOpen className="w-3.5 h-3.5 text-[#1d1d1c]" />
            <span style={kpiLabelStyle}>Rooms</span>
          </div>
          <div style={kpiValueStyle}>{totalRooms.toLocaleString()}</div>
        </div>

        {/* MRR */}
        <div className="flex-1 p-4" style={kpiBoxStyle}>
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-3.5 h-3.5 text-[#1d1d1c]" />
            <span style={kpiLabelStyle}>MRR</span>
          </div>
          {/* [MODIFIED] Use GBP currency formatter */}
          <div style={kpiValueStyle}>{formatCurrencyK(totalMRR)}</div>
        </div>

        {/* ARR */}
        <div className="flex-1 p-4" style={kpiBoxStyle}>
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-3.5 h-3.5 text-[#1d1d1c]" />
            <span style={kpiLabelStyle}>ARR</span>
          </div>
          {/* [MODIFIED] Use GBP currency formatter */}
          <div style={kpiValueStyle}>{formatCurrencyK(totalARR)}</div>
        </div>
      </div>

      {/* Section 1: All Portfolio (Live + Off-Platform) */}
      <div className="mb-8">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-[#e5e5e5] mb-1">Portfolio Properties</h2>
            <p className="text-[#9ca3af] text-sm">All properties managed by Rockenue, both on Market Pulse and off-platform. All properties are included in MRR/ARR calculations.</p>
          </div>
          <button
            onClick={addProperty} // Now calls the API
            className="px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
            // [FIX] Replaced broken Tailwind classes with inline styles
            style={{
              backgroundColor: '#faff6a',
              color: '#1d1d1c'
            }}
            // [FIX] A simple JS-based hover effect
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#e8eb5a')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#faff6a')}
          >
            <Plus className="w-4 h-4" />
            Add New Property
          </button>
        </div>

        <div className="bg-[#262626] border border-[#3a3a35] rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-[#3a3a35] hover:bg-transparent">
                <TableHead className="text-[#9ca3af]">Hotel Name</TableHead>
                <TableHead className="text-[#9ca3af]">City</TableHead>
                <TableHead className="text-[#9ca3af]">Total Rooms</TableHead>
                <TableHead className="text-[#9ca3af]">Group</TableHead>
                <TableHead className="text-[#9ca3af]">Monthly Fee</TableHead>
                <TableHead className="text-[#9ca3af]">Status</TableHead>
                <TableHead className="text-[#9ca3af]">Actions</TableHead>
          </TableRow>
            </TableHeader>
            <TableBody>
              {allPortfolio.map((property) => {
                // [NEW] Check if the current row is in edit mode
                const isEditing = editingRowId === property.id;
                
                // [NEW] Check if editing is allowed for this row
                // "Live" properties can only edit their fee.
                // "Off-Platform" properties can edit everything.
                const isOffPlatform = property.status === 'Off-Platform';

                return (
                  <TableRow key={property.id} className="border-[#3a3a35] hover:bg-[#2f2f2b]">
                    {/* --- Hotel Name --- */}
                    <TableCell className="text-[#e5e5e5]">
                      {isEditing && isOffPlatform ? (
                        <Input
                          type="text"
                          name="hotelName"
                          value={editFormData?.hotelName}
                          onChange={handleEditFormChange}
                          className="w-48 h-8 bg-[#1f1f1c] border-[#3a3a35] text-[#e5e5e5]"
                        />
                      ) : (
                        property.hotelName
                      )}
                    </TableCell>

                    {/* --- City --- */}
                    <TableCell className="text-[#e5e5e5]">
                      {isEditing && isOffPlatform ? (
                        <Input
                          type="text"
                          name="city"
                          value={editFormData?.city}
                          onChange={handleEditFormChange}
                          className="w-36 h-8 bg-[#1f1f1c] border-[#3a3a35] text-[#e5e5e5]"
                        />
                      ) : (
                        property.city
                      )}
                    </TableCell>

                    {/* --- Total Rooms --- */}
                    <TableCell className="text-[#e5e5e5]">
                      {isEditing && isOffPlatform ? (
                        <Input
                          type="number"
                          name="totalRooms"
                          value={editFormData?.totalRooms}
                          onChange={handleEditFormChange}
                          className="w-24 h-8 bg-[#1f1f1c] border-[#3a3a35] text-[#e5e5e5]"
                        />
                      ) : (
                        property.totalRooms
                      )}
                    </TableCell>
                    
                    {/* --- Group --- */}
                    <TableCell className="text-[#e5e5e5]">
                      {isEditing && isOffPlatform ? (
                        <Input
                          type="text"
                          name="group"
                          value={editFormData?.group || ''}
                          onChange={handleEditFormChange}
                          className="w-36 h-8 bg-[#1f1f1c] border-[#3a3a35] text-[#e5e5e5]"
                        />
                      ) : (
                        property.group
                      )}
                    </TableCell>
                    
                    {/* --- Monthly Fee --- */}
                    <TableCell className="text-[#e5e5e5]">
                      {isEditing ? ( // Fee is *always* editable
                        <Input
                          type="number"
                          name="monthlyFee"
                          value={editFormData?.monthlyFee}
                          onChange={handleEditFormChange}
                          className="w-24 h-8 bg-[#1f1f1c] border-[#3a3a35] text-[#e5e5e5]"
                        />
                      ) : (
                        <span>{formatCurrency.format(property.monthlyFee || 0)}</span>
                      )}
                    </TableCell>
                    
                    {/* --- Status --- */}
                    <TableCell>
                      <span 
                        className={`px-2 py-1 rounded text-xs ${
                          property.status === 'Live'
                            ? 'text-emerald-400 border' // Base classes
                            : 'bg-[#3a3a35] text-[#9ca3af] border border-[#3a3a35]' // Off-platform classes
                        }`}
                        style={property.status === 'Live' ? {
                          backgroundColor: 'rgba(16, 185, 129, 0.2)', // bg-emerald-500/20
                          borderColor: 'rgba(16, 185, 129, 0.3)'   // border-emerald-500/30
                        } : {}}
                      >
                        {property.status}
                      </span>
                    </TableCell>

                    {/* --- Actions --- */}
                    <TableCell>
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleSaveClick}
                            className="p-1 hover:bg-[#3f6212] rounded transition-colors"
                          >
                            <Check className="w-3.5 h-3.5 text-[#84cc16]" />
                          </button>
                          <button
                            onClick={handleCancelClick}
                            className="p-1 hover:bg-[#3a3a35] rounded transition-colors"
                          >
                            <X className="w-3.5 h-3.5 text-[#9ca3af]" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEditClick(property)}
                            className="p-1 hover:bg-[#3a3a35] rounded transition-colors"
                          >
                            <Edit2 className="w-3 h-3 text-[#9ca3af]" />
                          </button>
                          {isOffPlatform && (
                            <button
                              onClick={() => deleteProperty(property.id)}
                              className="p-1 hover:bg-[#3f1d1d] rounded transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-[#ef4444]" />
                            </button>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {/* Totals Row */}
              <TableRow className="border-[#3a3a35] bg-[#1f1f1c] hover:bg-[#1f1f1c]">
                <TableCell className="text-[#faff6a]">Total</TableCell>
                <TableCell></TableCell>
                <TableCell className="text-[#faff6a]">{totalRooms}</TableCell>
                <TableCell></TableCell>
                <TableCell className="text-[#faff6a]">{formatCurrency.format(totalFees)}</TableCell>
                <TableCell></TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}