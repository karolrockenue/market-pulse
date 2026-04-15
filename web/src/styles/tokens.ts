/** Design tokens — agreed palette */
export const R = {
  bg: "#14181D",
  card: "#1C2228",
  border: "#1E2330",
  sep: "rgba(255,255,255,0.04)",
  accent: "#F3F5F7",
  text: "#B0B8C4",
  textMid: "#7A8494",
  textDim: "#4E5868",
  teal: "#38C6BA",
  warmTeal: "#38C6BA",
  gold: "#C8A66E",
  heroBg: "#111519",
  darkBand: "#121519",
  sidebar: "#0C0E12",
  green: "#34D068",
  red: "#ef4444",
  cardLight: "#1E2530",
  cardRaised: "#1C2228",
  amber: "#f59e0b",
  blue: "#3b82f6",
  purple: "#8b5cf6",
  pink: "#ec4899",
  orange: "#f97316",
  recessed: "#0C0E12",
  surface: "#121519",
  white: "#F3F5F7",
} as const;

export const fmt = (v: number, symbol = "£") =>
  `${symbol}${(v || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export const demandColor = (v: number) =>
  v >= 85 ? R.red : v >= 70 ? R.gold : v >= 50 ? R.gold : v >= 30 ? R.warmTeal : R.teal;
