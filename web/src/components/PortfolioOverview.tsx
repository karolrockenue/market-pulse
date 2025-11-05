import { useState, useEffect } from 'react';
import { 
  Building2,
  DoorOpen,
  DollarSign,
  Calendar,
  Plus,
  Edit2,
  Trash2,
  Check, // Icon for Save
  X, // Icon for Cancel
  ArrowUpDown, // [NEW] From prototype
  Search // [NEW] From prototype
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'; // [NEW] From prototype
import { Input } from './ui/input';
import { toast } from 'sonner';

// [KEPT] Define the type for our portfolio data from the API
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

// [KEPT] Currency Formatters for GBP
const formatCurrency = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  minimumFractionDigits: 0, // No decimals for whole numbers
  maximumFractionDigits: 0, // No decimals for whole numbers
});

const formatCurrencyK = (value: number) => {
  return `£${(value / 1000).toFixed(1)}K`;
};

// --- [NEW] Inline Styles ---
// These styles replicate the Tailwind classes from the prototype.

const styles = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#252521',
    padding: '24px',
    color: '#e5e5e5',
  },
  header: {
    marginBottom: '24px',
  },
  headerTitle: {
    fontSize: '1.5rem',
    lineHeight: '2rem',
    color: '#e5e5e5',
    marginBottom: '8px',
  },
  headerSubtitle: {
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
    color: '#9ca3af',
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: '16px',
    marginBottom: '24px',
  },
  kpiCard: {
    backgroundColor: '#262626',
    border: '1px solid #3a3a35',
    borderRadius: '0.5rem',
    padding: '16px',
    transition: 'border-color 0.2s',
  },
  kpiCardTitle: {
    fontSize: '0.75rem',
    lineHeight: '1rem',
    color: '#9ca3af',
    marginBottom: '8px',
  },
  kpiCardValue: {
    fontSize: '1.5rem',
    lineHeight: '2rem',
    color: '#e5e5e5',
    marginBottom: '8px',
  },
  kpiCardFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kpiCardFooterLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  kpiIcon: {
    width: '14px',
    height: '14px',
    color: '#faff6a',
  },
  kpiCardFooterText: {
    color: '#faff6a',
    fontSize: '0.75rem',
    lineHeight: '1rem',
  },
  kpiCardFooterRight: {
    color: '#6b7280',
    fontSize: '10px',
  },
  groupGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: '12px',
    marginBottom: '32px',
  },
  groupCard: {
    backgroundColor: '#262626',
    border: '1px solid #3a3a35',
    borderRadius: '0.5rem',
    padding: '14px',
    transition: 'border-color 0.2s',
  },
  groupCardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '12px',
  },
  groupCardIconBg: {
    width: '24px',
    height: '24px',
    borderRadius: '0.25rem',
    backgroundColor: 'rgba(250, 255, 106, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid rgba(250, 255, 106, 0.2)',
  },
  groupCardTitle: {
    color: '#e5e5e5',
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as 'nowrap',
  },
  groupMetricRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '8px',
  },
  groupMetricLabel: {
    color: '#9ca3af',
    fontSize: '0.75rem',
    lineHeight: '1rem',
  },
  groupMetricValue: {
    color: '#e5e5e5',
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  },
  groupMetricValueHighlight: {
    color: '#faff6a',
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  },
  sectionHeader: {
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: '#e5e5e5',
    marginBottom: '4px',
    fontSize: '1.125rem', // text-lg, but h2 is bigger by default
  },
  sectionSubtitle: {
    color: '#9ca3af',
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
  },
  addButton: {
    padding: '8px 16px',
    backgroundColor: '#faff6a',
    color: '#1d1d1c',
    borderRadius: '0.5rem',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    border: 'none',
    cursor: 'pointer',
  },
  filterBar: {
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  searchInputContainer: {
    flex: '1 1 0%',
    position: 'relative' as 'relative',
  },
  searchInputIcon: {
    position: 'absolute' as 'absolute',
    left: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    width: '16px',
    height: '16px',
    color: '#6b7280',
  },
  tableContainer: {
    backgroundColor: '#262626',
    border: '1px solid #3a3a35',
    borderRadius: '0.5rem',
    overflow: 'hidden',
  },
  statusLive: {
    padding: '2px 8px',
    borderRadius: '0.25rem',
    fontSize: '0.75rem',
    lineHeight: '1rem',
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    color: 'rgb(52, 211, 153)', // emerald-400
    border: '1px solid rgba(16, 185, 129, 0.3)',
  },
  statusOffPlatform: {
    padding: '2px 8px',
    borderRadius: '0.25rem',
    fontSize: '0.75rem',
    lineHeight: '1rem',
    backgroundColor: '#3a3a35',
    color: '#9ca3af',
    border: '1px solid #3a3a35',
  },
  totalRow: {
    backgroundColor: '#1f1f1c',
    borderTop: '1px solid #3a3a35',
  },
  totalCell: {
    color: '#faff6a',
  },
  iconButton: {
    padding: '4px',
    borderRadius: '0.25rem',
    transition: 'background-color 0.2s',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
  },
  actionCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
};

