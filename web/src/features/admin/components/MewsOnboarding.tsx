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
    setStatus("connecting"); // Disable button
    const toastId = toast.loading("Validating details with Mews...");

    try {
      // --- Step 1: Validate ---
      const validateResponse = await fetch("/api/auth/mews/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, email, accessToken }),
      });

      const validateResult = await validateResponse.json();

      if (!validateResponse.ok) {
        // Handle validation errors (e.g., user exists, invalid token)
        throw new Error(validateResult.message || "Validation failed");
      }

      // --- Step 2: Check Token Type & Create ---
      if (validateResult.tokenType === "single") {
        toast.loading("Validation successful. Creating connection...", {
          id: toastId,
        });

        const createResponse = await fetch("/api/auth/mews/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName,
            lastName,
            email,
            accessToken,
            // Pass the single property returned by the validate endpoint
            selectedProperties: validateResult.properties,
          }),
        });

        const createResult = await createResponse.json();

        if (!createResponse.ok) {
          throw new Error(
            createResult.message || "Failed to create connection"
          );
        }

        // --- Step 3: Success & Redirect ---
        toast.success(
          createResult.message || "Connection successful! Redirecting...",
          { id: toastId, duration: 4000 }
        );

        // Redirect the user after a short delay
        setTimeout(() => {
          if (createResult.redirectTo) {
            window.location.href = createResult.redirectTo; //
          } else {
            // Fallback if redirect URL is missing
            window.location.href = "/app/";
          }
        }, 1500);
        // Keep button disabled during redirect phase
      } else if (validateResult.tokenType === "portfolio") {
        //
        // Handle portfolio tokens - show error for this component
        throw new Error(
          "Portfolio tokens are not supported in this form. Please use a single property token."
        );
      } else {
        // Handle unexpected token types
        throw new Error("Received an unknown token type from the server.");
      }
    } catch (error: any) {
      toast.error(`Error: ${error.message}`, { id: toastId });
      setStatus("idle"); // Re-enable button on error
    }
    // No 'finally' block needed here, button stays disabled on success until redirect
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
