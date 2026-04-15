import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Plug,
  Loader2,
  CheckCircle,
  Database,
  TrendingUp,
  Calendar,
  Building2,
  Hotel,
  Sparkles,
  Crown,
} from "lucide-react";
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

type PropertyTier = "Hostel" | "Economy" | "Midscale" | "Upper Midscale" | "Luxury";

const tierOptions: { id: PropertyTier; name: string; description: string; icon: typeof Building2 }[] = [
  { id: "Hostel", name: "Hostel", description: "Budget-friendly shared accommodation", icon: Building2 },
  { id: "Economy", name: "Economy", description: "Essential comfort and value", icon: Building2 },
  { id: "Midscale", name: "Midscale", description: "Balanced comfort and affordability", icon: Hotel },
  { id: "Upper Midscale", name: "Upper Midscale", description: "Stylish and service-focused", icon: Sparkles },
  { id: "Luxury", name: "Luxury", description: "Premium experience and amenities", icon: Crown },
];

const syncSteps = [
  { icon: Database, text: "Connecting to Mews..." },
  { icon: Calendar, text: "Fetching reservation history..." },
  { icon: TrendingUp, text: "Calculating performance metrics..." },
  { icon: Database, text: "Building your competitive set..." },
];

// ─── Full-screen onboarding overlay (portal) ──────────────────────
function OnboardingOverlay({
  testResult,
  accessToken,
  onClose,
}: {
  testResult: TestResult;
  accessToken: string;
  onClose: () => void;
}) {
  const [step, setStep] = useState<"service" | "syncing" | "classify">("service");
  const [selectedServiceId, setSelectedServiceId] = useState<string>(
    testResult.services.length === 1 ? testResult.services[0].id : ""
  );
  const [hotelId, setHotelId] = useState<number | null>(null);
  const [syncStep, setSyncStep] = useState(0);
  const [selectedTier, setSelectedTier] = useState<PropertyTier | null>(null);
  const [isOnboarding, setIsOnboarding] = useState(false);

  // Sync step carousel
  useEffect(() => {
    if (step !== "syncing") return;
    const interval = setInterval(() => {
      setSyncStep((prev) => (prev + 1) % syncSteps.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [step]);

  // Poll sync-status once we have a hotelId
  useEffect(() => {
    if (step !== "syncing" || !hotelId) return;
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`/api/metrics/metadata/sync-status/${hotelId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.isSyncComplete) {
          clearInterval(poll);
          setStep("classify");
        }
      } catch { /* keep polling */ }
    }, 10000);
    // Also check immediately
    (async () => {
      try {
        const res = await fetch(`/api/metrics/metadata/sync-status/${hotelId}`);
        const data = await res.json();
        if (data.isSyncComplete) { clearInterval(poll); setStep("classify"); }
      } catch { /* ignore */ }
    })();
    return () => clearInterval(poll);
  }, [step, hotelId]);

  const handleConnect = useCallback(async () => {
    if (!selectedServiceId) return;
    setIsOnboarding(true);
    try {
      const response = await fetch("/api/mews/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken, serviceId: selectedServiceId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Onboarding failed");

      setHotelId(result.data.hotelId);
      setStep("syncing");
    } catch (error: any) {
      toast.error(`Onboarding failed: ${error.message}`);
      setIsOnboarding(false);
    }
  }, [accessToken, selectedServiceId]);

  const handleClassify = useCallback(async () => {
    if (!hotelId) return;
    if (selectedTier) {
      try {
        await fetch("/api/hotels/category", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hotelId, category: selectedTier }),
        });
      } catch { /* non-critical */ }
    }
    // Force dashboard view and navigate
    sessionStorage.setItem("marketPulseActiveView", "dashboard");
    window.location.href = `/?propertyId=${hotelId}`;
  }, [hotelId, selectedTier]);

  const CurrentSyncIcon = syncSteps[syncStep].icon;

  return createPortal(
    <div style={{
      position: "fixed", inset: 0, backgroundColor: "#14181D",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999,
    }}>

      <div style={{ maxWidth: "520px", width: "100%", padding: "0 24px", position: "relative", zIndex: 10 }}>

        {/* ── Step 1: Service Selection ── */}
        {step === "service" && (
          <div style={{ textAlign: "center" }}>
            {/* Property Info */}
            <div style={{
              backgroundColor: "rgba(56, 198, 186, 0.08)",
              border: "1px solid rgba(56, 198, 186, 0.25)",
              borderRadius: "8px", padding: "16px 20px", marginBottom: "24px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "center", marginBottom: "6px" }}>
                <CheckCircle style={{ width: "16px", height: "16px", color: "#7BAFD4" }} />
                <span style={{ color: "#F3F5F7", fontSize: "16px", fontWeight: 600 }}>
                  {testResult.propertyName}
                </span>
              </div>
              <div style={{ color: "#7A8494", fontSize: "12px", display: "flex", gap: "16px", justifyContent: "center" }}>
                <span>{testResult.city}</span>
                <span>{testResult.timezone}</span>
                <span>{testResult.currency}</span>
              </div>
            </div>

            {/* Service Picker */}
            <div style={{ textAlign: "left", marginBottom: "24px" }}>
              <label style={{ color: "#7A8494", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "10px" }}>
                Accommodation Service {testResult.services.length > 1 && `(${testResult.services.length} found)`}
              </label>
              {testResult.services.length === 1 ? (
                <div style={{
                  color: "#F3F5F7", fontSize: "13px", padding: "10px 14px",
                  backgroundColor: "rgba(56, 198, 186, 0.1)", border: "1px solid #7BAFD4",
                  borderRadius: "6px",
                }}>
                  {testResult.services[0].name}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {testResult.services.map((svc) => (
                    <label
                      key={svc.id}
                      style={{
                        display: "flex", alignItems: "center", gap: "10px",
                        padding: "10px 14px",
                        backgroundColor: selectedServiceId === svc.id ? "rgba(56, 198, 186, 0.1)" : "#121519",
                        border: `1px solid ${selectedServiceId === svc.id ? "#7BAFD4" : "#1E2330"}`,
                        borderRadius: "6px", cursor: "pointer",
                      }}
                    >
                      <input
                        type="radio" name="mews-service" value={svc.id}
                        checked={selectedServiceId === svc.id}
                        onChange={() => setSelectedServiceId(svc.id)}
                        style={{ accentColor: "#7BAFD4" }}
                      />
                      <span style={{ color: "#F3F5F7", fontSize: "13px" }}>{svc.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Connect Button */}
            <Button
              onClick={handleConnect}
              disabled={!selectedServiceId || isOnboarding}
              style={{
                width: "100%", height: "44px",
                backgroundColor: selectedServiceId && !isOnboarding ? "#7BAFD4" : "#1E2330",
                color: selectedServiceId && !isOnboarding ? "#0d0d0d" : "#4E5868",
                fontSize: "14px", fontWeight: 600, border: "none",
              }}
            >
              {isOnboarding ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Connecting...</>
              ) : (
                <><Plug className="w-4 h-4 mr-2" />Connect Property</>
              )}
            </Button>

            {/* Cancel link */}
            <button
              onClick={onClose}
              style={{
                marginTop: "16px", background: "none", border: "none",
                color: "#4E5868", fontSize: "12px", cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        )}

        {/* ── Step 2: Syncing ── */}
        {step === "syncing" && (
          <div style={{ textAlign: "center" }}>
            {/* Spinner */}
            <div style={{ marginBottom: "32px", display: "flex", justifyContent: "center" }}>
              <div style={{ position: "relative", width: "96px", height: "96px" }}>
                <div className="animate-spin" style={{
                  width: "96px", height: "96px",
                  border: "3px solid #1E2330", borderTopColor: "#7BAFD4", borderRadius: "50%",
                }} />
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <CurrentSyncIcon style={{ width: "36px", height: "36px", color: "#7BAFD4" }} />
                </div>
              </div>
            </div>

            <h1 style={{ color: "#F3F5F7", fontSize: "22px", fontWeight: 600, marginBottom: "12px", letterSpacing: "-0.025em" }}>
              Syncing {testResult.propertyName}
            </h1>
            <p style={{ color: "#4E5868", fontSize: "13px", lineHeight: "1.7", marginBottom: "24px" }}>
              We're pulling your historical performance data from Mews to ensure your dashboard and reports are accurate from day one.
            </p>

            {/* Info Banner */}
            <div style={{
              backgroundColor: "rgba(56, 198, 186, 0.08)",
              border: "1px solid rgba(56, 198, 186, 0.25)",
              borderRadius: "6px", padding: "10px 16px", marginBottom: "24px",
            }}>
              <p style={{ color: "#7BAFD4", fontSize: "12px", margin: 0 }}>
                Please keep this page open while we complete the sync.
              </p>
            </div>

            {/* Progress Card */}
            <div style={{
              backgroundColor: "#121519", borderRadius: "8px",
              border: "1px solid #1E2330", padding: "16px",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
                <span style={{ color: "#4E5868", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Progress</span>
                <span style={{ color: "#7BAFD4", fontSize: "11px" }}>Step {syncStep + 1} of {syncSteps.length}</span>
              </div>
              <div style={{ width: "100%", backgroundColor: "#0d0d0d", borderRadius: "4px", height: "6px", marginBottom: "14px" }}>
                <div style={{
                  backgroundColor: "#7BAFD4", height: "6px", borderRadius: "4px",
                  transition: "width 0.5s ease",
                  width: `${((syncStep + 1) / syncSteps.length) * 100}%`,
                }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "center" }}>
                <Loader2 className="animate-spin" style={{ width: "14px", height: "14px", color: "#7BAFD4" }} />
                <span style={{ color: "#F3F5F7", fontSize: "13px" }}>{syncSteps[syncStep].text}</span>
              </div>
            </div>

            <div style={{ marginTop: "28px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginBottom: "8px" }}>
                <div className="animate-pulse" style={{ width: "6px", height: "6px", backgroundColor: "#7BAFD4", borderRadius: "50%" }} />
                <span style={{ color: "#4E5868", fontSize: "11px" }}>Secure connection established</span>
              </div>
              <div style={{ color: "#4E5868", fontSize: "11px" }}>Expected completion: 2-5 minutes</div>
            </div>
          </div>
        )}

        {/* ── Step 3: Classification ── */}
        {step === "classify" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ marginBottom: "24px" }}>
              <CheckCircle style={{ width: "48px", height: "48px", color: "#7BAFD4", margin: "0 auto 16px" }} />
              <h1 style={{ color: "#F3F5F7", fontSize: "22px", fontWeight: 600, marginBottom: "8px" }}>
                {testResult.propertyName} is connected
              </h1>
              <p style={{ color: "#4E5868", fontSize: "13px" }}>
                One last step — classify your property for accurate benchmarking.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "10px", marginBottom: "24px" }}>
              {tierOptions.map((tier) => {
                const Icon = tier.icon;
                const isSelected = selectedTier === tier.id;
                return (
                  <button
                    key={tier.id}
                    onClick={() => setSelectedTier(tier.id)}
                    style={{
                      padding: "16px 8px", borderRadius: "8px",
                      border: isSelected ? "2px solid #7BAFD4" : "1px solid #1E2330",
                      backgroundColor: isSelected ? "rgba(56, 198, 186, 0.08)" : "#121519",
                      cursor: "pointer", transition: "all 0.15s",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "8px" }}>
                      <Icon style={{ width: "28px", height: "28px", color: isSelected ? "#7BAFD4" : "#4E5868" }} />
                      <div>
                        <div style={{ fontSize: "12px", fontWeight: 600, color: isSelected ? "#7BAFD4" : "#F3F5F7", marginBottom: "2px" }}>
                          {tier.name}
                        </div>
                        <div style={{ color: "#4E5868", fontSize: "10px", lineHeight: "1.3" }}>
                          {tier.description}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <button
                onClick={() => { setSelectedTier(null); handleClassify(); }}
                style={{ background: "none", border: "none", color: "#4E5868", fontSize: "13px", cursor: "pointer", padding: "10px 20px" }}
              >
                Skip for now
              </button>
              <Button
                onClick={handleClassify}
                style={{
                  padding: "0 32px", height: "42px", fontSize: "14px", fontWeight: 600,
                  backgroundColor: "#7BAFD4", color: "#0d0d0d", border: "none",
                }}
              >
                Continue to Dashboard
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

// ─── Admin page section (token input + test) ──────────────────────
export function MewsOnboarding() {
  const [accessToken, setAccessToken] = useState("");
  const [status, setStatus] = useState<"idle" | "testing" | "tested">("idle");
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [showOverlay, setShowOverlay] = useState(false);

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
      setStatus("tested");
      toast.success(`Found: ${result.data.propertyName} (${result.data.city})`, { id: toastId });
    } catch (error: any) {
      toast.error(`Error: ${error.message}`, { id: toastId });
      setStatus("idle");
    }
  };

  const handleReset = () => {
    setAccessToken("");
    setTestResult(null);
    setStatus("idle");
  };

  const handleOverlayClose = () => {
    setShowOverlay(false);
  };

  return (
    <>
      <div style={{ backgroundColor: "#121519", border: "1px solid #1E2330", borderRadius: "0.5rem" }}>
        <div style={{ padding: "24px", paddingBottom: "0" }}>
          <h3 style={{
            color: "#F3F5F7", fontSize: "1.25rem",
            display: "flex", alignItems: "center", gap: "8px",
            fontWeight: 600, margin: 0,
          }}>
            <Plug className="w-5 h-5" style={{ color: "#7BAFD4" }} />
            Mews Property Onboarding
          </h3>
          <p style={{ color: "#7A8494", fontSize: "14px", marginTop: "4px" }}>
            Connect a Mews property and sync data automatically
          </p>
        </div>

        <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Token Input */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <label style={{ color: "#7A8494", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Mews Access Token
            </label>
            <Input
              type="password"
              value={accessToken}
              onChange={(e) => { setAccessToken(e.target.value); if (status === "tested") handleReset(); }}
              placeholder="Enter Mews API access token..."
              style={{ backgroundColor: "#121519", borderColor: "#1E2330", color: "#F3F5F7" }}
              className="focus:border-[#7BAFD4]/50"
            />
          </div>

          {/* Test / Begin Onboarding Button */}
          {status !== "tested" ? (
            <Button
              onClick={handleTest}
              disabled={!accessToken || status === "testing"}
              style={{
                backgroundColor: "#7BAFD4", color: "#121519",
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
          ) : testResult && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {/* Property preview */}
              <div style={{
                backgroundColor: "rgba(56, 198, 186, 0.08)",
                border: "1px solid rgba(56, 198, 186, 0.25)",
                borderRadius: "6px", padding: "12px 16px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  <CheckCircle className="w-4 h-4" style={{ color: "#7BAFD4" }} />
                  <span style={{ color: "#F3F5F7", fontSize: "14px", fontWeight: 600 }}>
                    {testResult.propertyName}
                  </span>
                </div>
                <div style={{ color: "#7A8494", fontSize: "12px", display: "flex", gap: "16px" }}>
                  <span>{testResult.city}</span>
                  <span>{testResult.services.length} service{testResult.services.length !== 1 ? "s" : ""}</span>
                </div>
              </div>

              <Button
                onClick={() => setShowOverlay(true)}
                style={{ backgroundColor: "#7BAFD4", color: "#121519" }}
                className="hover:bg-[#0ea572]"
              >
                <Plug className="w-4 h-4 mr-2" />
                Begin Onboarding
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Full-screen onboarding overlay */}
      {showOverlay && testResult && (
        <OnboardingOverlay
          testResult={testResult}
          accessToken={accessToken}
          onClose={handleOverlayClose}
        />
      )}
    </>
  );
}
