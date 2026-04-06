import { useState, useEffect, useCallback, CSSProperties } from "react";
import {
  User,
  Users,
  Building2,
  UserPlus,
  Save,
  Shield,
  Unplug,
  PlugZap,
} from "lucide-react";
import { toast } from "sonner";
import { useSettings } from "../features/settings/hooks/useSettings";
import { settingsApi } from "../features/settings/api/settings.api";
import { TeamMember } from "../features/settings/api/types";

interface SettingsPageProps {
  hotelId: string;
  userRole?: string;
  onInviteUser: () => void;
  onGrantAccess: () => void;
}

// Shared styles
const card: CSSProperties = {
  backgroundColor: "rgb(26, 26, 26)",
  borderRadius: "8px",
  border: "1px solid #2a2a2a",
  padding: "20px",
};
const sectionTitle: CSSProperties = { color: "#e5e5e5", fontSize: "14px", fontWeight: 600, marginBottom: "4px" };
const sectionSub: CSSProperties = { color: "#6b7280", fontSize: "11px" };
const labelStyle: CSSProperties = { color: "#6b7280", fontSize: "10px", textTransform: "uppercase", letterSpacing: "-0.025em", marginBottom: "6px" };
const inputStyle: CSSProperties = {
  width: "100%",
  height: "36px",
  backgroundColor: "#0d0d0d",
  border: "1px solid #2a2a2a",
  borderRadius: "4px",
  color: "#e5e5e5",
  fontSize: "13px",
  padding: "0 12px",
  outline: "none",
};
const thCell: CSSProperties = { color: "#6b7280", fontSize: "10px", textTransform: "uppercase", letterSpacing: "-0.025em", fontWeight: 600 };
const tdCell: CSSProperties = { color: "#e5e5e5", fontSize: "12px", display: "flex", alignItems: "center" };
const badge = (color: string): CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  padding: "2px 8px",
  borderRadius: "4px",
  fontSize: "10px",
  fontWeight: 600,
  backgroundColor: `${color}15`,
  color,
  border: `1px solid ${color}4D`,
});
const btnPrimary: CSSProperties = {
  height: "34px",
  padding: "0 14px",
  backgroundColor: "#39BDF8",
  color: "#1d1d1c",
  border: "none",
  borderRadius: "4px",
  fontSize: "12px",
  fontWeight: 600,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: "6px",
};
const btnSecondary: CSSProperties = {
  ...btnPrimary,
  backgroundColor: "#0d0d0d",
  color: "#e5e5e5",
  border: "1px solid #2a2a2a",
};

