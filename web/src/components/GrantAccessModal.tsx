import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { useState, useEffect } from "react";
import { Shield, Loader2 } from "lucide-react";

// --- Interfaces ---
interface Property {
  property_id: number;
  property_name: string;
}

interface GrantAccessModalProps {
  open: boolean;
  onClose: () => void;
  properties?: Property[]; // Made optional to prevent crashing if not passed yet
  onGrantAccess?: (data: { email: string; propertyId: string }) => void;
  isLoading?: boolean;
}

export function GrantAccessModal({
  open,
  onClose,
  properties = [], // Default to empty array
  onGrantAccess,
  isLoading = false,
}: GrantAccessModalProps) {
  const [email, setEmail] = useState("");
  const [propertyId, setPropertyId] = useState("");

  // Clear form on close
  useEffect(() => {
    if (!open) {
      setEmail("");
      setPropertyId("");
    }
  }, [open]);

  const handleGrant = () => {
    if (onGrantAccess) {
      onGrantAccess({ email, propertyId });
    } else {
      // Fallback for demo purposes if parent isn't wired yet
      console.log("Granting access:", { email, propertyId });
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <div
        style={
          {
            "--color-ring": "rgba(57, 189, 248, 0.5)",
            "--color-accent": "rgba(57, 189, 248, 0.1)",
            "--color-accent-foreground": "#39BDF8",
          } as React.CSSProperties
        }
      >
        <DialogContent
          style={{
            backgroundColor: "#1a1a1a",
            border: "1px solid #2a2a2a",
            color: "#e5e5e5",
            maxWidth: "520px",
            boxShadow: "0 0 20px rgba(57, 189, 248, 0.08)",
          }}
        >
          <DialogHeader
            style={{
              borderBottom: "1px solid rgba(42, 42, 42, 0.5)",
              paddingBottom: "16px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                marginBottom: "8px",
              }}
            >
              <div
                style={{
                  padding: "8px",
                  backgroundColor: "rgba(57, 189, 248, 0.1)",
                  borderRadius: "8px",
                }}
              >
                <Shield
                  style={{ width: "20px", height: "20px", color: "#39BDF8" }}
                />
              </div>
              <DialogTitle
                style={{
                  color: "#39BDF8",
                  fontSize: "18px",
                  textTransform: "uppercase",
                  letterSpacing: "-0.025em",
                  margin: 0,
                }}
              >
                Grant Access
              </DialogTitle>
            </div>
            <DialogDescription
              style={{ color: "#9ca3af", fontSize: "14px", marginLeft: "52px" }}
            >
              Give an existing user access to another property
            </DialogDescription>
          </DialogHeader>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "20px",
              paddingTop: "24px",
              paddingBottom: "8px",
            }}
          >
            {/* Email Field */}
            <div
              style={{ display: "flex", flexDirection: "column", gap: "8px" }}
            >
              <Label
                style={{
                  color: "#9ca3af",
                  fontSize: "10px",
                  textTransform: "uppercase",
                  letterSpacing: "-0.025em",
                  paddingLeft: "4px",
                }}
              >
                User's Email Address
              </Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                disabled={isLoading}
                style={{
                  backgroundColor: "#141414",
                  border: "1px solid #2a2a2a",
                  color: "#e5e5e5",
                  height: "40px",
                  fontSize: "14px",
                  boxShadow: "none",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "rgba(57, 189, 248, 0.5)";
                  e.currentTarget.style.outline = "none";
                  e.currentTarget.style.boxShadow =
                    "0 0 0 3px rgba(57, 189, 248, 0.1)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "#2a2a2a";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>

            {/* Property Selection */}
            <div
              style={{ display: "flex", flexDirection: "column", gap: "8px" }}
            >
              <Label
                style={{
                  color: "#9ca3af",
                  fontSize: "10px",
                  textTransform: "uppercase",
                  letterSpacing: "-0.025em",
                  paddingLeft: "4px",
                }}
              >
                Property to Share
              </Label>
              <Select value={propertyId} onValueChange={setPropertyId}>
                <SelectTrigger
                  style={{
                    backgroundColor: "#141414",
                    border: "1px solid #2a2a2a",
                    color: "#e5e5e5",
                    height: "40px",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor =
                      "rgba(57, 189, 248, 0.5)";
                    e.currentTarget.style.outline = "none";
                    e.currentTarget.style.boxShadow =
                      "0 0 0 3px rgba(57, 189, 248, 0.1)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "#2a2a2a";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <SelectValue placeholder="Select property..." />
                </SelectTrigger>
                <SelectContent
                  style={{
                    backgroundColor: "#1a1a1a",
                    border: "1px solid #2a2a2a",
                    color: "#e5e5e5",
                  }}
                >
                  {properties.length > 0 ? (
                    properties.map((prop) => (
                      <SelectItem
                        key={prop.property_id}
                        value={prop.property_id.toString()}
                        style={{
                          backgroundColor: "transparent",
                          cursor: "pointer",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor =
                            "rgba(57, 189, 248, 0.1)";
                          e.currentTarget.style.color = "#39BDF8";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "transparent";
                          e.currentTarget.style.color = "#e5e5e5";
                        }}
                      >
                        {prop.property_name}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="p-2 text-xs text-gray-500 text-center">
                      No properties available
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Info Box */}
            <div
              style={{
                backgroundColor: "rgba(57, 189, 248, 0.05)",
                border: "1px solid rgba(57, 189, 248, 0.2)",
                borderRadius: "6px",
                padding: "12px",
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
              }}
            >
              <Shield
                style={{
                  width: "16px",
                  height: "16px",
                  color: "#39BDF8",
                  flexShrink: 0,
                  marginTop: "2px",
                }}
              />
              <div
                style={{
                  fontSize: "12px",
                  color: "#9ca3af",
                  lineHeight: "1.5",
                }}
              >
                The user will receive an email notification and gain immediate
                access to the selected property's data.
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "12px",
              paddingTop: "20px",
              borderTop: "1px solid rgba(42, 42, 42, 0.5)",
              marginTop: "8px",
            }}
          >
            <Button
              onClick={onClose}
              disabled={isLoading}
              style={{
                backgroundColor: "#141414",
                border: "1px solid #2a2a2a",
                color: "#e5e5e5",
                height: "40px",
                padding: "0 20px",
                borderRadius: "6px",
                cursor: "pointer",
                transition: "all 0.2s",
                fontSize: "14px",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#1a1a1a";
                e.currentTarget.style.borderColor = "rgba(57, 189, 248, 0.3)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#141414";
                e.currentTarget.style.borderColor = "#2a2a2a";
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleGrant}
              disabled={!email || !propertyId || isLoading}
              style={{
                backgroundColor: !email || !propertyId ? "#2a2a2a" : "#39BDF8",
                color: !email || !propertyId ? "#6b7280" : "#0f0f0f",
                height: "40px",
                padding: "0 20px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                border: "none",
                borderRadius: "6px",
                cursor:
                  !email || !propertyId || isLoading
                    ? "not-allowed"
                    : "pointer",
                transition: "background-color 0.2s",
                fontSize: "14px",
              }}
              onMouseEnter={(e) => {
                if (email && propertyId && !isLoading) {
                  e.currentTarget.style.backgroundColor = "#29ADEE";
                }
              }}
              onMouseLeave={(e) => {
                if (email && propertyId && !isLoading) {
                  e.currentTarget.style.backgroundColor = "#39BDF8";
                }
              }}
            >
              {isLoading ? (
                <Loader2
                  style={{
                    width: "16px",
                    height: "16px",
                    animation: "spin 1s linear infinite",
                  }}
                />
              ) : (
                <Shield style={{ width: "16px", height: "16px" }} />
              )}
              {isLoading ? "Granting..." : "Grant Access"}
            </Button>
          </div>
        </DialogContent>
      </div>
    </Dialog>
  );
}
