import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";
import { toast } from "sonner";

import { usersApi, type AdminUser } from "../api/users.api";

const ADMIN_ROLES = new Set(["admin", "super_admin"]);

export function UserManagementTable() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    usersApi
      .getAll()
      .then((rows) => {
        if (!cancelled) setUsers(rows);
      })
      .catch((err) => {
        if (!cancelled) toast.error(err.message || "Failed to fetch users");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleToggleRates = async (userId: number, next: boolean) => {
    const prev = users;
    setSavingUserId(userId);
    setUsers((rows) =>
      rows.map((u) => (u.user_id === userId ? { ...u, can_view_rates: next } : u))
    );
    try {
      await usersApi.setRatesAccess(userId, next);
      toast.success(next ? "Rate access granted" : "Rate access revoked");
    } catch (err: any) {
      setUsers(prev);
      toast.error(err.message || "Failed to update rate access");
    } finally {
      setSavingUserId(null);
    }
  };

  return (
    <div
      style={{
        backgroundColor: "#121519",
        border: "1px solid #1E2330",
        borderRadius: "0.25rem",
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "16px 24px", borderBottom: "1px solid #1E2330" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Users className="w-4 h-4" style={{ color: "#7BAFD4" }} />
          <h2
            style={{
              color: "#F3F5F7",
              fontSize: "12px",
              textTransform: "uppercase",
              letterSpacing: "-0.025em",
              margin: 0,
            }}
          >
            User Management
          </h2>
        </div>
        <p style={{ color: "#7A8494", fontSize: "12px", marginTop: "4px" }}>
          Grant or revoke rate-viewing access for owner / user accounts. Admins
          have unconditional access.
        </p>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr
              style={{
                borderBottom: "1px solid #1E2330",
                backgroundColor: "#121519",
              }}
            >
              {["Name", "Email", "Role", "Properties", "Rate Access"].map(
                (header) => (
                  <th
                    key={header}
                    style={{
                      padding: "12px 24px",
                      textAlign: "left",
                      color: "#7A8494",
                      fontSize: "12px",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {header}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td
                  colSpan={5}
                  style={{
                    padding: "24px",
                    textAlign: "center",
                    color: "#7A8494",
                    fontSize: "13px",
                  }}
                >
                  Loading users…
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  style={{
                    padding: "24px",
                    textAlign: "center",
                    color: "#7A8494",
                    fontSize: "13px",
                  }}
                >
                  No users found
                </td>
              </tr>
            ) : (
              users.map((user) => {
                const isAdmin = ADMIN_ROLES.has(user.role);
                const fullName =
                  [user.first_name, user.last_name].filter(Boolean).join(" ") ||
                  "—";
                return (
                  <tr
                    key={user.user_id}
                    style={{ borderBottom: "1px solid #1E2330" }}
                  >
                    <td
                      style={{
                        padding: "16px 24px",
                        color: "#F3F5F7",
                        fontSize: "14px",
                      }}
                    >
                      {fullName}
                    </td>
                    <td
                      style={{
                        padding: "16px 24px",
                        color: "#7A8494",
                        fontSize: "14px",
                      }}
                    >
                      {user.email}
                    </td>
                    <td style={{ padding: "16px 24px" }}>
                      <Badge
                        variant="outline"
                        style={{
                          backgroundColor: isAdmin
                            ? "rgba(200,166,110,0.15)"
                            : "rgba(56,198,186,0.15)",
                          color: isAdmin ? "#C8A66E" : "#7BAFD4",
                          borderColor: isAdmin
                            ? "rgba(200,166,110,0.3)"
                            : "rgba(56,198,186,0.3)",
                          fontSize: "11px",
                        }}
                      >
                        {user.role}
                      </Badge>
                    </td>
                    <td
                      style={{
                        padding: "16px 24px",
                        color: "#7A8494",
                        fontSize: "14px",
                      }}
                    >
                      {user.property_count}
                    </td>
                    <td style={{ padding: "16px 24px" }}>
                      {isAdmin ? (
                        <span
                          style={{
                            fontSize: "12px",
                            color: "#666666",
                            fontStyle: "italic",
                          }}
                        >
                          N/A (admin)
                        </span>
                      ) : (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <Switch
                            checked={user.can_view_rates}
                            disabled={savingUserId === user.user_id}
                            onCheckedChange={(next) =>
                              handleToggleRates(user.user_id, next)
                            }
                            className="data-[state=checked]:bg-[#7BAFD4] data-[state=unchecked]:bg-[#1E2330]"
                          />
                          <span
                            style={{
                              fontSize: "12px",
                              color: user.can_view_rates
                                ? "#7BAFD4"
                                : "#666666",
                            }}
                          >
                            {user.can_view_rates ? "Granted" : "Denied"}
                          </span>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
