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
import { UserPlus, Loader2 } from "lucide-react";

// --- Interfaces ---
interface Property {
  property_id: number;
  property_name: string;
}

interface InviteUserModalProps {
  open: boolean;
  onClose: () => void;
  properties: Property[];
  onSendInvite: (data: {
    email: string;
    firstName: string;
    lastName: string;
    propertyId: string;
  }) => void;
  isLoading: boolean;
}

export function InviteUserModal({
  open,
  onClose,
  properties,
  onSendInvite,
  isLoading,
}: InviteUserModalProps) {
  const [propertyId, setPropertyId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");

  // Clear form when modal is closed
  useEffect(() => {
    if (!open) {
      setPropertyId("");
      setFirstName("");
      setLastName("");
      setEmail("");
    }
  }, [open]);

  const handleSendInvitation = () => {
    onSendInvite({
      email,
      firstName,
      lastName,
      propertyId,
    });
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
                <UserPlus
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
                Invite User
              </DialogTitle>
            </div>
            <DialogDescription
              style={{ color: "#9ca3af", fontSize: "14px", marginLeft: "52px" }}
            >
              Send an invitation to join your team
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
                Property
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
                  {properties.map((prop) => (
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
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Name Fields */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "12px",
              }}
            >
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
                  First Name
                </Label>
                <Input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="John"
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
                />
              </div>
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
                  Last Name
                </Label>
                <Input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Doe"
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
                />
              </div>
            </div>

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
                Email Address
              </Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john.doe@example.com"
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
              onClick={handleSendInvitation}
              disabled={
                !propertyId || !firstName || !lastName || !email || isLoading
              }
              style={{
                backgroundColor:
                  !propertyId || !firstName || !lastName || !email
                    ? "#2a2a2a"
                    : "#39BDF8",
                color:
                  !propertyId || !firstName || !lastName || !email
                    ? "#6b7280"
                    : "#0f0f0f",
                height: "40px",
                padding: "0 20px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                border: "none",
                borderRadius: "6px",
                cursor:
                  !propertyId || !firstName || !lastName || !email || isLoading
                    ? "not-allowed"
                    : "pointer",
                transition: "background-color 0.2s",
                fontSize: "14px",
              }}
              onMouseEnter={(e) => {
                if (
                  propertyId &&
                  firstName &&
                  lastName &&
                  email &&
                  !isLoading
                ) {
                  e.currentTarget.style.backgroundColor = "#29ADEE";
                }
              }}
              onMouseLeave={(e) => {
                if (
                  propertyId &&
                  firstName &&
                  lastName &&
                  email &&
                  !isLoading
                ) {
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
                <UserPlus style={{ width: "16px", height: "16px" }} />
              )}
              {isLoading ? "Sending..." : "Send Invitation"}
            </Button>
          </div>
        </DialogContent>
      </div>
    </Dialog>
  );
}
