import { useState, useEffect, useMemo } from 'react'; // [MODIFIED] Added useMemo
import { 
  Building2,
  DoorOpen,
  DollarSign,
  Calendar,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  Search, // [NEW] Icon from prototype
  ArrowUpDown, // [NEW] Icon from prototype
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
// [NEW] Import Select components from prototype
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Input } from './ui/input';
import { toast } from 'sonner';

interface PortfolioAsset {
  id: string;
  hotelName: string;
  group: string | null;
  totalRooms: number;
  city: string;
  monthlyFee: number;
  status: 'Live' | 'Off-Platform';
  market_pulse_hotel_id: string | null;
}

const formatCurrency = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const formatCurrencyK = (value: number) => {
  return `£${(value / 1000).toFixed(1)}K`;
};

export function PortfolioOverview() {
  const [allPortfolio, setAllPortfolio] = useState<PortfolioAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<PortfolioAsset | null>(null);

  // [NEW] State for filtering and sorting, from PROT_PortfolioOverview.tsx
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGroup, setFilterGroup] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('hotelName'); // Changed default to 'hotelName'
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

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
  }, []);

  // --- Calculate totals ---
  const totalRooms = allPortfolio.reduce((sum, p) => sum + (Number(p.totalRooms) || 0), 0);
  const totalFees = allPortfolio.reduce((sum, p) => sum + (Number(p.monthlyFee) || 0), 0);
  const totalMRR = totalFees;
  const totalARR = totalMRR * 12;

  // [NEW] Group metrics logic from PROT_PortfolioOverview.tsx, wrapped in useMemo
  const groupMetrics = useMemo(() => {
    return allPortfolio.reduce((acc, property) => {
      const groupName = property.group || 'N/A';
      if (!acc[groupName]) {
        acc[groupName] = { hotels: 0, mrr: 0, rooms: 0 };
      }
      acc[groupName].hotels += 1;
      acc[groupName].mrr += (Number(property.monthlyFee) || 0);
      acc[groupName].rooms += (Number(property.totalRooms) || 0);
      return acc;
    }, {} as Record<string, { hotels: number; mrr: number; rooms: number }>);
  }, [allPortfolio]);

  // [NEW] Filtering and sorting logic from PROT_PortfolioOverview.tsx, wrapped in useMemo
  const filteredAndSortedPortfolio = useMemo(() => {
    return allPortfolio
      .filter(p => {
        const p_group = p.group || 'N/A';
        const p_city = p.city || '';
        const p_hotelName = p.hotelName || '';

        const matchesSearch = p_hotelName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             p_city.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesGroup = filterGroup === 'all' || p_group === filterGroup;
        const matchesStatus = filterStatus === 'all' || p.status === filterStatus;
        return matchesSearch && matchesGroup && matchesStatus;
      })
      .sort((a, b) => {
        let comparison = 0;
        const a_group = a.group || '';
        const b_group = b.group || '';
        const a_city = a.city || '';
        const b_city = b.city || '';
        const a_hotelName = a.hotelName || '';
        const b_hotelName = b.hotelName || '';

        switch (sortBy) {
          case 'hotelName':
            comparison = a_hotelName.localeCompare(b_hotelName);
            break;
          case 'city':
            comparison = a_city.localeCompare(b_city);
            break;
          case 'rooms':
            comparison = (Number(a.totalRooms) || 0) - (Number(b.totalRooms) || 0);
            break;
          case 'fee':
            comparison = (Number(a.monthlyFee) || 0) - (Number(b.monthlyFee) || 0);
            break;
          case 'group':
            comparison = a_group.localeCompare(b_group);
            break;
          default:
            comparison = 0;
        }
        return sortOrder === 'asc' ? comparison : -comparison;
      });
  }, [allPortfolio, searchTerm, filterGroup, filterStatus, sortBy, sortOrder]);

  // --- Row Editing Handlers ---

  const handleEditClick = (asset: PortfolioAsset) => {
    setEditingRowId(asset.id);
    setEditFormData({ ...asset });
  };

  const handleCancelClick = () => {
    setEditingRowId(null);
    setEditFormData(null);
  };

  const handleEditFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (editFormData) {
      // [FIX] Correctly process numeric inputs to avoid API errors
      let processedValue: string | number | null = value;
      if (name === 'totalRooms') {
        processedValue = parseInt(value, 10) || 0;
      } else if (name === 'monthlyFee') {
        processedValue = parseFloat(value) || 0;
      } else if (name === 'group' && value === '') {
        processedValue = null; // Allow clearing the group
      }

      setEditFormData({
        ...editFormData,
        [name]: processedValue,
      });
    }
  };

  const handleSaveClick = async () => {
    if (!editFormData) return;
    const { id } = editFormData;

    try {
      const response = await fetch(`/api/rockenue/portfolio/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editFormData),
      });

      if (!response.ok) {
        throw new Error('Failed to update asset');
      }
      
      const updatedAsset: PortfolioAsset = await response.json();
      
      setAllPortfolio(prev => 
        prev.map(p => (p.id === id ? updatedAsset : p))
      );
      
      handleCancelClick();
      toast.success('Property updated successfully.');

    } catch (error: any) {
      console.error(error);
      toast.error('Update failed', { description: error.message });
    }
  };

  const addProperty = async () => {
    try {
      const response = await fetch('/api/rockenue/portfolio', {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to add new property');
      }
      
      const newProperty: PortfolioAsset = await response.json();
      
      setAllPortfolio(prev => [...prev, newProperty]);
      toast.success('New property added. Click "Edit" to update its details.');

    } catch (error: any) {
      console.error(error);
      toast.error('Failed to add property', { description: error.message });
    }
  };

  const deleteProperty = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this off-platform property?')) {
      return;
    }
    
    const originalPortfolio = [...allPortfolio];
    setAllPortfolio(prev => prev.filter(p => p.id !== id));

    try {
      const response = await fetch(`/api/rockenue/portfolio/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete property');
      }
      
      toast.success('Off-Platform property deleted.');

    } catch (error: any) {
      console.error(error);
      toast.error('Delete failed', { description: error.message });
      setAllPortfolio(originalPortfolio);
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

  const kpiBoxStyle = {
    backgroundColor: '#faff6a',
    color: '#1d1d1c',
  };
  const kpiLabelStyle = {
    color: '#1d1d1c',
    fontSize: '0.75rem',
    lineHeight: '1rem',
    textTransform: 'uppercase' as 'uppercase',
    letterSpacing: '0.05em',
  };
  const kpiValueStyle = {
    color: '#1d1d1c',
    fontSize: '1.5rem',
    lineHeight: '2rem',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  };

  return (
    <div className="min-h-screen bg-[#252521] p-6">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-[#e5e5e5] text-2xl mb-2">Portfolio Overview</h1>
        <p className="text-[#9ca3af] text-sm">Comprehensive view of portfolio performance and management</p>
      </div>

      {/* Metrics Bar */}
      <div className="flex items-stretch gap-px bg-[#1d1d1c] rounded-lg overflow-hidden mb-8">
        <div className="flex-1 p-4" style={kpiBoxStyle}>
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="w-3.5 h-3.5 text-[#1d1d1c]" />
            <span style={kpiLabelStyle}>Hotels</span>
          </div>
          <div style={kpiValueStyle}>{allPortfolio.length}</div>
        </div>
        <div className="flex-1 p-4" style={kpiBoxStyle}>
          <div className="flex items-center gap-2 mb-2">
            <DoorOpen className="w-3.5 h-3.5 text-[#1d1d1c]" />
            <span style={kpiLabelStyle}>Rooms</span>
          </div>
          <div style={kpiValueStyle}>{totalRooms.toLocaleString()}</div>
        </div>
        <div className="flex-1 p-4" style={kpiBoxStyle}>
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-3.5 h-3.5 text-[#1d1d1c]" />
            <span style={kpiLabelStyle}>MRR</span>
          </div>
          <div style={kpiValueStyle}>{formatCurrencyK(totalMRR)}</div>
        </div>
        <div className="flex-1 p-4" style={kpiBoxStyle}>
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-3.5 h-3.5 text-[#1d1d1c]" />
            <span style={kpiLabelStyle}>ARR</span>
          </div>
          <div style={kpiValueStyle}>{formatCurrencyK(totalARR)}</div>
        </div>
      </div>

      {/* [NEW] Group Metrics section from PROT_PortfolioOverview.tsx */}
      <div className="mb-8">
        <h3 className="text-[#e5e5e5] text-sm mb-3">Performance by Group</h3>
        <div className="grid grid-cols-4 gap-3">
          {Object.entries(groupMetrics).slice(0, 4).map(([groupName, metrics]) => (
            <div key={groupName} className="bg-[#262626] border border-[#3a3a35] rounded-lg p-3.5 hover:border-[#faff6a]/30 transition-colors">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded bg-[#faff6a]/10 flex items-center justify-center border border-[#faff6a]/20">
                  <Building2 className="w-3 h-3 text-[#faff6a]" />
                </div>
                <div className="text-[#e5e5e5] text-sm truncate">{groupName}</div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[#9ca3af] text-xs">Hotels</span>
                  <span className="text-[#e5e5e5] text-sm font-mono">{metrics.hotels}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#9ca3af] text-xs">MRR</span>
                  <span className="text-[#faff6a] text-sm font-mono">{formatCurrencyK(metrics.mrr)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#9ca3af] text-xs">Rooms</span>
                  <span className="text-[#e5e5e5] text-sm font-mono">{metrics.rooms}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 1: All Portfolio (Live + Off-Platform) */}
      <div className="mb-8">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-[#e5e5e5] mb-1">Portfolio Properties</h2>
            <p className="text-[#9ca3af] text-sm">All properties managed by Rockenue, both on Market Pulse and off-platform.</p>
          </div>
          <button
            onClick={addProperty}
            className="px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
            style={{ backgroundColor: '#faff6a', color: '#1d1d1c' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#e8eb5a')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#faff6a')}
          >
            <Plus className="w-4 h-4" />
            Add New Property
          </button>
        </div>

        {/* [NEW] Filters and Search from PROT_PortfolioOverview.tsx */}
        <div className="mb-4 flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b7280]" />
            <Input
              placeholder="Search hotels or cities..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-[#262626] border-[#3a3a35] text-[#e5e5e5] placeholder:text-[#6b7280]"
            />
          </div>
          
          <Select value={filterGroup} onValueChange={setFilterGroup}>
            <SelectTrigger className="w-[180px] bg-[#262626] border-[#3a3a35] text-[#e5e5e5]">
              <SelectValue placeholder="Filter by Group" />
            </SelectTrigger>
            <SelectContent className="bg-[#262626] border-[#3a3a35]">
              <SelectItem value="all" className="text-[#e5e5e5]">All Groups</SelectItem>
              {Object.keys(groupMetrics).map(group => (
                <SelectItem key={group} value={group} className="text-[#e5e5e5]">{group}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[180px] bg-[#262626] border-[#3a3a35] text-[#e5e5e5]">
              <SelectValue placeholder="Filter by Status" />
            </SelectTrigger>
            <SelectContent className="bg-[#262626] border-[#3a3a35]">
              <SelectItem value="all" className="text-[#e5e5e5]">All Status</SelectItem>
              <SelectItem value="Live" className="text-[#e5e5e5]">Live</SelectItem>
              <SelectItem value="Off-Platform" className="text-[#e5e5e5]">Off-Platform</SelectItem>
            </SelectContent>
          </Select>

<Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[180px] bg-[#262626] border-[#3a3a35] text-[#e5e5e5]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent className="bg-[#262626] border-[#3a3a35]">
              <SelectItem value="hotelName" className="text-[#e5e5e5]">Name</SelectItem>
              <SelectItem value="city" className="text-[#e5e5e5]">City</SelectItem>
              <SelectItem value="rooms" className="text-[#e5e5e5]">Rooms</SelectItem>
              <SelectItem value="fee" className="text-[#e5e5e5]">Monthly Fee</SelectItem>
              <SelectItem value="group" className="text-[#e5e5e5]">Group</SelectItem>
            </SelectContent>
          </Select>

          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="p-2 bg-[#262626] border border-[#3a3a35] rounded-lg hover:bg-[#3a3a35] transition-colors"
            title={sortOrder === 'asc' ? 'Sort Ascending' : 'Sort Descending'}
          >
            <ArrowUpDown className="w-4 h-4 text-[#9ca3af]" />
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
              {/* [MODIFIED] Map over the new filteredAndSortedPortfolio list */}
              {filteredAndSortedPortfolio.map((property) => {
                const isEditing = editingRowId === property.id;
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
                          value={editFormData?.city || ''}
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
                          placeholder="N/A"
                          className="w-36 h-8 bg-[#1f1f1c] border-[#3a3a35] text-[#e5e5e5]"
                        />
                      ) : (
                        property.group
                      )}
                    </TableCell>
                    
                    {/* --- Monthly Fee --- */}
                    <TableCell className="text-[#e5e5e5]">
                      {isEditing ? (
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
                            ? 'text-emerald-400 border'
                            : 'bg-[#3a3a35] text-[#9ca3af] border border-[#3a3a35]'
                        }`}
                        style={property.status === 'Live' ? {
                          backgroundColor: 'rgba(16, 185, 129, 0.2)',
                          borderColor: 'rgba(16, 185, 129, 0.3)'
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
              {/* [MODIFIED] Totals Row now calculates from the filtered list */}
              <TableRow className="border-[#3a3a35] bg-[#1f1f1c] hover:bg-[#1f1f1c]">
                <TableCell className="text-[#faff6a]">
                  {filteredAndSortedPortfolio.length < allPortfolio.length ? 'Filtered Total' : 'Total'}
                </TableCell>
                <TableCell></TableCell>
                <TableCell className="text-[#faff6a]">
                  {filteredAndSortedPortfolio.reduce((sum, p) => sum + (Number(p.totalRooms) || 0), 0)}
                </TableCell>
                <TableCell></TableCell>
                <TableCell className="text-[#faff6a]">
                  {formatCurrency.format(filteredAndSortedPortfolio.reduce((sum, p) => sum + (Number(p.monthlyFee) || 0), 0))}
                </TableCell>
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