import { useState, useEffect, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
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
import {
  User,
  Users,
  Building2,
  DollarSign,
  UserPlus,
  Save,
  Plus,
  CheckCircle,
  Copy,
  Download,
  Calendar,
  TrendingUp,
  Loader2,
  Trash2,
  Shield, // <--- Added
} from "lucide-react";
import { toast } from "sonner";
import { useSettings } from "../features/settings/hooks/useSettings";
import { settingsApi } from "../features/settings/api/settings.api";
import { TeamMember } from "../features/settings/api/types";

// [UPDATED] Add the handler props to the interface
interface SettingsPageProps {
  hotelId: string;
  userRole?: string;
  onInviteUser: () => void; // <--- Added
  onGrantAccess: () => void; // <--- Added
}

// [UPDATED] Destructure the new props
export function SettingsPage({
  hotelId,
  userRole, // <--- Added this
  onInviteUser,
  onGrantAccess,
}: SettingsPageProps) {
  // --- STATE: Control Tabs for Styling ---
  const [activeTab, setActiveTab] = useState("profile");

  // --- REAL LOGIC: Team Hook ---
  const { teamMembers, isLoadingTeam, handleRemoveUser, handleSendInvite } =
    useSettings(hotelId);

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
          inset: "0",
          background:
            "linear-gradient(to bottom right, rgba(57, 189, 248, 0.01), transparent, rgba(250, 255, 106, 0.01))",
        }}
      ></div>

      {/* Grid overlay */}
      <div
        style={{
          position: "absolute",
          inset: "0",
          backgroundImage:
            "linear-gradient(rgba(57,189,248,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(57,189,248,0.03) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      ></div>

      <div
        style={{
          position: "relative",
          zIndex: 10,
          padding: "48px",
          maxWidth: "1500px",
          margin: "0 auto",
        }}
      >
        {/* Page Header */}
        <div style={{ marginBottom: "48px" }}>
          <h1
            style={{
              color: "#e5e5e5",
              fontSize: "24px",
              letterSpacing: "-0.025em",
              marginBottom: "8px",
            }}
          >
            SETTINGS & CONFIGURATION
          </h1>
          <p style={{ color: "#9ca3af", fontSize: "14px" }}>
            User Management • Properties • Budget Targets
          </p>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          style={{ display: "flex", flexDirection: "column", gap: "32px" }}
        >
          {/* Sentinel-style Tab Navigation (Controlled Styles) */}
          <div
            style={{
              backgroundColor: "#1a1a1a",
              border: "1px solid #2a2a2a",
              borderRadius: "8px",
              padding: "8px",
            }}
          >
            <TabsList className="grid grid-cols-4 bg-transparent p-0 h-auto gap-2 w-full">
              {[
                { id: "profile", label: "Profile", icon: User },
                { id: "team", label: "Team", icon: Users },
                { id: "properties", label: "Properties", icon: Building2 },
                { id: "budget", label: "Budget", icon: DollarSign },
              ].map((tab) => {
                const isActive = activeTab === tab.id;
                const Icon = tab.icon;
                return (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    style={{
                      backgroundColor: isActive
                        ? "rgba(57, 189, 248, 0.2)"
                        : "transparent",
                      color: isActive ? "#39BDF8" : "#9ca3af",
                      border: isActive
                        ? "1px solid rgba(57, 189, 248, 0.5)"
                        : "1px solid transparent",
                      borderRadius: "6px",
                      padding: "12px",
                      fontSize: "12px",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "all 0.2s",
                      cursor: "pointer",
                    }}
                  >
                    <Icon
                      style={{
                        width: "14px",
                        height: "14px",
                        marginRight: "8px",
                      }}
                    />
                    {tab.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>

          {/* Profile Tab */}
          <TabsContent value="profile" style={{ marginTop: "32px" }}>
            <ProfileContent role={userRole} />
          </TabsContent>

          {/* Team Tab - WIRED */}
          <TabsContent value="team" style={{ marginTop: "32px" }}>
            <TeamContent
              members={teamMembers}
              isLoading={isLoadingTeam}
              onRemoveUser={handleRemoveUser}
              onInvite={onInviteUser}
              onGrantAccess={onGrantAccess} // <--- Pass it down
            />
          </TabsContent>

          {/* Properties Tab - WIRED */}
          <TabsContent value="properties" style={{ marginTop: "32px" }}>
            <PropertiesContent hotelId={hotelId} />
          </TabsContent>

          {/* Budget Configuration Tab - WIRED */}
          <TabsContent value="budget" style={{ marginTop: "32px" }}>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "24px" }}
            >
              {/* Info Banner */}
              <div
                style={{
                  backgroundColor: "rgba(57, 189, 248, 0.05)",
                  border: "1px solid rgba(57, 189, 248, 0.2)",
                  borderRadius: "8px",
                  padding: "20px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "12px",
                  }}
                >
                  <DollarSign
                    style={{
                      width: "20px",
                      height: "20px",
                      color: "#39BDF8",
                      flexShrink: 0,
                      marginTop: "2px",
                    }}
                  />
                  <div>
                    <div
                      style={{
                        color: "#e5e5e5",
                        fontSize: "14px",
                        marginBottom: "4px",
                      }}
                    >
                      Budget Configuration
                    </div>
                    <div style={{ color: "#9ca3af", fontSize: "14px" }}>
                      Configure annual revenue targets and performance
                      benchmarks. These targets will be used for variance
                      analysis in the Budgeting & Planning module.
                    </div>
                  </div>
                </div>
              </div>

              {/* Budget Configuration Component */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "32px",
                }}
              >
                <BudgetContent hotelId={hotelId} />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
// Profile Tab Component (Horizontal Layout)
function ProfileContent({ role }: { role?: string }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [hasChanges, setHasChanges] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Load Profile Logic
  useEffect(() => {
    setIsLoading(true);
    settingsApi
      .getProfile()
      .then((data) => {
        setFirstName(data.first_name || "");
        setLastName(data.last_name || "");
        setEmail(data.email || "");
      })
      .catch((err) => {
        console.error("Failed to load profile", err);
        toast.error("Could not load profile data");
      })
      .finally(() => setIsLoading(false));
  }, []);

  const handleSave = async () => {
    try {
      await settingsApi.updateProfile(firstName, lastName);
      toast.success("Profile updated successfully");
      setHasChanges(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to update profile");
    }
  };

  const handleChange = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setHasChanges(true);
  };

  if (isLoading) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>
        Loading profile...
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div
        style={{
          backgroundColor: "#1a1a1a",
          border: "1px solid #2a2a2a",
          borderRadius: "8px",
          boxShadow: "0 0 30px rgba(57, 189, 248, 0.08)",
        }}
      >
        {/* Header with Save Button */}
        <div
          style={{
            borderBottom: "1px solid rgba(42, 42, 42, 0.5)",
            paddingBottom: "24px",
            padding: "24px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  padding: "8px",
                  backgroundColor: "rgba(57, 189, 248, 0.1)",
                  borderRadius: "8px",
                }}
              >
                <div
                  style={{
                    width: "24px",
                    height: "24px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <User
                    style={{ width: "16px", height: "16px", color: "#39BDF8" }}
                  />
                </div>
              </div>
              <div>
                <h3
                  style={{
                    color: "#e5e5e5",
                    textTransform: "uppercase",
                    letterSpacing: "-0.025em",
                  }}
                >
                  User Profile
                </h3>
                <p
                  style={{
                    color: "#9ca3af",
                    marginTop: "4px",
                    fontSize: "14px",
                  }}
                >
                  Personal information and account details
                </p>
              </div>
            </div>

            {hasChanges && (
              <div
                style={{ display: "flex", alignItems: "center", gap: "12px" }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "6px 12px",
                    backgroundColor: "rgba(245, 158, 11, 0.1)",
                    border: "1px solid rgba(245, 158, 11, 0.3)",
                    borderRadius: "8px",
                  }}
                >
                  <div
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      backgroundColor: "#f59e0b",
                      animation:
                        "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                    }}
                  />
                  <span
                    style={{
                      color: "#f59e0b",
                      fontSize: "12px",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Unsaved
                  </span>
                </div>
                <Button
                  onClick={handleSave}
                  style={{
                    backgroundColor: "#39BDF8",
                    color: "#0f0f0f",
                    height: "36px",
                    padding: "0 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    transition: "background-color 0.2s",
                    fontSize: "13px",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#29ADEE";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "#39BDF8";
                  }}
                >
                  <Save style={{ width: "16px", height: "16px" }} />
                  Save Changes
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Horizontal Grid Layout */}
        <div style={{ padding: "24px" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1.5fr 120px",
              gap: "24px",
              alignItems: "start",
            }}
          >
            {/* First Name */}
            <div
              style={{ display: "flex", flexDirection: "column", gap: "8px" }}
            >
              <Label
                style={{
                  color: "#9ca3af",
                  fontSize: "10px",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                First Name
              </Label>
              <Input
                value={firstName}
                onChange={(e) => handleChange(setFirstName)(e.target.value)}
                style={{
                  backgroundColor: "#141414",
                  border: "1px solid #2a2a2a",
                  color: "#e5e5e5",
                }}
              />
            </div>

            {/* Last Name */}
            <div
              style={{ display: "flex", flexDirection: "column", gap: "8px" }}
            >
              <Label
                style={{
                  color: "#9ca3af",
                  fontSize: "10px",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Last Name
              </Label>
              <Input
                value={lastName}
                onChange={(e) => handleChange(setLastName)(e.target.value)}
                style={{
                  backgroundColor: "#141414",
                  border: "1px solid #2a2a2a",
                  color: "#e5e5e5",
                }}
              />
            </div>

            {/* Email */}
            <div
              style={{ display: "flex", flexDirection: "column", gap: "8px" }}
            >
              <Label
                style={{
                  color: "#9ca3af",
                  fontSize: "10px",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Email
              </Label>
              <Input
                value={email}
                disabled
                style={{
                  backgroundColor: "#141414",
                  border: "1px solid #2a2a2a",
                  color: "#9ca3af",
                  cursor: "not-allowed",
                  opacity: 0.7,
                }}
              />
            </div>

            {/* Role */}
            <div
              style={{ display: "flex", flexDirection: "column", gap: "8px" }}
            >
              <Label
                style={{
                  color: "#9ca3af",
                  fontSize: "10px",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Role
              </Label>
              <div
                style={{
                  height: "40px",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "4px 10px",
                    borderRadius: "6px",
                    fontSize: "11px",
                    border: "1px solid rgba(57, 189, 248, 0.3)",
                    backgroundColor: "rgba(57, 189, 248, 0.1)",
                    color: "#39BDF8",
                    textTransform: "capitalize",
                  }}
                >
                  {role || "User"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Team Tab Component (Wired to useSettings hook + Styled)
interface TeamContentProps {
  members: TeamMember[];
  isLoading: boolean;
  onInvite: () => void;
  onGrantAccess: () => void; // <--- Added to interface
  onRemoveUser: (id: string) => void;
}

function TeamContent({
  members = [],
  isLoading,
  onInvite,
  onGrantAccess, // <--- Destructured
  onRemoveUser,
}: TeamContentProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div
        style={{
          backgroundColor: "#1a1a1a",
          border: "1px solid #2a2a2a",
          borderRadius: "8px",
          boxShadow: "0 0 30px rgba(57, 189, 248, 0.08)",
        }}
      >
        <div
          style={{
            borderBottom: "1px solid rgba(42, 42, 42, 0.5)",
            paddingBottom: "24px",
            padding: "24px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  padding: "8px",
                  backgroundColor: "rgba(57, 189, 248, 0.1)",
                  borderRadius: "8px",
                }}
              >
                <div
                  style={{
                    width: "24px",
                    height: "24px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <span style={{ color: "#39BDF8" }}>{members.length}</span>
                </div>
              </div>
              <div>
                <h3
                  style={{
                    color: "#e5e5e5",
                    textTransform: "uppercase",
                    letterSpacing: "-0.025em",
                  }}
                >
                  Team Members
                </h3>
                <p
                  style={{
                    color: "#9ca3af",
                    marginTop: "4px",
                    fontSize: "14px",
                  }}
                >
                  Manage user roles, permissions, and team access
                </p>
              </div>
            </div>
            <div style={{ display: "flex", gap: "12px" }}>
              {/* Grant Access Button */}
              <Button
                onClick={onGrantAccess}
                style={{
                  backgroundColor: "#141414",
                  border: "1px solid #2a2a2a",
                  color: "#e5e5e5",
                  height: "36px",
                  padding: "0 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  fontSize: "13px",
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
                <Shield className="w-4 h-4 mr-2" />
                Grant Access
              </Button>

              {/* Invite User Button */}
              <Button
                onClick={onInvite}
                style={{
                  backgroundColor: "#39BDF8",
                  color: "#0f0f0f",
                  height: "36px",
                  padding: "0 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  transition: "background-color 0.2s",
                  fontSize: "13px",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#29ADEE";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#39BDF8";
                }}
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Invite User
              </Button>
            </div>
          </div>
        </div>

        <div style={{ padding: "24px" }}>
          <div
            style={{
              backgroundColor: "#1a1a1a",
              borderRadius: "8px",
              overflow: "hidden",
              border: "1px solid #2a2a2a",
              position: "relative",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1.5fr 120px 100px 120px",
                gap: "8px",
                padding: "12px 16px",
                borderBottom: "1px solid #2a2a2a",
                backgroundColor: "#1D1D1C",
                position: "relative",
                zIndex: 10,
              }}
            >
              <div
                style={{
                  color: "#6b7280",
                  fontSize: "10px",
                  textTransform: "uppercase",
                  letterSpacing: "-0.025em",
                  paddingRight: "12px",
                }}
              >
                Name
              </div>
              <div
                style={{
                  color: "#6b7280",
                  fontSize: "10px",
                  textTransform: "uppercase",
                  letterSpacing: "-0.025em",
                  paddingRight: "12px",
                }}
              >
                Email
              </div>
              <div
                style={{
                  color: "#6b7280",
                  fontSize: "10px",
                  textTransform: "uppercase",
                  letterSpacing: "-0.025em",
                  paddingRight: "12px",
                }}
              >
                Role
              </div>
              <div
                style={{
                  color: "#6b7280",
                  fontSize: "10px",
                  textTransform: "uppercase",
                  letterSpacing: "-0.025em",
                  textAlign: "center",
                  paddingRight: "12px",
                }}
              >
                Status
              </div>
              <div
                style={{
                  color: "#6b7280",
                  fontSize: "10px",
                  textTransform: "uppercase",
                  letterSpacing: "-0.025em",
                  textAlign: "center",
                  paddingRight: "12px",
                }}
              >
                Actions
              </div>
            </div>

            <div style={{ position: "relative", zIndex: 10 }}>
              {isLoading ? (
                <div
                  style={{
                    padding: "20px",
                    textAlign: "center",
                    color: "#6b7280",
                    fontSize: "12px",
                  }}
                >
                  Loading...
                </div>
              ) : members.length === 0 ? (
                <div
                  style={{
                    padding: "20px",
                    textAlign: "center",
                    color: "#6b7280",
                    fontSize: "12px",
                  }}
                >
                  No members found.
                </div>
              ) : (
                members.map((user, index) => (
                  <div
                    key={user.user_id || index}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1.5fr 120px 100px 120px",
                      gap: "8px",
                      padding: "14px 16px",
                      backgroundColor: "transparent",
                      borderTop: index > 0 ? "1px solid #2a2a2a" : "none",
                      transition: "background-color 0.3s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#141414";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        paddingRight: "12px",
                      }}
                    >
                      <span style={{ color: "#e5e5e5", fontSize: "12px" }}>
                        {user.first_name} {user.last_name}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        paddingRight: "12px",
                      }}
                    >
                      <span style={{ color: "#9ca3af", fontSize: "12px" }}>
                        {user.email}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        paddingRight: "12px",
                      }}
                    >
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "4px 10px",
                          borderRadius: "6px",
                          fontSize: "11px",
                          border: "1px solid rgba(57, 189, 248, 0.3)",
                          backgroundColor: "rgba(57, 189, 248, 0.1)",
                          color: "#39BDF8",
                        }}
                      >
                        {user.role}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        paddingRight: "12px",
                      }}
                    >
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "4px 10px",
                          borderRadius: "6px",
                          fontSize: "11px",
                          border: "1px solid rgba(16, 185, 129, 0.3)",
                          backgroundColor: "rgba(16, 185, 129, 0.1)",
                          color: "#10b981",
                        }}
                      >
                        Active
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        paddingRight: "12px",
                      }}
                    >
                      <button
                        onClick={() => onRemoveUser(user.user_id)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "4px 10px",
                          backgroundColor: "transparent",
                          border: "none",
                          color: "#ef4444",
                          fontSize: "11px",
                          cursor: "pointer",
                          borderRadius: "4px",
                          transition: "background-color 0.2s",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor =
                            "rgba(239, 68, 68, 0.1)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "transparent";
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Properties Tab Component (Wired to Real Fetch + Styled)
function PropertiesContent({ hotelId }: { hotelId: string }) {
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/hotels/mine")
      .then((res) => res.json())
      .then((data) => {
        setProperties(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div
        style={{
          backgroundColor: "#1a1a1a",
          border: "1px solid #2a2a2a",
          borderRadius: "8px",
          boxShadow: "0 0 30px rgba(57, 189, 248, 0.08)",
        }}
      >
        <div
          style={{
            borderBottom: "1px solid rgba(42, 42, 42, 0.5)",
            paddingBottom: "24px",
            padding: "24px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  padding: "8px",
                  backgroundColor: "rgba(57, 189, 248, 0.1)",
                  borderRadius: "8px",
                }}
              >
                <div
                  style={{
                    width: "24px",
                    height: "24px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <span style={{ color: "#39BDF8" }}>{properties.length}</span>
                </div>
              </div>
              <div>
                <h3
                  style={{
                    color: "#e5e5e5",
                    textTransform: "uppercase",
                    letterSpacing: "-0.025em",
                  }}
                >
                  Property Connections
                </h3>
                <p
                  style={{
                    color: "#9ca3af",
                    marginTop: "4px",
                    fontSize: "14px",
                  }}
                >
                  Manage connected properties and data synchronization
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px" }}>
              <Button
                style={{
                  backgroundColor: "#39BDF8",
                  color: "#0f0f0f",
                  height: "36px",
                  padding: "0 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  transition: "background-color 0.2s",
                  fontSize: "13px",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#29ADEE";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#39BDF8";
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Property
              </Button>
            </div>
          </div>
        </div>

        <div style={{ padding: "24px" }}>
          <div
            style={{
              backgroundColor: "#1a1a1a",
              borderRadius: "8px",
              overflow: "hidden",
              border: "1px solid #2a2a2a",
              position: "relative",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.5fr 120px 150px 120px 120px",
                gap: "8px",
                padding: "12px 16px",
                borderBottom: "1px solid #2a2a2a",
                backgroundColor: "#1D1D1C",
                position: "relative",
                zIndex: 10,
              }}
            >
              <div
                style={{
                  color: "#6b7280",
                  fontSize: "10px",
                  textTransform: "uppercase",
                  letterSpacing: "-0.025em",
                  paddingRight: "12px",
                }}
              >
                Property
              </div>
              <div
                style={{
                  color: "#6b7280",
                  fontSize: "10px",
                  textTransform: "uppercase",
                  letterSpacing: "-0.025em",
                  paddingRight: "12px",
                }}
              >
                Property ID
              </div>
              <div
                style={{
                  color: "#6b7280",
                  fontSize: "10px",
                  textTransform: "uppercase",
                  letterSpacing: "-0.025em",
                  paddingRight: "12px",
                }}
              >
                Last Sync
              </div>
              <div
                style={{
                  color: "#6b7280",
                  fontSize: "10px",
                  textTransform: "uppercase",
                  letterSpacing: "-0.025em",
                  textAlign: "center",
                  paddingRight: "12px",
                }}
              >
                Status
              </div>
              <div
                style={{
                  color: "#6b7280",
                  fontSize: "10px",
                  textTransform: "uppercase",
                  letterSpacing: "-0.025em",
                  textAlign: "center",
                  paddingRight: "12px",
                }}
              >
                Actions
              </div>
            </div>

            <div style={{ position: "relative", zIndex: 10 }}>
              {loading ? (
                <div
                  style={{
                    padding: "20px",
                    textAlign: "center",
                    color: "#6b7280",
                    fontSize: "12px",
                  }}
                >
                  Loading...
                </div>
              ) : (
                properties.map((property, index) => (
                  <div
                    key={property.property_id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.5fr 120px 150px 120px 120px",
                      gap: "8px",
                      padding: "14px 16px",
                      backgroundColor: "transparent",
                      borderTop: index > 0 ? "1px solid #2a2a2a" : "none",
                      transition: "background-color 0.3s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#141414";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        paddingRight: "12px",
                      }}
                    >
                      <span style={{ color: "#e5e5e5", fontSize: "12px" }}>
                        {property.property_name}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        paddingRight: "12px",
                      }}
                    >
                      <span
                        style={{
                          color: "#9ca3af",
                          fontSize: "12px",
                          fontFamily: "monospace",
                        }}
                      >
                        {property.property_id}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        paddingRight: "12px",
                      }}
                    >
                      <span style={{ color: "#9ca3af", fontSize: "12px" }}>
                        Just now
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        paddingRight: "12px",
                      }}
                    >
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "4px 10px",
                          borderRadius: "6px",
                          fontSize: "11px",
                          border: "1px solid rgba(16, 185, 129, 0.3)",
                          backgroundColor: "rgba(16, 185, 129, 0.1)",
                          color: "#10b981",
                        }}
                      >
                        Active
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        paddingRight: "12px",
                      }}
                    >
                      <button
                        onClick={() =>
                          toast.info("Disconnect feature disabled")
                        }
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "4px 10px",
                          backgroundColor: "transparent",
                          border: "none",
                          color: "#ef4444",
                          fontSize: "11px",
                          cursor: "pointer",
                          borderRadius: "4px",
                          transition: "background-color 0.2s",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor =
                            "rgba(239, 68, 68, 0.1)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "transparent";
                        }}
                      >
                        Disconnect
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
// --- HELPER: Global Formatter ---
const formatNumber = (numStr: string) => {
  if (!numStr) return "";
  const clean = numStr.toString().replace(/[^0-9.]/g, "");
  if (clean === "") return "";
  const parts = clean.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
};

// --- HELPER: Smart Input Component (Format on Blur) ---
// This prevents cursor jumping by showing raw numbers while focused
const FormattedInput = ({ value, onChange, className, placeholder }: any) => {
  const [isFocused, setIsFocused] = useState(false);

  // Show raw value when focused, formatted value when blurred
  const displayValue = isFocused ? value : formatNumber(value);

  return (
    <Input
      type="text"
      inputMode="decimal"
      value={displayValue}
      onChange={onChange}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      className={className}
      placeholder={placeholder}
    />
  );
};

// Budget Tab Component (Wired to Real API + Styled)
function BudgetContent({ hotelId }: { hotelId: string }) {
  const [selectedYear, setSelectedYear] = useState<string>("2025");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  // Initialize with empty months so grid always renders immediately
  const [budgetTargets, setBudgetTargets] = useState<any[]>(
    months.map((m) => ({ month: m, occupancy: "", adr: "", revenue: "" }))
  );

  // FETCH: Budget Logic
  useEffect(() => {
    if (!hotelId) return;
    console.log(`Fetching budget for hotel: ${hotelId}, year: ${selectedYear}`);

    // Background fetch to populate data without blocking UI
    fetch(`/api/hotels/${hotelId}/budgets/${selectedYear}`, {
      credentials: "include", // <--- CRITICAL: Sends session cookie
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch budget");
        return res.json();
      })
      .then((data) => {
        console.log("Budget Data Received:", data);
        if (Array.isArray(data) && data.length > 0) {
          const merged = months.map((m) => {
            const found = data.find((d: any) => d.month === m);
            return {
              month: m,
              occupancy: found?.targetOccupancy ?? "",
              adr: found?.targetADR ?? "",
              revenue: found?.targetRevenue ?? "",
            };
          });
          setBudgetTargets(merged);
        } else {
          setBudgetTargets(
            months.map((m) => ({
              month: m,
              occupancy: "",
              adr: "",
              revenue: "",
            }))
          );
        }
      })
      .catch((err) => console.error(err));
  }, [hotelId, selectedYear]);

  // Helper: Parse raw input back to stored state
  const handleInputChange = (
    index: number,
    field: string,
    rawValue: string
  ) => {
    // Allow digits and one dot
    const value = rawValue.replace(/[^0-9.]/g, "");

    const updated = [...budgetTargets];
    updated[index][field] = value;
    setBudgetTargets(updated);
  };

  const handleSaveBudget = async () => {
    setSaving(true);
    try {
      const payload = budgetTargets.map((t) => ({
        month: t.month,
        targetOccupancy: t.occupancy || null,
        targetADR: t.adr || null,
        targetRevenue: t.revenue || null,
      }));

      const res = await fetch(
        `/api/hotels/${hotelId}/budgets/${selectedYear}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include", // <--- CRITICAL: Sends session cookie
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) throw new Error("Failed");
      toast.success(`Budget for ${selectedYear} saved.`);
    } catch (e) {
      toast.error("Error saving budget");
    } finally {
      setSaving(false);
    }
  };

  const handleCopyFromPrevious = () => {
    toast.info("Copy from previous year feature coming soon");
  };

  const totals = useMemo(() => {
    const totalRev = budgetTargets.reduce(
      (sum, t) => sum + (parseFloat(t.revenue) || 0),
      0
    );
    const validOcc = budgetTargets.filter(
      (t) => t.occupancy && t.occupancy !== ""
    );
    const avgOcc = validOcc.length
      ? validOcc.reduce((sum, t) => sum + parseFloat(t.occupancy), 0) /
        validOcc.length
      : 0;
    const validAdr = budgetTargets.filter((t) => t.adr && t.adr !== "");
    const avgAdr = validAdr.length
      ? validAdr.reduce((sum, t) => sum + parseFloat(t.adr), 0) /
        validAdr.length
      : 0;
    return { totalRevenue: totalRev, avgOccupancy: avgOcc, avgADR: avgAdr };
  }, [budgetTargets]);

  return (
    <>
      {/* Step 1: Select Year */}
      <div
        style={{
          backgroundColor: "#1a1a1a",
          border: "1px solid #2a2a2a",
          borderRadius: "8px",
        }}
      >
        <div style={{ padding: "24px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "24px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  padding: "8px",
                  backgroundColor: "rgba(57, 189, 248, 0.1)",
                  borderRadius: "8px",
                }}
              >
                <div
                  style={{
                    width: "24px",
                    height: "24px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <span style={{ color: "#39BDF8" }}>1</span>
                </div>
              </div>
              <h3
                style={{
                  color: "#e5e5e5",
                  textTransform: "uppercase",
                  letterSpacing: "-0.025em",
                }}
              >
                Select Budget Year
              </h3>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <Label
                style={{
                  color: "#9ca3af",
                  fontSize: "12px",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Budget Year
              </Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger
                  style={{
                    width: "160px",
                    backgroundColor: "#0a0a0a",
                    border: "1px solid #2a2a2a",
                    color: "#e5e5e5",
                  }}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent
                  style={{
                    backgroundColor: "#1a1a1a",
                    border: "1px solid #2a2a2a",
                    color: "#e5e5e5",
                  }}
                >
                  {["2023", "2024", "2025", "2026"].map((y) => (
                    <SelectItem key={y} value={y}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Step 2: Quick Actions (Restored) */}
      <div
        style={{
          backgroundColor: "#1a1a1a",
          border: "1px solid #2a2a2a",
          borderRadius: "8px",
        }}
      >
        <div style={{ padding: "24px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "24px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  padding: "8px",
                  backgroundColor: "rgba(57, 189, 248, 0.1)",
                  borderRadius: "8px",
                }}
              >
                <div
                  style={{
                    width: "24px",
                    height: "24px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <span style={{ color: "#39BDF8" }}>2</span>
                </div>
              </div>
              <div>
                <h3
                  style={{
                    color: "#e5e5e5",
                    textTransform: "uppercase",
                    letterSpacing: "-0.025em",
                  }}
                >
                  Import or Start Fresh
                </h3>
                <p
                  style={{
                    color: "#9ca3af",
                    fontSize: "14px",
                    marginTop: "4px",
                  }}
                >
                  Optional: Copy data from previous year or import from file
                </p>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <Button
                onClick={handleCopyFromPrevious}
                style={{
                  backgroundColor: "#0a0a0a",
                  border: "1px solid #2a2a2a",
                  color: "#e5e5e5",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 16px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  transition: "all 0.3s",
                }}
              >
                <Copy style={{ width: "16px", height: "16px" }} />
                Copy from previous year
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Step 3: Configure Monthly Targets */}
      <div
        style={{
          backgroundColor: "#1a1a1a",
          border: "1px solid #2a2a2a",
          borderRadius: "8px",
          boxShadow: "0 0 30px rgba(57, 189, 248, 0.08)",
        }}
      >
        <div
          style={{
            borderBottom: "1px solid rgba(42, 42, 42, 0.5)",
            paddingBottom: "24px",
            padding: "24px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  padding: "8px",
                  backgroundColor: "rgba(57, 189, 248, 0.1)",
                  borderRadius: "8px",
                }}
              >
                <div
                  style={{
                    width: "24px",
                    height: "24px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <span style={{ color: "#39BDF8" }}>3</span>
                </div>
              </div>
              <div>
                <h3
                  style={{
                    color: "#e5e5e5",
                    textTransform: "uppercase",
                    letterSpacing: "-0.025em",
                  }}
                >
                  Configure Monthly Targets
                </h3>
                <p
                  style={{
                    color: "#9ca3af",
                    marginTop: "4px",
                    fontSize: "14px",
                  }}
                >
                  Set occupancy, ADR, and revenue targets for each month
                </p>
              </div>
            </div>

            <Button
              onClick={handleSaveBudget}
              disabled={saving}
              style={{
                backgroundColor: "#39BDF8",
                color: "#0f0f0f",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 16px",
                borderRadius: "6px",
                border: "none",
                cursor: "pointer",
                transition: "background-color 0.3s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#29ADEE";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#39BDF8";
              }}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Configuration
            </Button>
          </div>
        </div>

        <div style={{ padding: "24px" }}>
          <div
            style={{
              backgroundColor: "#1a1a1a",
              borderRadius: "8px",
              overflow: "hidden",
              border: "1px solid #2a2a2a",
              position: "relative",
            }}
          >
            {/* Table Header */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "100px 1fr 1fr 1fr",
                gap: "8px",
                padding: "12px 16px",
                borderBottom: "1px solid #2a2a2a",
                backgroundColor: "#1D1D1C",
                position: "relative",
                zIndex: 10,
              }}
            >
              <div
                style={{
                  color: "#6b7280",
                  fontSize: "10px",
                  textTransform: "uppercase",
                  letterSpacing: "-0.025em",
                  paddingRight: "12px",
                }}
              >
                Month
              </div>
              <div
                style={{
                  color: "#6b7280",
                  fontSize: "10px",
                  textTransform: "uppercase",
                  letterSpacing: "-0.025em",
                  textAlign: "center",
                  paddingRight: "12px",
                }}
              >
                Occ (%)
              </div>
              <div
                style={{
                  color: "#6b7280",
                  fontSize: "10px",
                  textTransform: "uppercase",
                  letterSpacing: "-0.025em",
                  textAlign: "center",
                  paddingRight: "12px",
                }}
              >
                ADR
              </div>
              <div
                style={{
                  color: "#6b7280",
                  fontSize: "10px",
                  textTransform: "uppercase",
                  letterSpacing: "-0.025em",
                  textAlign: "center",
                  paddingRight: "12px",
                }}
              >
                Revenue
              </div>
            </div>

            {/* Table Body */}
            <div style={{ position: "relative", zIndex: 10 }}>
              {budgetTargets.map((target, index) => (
                <div
                  key={target.month}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "100px 1fr 1fr 1fr",
                    gap: "8px",
                    padding: "14px 16px",
                    backgroundColor: "transparent",
                    borderTop: index > 0 ? "1px solid #2a2a2a" : "none",
                    transition: "background-color 0.3s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#141414";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      paddingRight: "12px",
                    }}
                  >
                    <span style={{ color: "#e5e5e5", fontSize: "12px" }}>
                      {target.month}
                    </span>
                  </div>

                  {/* Occupancy Input */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      paddingRight: "12px",
                    }}
                  >
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={target.occupancy}
                      onChange={(e) =>
                        handleInputChange(index, "occupancy", e.target.value)
                      }
                      className="w-[80px] text-xs h-8 text-[#e5e5e5] text-center rounded-md px-2 bg-transparent border border-transparent hover:border-[#2a2a2a] hover:bg-[#141414] focus:bg-[#141414] focus:border-[#2a2a2a] transition-colors placeholder:text-gray-700"
                      placeholder="0.0"
                    />
                  </div>
                  {/* ADR Input (Formatted + Currency) */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      paddingRight: "12px",
                    }}
                  >
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[#6b7280] text-[10px] pointer-events-none">
                        £
                      </span>
                      <FormattedInput
                        value={target.adr} // Pass RAW value
                        onChange={(e: any) =>
                          handleInputChange(index, "adr", e.target.value)
                        }
                        className="w-[96px] text-xs h-8 text-[#e5e5e5] text-right rounded-md pl-6 pr-2 bg-transparent border border-transparent hover:border-[#2a2a2a] hover:bg-[#141414] focus:bg-[#141414] focus:border-[#2a2a2a] transition-colors placeholder:text-gray-700"
                        placeholder="0"
                      />
                    </div>
                  </div>
                  {/* Revenue Input (Formatted + Currency) */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      paddingRight: "12px",
                    }}
                  >
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[#6b7280] text-[10px] pointer-events-none">
                        £
                      </span>
                      <FormattedInput
                        value={target.revenue} // Pass RAW value
                        onChange={(e: any) =>
                          handleInputChange(index, "revenue", e.target.value)
                        }
                        className="w-[128px] text-xs h-8 text-[#e5e5e5] text-right rounded-md pl-6 pr-2 bg-transparent border border-transparent hover:border-[#2a2a2a] hover:bg-[#141414] focus:bg-[#141414] focus:border-[#2a2a2a] transition-colors placeholder:text-gray-700"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>
              ))}

              {/* Totals Row */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "100px 1fr 1fr 1fr",
                  gap: "8px",
                  padding: "14px 16px",
                  backgroundColor: "#1D1D1C",
                  borderTop: "2px solid rgba(57, 189, 248, 0.3)",
                  position: "relative",
                  zIndex: 10,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    paddingRight: "12px",
                  }}
                >
                  <span style={{ color: "#39BDF8", fontSize: "12px" }}>
                    YTD Total
                  </span>
                </div>
                <div
                  style={{
                    textAlign: "center",
                    color: "#e5e5e5",
                    fontSize: "12px",
                    paddingRight: "12px",
                  }}
                >
                  {totals.avgOccupancy.toFixed(1)}%
                </div>
                <div
                  style={{
                    textAlign: "center",
                    color: "#e5e5e5",
                    fontSize: "12px",
                    paddingRight: "12px",
                  }}
                >
                  £{totals.avgADR.toFixed(0)}
                </div>
                <div
                  style={{
                    textAlign: "center",
                    color: "#e5e5e5",
                    fontSize: "12px",
                    paddingRight: "12px",
                  }}
                >
                  £{totals.totalRevenue.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* Annual Summary */}
          <div
            style={{
              marginTop: "24px",
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "16px",
            }}
          >
            <div
              style={{
                backgroundColor: "#141414",
                border: "1px solid #2a2a2a",
                borderRadius: "8px",
                padding: "20px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "8px",
                }}
              >
                <span
                  style={{
                    color: "#9ca3af",
                    fontSize: "12px",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Total Revenue Target
                </span>
                <TrendingUp
                  style={{ width: "16px", height: "16px", color: "#faff6a" }}
                />
              </div>
              <div style={{ color: "#e5e5e5", fontSize: "24px" }}>
                £{totals.totalRevenue.toLocaleString()}
              </div>
              <div
                style={{ color: "#6b7280", fontSize: "12px", marginTop: "4px" }}
              >
                Annual total for {selectedYear}
              </div>
            </div>

            <div
              style={{
                backgroundColor: "#141414",
                border: "1px solid #2a2a2a",
                borderRadius: "8px",
                padding: "20px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "8px",
                }}
              >
                <span
                  style={{
                    color: "#9ca3af",
                    fontSize: "12px",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Avg. Occupancy
                </span>
                <Calendar
                  style={{ width: "16px", height: "16px", color: "#39BDF8" }}
                />
              </div>
              <div style={{ color: "#e5e5e5", fontSize: "24px" }}>
                {totals.avgOccupancy.toFixed(1)}%
              </div>
              <div
                style={{ color: "#6b7280", fontSize: "12px", marginTop: "4px" }}
              >
                Annual average
              </div>
            </div>

            <div
              style={{
                backgroundColor: "#141414",
                border: "1px solid #2a2a2a",
                borderRadius: "8px",
                padding: "20px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "8px",
                }}
              >
                <span
                  style={{
                    color: "#9ca3af",
                    fontSize: "12px",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Avg. ADR
                </span>
                <TrendingUp
                  style={{ width: "16px", height: "16px", color: "#10b981" }}
                />
              </div>
              <div style={{ color: "#e5e5e5", fontSize: "24px" }}>
                £{totals.avgADR.toFixed(0)}
              </div>
              <div
                style={{ color: "#6b7280", fontSize: "12px", marginTop: "4px" }}
              >
                Annual average
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
