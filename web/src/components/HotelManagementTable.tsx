// Import useState/useMemo for loading state and combobox logic
import { useState, useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Button } from './ui/button';
import { Switch } from './ui/switch'; // [NEW] From prototype
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'; // [NEW] From prototype
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command'; // [NEW] From prototype
import { Users, RefreshCw, Database, Check, ChevronsUpDown, Plus, Building2 } from 'lucide-react'; // [NEW] From prototype
import { Badge } from './ui/badge'; // [NEW] From prototype
// Import the toast function from sonner
// [FIX] Removed the invalid '@2.0.3' version from the import path
import { toast } from 'sonner';
import { sentinelToast } from './ui/sentinel-toast';

interface Hotel {
  hotel_id: number;
  property_name: string;
  property_type: string;
  city: string;
  category: string;
  neighborhood: string;
  total_rooms: number; // [NEW] Add the total_rooms column
  is_rockenue_managed: boolean; // Add rockenue managed flag
  management_group: string | null; // Add rockenue management group
}

interface HotelManagementTableProps {
  onManageCompSet: (hotelId: string, hotelName: string) => void;
  hotels: Hotel[];
  // [NEW] Add the handler function from App.tsx
  onManagementChange: (
    hotelId: number, 
    field: 'is_rockenue_managed' | 'management_group', 
    value: string | boolean | null
  ) => void;
  // [NEW] Add the list of groups for the combobox
  managementGroups: string[];
}

