import { useState, useEffect } from "react";
import {
  ClipboardList,
  Globe,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Clock,
  Users,
  ArrowRight,
  Zap,
} from "lucide-react";

// ── Brand palette ──
const BLUE = "#39BDF8";
const GREEN = "#10b981";
const AMBER = "#f59e0b";
const RED = "#ef4444";
const PURPLE = "#8b5cf6";
const BG_PAGE = "#1d1d1c";
const CARD_BG = "#1a1a1a";
const BORDER = "#2a2a2a";
const INPUT_BG = "#2C2C2C";
const TEXT = "#e5e5e5";
const TEXT_MID = "#9ca3af";
const TEXT_DIM = "#6b7280";

const PRIORITY_CFG: Record<string, { color: string; label: string }> = {
  urgent: { color: RED, label: "Urgent" },
  high: { color: AMBER, label: "High" },
  medium: { color: BLUE, label: "Medium" },
  low: { color: TEXT_DIM, label: "Low" },
};

const CATEGORY_CFG: Record<string, { color: string; label: string }> = {
  distribution: { color: BLUE, label: "Distribution" },
  revenue: { color: GREEN, label: "Revenue" },
  operations: { color: AMBER, label: "Operations" },
  onboarding: { color: PURPLE, label: "Onboarding" },
  content: { color: "#ec4899", label: "Content" },
  finance: { color: "#f97316", label: "Finance" },
};

interface Task {
  id: number;
  title: string;
  hotel_name: string | null;
  assignee: string | null;
  priority: string;
  status: string;
  category: string;
  due_date: string | null;
}

interface Stats {
  totalTasks: number;
  activeTasks: number;
  overdueTasks: number;
  todoTasks: number;
  inProgressTasks: number;
  reviewTasks: number;
  doneTasks: number;
  totalChannels: number;
  liveConnections: number;
  onboardingConnections: number;
  suspendedConnections: number;
  overdueTasks_list: Task[];
  upcomingTasks: Task[];
  teamLoad: Record<string, { todo: number; in_progress: number; review: number; done: number }>;
}

