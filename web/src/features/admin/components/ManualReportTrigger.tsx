import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Send, Loader2, CheckCircle, FileText } from "lucide-react";
import { toast } from "sonner";

import { ScheduledReport } from "../api/types";

interface ManualReportTriggerProps {
  reports: ScheduledReport[];
}

// Accept the reports prop
export function ManualReportTrigger({ reports }: ManualReportTriggerProps) {
  const [selectedReport, setSelectedReport] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");

  const handleSendReport = async () => {
    // Check if a report is actually selected
    if (!selectedReport) {
      toast.warning("Please select a report first.");
      return;
    }

    setStatus("sending"); // Update button state
    const toastId = toast.loading("Triggering report generation...");

    try {
      // Call the backend endpoint
      const response = await fetch("/api/admin/run-scheduled-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId: selectedReport }), // Send the selected report_id
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to trigger report");
      }

      // Show success toast with the message from the backend
      toast.success(result.message || "Report sent successfully!", {
        id: toastId,
      });
      setStatus("sent"); // Update button state briefly
      setTimeout(() => setStatus("idle"), 2000); // Reset button after 2s
    } catch (error: any) {
      // Show error toast
      toast.error(`Error: ${error.message}`, { id: toastId });
      setStatus("idle"); // Reset button immediately on error
    }
  };

  return (
    <div
      style={{
        backgroundColor: "#1a1a1a",
        border: "1px solid #2a2a2a",
        borderRadius: "0.25rem",
      }}
    >
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #2a2a2a" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <FileText className="w-4 h-4" style={{ color: "#39BDF8" }} />
          <h2
            style={{
              color: "#e5e5e5",
              fontSize: "12px",
              textTransform: "uppercase",
              letterSpacing: "-0.025em",
              margin: 0,
            }}
          >
            Manual Report Trigger
          </h2>
        </div>
      </div>

      <div style={{ padding: "20px" }}>
        <div style={{ display: "flex", gap: "12px", alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <label
              style={{
                color: "#9ca3af",
                fontSize: "12px",
                marginBottom: "8px",
                display: "block",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Select Report
            </label>
            <Select value={selectedReport} onValueChange={setSelectedReport}>
              <SelectTrigger
                style={{
                  backgroundColor: "#0f0f0f",
                  borderColor: "#2a2a2a",
                  color: "#e5e5e5",
                }}
              >
                <SelectValue placeholder="Choose a scheduled report..." />
              </SelectTrigger>
              <SelectContent
                style={{
                  backgroundColor: "#1a1a1a",
                  borderColor: "#2a2a2a",
                  color: "#e5e5e5",
                }}
              >
                {reports.length === 0 ? (
                  <SelectItem value="loading" disabled>
                    Loading reports...
                  </SelectItem>
                ) : (
                  reports.map((report, index) => (
                    <SelectItem
                      key={`${report.report_id}-${index}`}
                      value={report.report_id}
                      style={{ cursor: "pointer" }}
                    >
                      {report.property_name} - {report.report_name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleSendReport}
            disabled={!selectedReport || status === "sending"}
            style={{
              backgroundColor: "#39BDF8",
              color: "#0f0f0f",
              height: "40px",
              padding: "0 24px",
              opacity: !selectedReport || status === "sending" ? 0.5 : 1,
            }}
            className="hover:bg-[#29ADEE]"
          >
            {status === "sending" ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : status === "sent" ? (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Sent!
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Send Now
              </>
            )}
          </Button>
        </div>

        {status !== "idle" && (
          <div
            style={{
              marginTop: "16px",
              padding: "12px",
              borderRadius: "0.25rem",
              borderWidth: "1px",
              borderStyle: "solid",
              fontSize: "12px",
              backgroundColor:
                status === "sending"
                  ? "rgba(57, 189, 248, 0.1)"
                  : "rgba(16, 185, 129, 0.1)",
              borderColor:
                status === "sending"
                  ? "rgba(57, 189, 248, 0.3)"
                  : "rgba(16, 185, 129, 0.3)",
              color: status === "sending" ? "#39BDF8" : "#10b981",
            }}
          >
            {status === "sending"
              ? "Generating and sending report..."
              : "Report sent successfully to all recipients"}
          </div>
        )}
      </div>
    </div>
  );
}
