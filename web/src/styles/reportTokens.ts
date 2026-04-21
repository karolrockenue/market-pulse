// Light-theme tokens for Reports (PDF + Email).
// Separate from the dark dashboard tokens in `./tokens.ts` — do not cross-import.
// Reports need fewer colors, not different ones. Six is the ceiling.

export const REPORT = {
  // Surfaces
  pageBg: "#FAFAF7",   // outer page/email background (warm off-white)
  surface: "#FFFFFF",  // cards, main canvas
  border: "#E5E5E0",   // hairline dividers
  muted: "#F3F3EE",    // zebra rows, subtle fills

  // Text
  text: "#1A1A1A",     // headings + body
  textMuted: "#6B7280",// labels, captions

  // Accent (one bridge color to the dark UI — stays brand-consistent)
  accent: "#0F4C81",   // deep teal-blue, print-friendly
  accentSoft: "#E7EEF5",// accent tint for KPI badges

  // Semantic (rare use in reports — only for deltas/warnings)
  pos: "#1F7A4D",
  neg: "#B4321F",

  // Typography
  fontBody: "'Inter', 'Helvetica Neue', Arial, sans-serif",
  fontDisplay: "'Inter', 'Helvetica Neue', Arial, sans-serif",
  fontMono: "'SFMono-Regular', Menlo, Consolas, monospace",

  // Scale
  labelSize: 10,      // uppercase labels
  bodySize: 13,       // body text
  h3Size: 16,
  h2Size: 20,
  h1Size: 28,
  kpiSize: 36,

  letterSpacingLabel: "0.08em",
} as const;

// Canvas widths for the lab preview frame.
export const REPORT_WIDTHS = {
  a4: 794,   // A4 at 96dpi (portrait). Target for PDF reports.
  email: 600,// Standard email max width. Most clients clamp here.
} as const;