// Destructure the new hotels prop
export function HotelManagementTable({ onManageCompSet, hotels, onManagementChange, managementGroups }: HotelManagementTableProps) {
  // Add state to track which hotel is currently syncing. Value will be the hotel_id.
const [syncingHotelId, setSyncingHotelId] = useState<number | null>(null);
  // Add a new state to track the full sync, separate from the info sync
  const [fullSyncingHotelId, setFullSyncingHotelId] = useState<number | null>(null);

  // This is the list of valid categories from the backend
  const validCategories = [
    "Hostel",
    "Economy",
    "Midscale",
    "Upper Midscale",
    "Luxury",
];

  /**
   * Handles changing the category for a hotel.
   * Calls the backend to update the database.
   */
  const handleCategoryChange = async (hotelId: number, newCategory: string) => {
    // Show a loading toast
    const toastId = toast.loading('Updating category...');
    try {
      const response = await fetch('/api/admin/update-hotel-category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hotelId: hotelId, category: newCategory }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to update category');
      }

      // Show a success toast
      toast.success('Category updated successfully.', { id: toastId });
      // Note: We don't need to refetch the data, as the prop will be updated
      // if the parent 'allHotels' state is refreshed on next view.
      // For immediate UI feedback, we could mutate the 'hotels' prop, but that's advanced.
    } catch (error: any) {
      // Show an error toast
      toast.error(`Error: ${error.message}`, { id: toastId });
    }
  };

  /**
   * Handles triggering the "Sync Info" for a single hotel.
   * Calls the backend to pull fresh data from the PMS.
   */
  const handleSyncInfo = async (hotelId: number) => {
    setSyncingHotelId(hotelId); // Disable button
    const toastId = toast.loading('Starting hotel info sync...');

    try {
      const response = await fetch('/api/admin/sync-hotel-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // The endpoint expects 'propertyId'
        body: JSON.stringify({ propertyId: hotelId }), 
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to sync info');
      }
      
      toast.success(result.message || 'Hotel info sync complete.', { id: toastId });
    } catch (error: any) {
      toast.error(`Sync failed: ${error.message}`, { id: toastId });
} finally {
      setSyncingHotelId(null); // Re-enable button
    }
  };

  /**
   * Handles triggering the "Full Sync" (5-year initial sync) for a single hotel.
   * Calls the backend to clear and re-import all data for that hotel.
   */
  const handleFullSync = async (hotelId: number) => {
    // Show a confirmation dialog first because this is a destructive action
    if (!window.confirm(`Are you sure you want to run a full 5-year sync for this hotel? This will delete all existing data for this property and re-import it.`)) {
      return;
    }

    setFullSyncingHotelId(hotelId); // Disable button
    // This toast message is more specific about the long duration
    const toastId = toast.loading('Starting 5-year full data sync... This may take several minutes.');

    try {
      const response = await fetch('/api/admin/initial-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // The endpoint expects 'propertyId'
        body: JSON.stringify({ propertyId: hotelId }), 
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to run full sync');
      }
      
      toast.success('Full 5-year sync complete.', { id: toastId, duration: 5000 });
    } catch (error: any) {
      toast.error(`Full sync failed: ${error.message}`, { id: toastId, duration: 5000 });
} finally {
      setFullSyncingHotelId(null); // Re-enable button
    }
  };



  // The static 'hotels' array has been removed.
  return (
    <div className="bg-[#2C2C2C] rounded border border-[#3a3a35] overflow-hidden">
      <div className="px-6 py-4 border-b border-[#3a3a35]">
        <h2 className="text-[#e5e5e5] text-lg">Hotel Management</h2>
      </div>

      <div className="overflow-x-auto">
<table className="w-full">
      <thead>
        <tr className="border-b border-[#3a3a35] bg-[#1f1f1c]">
   <th className="px-6 py-3 text-left text-[#9ca3af] text-xs uppercase tracking-wider">Hotel ID</th>
          <th className="px-6 py-3 text-left text-[#9ca3af] text-xs uppercase tracking-wider">Property Name</th>
          {/* [NEW] Add Total Rooms header */}
          <th className="px-6 py-3 text-left text-[#9ca3af] text-xs uppercase tracking-wider">Rooms</th>
          <th className="px-6 py-3 text-left text-[#9ca3af] text-xs uppercase tracking-wider">Type</th>
          <th className="px-6 py-3 text-left text-[#9ca3af] text-xs uppercase tracking-wider">City</th>
<th className="px-6 py-3 text-left text-[#9ca3af] text-xs uppercase tracking-wider">Neighborhood</th>
          <th className="px-6 py-3 text-left text-[#9ca3af] text-xs uppercase tracking-wider">Category</th>
          {/* Add new headers for Rockenue management */}
          <th className="px-6 py-3 text-left text-[#9ca3af] text-xs uppercase tracking-wider">Managed</th>
          <th className="px-6 py-3 text-left text-[#9ca3af] text-xs uppercase tracking-wider">Group</th>
          <th className="px-6 py-3 text-left text-[#9ca3af] text-xs uppercase tracking-wider">Actions</th>
        </tr>
      </thead>
<tbody>
        {/* Map over the 'hotels' prop instead of the static array */}
        {hotels.map((hotel) => (
          <tr key={hotel.hotel_id} className="border-b border-[#3a3a3s5] hover:bg-[#3a3a35]/30 transition-colors">
            {/* Use the correct data fields from the API */}
            <td className="px-6 py-4 text-[#9ca3af] text-sm">{hotel.hotel_id}</td>
            <td className="px-6 py-4 text-[#e5e5e5] text-sm">{hotel.property_name}</td>
            {/* [NEW] Add Total Rooms data cell. Show '-' if null/0. */}
            <td className="px-6 py-4 text-[#9ca3af] text-sm">{hotel.total_rooms || '-'}</td>
            <td className="px-6 py-4 text-[#9ca3af] text-sm">{hotel.property_type}</td>
            <td className="px-6 py-4 text-[#9ca3af] text-sm">{hotel.city}</td>
            <td className="px-6 py-4 text-[#9ca3af] text-sm">{hotel.neighborhood}</td>
<td className="px-6 py-4">
                  {/* Use the hotel.category and map the correct options */}
                  <Select 
                    defaultValue={hotel.category}
                    // Add the onValueChange handler
                    onValueChange={(newCategory) => {
                      handleCategoryChange(hotel.hotel_id, newCategory);
                    }}
                  >
                    <SelectTrigger className="w-32 h-8 bg-[#1f1f1c] border-[#3a3a35] text-[#e5e5e5] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#2C2C2C] border-[#3a3a35] text-[#e5e5e5]">
                      {/* Map over the valid category list from the backend */}
                      {validCategories.map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
 </SelectContent>
                  </Select>
                </td>
{/* [NEW] Replaced Checkbox with Switch from prototype */}
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
<Switch
  checked={hotel.is_rockenue_managed}
  // Call the onManagementChange prop from App.tsx
  onCheckedChange={(isChecked) => {
    onManagementChange(hotel.hotel_id, 'is_rockenue_managed', isChecked);
  }}
  // [FIX] Removed the data-[state=unchecked]:bg-[#3a3a35] arbitrary value.
  // The component's base style (data-[state=unchecked]:bg-switch-background)
  // will now apply, which is correctly defined in switch.tsx and index.css.
  className="data-[state=checked]:bg-[#faff6a]"
/>
                    <span className={`text-xs ${hotel.is_rockenue_managed ? 'text-[#faff6a]' : 'text-[#666666]'}`}>
                      {hotel.is_rockenue_managed ? 'Yes' : 'No'}
                    </span>
                  </div>
                </td>
   {/* [NEW] Replaced Input with GroupCombobox from prototype */}
                <td className="px-6 py-4">
                  <GroupCombobox
                    // Pass the hotel's current group
                    value={hotel.management_group}
                    // Pass the list of all groups from App.tsx
                    existingGroups={managementGroups}
                    // Call the handler from App.tsx when a group is selected/created
                    onChange={(group) => onManagementChange(hotel.hotel_id, 'management_group', group)}
                    // Use the prototype's logic to disable this if the hotel isn't managed
                    disabled={!hotel.is_rockenue_managed}
                  />
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
             <Button
                      // Pass the correct ID (as a string) and name to the handler
                      onClick={() => onManageCompSet(hotel.hotel_id.toString(), hotel.property_name)}
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-[#e5e5e5] hover:bg-[#3a3a35] hover:text-[#faff6a]"
                    >
                      <Users className="w-3 h-3 mr-1" />
                      Comp Set
                    </Button>
        <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-[#e5e5e5] hover:bg-[#3a3a35] disabled:opacity-50 disabled:cursor-not-allowed"
                      // Add the onClick handler
                      onClick={() => handleSyncInfo(hotel.hotel_id)}
                      // Disable the button if it's the one currently syncing
                      disabled={syncingHotelId === hotel.hotel_id}
                    >
                      <RefreshCw 
                        className={`w-3 h-3 mr-1 ${
                          // Add a spin animation if this hotel is syncing
                          syncingHotelId === hotel.hotel_id ? 'animate-spin' : ''
                        }`}
                      />
                      {/* Change text to "Syncing..." if this hotel is syncing */}
                      {syncingHotelId === hotel.hotel_id ? 'Syncing...' : 'Sync Info'}
                    </Button>
             <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-[#e5e5e5] hover:bg-[#3a3a35] disabled:opacity-50 disabled:cursor-not-allowed"
                      // Add the onClick handler
                      onClick={() => handleFullSync(hotel.hotel_id)}
                      // Disable this button if either a "Sync Info" or "Full Sync" is running
                      disabled={syncingHotelId === hotel.hotel_id || fullSyncingHotelId === hotel.hotel_id}
                    >
                      <Database 
                        className={`w-3 h-3 mr-1 ${
                          // Add a spin animation if this hotel is full-syncing
                          fullSyncingHotelId === hotel.hotel_id ? 'animate-spin' : ''
                        }`}
                      />
                      {/* Change text to "Syncing..." if this hotel is full-syncing */}
                      {fullSyncingHotelId === hotel.hotel_id ? 'Syncing...' : 'Full Sync'}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
// [NEW] Copied GroupCombobox component from prototype file

// GroupCombobox Component
interface GroupComboboxProps {
  value: string | null;
  existingGroups: string[];
  onChange: (value: string | null) => void;
  disabled?: boolean;
}

function GroupCombobox({ value, existingGroups, onChange, disabled }: GroupComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  const filteredGroups = useMemo(() => {
    if (!searchValue) return existingGroups;
    return existingGroups.filter(group =>
      group.toLowerCase().includes(searchValue.toLowerCase())
    );
  }, [existingGroups, searchValue]);

  // Check if the searched value is a new group
  const showCreateOption = searchValue && !existingGroups.some(g => g.toLowerCase() === searchValue.toLowerCase());

  const handleSelect = (selectedValue: string) => {
    // Allow deselecting by clicking the selected item
    onChange(selectedValue === value ? null : selectedValue);
    setOpen(false);
    setSearchValue('');
  };

  const handleCreate = () => {
    if (searchValue.trim()) {
      onChange(searchValue.trim());
      setOpen(false);
      setSearchValue('');
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={`w-48 justify-between h-8 bg-[#1f1f1c] border-[#3a3a35] text-xs hover:bg-[#2a2a2a] hover:border-[#faff6a]/30 ${
            disabled ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {value ? (
<Badge
  variant="outline"
  // [FIX] Moved arbitrary bg/border classes to an inline style,
  // as required by the project's static CSS build workaround.
  // The text color class is defined in index.css and works.
  className="text-[#d4d4a0] text-xs"
  style={{
    backgroundColor: 'rgba(58, 58, 53, 0.4)', // This is bg-[#3a3a35]/40
    borderColor: '#4a4a45' // This is border-[#4a4a45]
  }}
>
  <Building2 className="w-3 h-3 mr-1" />
  {value}
</Badge>
          ) : (
            <span className="text-[#666666]">No group</span>
          )}
          <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0 bg-[#2C2C2C] border-[#3a3a35]" align="start">
        <Command className="bg-[#2C2C2C]">
          <CommandInput
            placeholder="Search or create group..."
            value={searchValue}
            onValueChange={setSearchValue}
            className="text-[#e5e5e5] placeholder:text-[#666666] border-[#3a3a35]"
          />
          <CommandList>
            <CommandEmpty className="text-[#666666] py-6 text-center text-xs">
              {searchValue ? (
                <div className="text-center">
                  <p className="text-xs mb-2">No existing group found</p>
                  <button
                    onClick={handleCreate}
                    className="text-[#faff6a] hover:text-[#faff6a]/80 text-xs flex items-center justify-center gap-1 mx-auto"
                  >
                    <Plus className="w-3 h-3" />
                    Create "{searchValue}"
                  </button>
                </div>
              ) : (
                'No groups yet'
              )}
            </CommandEmpty>
            
            {filteredGroups.length > 0 && (
              <CommandGroup className="text-[#e5e5e5]">
                <div className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-[#666666]">
                  Existing Groups
                </div>
                {filteredGroups.map((group) => (
                  <CommandItem
                    key={group}
                    value={group}
                    onSelect={() => handleSelect(group)}
                    className="text-[#e5e5e5] hover:bg-[#3a3a35] cursor-pointer data-[selected=true]:bg-[#3a3a35]"
                  >
                    <Check
                      className={`mr-2 h-4 w-4 ${
                        value === group ? 'text-[#faff6a] opacity-100' : 'opacity-0'
                      }`}
                    />
                    <Building2 className="w-3 h-3 mr-2 text-[#faff6a]" />
                    {group}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {showCreateOption && filteredGroups.length > 0 && (
              <CommandGroup className="border-t border-[#3a3a35]">
                <CommandItem
                  onSelect={handleCreate}
                  className="text-[#faff6a] hover:bg-[#3a3a35] cursor-pointer data-[selected=true]:bg-[#3a3a35]"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create new: "{searchValue}"
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}