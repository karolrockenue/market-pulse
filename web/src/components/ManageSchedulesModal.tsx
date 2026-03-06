import { useState, CSSProperties } from "react";
import {
  Trash2,
  Edit2,
  Calendar,
  Clock,
  Mail,
  FileText,
  Play,
  Pause,
  Package,
  List,
  X,
} from "lucide-react";
import { toast } from "sonner";

interface Schedule {
  id: string;
  name: string;
  property: string;
  frequency: string;
  recipients: string;
  reportPeriod?: string;
  timeOfDay?: string;
  formats?: { csv: boolean; excel: boolean };
  enabled?: boolean;
}

interface ManageSchedulesModalProps {
  open: boolean;
  onClose: () => void;
  schedules: Schedule[];
  onDelete: (id: string) => void;
}

const font = "system-ui, -apple-system, sans-serif";

export function ManageSchedulesModal({
  open,
  onClose,
  schedules,
  onDelete,
}: ManageSchedulesModalProps) {
  const [scheduleStates, setScheduleStates] = useState<Record<string, boolean>>(
    schedules.reduce(
      (acc, schedule) => ({
        ...acc,
        [schedule.id]: schedule.enabled !== false,
      }),
      {},
    ),
  );

  if (!open) return null;

  const handleToggleSchedule = (id: string) => {
    setScheduleStates((prev) => ({ ...prev, [id]: !prev[id] }));
    toast.success(
      scheduleStates[id] ? "Schedule paused" : "Schedule activated",
    );
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}"?`)) {
      onDelete(id);
      toast.success("Schedule deleted");
    }
  };

  const getRecipientCount = (recipients: string) =>
    recipients.split(",").filter((e) => e.trim()).length;

  const getFormatsText = (formats?: { csv: boolean; excel: boolean }) => {
    if (!formats) return "CSV";
    const formatList = [];
    if (formats.csv) formatList.push("CSV");
    if (formats.excel) formatList.push("Excel");
    return formatList.join(", ");
  };

  const activeCount = Object.values(scheduleStates).filter(Boolean).length;

  const overlayStyle: CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 9998,
    backgroundColor: "rgba(0,0,0,0.6)",
    backdropFilter: "blur(4px)",
  };

  const modalStyle: CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 9999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
  };

  const contentStyle: CSSProperties = {
    position: "relative",
    backgroundColor: "#1a1a1a",
    border: "1px solid #2a2a2a",
    borderRadius: "8px",
    maxWidth: "1200px",
    width: "95vw",
    maxHeight: "85vh",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    padding: "24px",
    fontFamily: font,
    color: "#e5e5e5",
  };

  const toggleStyle = (isEnabled: boolean): CSSProperties => ({
    width: "36px",
    height: "20px",
    borderRadius: "10px",
    position: "relative",
    cursor: "pointer",
    transition: "background-color 0.2s",
    backgroundColor: isEnabled ? "#39BDF8" : "#333",
    flexShrink: 0,
  });

  const toggleKnobStyle = (isEnabled: boolean): CSSProperties => ({
    width: "16px",
    height: "16px",
    borderRadius: "50%",
    backgroundColor: "#fff",
    position: "absolute",
    top: "2px",
    left: isEnabled ? "18px" : "2px",
    transition: "left 0.2s",
  });

  const iconBtnStyle: CSSProperties = {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "6px",
    borderRadius: "4px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "background-color 0.15s",
  };

  const detailLabelTd: CSSProperties = {
    paddingTop: "12px",
    paddingBottom: "12px",
    color: "#9ca3af",
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "-0.025em",
    width: "128px",
    fontFamily: font,
  };

  const detailValueTd: CSSProperties = {
    paddingTop: "12px",
    paddingBottom: "12px",
    color: "#e5e5e5",
    fontSize: "13px",
    fontFamily: font,
  };

  return (
    <>
      <div style={overlayStyle} onClick={onClose} />
      <div style={modalStyle}>
        <div style={contentStyle}>
          {/* Background effects */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              overflow: "hidden",
              borderRadius: "8px",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                width: "384px",
                height: "384px",
                borderRadius: "9999px",
                filter: "blur(96px)",
                background: "rgba(57, 189, 248, 0.03)",
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                width: "384px",
                height: "384px",
                borderRadius: "9999px",
                filter: "blur(96px)",
                background: "rgba(250, 255, 106, 0.02)",
              }}
            />
          </div>
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage:
                "linear-gradient(rgba(57,189,248,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(57,189,248,0.02) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
              pointerEvents: "none",
              borderRadius: "8px",
            }}
          />

          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              position: "absolute",
              top: "16px",
              right: "16px",
              background: "none",
              border: "none",
              color: "#6b7280",
              cursor: "pointer",
              zIndex: 20,
              padding: "4px",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#e5e5e5")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#6b7280")}
          >
            <X size={18} />
          </button>

          <div
            style={{
              position: "relative",
              zIndex: 10,
              display: "flex",
              flexDirection: "column",
              height: "100%",
            }}
          >
            {/* Header */}
            <div
              style={{
                paddingBottom: "16px",
                borderBottom: "1px solid #2a2a2a",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "12px" }}
              >
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    background: "#39BDF8",
                    borderRadius: "4px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <List
                    style={{ width: "20px", height: "20px", color: "#0a0a0a" }}
                  />
                </div>
                <div>
                  <div
                    style={{
                      color: "#e5e5e5",
                      fontSize: "20px",
                      letterSpacing: "-0.025em",
                      textTransform: "uppercase",
                      marginBottom: "4px",
                    }}
                  >
                    Manage Report Schedules
                  </div>
                  <div style={{ color: "#9ca3af", fontSize: "14px" }}>
                    {schedules.length} schedule
                    {schedules.length !== 1 ? "s" : ""} configured •{" "}
                    {activeCount} active
                  </div>
                </div>
              </div>
            </div>

            {/* Content */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                marginTop: "24px",
                paddingRight: "8px",
              }}
            >
              {schedules.length === 0 ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    paddingTop: "64px",
                    paddingBottom: "64px",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      width: "80px",
                      height: "80px",
                      borderRadius: "9999px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: "16px",
                      background: "rgba(57, 189, 248, 0.1)",
                    }}
                  >
                    <Calendar
                      style={{
                        width: "40px",
                        height: "40px",
                        color: "#39BDF8",
                      }}
                    />
                  </div>
                  <h3
                    style={{
                      color: "#e5e5e5",
                      fontSize: "18px",
                      marginBottom: "8px",
                      fontFamily: font,
                    }}
                  >
                    No Scheduled Reports
                  </h3>
                  <p
                    style={{
                      color: "#9ca3af",
                      fontSize: "14px",
                      maxWidth: "28rem",
                      fontFamily: font,
                    }}
                  >
                    You haven't created any automated report schedules yet.
                    Create one to start receiving reports automatically.
                  </p>
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "16px",
                  }}
                >
                  {schedules.map((schedule) => {
                    const isEnabled = scheduleStates[schedule.id];
                    return (
                      <div
                        key={schedule.id}
                        style={{
                          background: "#0a0a0a",
                          borderRadius: "4px",
                          border: "1px solid #2a2a2a",
                          overflow: "hidden",
                        }}
                      >
                        {/* Schedule Header */}
                        <div
                          style={{
                            padding: "12px 16px",
                            borderBottom: "1px solid #2a2a2a",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            background: isEnabled
                              ? "linear-gradient(90deg, rgba(57, 189, 248, 0.05) 0%, transparent 100%)"
                              : "transparent",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "12px",
                            }}
                          >
                            <h3
                              style={{
                                color: "#e5e5e5",
                                textTransform: "uppercase",
                                letterSpacing: "-0.025em",
                                fontSize: "15px",
                                fontFamily: font,
                              }}
                            >
                              {schedule.name}
                            </h3>
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                padding: "2px 8px",
                                fontSize: "11px",
                                borderRadius: "9999px",
                                border: `1px solid ${isEnabled ? "#10b981" : "#6b7280"}`,
                                color: isEnabled ? "#10b981" : "#6b7280",
                                background: isEnabled
                                  ? "rgba(16, 185, 129, 0.1)"
                                  : "rgba(107, 114, 128, 0.1)",
                                fontFamily: font,
                              }}
                            >
                              {isEnabled ? (
                                <>
                                  <Play
                                    style={{ width: "12px", height: "12px" }}
                                  />{" "}
                                  Active
                                </>
                              ) : (
                                <>
                                  <Pause
                                    style={{ width: "12px", height: "12px" }}
                                  />{" "}
                                  Paused
                                </>
                              )}
                            </span>
                          </div>

                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "12px",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                              }}
                            >
                              <span
                                style={{
                                  color: "#9ca3af",
                                  fontSize: "11px",
                                  textTransform: "uppercase",
                                  letterSpacing: "-0.025em",
                                  fontFamily: font,
                                }}
                              >
                                {isEnabled ? "Active" : "Paused"}
                              </span>
                              <div
                                style={toggleStyle(isEnabled)}
                                onClick={() =>
                                  handleToggleSchedule(schedule.id)
                                }
                              >
                                <div style={toggleKnobStyle(isEnabled)} />
                              </div>
                            </div>
                            <div
                              style={{
                                height: "24px",
                                width: "1px",
                                background: "#2a2a2a",
                              }}
                            />
                            <button
                              style={{ ...iconBtnStyle, color: "#9ca3af" }}
                              onClick={() =>
                                toast.info("Edit functionality coming soon")
                              }
                              onMouseEnter={(e) => {
                                e.currentTarget.style.color = "#39BDF8";
                                e.currentTarget.style.backgroundColor =
                                  "rgba(57,189,248,0.1)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.color = "#9ca3af";
                                e.currentTarget.style.backgroundColor =
                                  "transparent";
                              }}
                            >
                              <Edit2
                                style={{ width: "16px", height: "16px" }}
                              />
                            </button>
                            <button
                              style={{ ...iconBtnStyle, color: "#ef4444" }}
                              onClick={() =>
                                handleDelete(schedule.id, schedule.name)
                              }
                              onMouseEnter={(e) =>
                                (e.currentTarget.style.backgroundColor =
                                  "rgba(239,68,68,0.1)")
                              }
                              onMouseLeave={(e) =>
                                (e.currentTarget.style.backgroundColor =
                                  "transparent")
                              }
                            >
                              <Trash2
                                style={{ width: "16px", height: "16px" }}
                              />
                            </button>
                          </div>
                        </div>

                        {/* Details Table */}
                        <div style={{ padding: "16px" }}>
                          <table
                            style={{
                              width: "100%",
                              fontSize: "14px",
                              borderCollapse: "collapse",
                              fontFamily: font,
                            }}
                          >
                            <tbody>
                              <tr style={{ borderBottom: "1px solid #2a2a2a" }}>
                                <td style={detailLabelTd}>
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "8px",
                                    }}
                                  >
                                    <Calendar
                                      style={{
                                        width: "14px",
                                        height: "14px",
                                        color: "#39BDF8",
                                      }}
                                    />{" "}
                                    Schedule
                                  </div>
                                </td>
                                <td style={detailValueTd}>
                                  <div>{schedule.frequency}</div>
                                  {schedule.timeOfDay && (
                                    <div
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "6px",
                                        marginTop: "4px",
                                        color: "#9ca3af",
                                        fontSize: "11px",
                                      }}
                                    >
                                      <Clock
                                        style={{
                                          width: "12px",
                                          height: "12px",
                                        }}
                                      />{" "}
                                      {schedule.timeOfDay}
                                    </div>
                                  )}
                                </td>
                              </tr>
                              {schedule.reportPeriod && (
                                <tr
                                  style={{ borderBottom: "1px solid #2a2a2a" }}
                                >
                                  <td style={detailLabelTd}>
                                    <div
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "8px",
                                      }}
                                    >
                                      <FileText
                                        style={{
                                          width: "14px",
                                          height: "14px",
                                          color: "#39BDF8",
                                        }}
                                      />{" "}
                                      Period
                                    </div>
                                  </td>
                                  <td
                                    style={{
                                      ...detailValueTd,
                                      textTransform: "capitalize",
                                    }}
                                  >
                                    {schedule.reportPeriod.replace("-", " ")}
                                  </td>
                                </tr>
                              )}
                              <tr style={{ borderBottom: "1px solid #2a2a2a" }}>
                                <td style={detailLabelTd}>
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "8px",
                                    }}
                                  >
                                    <Mail
                                      style={{
                                        width: "14px",
                                        height: "14px",
                                        color: "#39BDF8",
                                      }}
                                    />{" "}
                                    Recipients
                                  </div>
                                </td>
                                <td style={detailValueTd}>
                                  <div>
                                    {getRecipientCount(schedule.recipients)}{" "}
                                    recipient
                                    {getRecipientCount(schedule.recipients) > 1
                                      ? "s"
                                      : ""}
                                  </div>
                                  <div
                                    style={{
                                      color: "#9ca3af",
                                      fontSize: "11px",
                                      marginTop: "2px",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {schedule.recipients.split(",")[0].trim()}
                                    {getRecipientCount(schedule.recipients) >
                                      1 && ", ..."}
                                  </div>
                                </td>
                              </tr>
                              <tr>
                                <td style={detailLabelTd}>
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "8px",
                                    }}
                                  >
                                    <Package
                                      style={{
                                        width: "14px",
                                        height: "14px",
                                        color: "#39BDF8",
                                      }}
                                    />{" "}
                                    Format
                                  </div>
                                </td>
                                <td style={detailValueTd}>
                                  {getFormatsText(schedule.formats)}
                                </td>
                              </tr>
                            </tbody>
                          </table>

                          {isEnabled && (
                            <div
                              style={{
                                marginTop: "16px",
                                padding: "12px",
                                borderRadius: "4px",
                                border: "1px solid #2a2a2a",
                                background: "rgba(57, 189, 248, 0.03)",
                              }}
                            >
                              <p
                                style={{
                                  color: "#9ca3af",
                                  fontSize: "11px",
                                  fontFamily: font,
                                }}
                              >
                                <span
                                  style={{
                                    color: "#39BDF8",
                                    textTransform: "uppercase",
                                    letterSpacing: "-0.025em",
                                  }}
                                >
                                  Next delivery:
                                </span>{" "}
                                Tomorrow at {schedule.timeOfDay || "09:00"}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "12px",
                paddingTop: "24px",
                marginTop: "16px",
                borderTop: "1px solid #2a2a2a",
              }}
            >
              <button
                onClick={onClose}
                style={{
                  padding: "10px 20px",
                  fontSize: "13px",
                  borderRadius: "4px",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: font,
                  backgroundColor: "#39BDF8",
                  color: "#0a0a0a",
                  transition: "background-color 0.2s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = "#29ADEE")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = "#39BDF8")
                }
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
