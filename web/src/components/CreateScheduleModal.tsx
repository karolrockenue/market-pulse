import { useState, CSSProperties } from "react";
import {
  Calendar,
  Clock,
  FileText,
  Mail,
  Package,
  CheckCircle2,
  Info,
  Zap,
  ArrowRight,
  Radio,
  X,
} from "lucide-react";
import { toast } from "sonner";

interface CreateScheduleModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (schedule: any) => void;
}

const font = "system-ui, -apple-system, sans-serif";

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
  maxHeight: "90vh",
  overflowY: "auto",
  padding: "24px",
  fontFamily: font,
  color: "#e5e5e5",
};

const inputStyle: CSSProperties = {
  width: "100%",
  backgroundColor: "#141414",
  border: "1px solid #2a2a2a",
  borderRadius: "4px",
  padding: "10px 12px",
  color: "#e5e5e5",
  fontSize: "13px",
  fontFamily: font,
  outline: "none",
  boxSizing: "border-box",
};

const selectWrapperStyle: CSSProperties = {
  position: "relative",
  width: "100%",
};

const selectStyle: CSSProperties = {
  ...inputStyle,
  appearance: "none" as const,
  cursor: "pointer",
  paddingRight: "32px",
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 12px center",
};

const labelStyle: CSSProperties = {
  color: "#9ca3af",
  fontSize: "11px",
  textTransform: "uppercase",
  letterSpacing: "-0.025em",
  marginBottom: "8px",
  display: "block",
  fontFamily: font,
};

const sectionBoxStyle: CSSProperties = {
  background: "#0a0a0a",
  borderRadius: "4px",
  border: "1px solid #2a2a2a",
};

const sectionHeaderStyle: CSSProperties = {
  borderBottom: "1px solid #2a2a2a",
  padding: "12px 16px",
};

const sectionTitleStyle: CSSProperties = {
  color: "#39BDF8",
  fontSize: "11px",
  letterSpacing: "-0.025em",
  textTransform: "uppercase",
  fontFamily: font,
};

const buttonBase: CSSProperties = {
  padding: "10px 20px",
  fontSize: "13px",
  borderRadius: "4px",
  border: "none",
  cursor: "pointer",
  fontFamily: font,
  display: "flex",
  alignItems: "center",
  gap: "8px",
  transition: "all 0.2s",
};