export function RockenueDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [tasksRes, channelsRes, gridRes] = await Promise.all([
          fetch("/api/distribution/tasks").then(r => r.json()),
          fetch("/api/distribution/channels").then(r => r.json()),
          fetch("/api/distribution/grid").then(r => r.json()),
        ]);

        const today = new Date().toISOString().split("T")[0];
        const overdueTasks = tasksRes.filter((t: any) => t.due_date && t.due_date < today && t.status !== "done");
        const upcoming = tasksRes
          .filter((t: any) => t.due_date && t.due_date >= today && t.status !== "done")
          .sort((a: any, b: any) => a.due_date.localeCompare(b.due_date))
          .slice(0, 8);

        let liveCount = 0, onboardingCount = 0, suspendedCount = 0;
        for (const hotelId of Object.keys(gridRes.grid || {})) {
          for (const channelId of Object.keys(gridRes.grid[hotelId] || {})) {
            const s = gridRes.grid[hotelId][channelId];
            if (s === "live") liveCount++;
            else if (s === "onboarding") onboardingCount++;
            else if (s === "suspended") suspendedCount++;
          }
        }

        // Team workload
        const teamLoad: Stats["teamLoad"] = {};
        for (const t of tasksRes) {
          const name = t.assignee || "Unassigned";
          if (!teamLoad[name]) teamLoad[name] = { todo: 0, in_progress: 0, review: 0, done: 0 };
          if (teamLoad[name][t.status as keyof typeof teamLoad[string]] !== undefined) {
            teamLoad[name][t.status as keyof typeof teamLoad[string]]++;
          }
        }

        setStats({
          totalTasks: tasksRes.length,
          activeTasks: tasksRes.filter((t: any) => t.status !== "done").length,
          overdueTasks: overdueTasks.length,
          todoTasks: tasksRes.filter((t: any) => t.status === "todo").length,
          inProgressTasks: tasksRes.filter((t: any) => t.status === "in_progress").length,
          reviewTasks: tasksRes.filter((t: any) => t.status === "review").length,
          doneTasks: tasksRes.filter((t: any) => t.status === "done").length,
          totalChannels: channelsRes.length,
          liveConnections: liveCount,
          onboardingConnections: onboardingCount,
          suspendedConnections: suspendedCount,
          overdueTasks_list: overdueTasks,
          upcomingTasks: upcoming,
          teamLoad,
        });
      } catch (err) {
        console.error("Dashboard load error:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: BG_PAGE, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 size={28} style={{ color: BLUE, animation: "spin 1s linear infinite" }} />
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!stats) return null;

  const kpiCards = [
    { label: "Active Tasks", value: stats.activeTasks, icon: ClipboardList, color: BLUE },
    { label: "Overdue", value: stats.overdueTasks, icon: AlertTriangle, color: stats.overdueTasks > 0 ? RED : GREEN },
    { label: "In Review", value: stats.reviewTasks, icon: Clock, color: PURPLE },
    { label: "Completed", value: stats.doneTasks, icon: CheckCircle, color: GREEN },
    { label: "Live Connections", value: stats.liveConnections, icon: Globe, color: GREEN },
    { label: "Onboarding", value: stats.onboardingConnections, icon: Zap, color: AMBER },
  ];

  const totalGridCells = stats.liveConnections + stats.onboardingConnections + stats.suspendedConnections;
  const coveragePct = totalGridCells > 0 ? Math.round((stats.liveConnections / (totalGridCells + (stats.totalChannels * 21 - totalGridCells - stats.suspendedConnections))) * 100) : 0;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: BG_PAGE, position: "relative", overflow: "hidden", paddingBottom: 64 }}>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom right, rgba(57,189,248,0.01), transparent, rgba(57,189,248,0.01))", pointerEvents: "none" }} />
      <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(57,189,248,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(57,189,248,0.03) 1px, transparent 1px)", backgroundSize: "64px 64px", pointerEvents: "none" }} />

      <div style={{ position: "relative", zIndex: 10, padding: "28px 32px" }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(57,189,248,0.12)" }}>
              <Zap size={18} style={{ color: BLUE }} />
            </div>
            <div>
              <h1 style={{ color: TEXT, fontSize: 20, fontWeight: 600, margin: 0 }}>Rockenue Operations</h1>
              <p style={{ color: TEXT_MID, fontSize: 12, margin: 0 }}>Distribution, CRM & channel management</p>
            </div>
          </div>
        </div>

        {/* ── KPI Cards ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 14, marginBottom: 28 }}>
          {kpiCards.map((card) => (
            <div key={card.label} style={{
              background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "18px 16px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: `${card.color}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <card.icon size={14} style={{ color: card.color }} />
                </div>
                <span style={{ color: TEXT_DIM, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "-0.025em" }}>{card.label}</span>
              </div>
              <div style={{ color: card.color, fontSize: 26, fontWeight: 600 }}>{card.value}</div>
            </div>
          ))}
        </div>

        {/* ── Two Column Layout ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 28 }}>

          {/* ── Overdue Tasks ── */}
          <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "16px 18px 12px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <AlertTriangle size={14} style={{ color: stats.overdueTasks > 0 ? RED : GREEN }} />
                <span style={{ color: TEXT, fontSize: 13, fontWeight: 600 }}>Overdue Tasks</span>
                {stats.overdueTasks > 0 && (
                  <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: `${RED}15`, color: RED, fontWeight: 700 }}>{stats.overdueTasks}</span>
                )}
              </div>
            </div>
            <div style={{ maxHeight: 280, overflowY: "auto" }}>
              {stats.overdueTasks_list.length === 0 ? (
                <div style={{ padding: 32, textAlign: "center", color: TEXT_DIM, fontSize: 12 }}>
                  <CheckCircle size={20} style={{ color: GREEN, margin: "0 auto 8px" }} />
                  No overdue tasks
                </div>
              ) : (
                stats.overdueTasks_list.map((task) => {
                  const pCfg = PRIORITY_CFG[task.priority] || PRIORITY_CFG.medium;
                  const cCfg = CATEGORY_CFG[task.category] || CATEGORY_CFG.operations;
                  return (
                    <div key={task.id} style={{
                      padding: "10px 18px", borderBottom: `1px solid ${BORDER}`,
                      display: "flex", alignItems: "center", gap: 10,
                    }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: pCfg.color, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: TEXT, fontSize: 12, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{task.title}</div>
                        <div style={{ display: "flex", gap: 8, marginTop: 3 }}>
                          <span style={{ color: TEXT_DIM, fontSize: 10 }}>{task.hotel_name || "—"}</span>
                          <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 3, background: `${cCfg.color}15`, color: cCfg.color }}>{cCfg.label}</span>
                        </div>
                      </div>
                      <div style={{ color: RED, fontSize: 10, fontWeight: 600, flexShrink: 0 }}>{task.due_date}</div>
                      <div style={{ color: TEXT_DIM, fontSize: 10, flexShrink: 0 }}>{task.assignee || "—"}</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ── Upcoming Due ── */}
          <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "16px 18px 12px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 8 }}>
              <Clock size={14} style={{ color: BLUE }} />
              <span style={{ color: TEXT, fontSize: 13, fontWeight: 600 }}>Upcoming Due</span>
            </div>
            <div style={{ maxHeight: 280, overflowY: "auto" }}>
              {stats.upcomingTasks.length === 0 ? (
                <div style={{ padding: 32, textAlign: "center", color: TEXT_DIM, fontSize: 12 }}>No upcoming tasks</div>
              ) : (
                stats.upcomingTasks.map((task) => {
                  const pCfg = PRIORITY_CFG[task.priority] || PRIORITY_CFG.medium;
                  const cCfg = CATEGORY_CFG[task.category] || CATEGORY_CFG.operations;
                  return (
                    <div key={task.id} style={{
                      padding: "10px 18px", borderBottom: `1px solid ${BORDER}`,
                      display: "flex", alignItems: "center", gap: 10,
                    }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: pCfg.color, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: TEXT, fontSize: 12, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{task.title}</div>
                        <div style={{ display: "flex", gap: 8, marginTop: 3 }}>
                          <span style={{ color: TEXT_DIM, fontSize: 10 }}>{task.hotel_name || "—"}</span>
                          <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 3, background: `${cCfg.color}15`, color: cCfg.color }}>{cCfg.label}</span>
                        </div>
                      </div>
                      <div style={{ color: TEXT_MID, fontSize: 10, fontWeight: 500, flexShrink: 0 }}>{task.due_date}</div>
                      <div style={{ color: TEXT_DIM, fontSize: 10, flexShrink: 0 }}>{task.assignee || "—"}</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ── Team Workload ── */}
        <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 0, overflow: "hidden", marginBottom: 28 }}>
          <div style={{ padding: "16px 18px 12px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 8 }}>
            <Users size={14} style={{ color: BLUE }} />
            <span style={{ color: TEXT, fontSize: 13, fontWeight: 600 }}>Team Workload</span>
          </div>
          <div style={{ padding: "4px 0" }}>
            {/* Header */}
            <div style={{ display: "grid", gridTemplateColumns: "140px 1fr 60px 60px 60px 60px", padding: "8px 18px", gap: 8 }}>
              <span style={{ color: TEXT_DIM, fontSize: 10, fontWeight: 600, textTransform: "uppercase" }}>Person</span>
              <span style={{ color: TEXT_DIM, fontSize: 10, fontWeight: 600, textTransform: "uppercase" }}>Distribution</span>
              <span style={{ color: TEXT_MID, fontSize: 10, fontWeight: 600, textTransform: "uppercase", textAlign: "center" }}>To Do</span>
              <span style={{ color: BLUE, fontSize: 10, fontWeight: 600, textTransform: "uppercase", textAlign: "center" }}>Active</span>
              <span style={{ color: PURPLE, fontSize: 10, fontWeight: 600, textTransform: "uppercase", textAlign: "center" }}>Review</span>
              <span style={{ color: GREEN, fontSize: 10, fontWeight: 600, textTransform: "uppercase", textAlign: "center" }}>Done</span>
            </div>
            {Object.entries(stats.teamLoad).sort(([, a], [, b]) => (b.todo + b.in_progress + b.review) - (a.todo + a.in_progress + a.review)).map(([name, counts]) => {
              const total = counts.todo + counts.in_progress + counts.review + counts.done;
              const activeWidth = total > 0 ? ((counts.todo + counts.in_progress + counts.review) / total) * 100 : 0;
              return (
                <div key={name} style={{ display: "grid", gridTemplateColumns: "140px 1fr 60px 60px 60px 60px", padding: "10px 18px", gap: 8, alignItems: "center", borderTop: `1px solid ${BORDER}` }}>
                  <span style={{ color: TEXT, fontSize: 12, fontWeight: 500 }}>{name}</span>
                  <div style={{ height: 6, borderRadius: 3, background: INPUT_BG, overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 3, width: `${activeWidth}%`, background: `linear-gradient(90deg, ${BLUE}, ${PURPLE})`, transition: "width 0.3s" }} />
                  </div>
                  <span style={{ color: TEXT_MID, fontSize: 12, fontWeight: 600, textAlign: "center" }}>{counts.todo}</span>
                  <span style={{ color: BLUE, fontSize: 12, fontWeight: 600, textAlign: "center" }}>{counts.in_progress}</span>
                  <span style={{ color: PURPLE, fontSize: 12, fontWeight: 600, textAlign: "center" }}>{counts.review}</span>
                  <span style={{ color: GREEN, fontSize: 12, fontWeight: 600, textAlign: "center" }}>{counts.done}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Distribution Health ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "18px" }}>
            <div style={{ color: TEXT_DIM, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "-0.025em", marginBottom: 10 }}>Channels Active</div>
            <div style={{ color: BLUE, fontSize: 32, fontWeight: 600, marginBottom: 4 }}>{stats.totalChannels}</div>
            <div style={{ color: TEXT_DIM, fontSize: 11 }}>OTA & direct partners</div>
          </div>
          <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "18px" }}>
            <div style={{ color: TEXT_DIM, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "-0.025em", marginBottom: 10 }}>Live Connections</div>
            <div style={{ color: GREEN, fontSize: 32, fontWeight: 600, marginBottom: 4 }}>{stats.liveConnections}</div>
            <div style={{ color: TEXT_DIM, fontSize: 11 }}>{stats.suspendedConnections} suspended</div>
          </div>
          <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "18px" }}>
            <div style={{ color: TEXT_DIM, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "-0.025em", marginBottom: 10 }}>Onboarding</div>
            <div style={{ color: AMBER, fontSize: 32, fontWeight: 600, marginBottom: 4 }}>{stats.onboardingConnections}</div>
            <div style={{ color: TEXT_DIM, fontSize: 11 }}>hotel×channel setups in progress</div>
          </div>
        </div>

      </div>
    </div>
  );
}
