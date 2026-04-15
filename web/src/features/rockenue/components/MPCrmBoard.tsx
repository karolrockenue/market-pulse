import { useState } from "react";
import { Search, Plus, Filter, Clock, Flag, Building2, User, MessageSquare } from "lucide-react";

// ── MP CRM Board — Rockenue style mockup ──

interface MPCrmBoardProps { activeView: string; onNavigate: (view: string) => void; }

const R = {
  bg: "#14181D", surface: "#121519", recessed: "#0C0E12",
  border: "#1E2330", sep: "rgba(255,255,255,0.04)", accent: "#F3F5F7",
  text: "#B0B8C4", textMid: "#7A8494", textDim: "#4E5868",
  blue: "#39BDF8", gold: "#C8A66E", green: "#10b981", red: "#ef4444",
  amber: "#f59e0b", purple: "#8b5cf6", pink: "#ec4899",
};

const COLUMNS = [
  { key: "todo", label: "To Do", color: R.textMid },
  { key: "in_progress", label: "In Progress", color: R.blue },
  { key: "review", label: "Review", color: R.purple },
  { key: "done", label: "Done", color: R.green },
];

const CATEGORIES: Record<string, { color: string; label: string }> = {
  distribution: { color: R.blue, label: "Distribution" },
  revenue: { color: R.green, label: "Revenue" },
  operations: { color: R.amber, label: "Operations" },
  onboarding: { color: R.purple, label: "Onboarding" },
  content: { color: R.pink, label: "Content" },
};

const PRIORITIES: Record<string, { color: string }> = {
  urgent: { color: R.red },
  high: { color: R.amber },
  medium: { color: R.blue },
  low: { color: R.textDim },
};

const TASKS = [
  // To Do
  { id: 1, title: "Set up Expedia virtual card payments", hotel: "The W14 Hotel", category: "distribution", priority: "high", assignee: "Karol", due: "18 Apr", comments: 2, status: "todo" },
  { id: 2, title: "Review Booking.com content score", hotel: "Elysee Hyde Park", category: "content", priority: "medium", assignee: "Sana", due: "20 Apr", comments: 0, status: "todo" },
  { id: 3, title: "Negotiate HRS corporate rate", hotel: "Jubilee Hotel Victoria", category: "revenue", priority: "medium", assignee: "Karol", due: "22 Apr", comments: 1, status: "todo" },
  { id: 4, title: "Onboard Vilenza to Mews", hotel: "Vilenza Hotel", category: "onboarding", priority: "urgent", assignee: "Karol", due: "15 Apr", comments: 4, status: "todo" },
  // In Progress
  { id: 5, title: "Fix Agoda rate parity issue", hotel: "Camden Suites", category: "distribution", priority: "urgent", assignee: "Sana", due: "16 Apr", comments: 3, status: "in_progress" },
  { id: 6, title: "Update Trip.com photos", hotel: "The Melita", category: "content", priority: "low", assignee: "Sana", due: "25 Apr", comments: 0, status: "in_progress" },
  { id: 7, title: "Q2 pricing strategy review", hotel: "Portfolio", category: "revenue", priority: "high", assignee: "Karol", due: "19 Apr", comments: 5, status: "in_progress" },
  // Review
  { id: 8, title: "Hotelbeds contract renewal", hotel: "The W14 Hotel", category: "distribution", priority: "high", assignee: "Karol", due: "17 Apr", comments: 2, status: "review" },
  { id: 9, title: "Google Hotels listing audit", hotel: "Lancaster Court Hotel", category: "content", priority: "medium", assignee: "Sana", due: "21 Apr", comments: 1, status: "review" },
  // Done
  { id: 10, title: "Booking.com Genius L2 activation", hotel: "Notting Hill House Hotel", category: "distribution", priority: "high", assignee: "Karol", due: "12 Apr", comments: 3, status: "done" },
  { id: 11, title: "Connect Whitechapel to channel manager", hotel: "The Whitechapel Hotel", category: "onboarding", priority: "medium", assignee: "Sana", due: "10 Apr", comments: 1, status: "done" },
  { id: 12, title: "April budget forecast", hotel: "Portfolio", category: "revenue", priority: "medium", assignee: "Karol", due: "8 Apr", comments: 0, status: "done" },
];

const TEAM = [
  { name: "Karol", color: R.blue },
  { name: "Sana", color: R.purple },
];

function Avatar({ name, size = 24 }: { name: string; size?: number }) {
  const member = TEAM.find(t => t.name === name);
  return (
    <div style={{
      width: size, height: size, borderRadius: size / 2, background: member?.color || R.textDim,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.4, fontWeight: 700, color: R.recessed, flexShrink: 0,
    }}>
      {name[0]}
    </div>
  );
}