// --- [END] Inline Styles ---


export function PortfolioOverview() {
  const [allPortfolio, setAllPortfolio] = useState<PortfolioAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // [KEPT] State for full-row editing
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<PortfolioAsset | null>(null);

  // [NEW] States from prototype for filtering and sorting
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGroup, setFilterGroup] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // --- [KEPT] Data Fetching ---
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

  // --- [KEPT & FIXED] Calculate totals ---
  const totalRooms = allPortfolio.reduce((sum, p) => sum + (Number(p.totalRooms) || 0), 0);
  const totalFees = allPortfolio.reduce((sum, p) => sum + (Number(p.monthlyFee) || 0), 0);
  const totalMRR = totalFees;
  const totalARR = totalMRR * 12;

  // --- [NEW] Calculate group-based metrics ---
  const groupMetrics = allPortfolio.reduce((acc, property) => {
    const groupName = property.group || 'N/A'; // Handle null groups
    if (!acc[groupName]) {
      acc[groupName] = { hotels: 0, mrr: 0, rooms: 0 };
    }
    acc[groupName].hotels += 1;
    acc[groupName].mrr += (Number(property.monthlyFee) || 0);
    acc[groupName].rooms += (Number(property.totalRooms) || 0);
    return acc;
  }, {} as Record<string, { hotels: number; mrr: number; rooms: number }>);

  // --- [NEW] Filter and sort portfolio ---
  const filteredAndSortedPortfolio = allPortfolio
    .filter(p => {
      const pGroup = p.group || 'N/A';
      const matchesSearch = p.hotelName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           p.city.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesGroup = filterGroup === 'all' || pGroup === filterGroup;
      const matchesStatus = filterStatus === 'all' || p.status === filterStatus;
      return matchesSearch && matchesGroup && matchesStatus;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.hotelName.localeCompare(b.hotelName);
          break;
        case 'city':
          comparison = a.city.localeCompare(b.city);
          break;
        case 'rooms':
          comparison = (Number(a.totalRooms) || 0) - (Number(b.totalRooms) || 0);
          break;
        case 'fee':
          comparison = (Number(a.monthlyFee) || 0) - (Number(b.monthlyFee) || 0);
          break;
        case 'group':
          comparison = (a.group || 'N/A').localeCompare(b.group || 'N/A');
          break;
        default:
          comparison = 0;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  // --- [KEPT] Row Editing Handlers ---

  const handleEditClick = (asset: PortfolioAsset) => {
    setEditingRowId(asset.id);
    setEditFormData({ ...asset }); // Make a copy of the asset data for editing
  };

  const handleCancelClick = () => {
    setEditingRowId(null);
    setEditFormData(null);
  };

  // --- [KEPT & BUG FIXED] ---
  const handleEditFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (editFormData) {
      let processedValue: string | number = value;
      if (name === 'totalRooms') {
        processedValue = parseInt(value, 10) || 0;
      } else if (name === 'monthlyFee') {
        processedValue = parseFloat(value) || 0;
      }

      setEditFormData({
        ...editFormData,
        [name]: processedValue,
      });
    }
  };

  // [KEPT] handleSaveClick now calls the upgraded PUT endpoint
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

  // [KEPT] Rewired addProperty to call the POST API
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

  // [KEPT] Rewired deleteProperty to call the DELETE API
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
      setAllPortfolio(originalPortfolio); // Revert on error
    }
  };

  // --- [KEPT] Render Logic ---
  if (isLoading) {
    return (
      <div style={styles.page}>
        <div className="w-12 h-12 border-4 border-[#faff6a] border-t-transparent border-solid rounded-full animate-spin"></div>
      </div>
    );
  }

  // --- [MODIFIED] Using inline styles ---
  return (
    <div style={styles.page}>
      {/* Page Header */}
      <div style={styles.header}>
        <h1 style={styles.headerTitle}>Portfolio Overview</h1>
        <p style={styles.headerSubtitle}>Comprehensive view of portfolio performance and management</p>
      </div>

      {/* Metrics Bar */}
      <div style={styles.kpiGrid}>
        {/* Hotels */}
        <div style={styles.kpiCard}>
          <div style={styles.kpiCardTitle}>Total Hotels</div>
          <div style={styles.kpiCardValue}>{allPortfolio.length}</div>
          <div style={styles.kpiCardFooter}>
            <div style={styles.kpiCardFooterLeft}>
              <Building2 style={styles.kpiIcon} />
              <span style={styles.kpiCardFooterText}>Properties</span>
            </div>
            <span style={styles.kpiCardFooterRight}>Live + Off</span>
          </div>
        </div>

        {/* Rooms */}
        <div style={styles.kpiCard}>
          <div style={styles.kpiCardTitle}>Total Rooms</div>
          <div style={styles.kpiCardValue}>{totalRooms.toLocaleString()}</div>
          <div style={styles.kpiCardFooter}>
            <div style={styles.kpiCardFooterLeft}>
              <DoorOpen style={styles.kpiIcon} />
              <span style={styles.kpiCardFooterText}>Inventory</span>
            </div>
            <span style={styles.kpiCardFooterRight}>All Properties</span>
          </div>
        </div>

        {/* MRR */}
        <div style={styles.kpiCard}>
          <div style={styles.kpiCardTitle}>Monthly Revenue</div>
          <div style={styles.kpiCardValue}>{formatCurrencyK(totalMRR)}</div>
          <div style={styles.kpiCardFooter}>
            <div style={styles.kpiCardFooterLeft}>
              <Calendar style={styles.kpiIcon} />
              <span style={styles.kpiCardFooterText}>MRR</span>
            </div>
            <span style={styles.kpiCardFooterRight}>Per Month</span>
          </div>
        </div>

        {/* ARR */}
        <div style={styles.kpiCard}>
          <div style={styles.kpiCardTitle}>Annual Revenue</div>
          <div style={styles.kpiCardValue}>{formatCurrencyK(totalARR)}</div>
          <div style={styles.kpiCardFooter}>
            <div style={styles.kpiCardFooterLeft}>
              <DollarSign style={styles.kpiIcon} />
              <span style={styles.kpiCardFooterText}>ARR</span>
            </div>
            <span style={styles.kpiCardFooterRight}>Per Year</span>
          </div>
        </div>
      </div>

      {/* Group Metrics */}
      <div> {/* Removed mb-8 for style object */}
        <h3 style={{ ...styles.sectionSubtitle, fontSize: '0.875rem', marginBottom: '12px', color: '#e5e5e5' }}>Performance by Group</h3>
        <div style={styles.groupGrid}>
          {Object.entries(groupMetrics).slice(0, 4).map(([groupName, metrics]) => (
            <div key={groupName} style={styles.groupCard}>
              <div style={styles.groupCardHeader}>
                <div style={styles.groupCardIconBg}>
                  <Building2 style={{ width: '12px', height: '12px', color: '#faff6a' }} />
                </div>
                <div style={styles.groupCardTitle}>{groupName}</div>
              </div>
              <div> {/* Removed space-y-2 */}
                <div style={styles.groupMetricRow}>
                  <span style={styles.groupMetricLabel}>Hotels</span>
                  <span style={styles.groupMetricValue}>{metrics.hotels}</span>
                </div>
                <div style={styles.groupMetricRow}>
                  <span style={styles.groupMetricLabel}>MRR</span>
                  <span style={styles.groupMetricValueHighlight}>{formatCurrencyK(metrics.mrr)}</span>
                </div>
                <div style={styles.groupMetricRow}>
                  <span style={styles.groupMetricLabel}>Rooms</span>
                  <span style={styles.groupMetricValue}>{metrics.rooms}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 1: All Portfolio (Live + Off-Platform) */}
      <div style={{ marginBottom: '32px' }}>
        <div style={styles.sectionHeader}>
          <div>
            <h2 style={styles.sectionTitle}>Portfolio Properties</h2>
            <p style={styles.sectionSubtitle}>All properties managed by Rockenue, both on Market Pulse and off-platform. All properties are included in MRR/ARR calculations.</p>
          </div>
          <button
            onClick={addProperty} // [WIRED] Calls API function
            style={styles.addButton}
          >
            <Plus style={{ width: '16px', height: '16px' }} />
            Add New Property
          </button>
        </div>

        {/* Filters and Search */}
        <div style={styles.filterBar}>
          <div style={styles.searchInputContainer}>
            <Search style={styles.searchInputIcon} />
            <Input
              placeholder="Search hotels or cities..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-[#262626] border-[#3a3a35] text-[#e5e5e5] placeholder:text-[#6b7280]" // These classes are from shadcn/ui, they should work
            />
          </div>
          
          <Select value={filterGroup} onValueChange={setFilterGroup}>
            <SelectTrigger className="w-[180px] bg-[#262626] border-[#3a3a35] text-[#e5e5e5]">
              <SelectValue placeholder="Filter by Group" />
            </SelectTrigger>
            <SelectContent className="bg-[#262626] border-[#3a3a35]">
              <SelectItem value="all" className="text-[#e5e5e5]">All Groups</SelectItem>
              {Array.from(new Set(allPortfolio.map(p => p.group).filter(Boolean))).map(group => (
                <SelectItem key={group} value={group!} className="text-[#e5e5e5]">{group}</SelectItem>
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
              <SelectItem value="name" className="text-[#e5e5e5]">Name</SelectItem>
              <SelectItem value="city" className="text-[#e5e5e5]">City</SelectItem>
              <SelectItem value="rooms" className="text-[#e5e5e5]">Rooms</SelectItem>
              <SelectItem value="fee" className="text-[#e5e5e5]">Monthly Fee</SelectItem>
              <SelectItem value="group" className="text-[#e5e5e5]">Group</SelectItem>
            </SelectContent>
          </Select>

          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            title={sortOrder === 'asc' ? 'Sort Ascending' : 'Sort Descending'}
            style={{ ...styles.iconButton, padding: '8px', border: '1px solid #3a3a35', backgroundColor: '#262626' }}
          >
            <ArrowUpDown style={{ width: '16px', height: '16px', color: '#9ca3af' }} />
          </button>
        </div>

        {/* Table */}
        <div style={styles.tableContainer}>
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
                        <span>{formatCurrency.format(Number(property.monthlyFee) || 0)}</span>
                      )}
                    </TableCell>
                    
                    {/* --- Status --- */}
                    <TableCell>
                      <span 
                        style={
                          property.status === 'Live'
                            ? styles.statusLive
                            : styles.statusOffPlatform
                        }
                      >
                        {property.status}
                      </span>
                    </TableCell>

                    {/* --- Actions --- */}
                    <TableCell>
                      <div style={styles.actionCell}>
                        {isEditing ? (
                          <>
                            <button
                              onClick={handleSaveClick}
                              style={styles.iconButton}
                            >
                              <Check style={{ width: '14px', height: '14px', color: '#84cc16' }} />
                            </button>
                            <button
                              onClick={handleCancelClick}
                              style={styles.iconButton}
                            >
                              <X style={{ width: '14px', height: '14px', color: '#9ca3af' }} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleEditClick(property)}
                              style={styles.iconButton}
                            >
                              <Edit2 style={{ width: '12px', height: '12px', color: '#9ca3af' }} />
                            </button>
                            {isOffPlatform && (
                              <button
                                onClick={() => deleteProperty(property.id)}
                                style={styles.iconButton}
                              >
                                <Trash2 style={{ width: '14px', height: '14px', color: '#ef4444' }} />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {/* Totals Row */}
              <TableRow style={styles.totalRow}>
                <TableCell style={styles.totalCell}>
                  {filteredAndSortedPortfolio.length < allPortfolio.length ? 'Filtered Total' : 'Total'}
                </TableCell>
                <TableCell></TableCell>
                <TableCell style={styles.totalCell}>
                  {filteredAndSortedPortfolio.reduce((sum, p) => sum + (Number(p.totalRooms) || 0), 0)}
                </TableCell>
                <TableCell></TableCell>
                <TableCell style={styles.totalCell}>
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