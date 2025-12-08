// Import useState/useMemo for loading state and combobox logic
import { useState, useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Users,
  RefreshCw,
  Database,
  Check,
  ChevronsUpDown,
  Plus,
  Building2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Input } from "@/components/ui/input"; // Import Input just in case needed, though we use GroupCombobox now

import { Hotel } from "../api/types";

interface HotelManagementTableProps {
  onManageCompSet: (hotelId: string, hotelName: string) => void;
  hotels: Hotel[];
  // [NEW] Add the handler function from App.tsx
  onManagementChange: (
    hotelId: number,
    field: "is_rockenue_managed" | "management_group",
    value: string | boolean | null
  ) => void;
  // [NEW] Add the list of groups for the combobox
  managementGroups: string[];
}

// Destructure the new hotels prop
export function HotelManagementTable({
  onManageCompSet,
  hotels,
  onManagementChange,
  managementGroups,
}: HotelManagementTableProps) {
  // Add state to track which hotel is currently syncing. Value will be the hotel_id.
  const [syncingHotelId, setSyncingHotelId] = useState<number | null>(null);
  // Add a new state to track the full sync, separate from the info sync
  const [fullSyncingHotelId, setFullSyncingHotelId] = useState<number | null>(
    null
  );

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
    const toastId = toast.loading("Updating category...");
    try {
      const response = await fetch("/api/admin/update-hotel-category", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hotelId: hotelId, category: newCategory }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to update category");
      }

      // Show a success toast
      toast.success("Category updated successfully.", { id: toastId });
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
    const toastId = toast.loading("Starting hotel info sync...");

    try {
      const response = await fetch("/api/admin/sync-hotel-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // The endpoint expects 'propertyId'
        body: JSON.stringify({ propertyId: hotelId }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to sync info");
      }

      toast.success(result.message || "Hotel info sync complete.", {
        id: toastId,
      });
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
    if (
      !window.confirm(
        `Are you sure you want to run a full 5-year sync for this hotel? This will delete all existing data for this property and re-import it.`
      )
    ) {
      return;
    }

    setFullSyncingHotelId(hotelId); // Disable button
    // This toast message is more specific about the long duration
    const toastId = toast.loading(
      "Starting 5-year full data sync... This may take several minutes."
    );

    try {
      const response = await fetch("/api/admin/initial-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // The endpoint expects 'propertyId'
        body: JSON.stringify({ propertyId: hotelId }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to run full sync");
      }

      toast.success("Full 5-year sync complete.", {
        id: toastId,
        duration: 5000,
      });
    } catch (error: any) {
      toast.error(`Full sync failed: ${error.message}`, {
        id: toastId,
        duration: 5000,
      });
    } finally {
      setFullSyncingHotelId(null); // Re-enable button
    }
  };
  return (
    <div
      style={{
        backgroundColor: "#1a1a1a",
        border: "1px solid #2a2a2a",
        borderRadius: "0.25rem",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "16px 24px",
          borderBottom: "1px solid #2a2a2a",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Building2 className="w-4 h-4" style={{ color: "#39BDF8" }} />
          <h2
            style={{
              color: "#e5e5e5",
              fontSize: "12px",
              textTransform: "uppercase",
              letterSpacing: "-0.025em",
              margin: 0,
            }}
          >
            Hotel Management
          </h2>
        </div>
        <p style={{ color: "#9ca3af", fontSize: "12px", marginTop: "4px" }}>
          Manage Rockenue properties and assignment to management groups
        </p>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr
              style={{
                borderBottom: "1px solid #2a2a2a",
                backgroundColor: "#0f0f0f",
              }}
            >
              {[
                "Hotel ID",
                "Property Name",
                "Rooms",
                "Type",
                "City",
                "Neighborhood",
                "Category",
                "Managed",
                "Group",
                "Actions",
              ].map((header) => (
                <th
                  key={header}
                  style={{
                    padding: "12px 24px",
                    textAlign: "left",
                    color: "#9ca3af",
                    fontSize: "12px",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hotels.map((hotel) => (
              <tr
                key={hotel.hotel_id}
                style={{ borderBottom: "1px solid #2a2a2a" }}
              >
                <td
                  style={{
                    padding: "16px 24px",
                    color: "#9ca3af",
                    fontSize: "14px",
                  }}
                >
                  {hotel.hotel_id}
                </td>
                <td
                  style={{
                    padding: "16px 24px",
                    color: "#e5e5e5",
                    fontSize: "14px",
                  }}
                >
                  {hotel.property_name}
                </td>
                <td
                  style={{
                    padding: "16px 24px",
                    color: "#9ca3af",
                    fontSize: "14px",
                  }}
                >
                  {hotel.total_rooms || "-"}
                </td>
                <td
                  style={{
                    padding: "16px 24px",
                    color: "#9ca3af",
                    fontSize: "14px",
                  }}
                >
                  {hotel.property_type}
                </td>
                <td
                  style={{
                    padding: "16px 24px",
                    color: "#9ca3af",
                    fontSize: "14px",
                  }}
                >
                  {hotel.city}
                </td>
                <td
                  style={{
                    padding: "16px 24px",
                    color: "#9ca3af",
                    fontSize: "14px",
                  }}
                >
                  {hotel.neighborhood}
                </td>
                <td style={{ padding: "16px 24px" }}>
                  <Select
                    defaultValue={hotel.category}
                    onValueChange={(newCategory) => {
                      handleCategoryChange(hotel.hotel_id, newCategory);
                    }}
                  >
                    <SelectTrigger
                      style={{
                        width: "128px",
                        height: "32px",
                        backgroundColor: "#0f0f0f",
                        borderColor: "#2a2a2a",
                        color: "#e5e5e5",
                        fontSize: "12px",
                      }}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent
                      style={{
                        backgroundColor: "#1a1a1a",
                        borderColor: "#2a2a2a",
                        color: "#e5e5e5",
                      }}
                    >
                      {validCategories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td style={{ padding: "16px 24px" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <Switch
                      checked={hotel.is_rockenue_managed}
                      onCheckedChange={(isChecked) => {
                        onManagementChange(
                          hotel.hotel_id,
                          "is_rockenue_managed",
                          isChecked
                        );
                      }}
                      className="data-[state=checked]:bg-[#39BDF8] data-[state=unchecked]:bg-[#3a3a35]"
                    />
                    <span
                      style={{
                        fontSize: "12px",
                        color: hotel.is_rockenue_managed
                          ? "#39BDF8"
                          : "#666666",
                      }}
                    >
                      {hotel.is_rockenue_managed ? "Yes" : "No"}
                    </span>
                  </div>
                </td>
                <td style={{ padding: "16px 24px" }}>
                  <GroupCombobox
                    value={hotel.management_group}
                    existingGroups={managementGroups}
                    onChange={(group) =>
                      onManagementChange(
                        hotel.hotel_id,
                        "management_group",
                        group
                      )
                    }
                    disabled={!hotel.is_rockenue_managed}
                  />
                </td>
                <td style={{ padding: "16px 24px" }}>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <Button
                      onClick={() =>
                        onManageCompSet(
                          hotel.hotel_id.toString(),
                          hotel.property_name
                        )
                      }
                      variant="ghost"
                      size="sm"
                      style={{
                        height: "28px",
                        padding: "0 8px",
                        fontSize: "12px",
                        color: "#e5e5e5",
                      }}
                      className="hover:bg-[#39BDF8]/10 hover:text-[#39BDF8]"
                    >
                      <Users className="w-3 h-3 mr-1" />
                      Comp Set
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      style={{
                        height: "28px",
                        padding: "0 8px",
                        fontSize: "12px",
                        color: "#e5e5e5",
                      }}
                      className="hover:bg-[#39BDF8]/10 hover:text-[#39BDF8]"
                      onClick={() => handleSyncInfo(hotel.hotel_id)}
                      disabled={syncingHotelId === hotel.hotel_id}
                    >
                      <RefreshCw
                        className={`w-3 h-3 mr-1 ${
                          syncingHotelId === hotel.hotel_id
                            ? "animate-spin"
                            : ""
                        }`}
                      />
                      {syncingHotelId === hotel.hotel_id
                        ? "Syncing..."
                        : "Sync Info"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      style={{
                        height: "28px",
                        padding: "0 8px",
                        fontSize: "12px",
                        color: "#e5e5e5",
                      }}
                      className="hover:bg-[#39BDF8]/10 hover:text-[#39BDF8]"
                      onClick={() => handleFullSync(hotel.hotel_id)}
                      disabled={
                        syncingHotelId === hotel.hotel_id ||
                        fullSyncingHotelId === hotel.hotel_id
                      }
                    >
                      <Database
                        className={`w-3 h-3 mr-1 ${
                          fullSyncingHotelId === hotel.hotel_id
                            ? "animate-spin"
                            : ""
                        }`}
                      />
                      {fullSyncingHotelId === hotel.hotel_id
                        ? "Syncing..."
                        : "Full Sync"}
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

function GroupCombobox({
  value,
  existingGroups,
  onChange,
  disabled,
}: GroupComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  const filteredGroups = useMemo(() => {
    if (!searchValue) return existingGroups;
    return existingGroups.filter((group) =>
      group.toLowerCase().includes(searchValue.toLowerCase())
    );
  }, [existingGroups, searchValue]);

  // Check if the searched value is a new group
  const showCreateOption =
    searchValue &&
    !existingGroups.some((g) => g.toLowerCase() === searchValue.toLowerCase());

  const handleSelect = (selectedValue: string) => {
    // Allow deselecting by clicking the selected item
    onChange(selectedValue === value ? null : selectedValue);
    setOpen(false);
    setSearchValue("");
  };

  const handleCreate = () => {
    if (searchValue.trim()) {
      onChange(searchValue.trim());
      setOpen(false);
      setSearchValue("");
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
          style={{
            width: "192px", // w-48
            justifyContent: "space-between",
            height: "32px", // h-8
            backgroundColor: "rgba(0,0,0,0.4)", // bg-black/40
            borderColor: "rgba(255,255,255,0.1)", // border-white/10
            fontSize: "12px", // text-xs
            color: disabled ? "#666666" : "#e5e5e5",
            opacity: disabled ? 0.5 : 1,
            cursor: disabled ? "not-allowed" : "pointer",
          }}
        >
          {value ? (
            <Badge
              variant="outline"
              // [FIX] Moved arbitrary bg/border classes to an inline style,
              // as required by the project's static CSS build workaround.
              // The text color class is defined in index.css and works.
              className="text-[#d4d4a0] text-xs"
              style={{
                backgroundColor: "rgba(58, 58, 53, 0.4)", // This is bg-[#3a3a35]/40
                borderColor: "#4a4a45", // This is border-[#4a4a45]
              }}
            >
              <Building2 className="w-3 h-3 mr-1" />
              {value}
            </Badge>
          ) : (
            <span style={{ color: "#666666" }}>No group</span>
          )}
          <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        style={{
          width: "256px", // w-64
          padding: 0,
          backgroundColor: "#18181b", // bg-zinc-900
          borderColor: "rgba(255,255,255,0.1)",
        }}
        align="start"
      >
        <Command style={{ backgroundColor: "#18181b" }}>
          <CommandInput
            placeholder="Search or create group..."
            value={searchValue}
            onValueChange={setSearchValue}
            style={{
              color: "#e5e5e5",
              borderColor: "rgba(255,255,255,0.1)",
            }}
          />
          <CommandList>
            <CommandEmpty
              style={{
                color: "#666666",
                padding: "24px",
                textAlign: "center",
                fontSize: "12px",
              }}
            >
              {searchValue ? (
                <div style={{ textAlign: "center" }}>
                  <p style={{ fontSize: "12px", marginBottom: "8px" }}>
                    No existing group found
                  </p>
                  <button
                    onClick={handleCreate}
                    style={{
                      color: "#faff6a",
                      fontSize: "12px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "4px",
                      margin: "0 auto",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    <Plus className="w-3 h-3" />
                    Create "{searchValue}"
                  </button>
                </div>
              ) : (
                "No groups yet"
              )}
            </CommandEmpty>

            {filteredGroups.length > 0 && (
              <CommandGroup>
                <div
                  style={{
                    padding: "6px 8px",
                    fontSize: "10px",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: "#666666",
                  }}
                >
                  Existing Groups
                </div>
                {filteredGroups.map((group) => (
                  <CommandItem
                    key={group}
                    value={group}
                    onSelect={() => handleSelect(group)}
                    style={{
                      color: "#e5e5e5",
                      cursor: "pointer",
                      // Note: CommandItem manages its own hover state class internally,
                      // usually via data-[selected=true]. We rely on standard shadcn here for hover.
                    }}
                  >
                    <Check
                      className={`mr-2 h-4 w-4 ${
                        value === group
                          ? "text-[#faff6a] opacity-100"
                          : "opacity-0"
                      }`}
                    />
                    <Building2 className="w-3 h-3 mr-2 text-[#faff6a]" />
                    {group}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {showCreateOption && filteredGroups.length > 0 && (
              <CommandGroup
                style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}
              >
                <CommandItem
                  onSelect={handleCreate}
                  style={{ color: "#faff6a", cursor: "pointer" }}
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
