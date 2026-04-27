import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Toaster } from "sonner";

// Hooks
import { useAdminData } from "./hooks/useAdminData";

// Components (These should now be in features/admin/components)
import { HotelManagementTable } from "./components/HotelManagementTable";
import { UserManagementTable } from "./components/UserManagementTable";
import { ManageCompSetModal } from "./components/ManageCompSetModal";
import { SystemHealth } from "./components/SystemHealth";
import { ManualReportTrigger } from "./components/ManualReportTrigger";
import { MewsOnboarding } from "./components/MewsOnboarding";
import { CloudbedsAPIExplorer } from "./components/CloudbedsAPIExplorer";

export default function AdminHub() {
  // 1. Use the custom hook for data
  const {
    hotels,
    managementGroups,
    scheduledReports,
    systemStatus,
    isLoading,
    refreshData,
    handleManagementChange,
  } = useAdminData();

  // 2. Local UI State (moved from App.tsx)
  const [adminSelectedPropertyId, setAdminSelectedPropertyId] =
    useState<string>("");
  const [compSetModal, setCompSetModal] = useState<{
    hotelId: string;
    hotelName: string;
  } | null>(null);

  // 3. Effects
  // Set default property selector when hotels load
  useEffect(() => {
    if (hotels.length > 0 && !adminSelectedPropertyId) {
      setAdminSelectedPropertyId(hotels[0].hotel_id.toString());
    }
  }, [hotels, adminSelectedPropertyId]);

  if (isLoading && hotels.length === 0) {
    return (
      <div
        style={{
          minHeight: "100vh",
          backgroundColor: "#14181D",
          padding: "28px 32px",
          color: "#7A8494",
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        }}
      >
        Loading Admin Dashboard...
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#14181D",
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Content */}
      <div
        style={{
          padding: "28px 32px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        {/* Page Header */}
        <div style={{ marginBottom: "12px" }}>
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: 2.5, textTransform: "uppercase", color: "#C8A66E", marginBottom: 8 }}>ADMIN</div>
          <h1
            style={{
              color: "#F3F5F7",
              fontSize: "24px",
              fontWeight: 700,
              letterSpacing: "-0.5px",
              marginBottom: "6px",
              margin: 0,
            }}
          >
            Admin Dashboard
          </h1>
          <p
            style={{
              color: "#7A8494",
              fontSize: "13px",
              margin: 0,
            }}
          >
            System management, property onboarding, and API diagnostics
          </p>
        </div>

        {/* System Health & Manual Report */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: "24px",
          }}
        >
          <SystemHealth
            propertyId={adminSelectedPropertyId}
            lastRefreshTime={systemStatus?.last_successful_run || null}
            onRefreshData={refreshData}
          />
          <ManualReportTrigger reports={scheduledReports} />
        </div>

        <HotelManagementTable
          hotels={hotels}
          onManagementChange={handleManagementChange}
          managementGroups={managementGroups}
          onManageCompSet={(hotelId, hotelName) =>
            setCompSetModal({ hotelId, hotelName })
          }
          onHotelDeleted={refreshData}
        />

        <UserManagementTable />

        <MewsOnboarding />

        {/* API Target Property Selector */}
        <div
          style={{
            backgroundColor: "#121519",
            borderRadius: "10px",
            border: "1px solid #1E2330",
            padding: "16px 20px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <label
              style={{ fontSize: "13px", fontWeight: 500, color: "#F3F5F7" }}
            >
              API Target Property:
            </label>
            <Select
              value={adminSelectedPropertyId}
              onValueChange={setAdminSelectedPropertyId}
            >
              <SelectTrigger
                style={{
                  width: "288px",
                  height: "36px",
                  backgroundColor: "#121519",
                  borderColor: "#1E2330",
                  color: "#F3F5F7",
                }}
              >
                <SelectValue placeholder="Select a property..." />
              </SelectTrigger>
              <SelectContent
                style={{
                  backgroundColor: "#121519",
                  borderColor: "#1E2330",
                  color: "#F3F5F7",
                }}
              >
                {hotels.map((hotel) => (
                  <SelectItem
                    key={hotel.hotel_id}
                    value={hotel.hotel_id.toString()}
                  >
                    {hotel.property_name} ({hotel.pms_type || "N/A"})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p style={{ color: "#4E5868", fontSize: "11px", margin: 0 }}>
              Select the property to use for API tests
            </p>
          </div>
        </div>

        <CloudbedsAPIExplorer propertyId={adminSelectedPropertyId} />
      </div>

      {compSetModal && (
        <ManageCompSetModal
          hotelId={compSetModal.hotelId}
          hotelName={compSetModal.hotelName}
          allHotels={hotels}
          onClose={() => setCompSetModal(null)}
        />
      )}
    </div>
  );
}
