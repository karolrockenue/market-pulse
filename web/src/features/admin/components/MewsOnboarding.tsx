import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Plug, Loader2, CheckCircle } from "lucide-react";
import { toast } from "sonner";

interface MewsService {
  id: string;
  name: string;
  startTime?: string;
}

interface TestResult {
  propertyName: string;
  city: string;
  timezone: string;
  currency: string;
  enterpriseId: string;
  services: MewsService[];
}

export function MewsOnboarding() {
  const [accessToken, setAccessToken] = useState("");
  const [status, setStatus] = useState<"idle" | "testing" | "tested" | "onboarding">("idle");
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");

  const handleTest = async () => {
    setStatus("testing");
    const toastId = toast.loading("Validating credentials with Mews...");

    try {
      const response = await fetch("/api/mews/test-creds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Test failed");

      setTestResult(result.data);
      // Auto-select if only one service
      if (result.data.services.length === 1) {
        setSelectedServiceId(result.data.services[0].id);
      }
      setStatus("tested");
      toast.success(`Found: ${result.data.propertyName} (${result.data.city})`, { id: toastId });
    } catch (error: any) {
      toast.error(`Error: ${error.message}`, { id: toastId });
      setStatus("idle");
    }
  };

  const handleOnboard = async () => {
    if (!selectedServiceId) {
      toast.error("Please select an accommodation service.");
      return;
    }

    setStatus("onboarding");
    const toastId = toast.loading("Onboarding property...");

    try {
      const response = await fetch("/api/mews/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken, serviceId: selectedServiceId }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Onboarding failed");

      toast.success(
        `${result.data?.propertyName || "Property"} onboarded! ${result.data?.roomTypes || 0} room types, ${result.data?.ratePlans || 0} rate plans.`,
        { id: toastId, duration: 5000 }
      );

      // Reset
      setAccessToken("");
      setTestResult(null);
      setSelectedServiceId("");
      setStatus("idle");
    } catch (error: any) {
      toast.error(`Error: ${error.message}`, { id: toastId });
      setStatus("tested"); // Go back to tested state so they can retry
    }
  };

  const handleReset = () => {
    setAccessToken("");
    setTestResult(null);
    setSelectedServiceId("");
    setStatus("idle");
  };

  return (
    <div
      style={{
        backgroundColor: "#1a1a1a",
        border: "1px solid #2a2a2a",
        borderRadius: "0.5rem",
      }}
    >
      <div style={{ padding: "24px", paddingBottom: "0" }}>
        <h3
          style={{
            color: "#e5e5e5",
            fontSize: "1.25rem",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontWeight: 600,
            margin: 0,
          }}
        >
          <Plug className="w-5 h-5" style={{ color: "#39BDF8" }} />
          Mews Property Onboarding
        </h3>
        <p style={{ color: "#9ca3af", fontSize: "14px", marginTop: "4px" }}>
          Connect a Mews property and sync data automatically
        </p>
      </div>

      <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Step 1: Access Token */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label style={{ color: "#9ca3af", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Mews Access Token
          </label>
          <Input
            type="password"
            value={accessToken}
            onChange={(e) => { setAccessToken(e.target.value); if (status === "tested") handleReset(); }}
            placeholder="Enter Mews API access token..."
            disabled={status === "onboarding"}
            style={{ backgroundColor: "#0f0f0f", borderColor: "#2a2a2a", color: "#e5e5e5" }}
            className="focus:border-[#39BDF8]/50"
          />
        </div>

        {/* Step 1 Button: Test */}
        {status !== "tested" && (
          <Button
            onClick={handleTest}
            disabled={!accessToken || status === "testing"}
            style={{
              backgroundColor: "#39BDF8",
              color: "#0f0f0f",
              opacity: !accessToken || status === "testing" ? 0.5 : 1,
            }}
            className="hover:bg-[#29ADEE]"
          >
            {status === "testing" ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Testing...</>
            ) : (
              <><Plug className="w-4 h-4 mr-2" />Test Credentials</>
            )}
          </Button>
        )}

        {/* Step 2: Property Details + Service Picker */}
        {testResult && status !== "idle" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {/* Property Info */}
            <div style={{
              backgroundColor: "rgba(57, 189, 248, 0.08)",
              border: "1px solid rgba(57, 189, 248, 0.25)",
              borderRadius: "6px",
              padding: "12px 16px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                <CheckCircle className="w-4 h-4" style={{ color: "#10b981" }} />
                <span style={{ color: "#e5e5e5", fontSize: "14px", fontWeight: 600 }}>
                  {testResult.propertyName}
                </span>
              </div>
              <div style={{ color: "#9ca3af", fontSize: "12px", display: "flex", gap: "16px" }}>
                <span>{testResult.city}</span>
                <span>{testResult.timezone}</span>
                <span>{testResult.currency}</span>
              </div>
            </div>

            {/* Service Picker */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label style={{ color: "#9ca3af", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Accommodation Service {testResult.services.length > 1 && `(${testResult.services.length} found — select the correct one)`}
              </label>
              {testResult.services.length === 1 ? (
                <div style={{ color: "#e5e5e5", fontSize: "13px", padding: "8px 12px", backgroundColor: "#0f0f0f", border: "1px solid #2a2a2a", borderRadius: "6px" }}>
                  {testResult.services[0].name}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {testResult.services.map((svc) => (
                    <label
                      key={svc.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "10px 12px",
                        backgroundColor: selectedServiceId === svc.id ? "rgba(57, 189, 248, 0.1)" : "#0f0f0f",
                        border: `1px solid ${selectedServiceId === svc.id ? "#39BDF8" : "#2a2a2a"}`,
                        borderRadius: "6px",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="radio"
                        name="mews-service"
                        value={svc.id}
                        checked={selectedServiceId === svc.id}
                        onChange={() => setSelectedServiceId(svc.id)}
                        style={{ accentColor: "#39BDF8" }}
                      />
                      <span style={{ color: "#e5e5e5", fontSize: "13px" }}>{svc.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Onboard Button */}
            <Button
              onClick={handleOnboard}
              disabled={!selectedServiceId || status === "onboarding"}
              style={{
                backgroundColor: "#10b981",
                color: "#0f0f0f",
                opacity: !selectedServiceId || status === "onboarding" ? 0.5 : 1,
              }}
              className="hover:bg-[#0ea572]"
            >
              {status === "onboarding" ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Onboarding...</>
              ) : (
                <><Plug className="w-4 h-4 mr-2" />Onboard Property</>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