export function SettingsPage({ hotelId, userRole, onInviteUser, onGrantAccess }: SettingsPageProps) {
  const { teamMembers, isLoadingTeam, handleRemoveUser } = useSettings(hotelId);

  // Profile state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [profileDirty, setProfileDirty] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    settingsApi.getProfile()
      .then((data) => { setFirstName(data.first_name || ""); setLastName(data.last_name || ""); setEmail(data.email || ""); })
      .catch(() => toast.error("Could not load profile"))
      .finally(() => setProfileLoading(false));
  }, []);

  const handleSaveProfile = async () => {
    try {
      await settingsApi.updateProfile(firstName, lastName);
      toast.success("Profile updated");
      setProfileDirty(false);
    } catch { toast.error("Failed to update profile"); }
  };

  // Properties state
  const [properties, setProperties] = useState<any[]>([]);
  const [propsLoading, setPropsLoading] = useState(true);
  const [disconnectTarget, setDisconnectTarget] = useState<{ id: string; name: string } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchProperties = useCallback(() => {
    setPropsLoading(true);
    fetch("/api/hotels/mine?includeDisconnected=true", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setProperties(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setPropsLoading(false));
  }, []);

  useEffect(() => { fetchProperties(); }, [fetchProperties]);

  const handleDisconnect = async () => {
    if (!disconnectTarget) return;
    setActionLoading(disconnectTarget.id);
    try {
      await settingsApi.disconnectHotel(disconnectTarget.id);
      toast.success(`${disconnectTarget.name} disconnected`);
      fetchProperties();
    } catch { toast.error("Failed to disconnect"); }
    finally { setActionLoading(null); setDisconnectTarget(null); }
  };

  const handleReconnect = async (id: string, name: string) => {
    setActionLoading(id);
    try {
      await settingsApi.reconnectHotel(id);
      toast.success(`${name} reconnected`);
      fetchProperties();
    } catch { toast.error("Failed to reconnect"); }
    finally { setActionLoading(null); }
  };


  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#1d1d1c", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom right, rgba(57, 189, 248, 0.01), transparent, rgba(57, 189, 248, 0.01))" }} />
      <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(57, 189, 248, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(57, 189, 248, 0.03) 1px, transparent 1px)", backgroundSize: "64px 64px" }} />

      <div style={{ position: "relative", zIndex: 10, padding: "24px", display: "flex", flexDirection: "column", gap: "24px" }}>
        {/* Header */}
        <div>
          <div style={{ color: "#e5e5e5", fontSize: "18px", fontWeight: 600, marginBottom: "4px" }}>Settings</div>
          <div style={{ color: "#9ca3af", fontSize: "12px" }}>Profile, team, properties, and budget configuration</div>
        </div>

        {/* ── Profile ── */}
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <User style={{ width: "16px", height: "16px", color: "#39BDF8" }} />
              <div>
                <div style={sectionTitle}>Profile</div>
                <div style={sectionSub}>Personal information and account details</div>
              </div>
            </div>
            {profileDirty && (
              <button style={btnPrimary} onClick={handleSaveProfile}>
                <Save style={{ width: "14px", height: "14px" }} />
                Save
              </button>
            )}
          </div>
          {profileLoading ? (
            <div style={{ color: "#6b7280", fontSize: "12px", padding: "12px 0" }}>Loading...</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.5fr auto", gap: "16px", alignItems: "end" }}>
              <div>
                <div style={labelStyle}>First Name</div>
                <input style={inputStyle} value={firstName} onChange={(e) => { setFirstName(e.target.value); setProfileDirty(true); }} />
              </div>
              <div>
                <div style={labelStyle}>Last Name</div>
                <input style={inputStyle} value={lastName} onChange={(e) => { setLastName(e.target.value); setProfileDirty(true); }} />
              </div>
              <div>
                <div style={labelStyle}>Email</div>
                <input style={{ ...inputStyle, color: "#6b7280", cursor: "not-allowed" }} value={email} disabled />
              </div>
              <div>
                <div style={labelStyle}>Role</div>
                <span style={badge("#39BDF8")}>{userRole || "User"}</span>
              </div>
            </div>
          )}
        </div>

        {/* ── Team ── */}
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Users style={{ width: "16px", height: "16px", color: "#39BDF8" }} />
              <div>
                <div style={sectionTitle}>Team ({teamMembers.length})</div>
                <div style={sectionSub}>Manage user roles and access</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button style={btnSecondary} onClick={onGrantAccess}>
                <Shield style={{ width: "14px", height: "14px" }} /> Grant Access
              </button>
              <button style={btnPrimary} onClick={onInviteUser}>
                <UserPlus style={{ width: "14px", height: "14px" }} /> Invite
              </button>
            </div>
          </div>

          {/* Team table */}
          <div style={{ borderRadius: "4px", border: "1px solid #2a2a2a", overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr 100px 80px 80px", gap: "8px", padding: "10px 16px", backgroundColor: "#1d1d1c", borderBottom: "1px solid #2a2a2a" }}>
              {["Name", "Email", "Role", "Status", ""].map((h) => <div key={h} style={thCell}>{h}</div>)}
            </div>
            {isLoadingTeam ? (
              <div style={{ padding: "16px", color: "#6b7280", fontSize: "12px", textAlign: "center" }}>Loading...</div>
            ) : teamMembers.length === 0 ? (
              <div style={{ padding: "16px", color: "#6b7280", fontSize: "12px", textAlign: "center" }}>No members</div>
            ) : teamMembers.map((user, i) => (
              <div
                key={user.user_id || i}
                style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr 100px 80px 80px", gap: "8px", padding: "10px 16px", borderTop: i > 0 ? "1px solid #2a2a2a" : "none", transition: "background-color 0.15s" }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(57,189,248,0.04)"}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
              >
                <div style={tdCell}>{user.first_name} {user.last_name}</div>
                <div style={{ ...tdCell, color: "#9ca3af" }}>{user.email}</div>
                <div style={tdCell}><span style={badge("#39BDF8")}>{user.role}</span></div>
                <div style={tdCell}><span style={badge("#10b981")}>Active</span></div>
                <div style={tdCell}>
                  <button
                    onClick={() => handleRemoveUser(user.user_id)}
                    style={{ background: "none", border: "none", color: "#ef4444", fontSize: "11px", cursor: "pointer", padding: "2px 6px", borderRadius: "4px" }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(239,68,68,0.1)"}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Properties ── */}
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Building2 style={{ width: "16px", height: "16px", color: "#39BDF8" }} />
              <div>
                <div style={sectionTitle}>Properties ({properties.length})</div>
                <div style={sectionSub}>Connected properties and sync status</div>
              </div>
            </div>
          </div>

          <div style={{ borderRadius: "4px", border: "1px solid #2a2a2a", overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 120px 150px 90px 100px", gap: "8px", padding: "10px 16px", backgroundColor: "#1d1d1c", borderBottom: "1px solid #2a2a2a" }}>
              {["Property", "ID", "Last Sync", "Status", ""].map((h) => <div key={h} style={thCell}>{h}</div>)}
            </div>
            {propsLoading ? (
              <div style={{ padding: "16px", color: "#6b7280", fontSize: "12px", textAlign: "center" }}>Loading...</div>
            ) : properties.map((p, i) => (
              <div
                key={p.property_id}
                style={{ display: "grid", gridTemplateColumns: "1.5fr 120px 150px 90px 100px", gap: "8px", padding: "10px 16px", borderTop: i > 0 ? "1px solid #2a2a2a" : "none", transition: "background-color 0.15s" }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(57,189,248,0.04)"}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
              >
                <div style={{ ...tdCell, opacity: p.is_disconnected ? 0.5 : 1 }}>{p.property_name}</div>
                <div style={{ ...tdCell, color: "#9ca3af", fontFamily: "monospace", fontSize: "11px" }}>{p.property_id}</div>
                <div style={{ ...tdCell, color: "#9ca3af" }}>Just now</div>
                <div style={tdCell}>
                  <span style={badge(p.is_disconnected ? "#f59e0b" : "#10b981")}>
                    {p.is_disconnected ? "Disconnected" : "Active"}
                  </span>
                </div>
                <div style={tdCell}>
                  {p.is_disconnected ? (
                    <button
                      onClick={() => handleReconnect(p.property_id, p.property_name)}
                      disabled={actionLoading === p.property_id}
                      style={{ background: "none", border: "none", color: "#10b981", fontSize: "11px", cursor: "pointer", padding: "2px 6px", borderRadius: "4px", display: "flex", alignItems: "center", gap: "4px" }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(16,185,129,0.1)"}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                    >
                      <PlugZap style={{ width: "12px", height: "12px" }} />
                      {actionLoading === p.property_id ? "..." : "Reconnect"}
                    </button>
                  ) : (
                    <button
                      onClick={() => setDisconnectTarget({ id: p.property_id, name: p.property_name })}
                      disabled={actionLoading === p.property_id}
                      style={{ background: "none", border: "none", color: "#ef4444", fontSize: "11px", cursor: "pointer", padding: "2px 6px", borderRadius: "4px", display: "flex", alignItems: "center", gap: "4px" }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(239,68,68,0.1)"}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                    >
                      <Unplug style={{ width: "12px", height: "12px" }} />
                      Disconnect
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>


        {/* Disconnect Confirmation Modal */}
        {disconnectTarget && (
          <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.6)" }} onClick={() => setDisconnectTarget(null)} />
            <div style={{ ...card, position: "relative", width: "400px", maxWidth: "90vw", zIndex: 51 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <Unplug style={{ width: "16px", height: "16px", color: "#ef4444" }} />
                <div style={{ ...sectionTitle, color: "#ef4444" }}>Disconnect {disconnectTarget.name}?</div>
              </div>
              <p style={{ color: "#9ca3af", fontSize: "12px", lineHeight: "1.5", marginBottom: "20px" }}>
                This hotel will be hidden from dashboards, reports, and pricing. All data is preserved and you can reconnect at any time.
              </p>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                <button style={btnSecondary} onClick={() => setDisconnectTarget(null)}>Cancel</button>
                <button
                  style={{ ...btnPrimary, backgroundColor: "#ef4444" }}
                  onClick={handleDisconnect}
                  disabled={actionLoading === disconnectTarget.id}
                >
                  <Unplug style={{ width: "14px", height: "14px" }} />
                  {actionLoading === disconnectTarget.id ? "Disconnecting..." : "Disconnect"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
