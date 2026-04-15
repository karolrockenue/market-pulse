import { useState, useEffect, useRef } from "react";
import { CalendarDays } from "lucide-react";
import { R } from "../styles/tokens";

const P = {
  cardRaised: "#1C2228",
  teal: "#38C6BA",
  border: R.border,
  textDim: R.textDim,
  textMid: R.textMid,
  accent: R.accent,
  darkBand: R.darkBand,
};

interface DatePickerNavProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function DatePickerNav({ label, value, onChange, isOpen, onOpenChange }: DatePickerNavProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const open = isOpen !== undefined ? isOpen : internalOpen;
  const setOpen = (v: boolean) => {
    if (onOpenChange) onOpenChange(v);
    else setInternalOpen(v);
  };

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const parsed = new Date(value + "T12:00:00");
  const year = parsed.getFullYear();
  const month = parsed.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();
  const monthLabel = parsed.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  const days: { day: number; current: boolean; date: string }[] = [];
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    const m = month === 0 ? 11 : month - 1;
    const y = month === 0 ? year - 1 : year;
    days.push({ day: d, current: false, date: `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}` });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    days.push({ day: d, current: true, date: `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}` });
  }
  const remaining = 42 - days.length;
  for (let d = 1; d <= remaining; d++) {
    const m = month === 11 ? 0 : month + 1;
    const y = month === 11 ? year + 1 : year;
    days.push({ day: d, current: false, date: `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}` });
  }

  const navMonth = (dir: number) => {
    const d = new Date(year, month + dir, 1);
    onChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`);
  };

  const displayValue = parsed.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div style={{ position: "relative" }} ref={ref}>
      <div style={{ fontSize: 9, color: P.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{label}</div>
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: "flex", alignItems: "center", gap: 8, padding: "7px 12px",
          background: P.cardRaised, border: `1px solid ${open ? `${P.teal}40` : P.border}`,
          borderRadius: 6, cursor: "pointer", transition: "border-color 0.15s", width: 260,
        }}
      >
        <CalendarDays size={13} color={P.textDim} />
        <span style={{ fontSize: 12, color: P.accent }}>{displayValue}</span>
      </div>

      {open && (
        <div style={{
          position: "absolute", top: "100%", left: 0, zIndex: 50, marginTop: 6,
          background: P.cardRaised, border: `1px solid ${P.border}`, borderRadius: 8,
          padding: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.5)", width: 260,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <button onClick={() => navMonth(-1)} style={{ background: "none", border: "none", color: P.textMid, cursor: "pointer", fontSize: 14, padding: "2px 6px" }}>‹</button>
            <span style={{ fontSize: 12, fontWeight: 600, color: P.accent }}>{monthLabel}</span>
            <button onClick={() => navMonth(1)} style={{ background: "none", border: "none", color: P.textMid, cursor: "pointer", fontSize: 14, padding: "2px 6px" }}>›</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
            {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map(d => (
              <div key={d} style={{ fontSize: 9, color: P.textDim, textAlign: "center", padding: 4, textTransform: "uppercase" }}>{d}</div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
            {days.map((d, i) => {
              const isSelected = d.date === value;
              const isToday = d.date === new Date().toISOString().split("T")[0];
              return (
                <button
                  key={i}
                  onClick={() => { onChange(d.date); setOpen(false); }}
                  style={{
                    width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, borderRadius: 4, border: "none", cursor: "pointer",
                    background: isSelected ? P.teal : "transparent",
                    color: isSelected ? P.darkBand : d.current ? P.accent : P.textDim,
                    fontWeight: isSelected || isToday ? 600 : 400,
                    outline: isToday && !isSelected ? `1px solid ${P.teal}50` : "none",
                  }}
                >
                  {d.day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