export function MPCrmBoard({ activeView, onNavigate }: MPCrmBoardProps) {
  const [viewMode, setViewMode] = useState("board");

  return (
    <div style={{ minHeight: "100vh", background: R.bg, color: R.accent, fontFamily: "'Inter', system-ui, -apple-system, sans-serif", display: "flex" }}>
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>

        {/* Header */}
        <div style={{ padding: "20px 36px", borderBottom: `1px solid ${R.border}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: -0.8 }}>Task Board</h1>
            <button style={{ display: "flex", alignItems: "center", gap: 6, background: R.blue, color: R.recessed, border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              <Plus size={14} /> New Task
            </button>
          </div>

          {/* Status summary + filters */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 8 }}>
              {COLUMNS.map(col => {
                const count = TASKS.filter(t => t.status === col.key).length;
                return (
                  <div key={col.key} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 6, background: `${col.color}10`, border: `1px solid ${col.color}25` }}>
                    <div style={{ width: 6, height: 6, borderRadius: 3, background: col.color }} />
                    <span style={{ fontSize: 11, color: R.text }}>{col.label}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: col.color }}>{count}</span>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <Search size={13} color={R.textDim} style={{ position: "absolute", left: 10 }} />
                <input style={{ background: R.surface, border: `1px solid ${R.border}`, borderRadius: 6, padding: "6px 10px 6px 30px", fontSize: 12, color: R.text, outline: "none", width: 180 }} placeholder="Search tasks..." />
              </div>
              <div style={{ display: "flex", gap: 2, background: R.surface, padding: 3, borderRadius: 6, border: `1px solid ${R.border}` }}>
                {[
                  { key: "board", label: "Board" },
                  { key: "timeline", label: "Timeline" },
                  { key: "hotel", label: "By Hotel" },
                ].map(v => (
                  <button key={v.key} onClick={() => setViewMode(v.key)} style={{
                    padding: "4px 12px", fontSize: 11, borderRadius: 4, border: "none", cursor: "pointer",
                    background: viewMode === v.key ? R.blue : "transparent",
                    color: viewMode === v.key ? R.recessed : R.textDim,
                    fontWeight: viewMode === v.key ? 600 : 400,
                  }}>
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Kanban Board */}
        <div style={{ flex: 1, overflow: "auto", padding: "20px 36px", display: "flex", gap: 14 }}>
          {COLUMNS.map(col => {
            const colTasks = TASKS.filter(t => t.status === col.key);
            return (
              <div key={col.key} style={{ flex: 1, minWidth: 260, display: "flex", flexDirection: "column" }}>
                {/* Column header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, padding: "0 4px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 4, background: col.color }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: R.accent, textTransform: "uppercase", letterSpacing: 0.5 }}>{col.label}</span>
                    <span style={{ fontSize: 11, color: R.textDim, fontWeight: 600 }}>{colTasks.length}</span>
                  </div>
                  <Plus size={14} color={R.textDim} style={{ cursor: "pointer" }} />
                </div>

                {/* Cards */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                  {colTasks.map(task => {
                    const cat = CATEGORIES[task.category];
                    const pri = PRIORITIES[task.priority];
                    const isOverdue = task.status !== "done" && new Date(`2026-${task.due.includes("Apr") ? "04" : "05"}-${task.due.split(" ")[0]}`) < new Date(2026, 3, 14);
                    return (
                      <div key={task.id} style={{
                        background: R.surface, border: `1px solid ${R.border}`, borderRadius: 8,
                        padding: "14px 16px", cursor: "pointer", transition: "border-color 0.15s",
                      }}>
                        {/* Priority + Category */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                          <span style={{
                            fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 4,
                            background: `${cat.color}15`, color: cat.color, letterSpacing: 0.3,
                          }}>
                            {cat.label}
                          </span>
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <Flag size={10} color={pri.color} fill={task.priority === "urgent" ? pri.color : "none"} />
                            <span style={{ fontSize: 9, color: pri.color, fontWeight: 600, textTransform: "uppercase" }}>{task.priority}</span>
                          </div>
                        </div>

                        {/* Title */}
                        <div style={{ fontSize: 13, fontWeight: 500, color: R.accent, lineHeight: 1.4, marginBottom: 10 }}>
                          {task.title}
                        </div>

                        {/* Hotel */}
                        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 12 }}>
                          <Building2 size={10} color={R.textDim} />
                          <span style={{ fontSize: 11, color: R.textMid }}>{task.hotel}</span>
                        </div>

                        {/* Footer: assignee, due, comments */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <Avatar name={task.assignee} size={22} />
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            {task.comments > 0 && (
                              <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                                <MessageSquare size={10} color={R.textDim} />
                                <span style={{ fontSize: 10, color: R.textDim }}>{task.comments}</span>
                              </div>
                            )}
                            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                              <Clock size={10} color={isOverdue ? R.red : R.textDim} />
                              <span style={{ fontSize: 10, color: isOverdue ? R.red : R.textDim, fontWeight: isOverdue ? 600 : 400 }}>{task.due}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
