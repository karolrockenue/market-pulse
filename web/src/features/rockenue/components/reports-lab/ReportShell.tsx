import React from "react";
import { REPORT as R } from "../../../../styles/reportTokens";
import { BrandMarkDark } from "./reportShared";

// Shared shell for every report mockup. Design-locked as of 2026-04-20:
// dark header bar (logo + report type), utilitarian body, two-colour
// accent strip hugging the bottom edge.

export const BODY_FONT_SIZE = 11;
export const LABEL_FONT_SIZE = 10;

export function MetaRow({ label, value, trailing }: { label: string; value: string; trailing?: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "140px 1fr 100px", gap: 12, padding: "4px 0", borderBottom: `1px solid ${R.border}`, fontSize: BODY_FONT_SIZE }}>
      <div style={{ color: R.textMuted }}>{label}</div>
      <div style={{ color: R.text }}>{value}</div>
      <div style={{ color: R.textMuted, textAlign: "right" }}>{trailing ?? ""}</div>
    </div>
  );
}

export function SectionLabel({ children }: { children: string }) {
  return (
    <div style={{
      fontSize: LABEL_FONT_SIZE,
      color: R.textMuted,
      textTransform: "uppercase",
      letterSpacing: R.letterSpacingLabel,
      marginTop: 24,
      marginBottom: 8,
    }}>
      {children}
    </div>
  );
}

interface ReportShellProps {
  reportType: string;         // e.g. "Monthly Performance"
  metadata: { label: string; value: string; trailing?: string }[];
  children: React.ReactNode;  // the report body
  fontFamily?: string;        // optional per-report font override; inherits into header, metadata, and table
}

export function ReportShell({ reportType, metadata, children, fontFamily }: ReportShellProps) {
  return (
    <div style={{ background: R.surface, color: R.text, fontFamily: fontFamily ?? R.fontBody, flex: 1, display: "flex", flexDirection: "column" }}>
      {/* Dark header bar — logo + report type. */}
      <div style={{
        background: "#14181D",
        color: "#F3F5F7",
        padding: "20px 40px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <BrandMarkDark size={13} />
        <div style={{ fontSize: 11, letterSpacing: R.letterSpacingLabel, textTransform: "uppercase", color: "#7A8494" }}>
          {reportType}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "32px 40px 24px", flex: 1, display: "flex", flexDirection: "column" }}>
        {metadata.map((m) => (
          <MetaRow key={m.label} label={m.label} value={m.value} trailing={m.trailing} />
        ))}
        {children}
        <div style={{ flex: 1 }} />
      </div>

      {/* Teal/gold accent strip hugging the bottom edge. */}
      <div style={{ height: 6, background: "linear-gradient(90deg, #38C6BA 0%, #38C6BA 50%, #C8A66E 50%, #C8A66E 100%)" }} />
    </div>
  );
}

// Shared table primitives so every report table renders identically.
export const tableCellPad = "4px 8px";

export const tableTh: React.CSSProperties = {
  textAlign: "right",
  padding: tableCellPad,
  fontSize: 9,
  letterSpacing: R.letterSpacingLabel,
  textTransform: "uppercase",
  color: R.textMuted,
  fontWeight: 500,
  borderBottom: `1px solid ${R.border}`,
};

export const tableTd: React.CSSProperties = {
  textAlign: "right",
  padding: tableCellPad,
  fontSize: 10.5,
  color: R.text,
  fontVariantNumeric: "tabular-nums",
};

export const tableThLeft: React.CSSProperties = { ...tableTh, textAlign: "left" };
export const tableTdLeft: React.CSSProperties = { ...tableTd, textAlign: "left" };
export const tableTotalsRow: React.CSSProperties = { borderTop: `2px solid ${R.border}` };
export const tableTotalsCell: React.CSSProperties = { padding: "8px 8px", fontWeight: 500 };
