import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Plug, Loader2, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label"; // Ensure Label is imported or use standard label tag styled

// Define the shape of the report object from the API
interface Report {
  report_id: string;
  report_name: string;
  property_name: string;
}

// Define the props for the component
interface ManualReportTriggerProps {
  reports: Report[]; // Accept the list of reports
}

// Accept the reports prop
export function MewsOnboarding() {
  // Changed function name back to MewsOnboarding
  const [accessToken, setAccessToken] = useState("");
  const [email, setEmail] = useState("");
  // Add state for first and last name
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  // Simplify status for button state
  const [status, setStatus] = useState<"idle" | "connecting">("idle");

  const handleConnect = async () => {
    setStatus("connecting");
    const toastId = toast.loading("Connecting to Mews and fetching property data...");

    try {
      const response = await fetch("/api/mews/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Onboarding failed");
      }

      toast.success(
        `${result.data?.propertyName || "Property"} onboarded successfully! ${result.data?.roomTypes || 0} room types, ${result.data?.ratePlans || 0} rate plans.`,
        { id: toastId, duration: 5000 }
      );

      // Reset form
      setAccessToken("");
      setEmail("");
      setFirstName("");
      setLastName("");
      setStatus("idle");
    } catch (error: any) {
      toast.error(`Error: ${error.message}`, { id: toastId });
      setStatus("idle");
    }
  };

  return (
    <div
      style={{
        backgroundColor: "#1a1a1a",
        borderColor: "#2a2a2a",
        borderWidth: "1px",
        borderStyle: "solid",
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

      <div
        style={{
          padding: "24px",
          paddingTop: "24px",
          display: "flex",
          flexDirection: "column",
          gap: "24px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: "16px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <label
              style={{
                color: "#9ca3af",
                fontSize: "12px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Owner's First Name
            </label>
            <Input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Jane"
              style={{
                backgroundColor: "#0f0f0f",
                borderColor: "#2a2a2a",
                color: "#e5e5e5",
              }}
              className="focus:border-[#39BDF8]/50"
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <label
              style={{
                color: "#9ca3af",
                fontSize: "12px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Owner's Last Name
            </label>
            <Input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Doe"
              style={{
                backgroundColor: "#0f0f0f",
                borderColor: "#2a2a2a",
                color: "#e5e5e5",
              }}
              className="focus:border-[#39BDF8]/50"
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <label
              style={{
                color: "#9ca3af",
                fontSize: "12px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Owner's Email Address
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="owner@property.com"
              style={{
                backgroundColor: "#0f0f0f",
                borderColor: "#2a2a2a",
                color: "#e5e5e5",
              }}
              className="focus:border-[#39BDF8]/50"
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <label
              style={{
                color: "#9ca3af",
                fontSize: "12px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Mews Access Token
            </label>
            <Input
              type="password"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="Enter Mews API access token..."
              style={{
                backgroundColor: "#0f0f0f",
                borderColor: "#2a2a2a",
                color: "#e5e5e5",
              }}
              className="focus:border-[#39BDF8]/50"
            />
          </div>
        </div>

        <Button
          onClick={handleConnect}
          disabled={
            !firstName ||
            !lastName ||
            !accessToken ||
            !email ||
            status === "connecting"
          }
          style={{
            backgroundColor: "#39BDF8",
            color: "#0f0f0f",
            opacity:
              !firstName ||
              !lastName ||
              !accessToken ||
              !email ||
              status === "connecting"
                ? 0.5
                : 1,
          }}
          className="hover:bg-[#29ADEE]"
        >
          {status === "connecting" ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <Plug className="w-4 h-4 mr-2" />
              Connect & Sync Property
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
