import { Button } from "@/components/ui/button";
import { useState } from "react";
import {
  Database,
  Cloud,
  RefreshCw,
  CheckCircle,
  XCircle,
  Loader2,
  Activity,
} from "lucide-react";
import { toast } from "sonner";

interface SystemHealthProps {
  propertyId: string;
  lastRefreshTime: string | null;
  onRefreshData: () => void;
}

export function SystemHealth({
  propertyId,
  lastRefreshTime,
  onRefreshData,
}: SystemHealthProps) {
  const [dbStatus, setDbStatus] = useState<
    "idle" | "testing" | "connected" | "error"
  >("idle");
  const [cloudbedsStatus, setCloudbedsStatus] = useState<
    "idle" | "testing" | "connected" | "error"
  >("idle");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const testDatabase = async () => {
    setDbStatus("testing");
    try {
      const response = await fetch("/api/admin/test-database");
      if (!response.ok) throw new Error("Database test failed");
      const data = await response.json();
      if (!data.success) throw new Error(data.error || "Database test failed");

      setDbStatus("connected");
      toast.success("Database connection successful.");
    } catch (error: any) {
      setDbStatus("error");
      toast.error(error.message);
    }
  };

  const testCloudbeds = async () => {
    setCloudbedsStatus("testing");
    if (!propertyId) {
      setCloudbedsStatus("error");
      toast.error("Test failed: No API Target Property selected.");
      return;
    }

    try {
      const response = await fetch(
        `/api/admin/test-cloudbeds?propertyId=${propertyId}`
      );
      const data = await response.json();

      if (!response.ok || !data.success) {
        if (
          data.error &&
          data.error.includes("Could not find a valid refresh token")
        ) {
          throw new Error(
            "Auth test failed (Hint: Is a Mews property selected?)"
          );
        }
        throw new Error(data.error || "Cloudbeds test failed");
      }

      setCloudbedsStatus("connected");
      toast.success("Cloudbeds authentication successful.");
    } catch (error: any) {
      setCloudbedsStatus("error");
      toast.error(error.message);
    }
  };

  const forceRefresh = async () => {
    setIsRefreshing(true);
    const toastId = toast.loading("Forcing daily data refresh...");
    try {
      const response = await fetch("/api/admin/daily-refresh");
      if (!response.ok) throw new Error("Refresh job failed to start");
      const data = await response.json();
      if (data.error) throw new Error(data.error);

      toast.success("Daily refresh job triggered.", { id: toastId });
      onRefreshData();
    } catch (error: any) {
      toast.error(error.message, { id: toastId });
    } finally {
      setIsRefreshing(false);
    }
  };

  const StatusIcon = ({ status }: { status: string }) => {
    switch (status) {
      case "testing":
        return (
          <Loader2
            className="w-4 h-4 animate-spin"
            style={{ color: "#39BDF8" }}
          />
        );
      case "connected":
        return <CheckCircle className="w-4 h-4 text-[#10b981]" />;
      case "error":
        return <XCircle className="w-4 h-4 text-[#ef4444]" />;
      default:
        return (
          <div
            style={{
              width: "16px",
              height: "16px",
              borderRadius: "50%",
              backgroundColor: "#3a3a35",
            }}
          />
        );
    }
  };

  return (
    <div
      style={{
        backgroundColor: "#1a1a1a",
        border: "1px solid #2a2a2a",
        borderRadius: "0.25rem",
      }}
    >
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid #2a2a2a",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Activity className="w-4 h-4" style={{ color: "#39BDF8" }} />
          <h2
            style={{
              color: "#e5e5e5",
              fontSize: "12px",
              textTransform: "uppercase",
              letterSpacing: "-0.025em",
              margin: 0,
            }}
          >
            System Status & Health
          </h2>
        </div>
      </div>

      <div style={{ padding: "20px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "16px",
          }}
        >
          {/* Database Test */}
          <div
            style={{
              backgroundColor: "#1A1A1A",
              border: "1px solid #2a2a2a",
              borderRadius: "0.25rem",
              padding: "16px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "12px",
              }}
            >
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "0.25rem",
                  backgroundColor: "rgba(57, 189, 248, 0.1)",
                  border: "1px solid rgba(57, 189, 248, 0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Database className="w-4 h-4" style={{ color: "#39BDF8" }} />
              </div>
              <span style={{ color: "#e5e5e5", fontSize: "12px" }}>
                Database Connection
              </span>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "16px",
              }}
            >
              <StatusIcon status={dbStatus} />
              <span style={{ color: "#9ca3af", fontSize: "12px" }}>
                {dbStatus === "idle" && "Not tested"}
                {dbStatus === "testing" && "Testing..."}
                {dbStatus === "connected" && "Connected"}
                {dbStatus === "error" && "Connection failed"}
              </span>
            </div>
            <Button
              onClick={testDatabase}
              disabled={dbStatus === "testing"}
              style={{
                width: "100%",
                height: "32px",
                backgroundColor: "#39BDF8",
                color: "#0f0f0f",
                fontSize: "12px",
                opacity: dbStatus === "testing" ? 0.5 : 1,
              }}
              className="hover:bg-[#29ADEE]"
            >
              Test Database
            </Button>
          </div>

          {/* Cloudbeds Auth Test */}
          <div
            style={{
              backgroundColor: "#1A1A1A",
              border: "1px solid #2a2a2a",
              borderRadius: "0.25rem",
              padding: "16px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "12px",
              }}
            >
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "0.25rem",
                  backgroundColor: "rgba(57, 189, 248, 0.1)",
                  border: "1px solid rgba(57, 189, 248, 0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Cloud className="w-4 h-4" style={{ color: "#39BDF8" }} />
              </div>
              <span style={{ color: "#e5e5e5", fontSize: "12px" }}>
                Cloudbeds Auth
              </span>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "16px",
              }}
            >
              <StatusIcon status={cloudbedsStatus} />
              <span style={{ color: "#9ca3af", fontSize: "12px" }}>
                {cloudbedsStatus === "idle" && "Not tested"}
                {cloudbedsStatus === "testing" && "Testing..."}
                {cloudbedsStatus === "connected" && "Authenticated"}
                {cloudbedsStatus === "error" && "Auth failed"}
              </span>
            </div>
            <Button
              onClick={testCloudbeds}
              disabled={cloudbedsStatus === "testing"}
              style={{
                width: "100%",
                height: "32px",
                backgroundColor: "#39BDF8",
                color: "#0f0f0f",
                fontSize: "12px",
                opacity: cloudbedsStatus === "testing" ? 0.5 : 1,
              }}
              className="hover:bg-[#29ADEE]"
            >
              Test Auth
            </Button>
          </div>

          {/* Data Freshness */}
          <div
            style={{
              backgroundColor: "#1A1A1A",
              border: "1px solid #2a2a2a",
              borderRadius: "0.25rem",
              padding: "16px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "12px",
              }}
            >
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "0.25rem",
                  backgroundColor: "rgba(57, 189, 248, 0.1)",
                  border: "1px solid rgba(57, 189, 248, 0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <RefreshCw className="w-4 h-4" style={{ color: "#39BDF8" }} />
              </div>
              <span style={{ color: "#e5e5e5", fontSize: "12px" }}>
                Data Freshness
              </span>
            </div>
            <div style={{ marginBottom: "16px" }}>
              <div
                style={{
                  color: "#9ca3af",
                  fontSize: "12px",
                  marginBottom: "4px",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Last Daily Refresh
              </div>
              <div
                style={{
                  color: "#39BDF8",
                  fontSize: "12px",
                  fontFamily: "monospace",
                }}
              >
                {lastRefreshTime
                  ? new Date(lastRefreshTime).toLocaleString()
                  : "Never"}
              </div>
            </div>
            <Button
              onClick={forceRefresh}
              disabled={isRefreshing}
              style={{
                width: "100%",
                height: "32px",
                backgroundColor: "#39BDF8",
                color: "#0f0f0f",
                fontSize: "12px",
                opacity: isRefreshing ? 0.5 : 1,
              }}
              className="hover:bg-[#29ADEE]"
            >
              {isRefreshing ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  Refreshing...
                </>
              ) : (
                "Force Refresh"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