export function CreateScheduleModal({
  open,
  onClose,
  onSave,
}: CreateScheduleModalProps) {
  const [reportPeriod, setReportPeriod] = useState("previous-week");
  const [frequency, setFrequency] = useState("weekly");
  const [dayOfWeek, setDayOfWeek] = useState("monday");
  const [timeOfDay, setTimeOfDay] = useState("09:00");
  const [reportName, setReportName] = useState("");
  const [emailRecipients, setEmailRecipients] = useState("");
  const [csvFormat, setCsvFormat] = useState(true);
  const [excelFormat, setExcelFormat] = useState(false);

  if (!open) return null;

  const handleSave = () => {
    if (!reportName.trim()) {
      toast.error("Please enter a report name");
      return;
    }
    if (!emailRecipients.trim()) {
      toast.error("Please enter at least one email recipient");
      return;
    }
    if (!csvFormat && !excelFormat) {
      toast.error("Please select at least one file format");
      return;
    }
    onSave({
      reportPeriod,
      frequency,
      dayOfWeek,
      timeOfDay,
      reportName,
      emailRecipients,
      formats: { csv: csvFormat, excel: excelFormat },
    });
    toast.success("Schedule created successfully!");
    onClose();
  };

  const getFrequencyText = () => {
    if (frequency === "daily") return "Daily";
    if (frequency === "weekly") {
      const days: Record<string, string> = {
        monday: "Monday",
        tuesday: "Tuesday",
        wednesday: "Wednesday",
        thursday: "Thursday",
        friday: "Friday",
        saturday: "Saturday",
        sunday: "Sunday",
      };
      return `Every ${days[dayOfWeek]}`;
    }
    return "Monthly (1st)";
  };

  const getPeriodLabel = () => {
    const periods: Record<string, string> = {
      "previous-week": "Previous Week",
      "current-week": "Current Week",
      "previous-month": "Previous Month",
      "current-month": "Current Month",
    };
    return periods[reportPeriod];
  };

  const getRecipientCount = () => {
    if (!emailRecipients.trim()) return 0;
    return emailRecipients.split(",").filter((e) => e.trim()).length;
  };

  const getFormats = () => {
    const formats = [];
    if (csvFormat) formats.push("CSV");
    if (excelFormat) formats.push("Excel");
    return formats.length > 0 ? formats.join(" + ") : "None";
  };

  const checkboxStyle = (checked: boolean): CSSProperties => ({
    width: "16px",
    height: "16px",
    borderRadius: "3px",
    border: `1px solid ${checked ? "#39BDF8" : "#2a2a2a"}`,
    backgroundColor: checked ? "#39BDF8" : "transparent",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    transition: "all 0.15s",
  });

  const summaryRowStyle: CSSProperties = {
    borderBottom: "1px solid #2a2a2a",
  };

  const summaryLabelTd: CSSProperties = {
    paddingTop: "8px",
    paddingBottom: "8px",
    color: "#9ca3af",
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "-0.025em",
    fontFamily: font,
  };

  const summaryValueTd: CSSProperties = {
    paddingTop: "8px",
    paddingBottom: "8px",
    color: "#e5e5e5",
    textAlign: "right",
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

          <div style={{ position: "relative", zIndex: 10 }}>
            {/* Header */}
            <div
              style={{
                paddingBottom: "16px",
                borderBottom: "1px solid #2a2a2a",
                marginBottom: "24px",
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
                  <Radio
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
                    Create Report Schedule
                  </div>
                  <div style={{ color: "#9ca3af", fontSize: "14px" }}>
                    Automated report delivery configuration
                  </div>
                </div>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr",
                gap: "24px",
              }}
            >
              {/* Left Side */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "20px",
                }}
              >
                {/* Report Configuration */}
                <div style={sectionBoxStyle}>
                  <div style={sectionHeaderStyle}>
                    <h3 style={sectionTitleStyle}>Report Configuration</h3>
                  </div>
                  <div
                    style={{
                      padding: "16px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "16px",
                    }}
                  >
                    <div>
                      <label style={labelStyle}>Report Name</label>
                      <input
                        value={reportName}
                        onChange={(e) => setReportName(e.target.value)}
                        placeholder="e.g., Weekly Performance Summary"
                        style={inputStyle}
                        onFocus={(e) =>
                          (e.currentTarget.style.borderColor = "#39BDF8")
                        }
                        onBlur={(e) =>
                          (e.currentTarget.style.borderColor = "#2a2a2a")
                        }
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Report Period</label>
                      <div style={selectWrapperStyle}>
                        <select
                          value={reportPeriod}
                          onChange={(e) => setReportPeriod(e.target.value)}
                          style={selectStyle}
                        >
                          <option value="previous-week">
                            Previous Week (Mon-Sun)
                          </option>
                          <option value="current-week">
                            Current Week (Mon-Sun)
                          </option>
                          <option value="previous-month">
                            Previous Month (Full)
                          </option>
                          <option value="current-month">
                            Current Month (MTD)
                          </option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Delivery Schedule */}
                <div style={sectionBoxStyle}>
                  <div style={sectionHeaderStyle}>
                    <h3 style={sectionTitleStyle}>Delivery Schedule</h3>
                  </div>
                  <div
                    style={{
                      padding: "16px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "16px",
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "16px",
                      }}
                    >
                      <div>
                        <label style={labelStyle}>Frequency</label>
                        <div style={selectWrapperStyle}>
                          <select
                            value={frequency}
                            onChange={(e) => setFrequency(e.target.value)}
                            style={selectStyle}
                          >
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label style={labelStyle}>Time</label>
                        <input
                          type="time"
                          value={timeOfDay}
                          onChange={(e) => setTimeOfDay(e.target.value)}
                          style={inputStyle}
                          onFocus={(e) =>
                            (e.currentTarget.style.borderColor = "#39BDF8")
                          }
                          onBlur={(e) =>
                            (e.currentTarget.style.borderColor = "#2a2a2a")
                          }
                        />
                      </div>
                    </div>
                    {frequency === "weekly" && (
                      <div>
                        <label style={labelStyle}>Day of Week</label>
                        <div style={selectWrapperStyle}>
                          <select
                            value={dayOfWeek}
                            onChange={(e) => setDayOfWeek(e.target.value)}
                            style={selectStyle}
                          >
                            <option value="monday">Monday</option>
                            <option value="tuesday">Tuesday</option>
                            <option value="wednesday">Wednesday</option>
                            <option value="thursday">Thursday</option>
                            <option value="friday">Friday</option>
                            <option value="saturday">Saturday</option>
                            <option value="sunday">Sunday</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Recipients & Format */}
                <div style={sectionBoxStyle}>
                  <div style={sectionHeaderStyle}>
                    <h3 style={sectionTitleStyle}>Recipients & Format</h3>
                  </div>
                  <div
                    style={{
                      padding: "16px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "16px",
                    }}
                  >
                    <div>
                      <label style={labelStyle}>Email Addresses</label>
                      <input
                        value={emailRecipients}
                        onChange={(e) => setEmailRecipients(e.target.value)}
                        placeholder="manager@hotel.com, owner@hotel.com"
                        style={inputStyle}
                        onFocus={(e) =>
                          (e.currentTarget.style.borderColor = "#39BDF8")
                        }
                        onBlur={(e) =>
                          (e.currentTarget.style.borderColor = "#2a2a2a")
                        }
                      />
                      <p
                        style={{
                          color: "#6b7280",
                          fontSize: "11px",
                          marginTop: "6px",
                          fontFamily: font,
                        }}
                      >
                        Separate multiple emails with commas
                      </p>
                    </div>
                    <div>
                      <label style={labelStyle}>File Formats</label>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "8px",
                        }}
                      >
                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                            cursor: "pointer",
                            padding: "12px",
                            borderRadius: "4px",
                            border: "1px solid #2a2a2a",
                            transition: "border-color 0.2s",
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.borderColor = "#39BDF8")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.borderColor = "#2a2a2a")
                          }
                        >
                          <div
                            style={checkboxStyle(csvFormat)}
                            onClick={(e) => {
                              e.preventDefault();
                              setCsvFormat(!csvFormat);
                            }}
                          >
                            {csvFormat && (
                              <span
                                style={{
                                  color: "#0a0a0a",
                                  fontSize: "11px",
                                  lineHeight: 1,
                                }}
                              >
                                ✓
                              </span>
                            )}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                              }}
                            >
                              <span
                                style={{
                                  color: "#e5e5e5",
                                  fontSize: "14px",
                                  fontFamily: font,
                                }}
                              >
                                CSV Format
                              </span>
                              <span
                                style={{
                                  color: "#9ca3af",
                                  fontSize: "11px",
                                  fontFamily: font,
                                }}
                              >
                                .csv
                              </span>
                            </div>
                          </div>
                        </label>
                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                            cursor: "pointer",
                            padding: "12px",
                            borderRadius: "4px",
                            border: "1px solid #2a2a2a",
                            transition: "border-color 0.2s",
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.borderColor = "#39BDF8")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.borderColor = "#2a2a2a")
                          }
                        >
                          <div
                            style={checkboxStyle(excelFormat)}
                            onClick={(e) => {
                              e.preventDefault();
                              setExcelFormat(!excelFormat);
                            }}
                          >
                            {excelFormat && (
                              <span
                                style={{
                                  color: "#0a0a0a",
                                  fontSize: "11px",
                                  lineHeight: 1,
                                }}
                              >
                                ✓
                              </span>
                            )}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                              }}
                            >
                              <span
                                style={{
                                  color: "#e5e5e5",
                                  fontSize: "14px",
                                  fontFamily: font,
                                }}
                              >
                                Excel Format
                              </span>
                              <span
                                style={{
                                  color: "#9ca3af",
                                  fontSize: "11px",
                                  fontFamily: font,
                                }}
                              >
                                .xlsx
                              </span>
                            </div>
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Side - Summary */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                }}
              >
                <div
                  style={{
                    background: "#0a0a0a",
                    borderRadius: "4px",
                    border: "1px solid #39BDF8",
                    position: "sticky",
                    top: 0,
                  }}
                >
                  <div style={sectionHeaderStyle}>
                    <h3
                      style={{
                        ...sectionTitleStyle,
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <CheckCircle2 style={{ width: "14px", height: "14px" }} />{" "}
                      Schedule Summary
                    </h3>
                  </div>
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
                        <tr style={summaryRowStyle}>
                          <td style={summaryLabelTd}>Report</td>
                          <td style={summaryValueTd}>
                            {reportName || (
                              <span
                                style={{
                                  color: "#6b7280",
                                  fontStyle: "italic",
                                }}
                              >
                                Not set
                              </span>
                            )}
                          </td>
                        </tr>
                        <tr style={summaryRowStyle}>
                          <td style={summaryLabelTd}>Period</td>
                          <td style={summaryValueTd}>{getPeriodLabel()}</td>
                        </tr>
                        <tr style={summaryRowStyle}>
                          <td style={summaryLabelTd}>Frequency</td>
                          <td style={summaryValueTd}>{getFrequencyText()}</td>
                        </tr>
                        <tr style={summaryRowStyle}>
                          <td style={summaryLabelTd}>Time</td>
                          <td style={summaryValueTd}>{timeOfDay}</td>
                        </tr>
                        <tr style={summaryRowStyle}>
                          <td style={summaryLabelTd}>Recipients</td>
                          <td style={summaryValueTd}>
                            {getRecipientCount() > 0 ? (
                              `${getRecipientCount()} recipient${getRecipientCount() > 1 ? "s" : ""}`
                            ) : (
                              <span
                                style={{
                                  color: "#6b7280",
                                  fontStyle: "italic",
                                }}
                              >
                                Not set
                              </span>
                            )}
                          </td>
                        </tr>
                        <tr>
                          <td style={summaryLabelTd}>Format</td>
                          <td style={summaryValueTd}>
                            {csvFormat || excelFormat ? (
                              getFormats()
                            ) : (
                              <span
                                style={{
                                  color: "#6b7280",
                                  fontStyle: "italic",
                                }}
                              >
                                Not set
                              </span>
                            )}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Info Panel */}
                <div style={sectionBoxStyle}>
                  <div style={{ padding: "16px" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        marginBottom: "12px",
                      }}
                    >
                      <Info
                        style={{
                          width: "14px",
                          height: "14px",
                          color: "#39BDF8",
                        }}
                      />
                      <h4
                        style={{
                          color: "#e5e5e5",
                          fontSize: "11px",
                          textTransform: "uppercase",
                          letterSpacing: "-0.025em",
                          fontFamily: font,
                        }}
                      >
                        Automation
                      </h4>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                        fontSize: "11px",
                        color: "#9ca3af",
                        fontFamily: font,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "8px",
                        }}
                      >
                        <ArrowRight
                          style={{
                            width: "12px",
                            height: "12px",
                            color: "#39BDF8",
                            flexShrink: 0,
                            marginTop: "2px",
                          }}
                        />
                        <span>Reports generated automatically</span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "8px",
                        }}
                      >
                        <ArrowRight
                          style={{
                            width: "12px",
                            height: "12px",
                            color: "#39BDF8",
                            flexShrink: 0,
                            marginTop: "2px",
                          }}
                        />
                        <span>Edit or pause anytime</span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "8px",
                        }}
                      >
                        <ArrowRight
                          style={{
                            width: "12px",
                            height: "12px",
                            color: "#39BDF8",
                            flexShrink: 0,
                            marginTop: "2px",
                          }}
                        />
                        <span>Delivery confirmation emails</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "12px",
                paddingTop: "24px",
                marginTop: "24px",
                borderTop: "1px solid #2a2a2a",
              }}
            >
              <button
                onClick={onClose}
                style={{
                  ...buttonBase,
                  backgroundColor: "transparent",
                  border: "1px solid #2a2a2a",
                  color: "#e5e5e5",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = "#2a2a2a")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = "transparent")
                }
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                style={{
                  ...buttonBase,
                  backgroundColor: "#39BDF8",
                  color: "#0a0a0a",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = "#29ADEE")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = "#39BDF8")
                }
              >
                <Zap style={{ width: "16px", height: "16px" }} />
                Create Schedule
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
