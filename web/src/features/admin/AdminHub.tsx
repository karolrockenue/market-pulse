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
import { SystemHealth } from "./components/SystemHealth";
import { ManualReportTrigger } from "./components/ManualReportTrigger";
import { MewsOnboarding } from "./components/MewsOnboarding";
import { CloudbedsAPIExplorer } from "./components/CloudbedsAPIExplorer";

// If you haven't moved ManageCompSetModal yet, keep it as '@/components/ManageCompSetModal'

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
          backgroundColor: "#1d1d1c",
          padding: "48px",
          color: "#9ca3af",
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
        backgroundColor: "#1d1d1c",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Animated background gradient */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(to bottom right, rgba(57, 189, 248, 0.05), transparent, rgba(250, 255, 106, 0.05))",
        }}
      ></div>

      {/* Grid overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(57,189,248,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(57,189,248,0.03) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      ></div>

      {/* Content */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          padding: "48px",
          display: "flex",
          flexDirection: "column",
          gap: "32px",
          maxWidth: "1800px",
          marginLeft: "auto",
          marginRight: "auto",
        }}
      >
        {/* Page Header */}
        <div style={{ marginBottom: "48px" }}>
          <h1
            style={{
              color: "#e5e5e5",
              fontSize: "30px",
              letterSpacing: "-0.025em",
              marginBottom: "8px",
              margin: 0,
            }}
          >
            Admin Dashboard
          </h1>
          <p
            style={{
              color: "#9ca3af",
              fontSize: "14px",
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
          onManageCompSet={() => {}} // Placeholder if needed
        />

        <MewsOnboarding />

        {/* API Target Property Selector */}
        <div
          style={{
            backgroundColor: "#1A1A1A",
            borderRadius: "8px",
            border: "1px solid #3a3a35",
            padding: "24px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <label
              style={{ fontSize: "14px", fontWeight: 500, color: "#e5e5e5" }}
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
                  backgroundColor: "#1f1f1c",
                  borderColor: "#3a3a35",
                  color: "#e5e5e5",
                }}
              >
                <SelectValue placeholder="Select a property..." />
              </SelectTrigger>
              <SelectContent
                style={{
                  backgroundColor: "#2C2C2C",
                  borderColor: "#3a3a35",
                  color: "#e5e5e5",
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
            <p style={{ color: "#9ca3af", fontSize: "12px", margin: 0 }}>
              Select the property to use for API tests and the API Explorer.
            </p>
          </div>
        </div>

        <CloudbedsAPIExplorer propertyId={adminSelectedPropertyId} />
      </div>
    </div>
  );
}
