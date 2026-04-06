import { useState, useMemo, useRef, useEffect, useCallback, createContext, useContext } from "react";
import {
  Search,
  Plus,
  X,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Filter,
  MoreHorizontal,
  Calendar,
  MessageSquare,
  Paperclip,
  ChevronDown,
  ChevronRight,
  Building2,
  User,
  Tag,
  Flag,
  Eye,
  GripVertical,
  ArrowRight,
  Send,
  Link,
  History,
  Edit3,
  Globe,
  Loader2,
  ClipboardList,
} from "lucide-react";
import { useCrmTasks } from "../hooks/useCrmTasks";
import {
  fetchComments,
  addComment,
  fetchSubtasks,
  addSubtask,
  updateSubtask,
  fetchTeam,
} from "../api/distribution.api";
import type {
  CrmTask,
  CrmTaskComment,
  CrmTaskSubtask,
  Priority,
  TaskStatus,
  TaskCategory,
  TeamMember,
} from "../api/types";

// ── Brand palette ──
const BLUE = "#39BDF8";
const GREEN = "#10b981";
const AMBER = "#f59e0b";
const RED = "#ef4444";
const PURPLE = "#8b5cf6";
const BG_PAGE = "#1d1d1c";
const CARD_BG = "#1a1a1a";
const INPUT_BG = "#2C2C2C";
const BORDER = "#2a2a2a";
const TEXT = "#e5e5e5";
const TEXT_MID = "#9ca3af";
const TEXT_DIM = "#6b7280";

const OTA_CHANNELS_LIST = [
  "Booking.com", "Expedia", "Agoda", "Hotelbeds", "Trip.com", "HRS",
  "Stuba", "WebBeds", "CN Travel", "Direct", "Google Hotels", "Trivago",
];

// ── Config ──
const PRIORITY_CFG: Record<Priority, { color: string; label: string }> = {
  urgent: { color: RED, label: "Urgent" },
  high: { color: AMBER, label: "High" },
  medium: { color: BLUE, label: "Medium" },
  low: { color: TEXT_DIM, label: "Low" },
};

const STATUS_COLUMNS: { key: TaskStatus; label: string; color: string }[] = [
  { key: "todo", label: "To Do", color: TEXT_MID },
  { key: "in_progress", label: "In Progress", color: BLUE },
  { key: "review", label: "Review", color: PURPLE },
  { key: "done", label: "Done", color: GREEN },
];

const CATEGORY_CFG: Record<TaskCategory, { color: string; label: string }> = {
  distribution: { color: BLUE, label: "Distribution" },
  revenue: { color: GREEN, label: "Revenue" },
  operations: { color: AMBER, label: "Operations" },
  onboarding: { color: PURPLE, label: "Onboarding" },
  content: { color: "#ec4899", label: "Content" },
  finance: { color: "#f97316", label: "Finance" },
};

const TEAM_COLORS = [BLUE, GREEN, PURPLE, AMBER, "#ec4899", "#f97316", RED];

function buildTeamDisplay(members: TeamMember[]) {
  return members.map((m, i) => ({
    name: m.first_name,
    fullName: `${m.first_name} ${m.last_name}`,
    initials: `${m.first_name.charAt(0)}${m.last_name.charAt(0)}`.toUpperCase(),
    color: TEAM_COLORS[i % TEAM_COLORS.length],
    role: m.role === "super_admin" ? "Super Admin" : "Admin",
    email: m.email,
  }));
}

type TeamDisplay = ReturnType<typeof buildTeamDisplay>;
const TeamContext = createContext<TeamDisplay>([]);
function useTeam() { return useContext(TeamContext); }

// ── View mode ──
type ViewMode = "board" | "hotel" | "user";

interface CrmBoardProps {
  initialFilter?: { hotel_id?: number; channel_id?: number } | null;
  onClearFilter?: () => void;
}

export function CrmBoard({ initialFilter, onClearFilter }: CrmBoardProps) {
  const { tasks, loading, createTask, updateTask, deleteTask, refresh } = useCrmTasks(
    initialFilter ? { hotel_id: initialFilter.hotel_id, channel_id: initialFilter.channel_id } : undefined
  );

  const [teamMembers, setTeamMembers] = useState<ReturnType<typeof buildTeamDisplay>>([]);
  useEffect(() => {
    fetchTeam().then((members) => setTeamMembers(buildTeamDisplay(members))).catch(console.error);
  }, []);

  const [viewMode, setViewMode] = useState<ViewMode>("board");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<TaskCategory | "all">("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "all">("all");
  const [showNewTask, setShowNewTask] = useState(false);
  const [expandedHotel, setExpandedHotel] = useState<string | null>(null);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);

  const selectedTask = useMemo(() => tasks.find((t) => t.id === selectedTaskId) || null, [tasks, selectedTaskId]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (search && !t.title.toLowerCase().includes(search.toLowerCase()) && !(t.hotel_name || "").toLowerCase().includes(search.toLowerCase())) return false;
      if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
      if (assigneeFilter !== "all" && t.assignee !== assigneeFilter) return false;
      if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
      return true;
    });
  }, [tasks, search, categoryFilter, assigneeFilter, priorityFilter]);

  // Derive unique hotel names from tasks for the "By Hotel" view
  const hotelNames = useMemo(() => {
    const names = new Set<string>();
    tasks.forEach((t) => { if (t.hotel_name) names.add(t.hotel_name); });
    return Array.from(names).sort();
  }, [tasks]);

  const todayStr = new Date().toISOString().split("T")[0];

  if (loading) {
    return (
      <div style={{ padding: "32px 32px 64px", display: "flex", justifyContent: "center", alignItems: "center", minHeight: 300 }}>
        <Loader2 size={28} style={{ color: BLUE, animation: "spin 1s linear infinite" }} />
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <TeamContext.Provider value={teamMembers}>
    <div style={{ minHeight: "100vh", backgroundColor: "#1d1d1c", position: "relative", overflow: "hidden", paddingBottom: 64 }}>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom right, rgba(57,189,248,0.01), transparent, rgba(57,189,248,0.01))", pointerEvents: "none" }} />
      <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(57,189,248,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(57,189,248,0.03) 1px, transparent 1px)", backgroundSize: "64px 64px", pointerEvents: "none" }} />

      <div style={{ position: "relative", zIndex: 10, padding: "28px 32px" }}>

      {/* ── Page Header ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(57,189,248,0.12)" }}>
              <ClipboardList size={18} style={{ color: BLUE }} />
            </div>
            <div>
              <h1 style={{ color: TEXT, fontSize: 20, fontWeight: 600, margin: 0 }}>CRM</h1>
              <p style={{ color: TEXT_MID, fontSize: 12, margin: 0 }}>Task management & operations</p>
            </div>
          </div>
          <button onClick={() => setShowNewTask(true)} style={{
            display: "flex", alignItems: "center", gap: 6, padding: "9px 20px", borderRadius: 8,
            border: "none", background: BLUE, color: "#000",
            fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}>
            <Plus size={14} /> New Task
          </button>
        </div>
      </div>

      {/* ── Pipeline filter banner ── */}
      {initialFilter && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", marginBottom: 16,
          background: `${BLUE}08`, border: `1px solid ${BLUE}25`, borderRadius: 8,
        }}>
          <Filter size={13} style={{ color: BLUE }} />
          <span style={{ color: TEXT_MID, fontSize: 12 }}>
            Filtered from pipeline view
            {initialFilter.hotel_id && <> &middot; Hotel #{initialFilter.hotel_id}</>}
            {initialFilter.channel_id && <> &middot; Channel #{initialFilter.channel_id}</>}
          </span>
          {onClearFilter && (
            <button onClick={onClearFilter} style={{
              marginLeft: "auto", display: "flex", alignItems: "center", gap: 4,
              padding: "4px 10px", borderRadius: 5, border: `1px solid ${BORDER}`,
              background: INPUT_BG, color: TEXT_DIM, fontSize: 11, cursor: "pointer",
            }}>
              <X size={11} /> Clear
            </button>
          )}
        </div>
      )}

      {/* ── Toolbar ── */}
      <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", background: INPUT_BG, borderRadius: 8, border: `1px solid ${BORDER}`, overflow: "hidden" }}>
          {([
            { key: "board" as ViewMode, label: "Board", icon: <LayoutIcon /> },
            { key: "hotel" as ViewMode, label: "By Hotel", icon: <Building2 size={12} /> },
            { key: "user" as ViewMode, label: "By Person", icon: <User size={12} /> },
          ]).map((v) => (
            <button key={v.key} onClick={() => setViewMode(v.key)} style={{
              display: "flex", alignItems: "center", gap: 5, padding: "7px 14px",
              border: "none", background: viewMode === v.key ? `${BLUE}15` : "transparent",
              color: viewMode === v.key ? BLUE : TEXT_DIM,
              fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
              borderRight: `1px solid ${BORDER}`,
            }}>
              {v.icon} {v.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        <div style={{ position: "relative", width: 200 }}>
          <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: TEXT_DIM }} />
          <input type="text" placeholder="Search tasks..." value={search} onChange={(e) => setSearch(e.target.value)}
            style={{ width: "100%", padding: "7px 10px 7px 30px", background: INPUT_BG, border: `1px solid ${BORDER}`, borderRadius: 6, color: TEXT, fontSize: 12, outline: "none" }} />
        </div>

        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as any)}
          style={{ padding: "7px 10px", background: INPUT_BG, border: `1px solid ${BORDER}`, borderRadius: 6, color: TEXT, fontSize: 12, outline: "none", cursor: "pointer" }}>
          <option value="all">All Categories</option>
          {Object.entries(CATEGORY_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>

        <select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)}
          style={{ padding: "7px 10px", background: INPUT_BG, border: `1px solid ${BORDER}`, borderRadius: 6, color: TEXT, fontSize: 12, outline: "none", cursor: "pointer" }}>
          <option value="all">All People</option>
          {teamMembers.map((m) => <option key={m.name} value={m.name}>{m.name}</option>)}
        </select>

        <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as any)}
          style={{ padding: "7px 10px", background: INPUT_BG, border: `1px solid ${BORDER}`, borderRadius: 6, color: TEXT, fontSize: 12, outline: "none", cursor: "pointer" }}>
          <option value="all">All Priorities</option>
          {Object.entries(PRIORITY_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* ── Board View (Kanban) ── */}
      {viewMode === "board" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, alignItems: "start" }}>
          {STATUS_COLUMNS.map((col) => {
            const colTasks = filteredTasks.filter((t) => t.status === col.key);
            return (
              <div key={col.key}>
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "18px 16px", marginBottom: 12, borderRadius: 10,
                  background: `${col.color}08`, border: `1px solid ${col.color}20`,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: col.color }} />
                    <span style={{ color: TEXT, fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: "-0.01em" }}>{col.label}</span>
                  </div>
                  <span style={{ color: col.color, fontSize: 13, fontWeight: 700, background: `${col.color}15`, padding: "4px 12px", borderRadius: 10 }}>
                    {colTasks.length}
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {colTasks.map((task) => <TaskCard key={task.id} task={task} onClick={() => setSelectedTaskId(task.id)} />)}
                  {colTasks.length === 0 && (
                    <div style={{ padding: "40px 16px", textAlign: "center", color: TEXT_DIM, fontSize: 12, border: `1px dashed ${BORDER}`, borderRadius: 8 }}>
                      No tasks
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Hotel View ── */}
      {viewMode === "hotel" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{
            display: "grid", gridTemplateColumns: "260px 1fr 100px 100px 110px 100px",
            padding: "10px 16px", backgroundColor: "#222222", borderRadius: "8px 8px 0 0",
            border: `1px solid ${BORDER}`, borderBottom: "none",
          }}>
            {["Property", "Task", "Category", "Priority", "Assignee", "Due Date"].map((h) => (
              <span key={h} style={{ color: TEXT_DIM, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" }}>{h}</span>
            ))}
          </div>
          {hotelNames.map((hotel) => {
            const hotelTasks = filteredTasks.filter((t) => t.hotel_name === hotel && t.status !== "done");
            if (hotelTasks.length === 0) return null;
            const isExpanded = expandedHotel === hotel;
            return (
              <div key={hotel} style={{ backgroundColor: CARD_BG, border: `1px solid ${BORDER}`, borderBottom: "none" }}>
                <div onClick={() => setExpandedHotel(isExpanded ? null : hotel)}
                  style={{ display: "grid", gridTemplateColumns: "260px 1fr 100px", padding: "12px 16px", cursor: "pointer", transition: "background 0.12s", alignItems: "center" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(57,189,248,0.025)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <ChevronDown size={14} style={{ color: TEXT_DIM, transform: isExpanded ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.15s" }} />
                    <Building2 size={14} style={{ color: BLUE }} />
                    <span style={{ color: TEXT, fontSize: 13, fontWeight: 600 }}>{hotel}</span>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {Object.entries(CATEGORY_CFG).map(([cat, cfg]) => {
                      const count = hotelTasks.filter((t) => t.category === cat).length;
                      if (!count) return null;
                      return <span key={cat} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: `${cfg.color}15`, color: cfg.color, fontWeight: 500 }}>{cfg.label} {count}</span>;
                    })}
                  </div>
                  <span style={{ color: TEXT_DIM, fontSize: 12, textAlign: "right" }}>{hotelTasks.length} task{hotelTasks.length !== 1 ? "s" : ""}</span>
                </div>
                {isExpanded && hotelTasks.map((task, i) => {
                  const pCfg = PRIORITY_CFG[task.priority];
                  const cCfg = CATEGORY_CFG[task.category];
                  const isOverdue = task.due_date ? task.due_date < todayStr : false;
                  return (
                    <div key={task.id} onClick={() => setSelectedTaskId(task.id)} style={{
                      display: "grid", gridTemplateColumns: "260px 1fr 100px 100px 110px 100px",
                      padding: "10px 16px 10px 52px", alignItems: "center",
                      borderTop: `1px solid ${BORDER}`, background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
                      transition: "background 0.12s", cursor: "pointer",
                    }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(57,189,248,0.03)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)")}>
                      <span style={{ color: TEXT_DIM, fontSize: 11 }}>CRM-{task.id}</span>
                      <div>
                        <span style={{ color: TEXT, fontSize: 12, fontWeight: 500 }}>{task.title}</span>
                        {task.tags.length > 0 && (
                          <div style={{ display: "flex", gap: 4, marginTop: 3 }}>
                            {task.tags.slice(0, 2).map((tag) => <span key={tag} style={{ fontSize: 9, padding: "1px 6px", borderRadius: 3, background: BORDER, color: TEXT_DIM }}>{tag}</span>)}
                          </div>
                        )}
                      </div>
                      <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: `${cCfg.color}15`, color: cCfg.color, fontWeight: 500, width: "fit-content" }}>{cCfg.label}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: pCfg.color }} />
                        <span style={{ color: pCfg.color, fontSize: 11 }}>{pCfg.label}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Avatar name={task.assignee || "?"} size={20} />
                        <span style={{ color: TEXT_MID, fontSize: 11 }}>{task.assignee || "Unassigned"}</span>
                      </div>
                      <span style={{ color: isOverdue ? RED : TEXT_DIM, fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
                        {isOverdue && <AlertTriangle size={10} />}
                        {task.due_date ? formatDate(task.due_date) : "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })}
          <div style={{ borderBottom: `1px solid ${BORDER}`, borderRadius: "0 0 8px 8px" }} />
        </div>
      )}

      {/* ── User View ── */}
      {viewMode === "user" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {teamMembers.map((member) => {
            const memberTasks = filteredTasks.filter((t) => t.assignee === member.name && t.status !== "done");
            const isExpanded = expandedUser === member.name || expandedUser === null;
            const statusCounts = STATUS_COLUMNS.filter((s) => s.key !== "done").map((s) => ({
              ...s, count: memberTasks.filter((t) => t.status === s.key).length,
            }));
            return (
              <div key={member.name} style={{ backgroundColor: CARD_BG, borderRadius: 10, border: `1px solid ${BORDER}`, overflow: "hidden" }}>
                <div onClick={() => setExpandedUser(expandedUser === member.name ? "" : member.name)}
                  style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 20px", cursor: "pointer", transition: "background 0.12s", borderBottom: isExpanded && memberTasks.length > 0 ? `1px solid ${BORDER}` : "none" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(57,189,248,0.025)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                  <ChevronDown size={14} style={{ color: TEXT_DIM, transform: isExpanded ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.15s" }} />
                  <Avatar name={member.name} size={34} />
                  <div style={{ flex: 1 }}>
                    <div style={{ color: TEXT, fontSize: 14, fontWeight: 600 }}>{member.name}</div>
                    <div style={{ color: TEXT_DIM, fontSize: 11 }}>{member.role}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {statusCounts.map((s) => (
                      <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 6, background: s.count > 0 ? `${s.color}10` : "transparent", border: `1px solid ${s.count > 0 ? s.color + "25" : BORDER}` }}>
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: s.count > 0 ? s.color : TEXT_DIM }} />
                        <span style={{ color: s.count > 0 ? s.color : TEXT_DIM, fontSize: 10, fontWeight: 600 }}>{s.count}</span>
                        <span style={{ color: TEXT_DIM, fontSize: 10 }}>{s.label}</span>
                      </div>
                    ))}
                  </div>
                  <span style={{ color: TEXT_MID, fontSize: 12, fontWeight: 600 }}>{memberTasks.length} tasks</span>
                </div>
                {isExpanded && memberTasks.length > 0 && (
                  <div>
                    <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 140px 100px 90px 90px", padding: "8px 20px", background: "#222222" }}>
                      {["ID", "Task", "Property", "Category", "Priority", "Due"].map((h) => (
                        <span key={h} style={{ color: TEXT_DIM, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" }}>{h}</span>
                      ))}
                    </div>
                    {memberTasks
                      .sort((a, b) => {
                        const po: Record<Priority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
                        return po[a.priority] - po[b.priority] || (a.due_date || "").localeCompare(b.due_date || "");
                      })
                      .map((task, i) => {
                        const pCfg = PRIORITY_CFG[task.priority];
                        const cCfg = CATEGORY_CFG[task.category];
                        const isOverdue = task.due_date ? task.due_date < todayStr : false;
                        const sCfg = STATUS_COLUMNS.find((s) => s.key === task.status)!;
                        const hotelDisplay = task.hotel_name || "—";
                        return (
                          <div key={task.id} onClick={() => setSelectedTaskId(task.id)} style={{
                            display: "grid", gridTemplateColumns: "80px 1fr 140px 100px 90px 90px",
                            padding: "10px 20px", alignItems: "center", borderTop: `1px solid ${BORDER}`,
                            background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
                            transition: "background 0.12s", cursor: "pointer",
                          }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(57,189,248,0.03)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)")}>
                            <span style={{ color: TEXT_DIM, fontSize: 11, fontFamily: "monospace" }}>CRM-{task.id}</span>
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <div style={{ width: 8, height: 8, borderRadius: "50%", background: sCfg.color, flexShrink: 0 }} />
                                <span style={{ color: TEXT, fontSize: 12, fontWeight: 500 }}>{task.title}</span>
                              </div>
                              {(task.comment_count > 0 || task.subtask_total > 0) && (
                                <div style={{ display: "flex", gap: 10, marginTop: 4, marginLeft: 16 }}>
                                  {task.subtask_total > 0 && <span style={{ color: TEXT_DIM, fontSize: 10, display: "flex", alignItems: "center", gap: 3 }}><CheckCircle2 size={9} /> {task.subtask_done}/{task.subtask_total}</span>}
                                  {task.comment_count > 0 && <span style={{ color: TEXT_DIM, fontSize: 10, display: "flex", alignItems: "center", gap: 3 }}><MessageSquare size={9} /> {task.comment_count}</span>}
                                </div>
                              )}
                            </div>
                            <span style={{ color: TEXT_MID, fontSize: 11 }}>{hotelDisplay.length > 18 ? hotelDisplay.slice(0, 18) + "\u2026" : hotelDisplay}</span>
                            <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: `${cCfg.color}15`, color: cCfg.color, fontWeight: 500, width: "fit-content" }}>{cCfg.label}</span>
                            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                              <div style={{ width: 6, height: 6, borderRadius: "50%", background: pCfg.color }} />
                              <span style={{ color: pCfg.color, fontSize: 11 }}>{pCfg.label}</span>
                            </div>
                            <span style={{ color: isOverdue ? RED : TEXT_DIM, fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
                              {isOverdue && <AlertTriangle size={10} />}
                              {task.due_date ? formatDate(task.due_date) : "—"}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                )}
                {isExpanded && memberTasks.length === 0 && (
                  <div style={{ padding: "24px 20px", textAlign: "center", color: TEXT_DIM, fontSize: 12 }}>No open tasks</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* TASK DETAIL PANEL — Jira-style slide-out    */}
      {/* ═══════════════════════════════════════════ */}
      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          onClose={() => setSelectedTaskId(null)}
          onUpdateTask={updateTask}
          onRefresh={refresh}
        />
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* CREATE TASK — Jira/Monday-style             */}
      {/* ═══════════════════════════════════════════ */}
      {showNewTask && (
        <CreateTaskPanel
          onClose={() => setShowNewTask(false)}
          onCreateTask={createTask}
          hotelNames={hotelNames}
        />
      )}
      </div>
    </div>
    </TeamContext.Provider>
  );
}


// ═══════════════════════════════════════════════════
// TASK DETAIL PANEL (Jira-style slide-out)
// ═══════════════════════════════════════════════════

function TaskDetailPanel({
  task,
  onClose,
  onUpdateTask,
  onRefresh,
}: {
  task: CrmTask;
  onClose: () => void;
  onUpdateTask: (id: number, data: Record<string, unknown>) => Promise<CrmTask>;
  onRefresh: () => Promise<void>;
}) {
  const [activeTab, setActiveTab] = useState<"details" | "activity">("details");
  const panelRef = useRef<HTMLDivElement>(null);
  const pCfg = PRIORITY_CFG[task.priority];
  const cCfg = CATEGORY_CFG[task.category];
  const sCfg = STATUS_COLUMNS.find((s) => s.key === task.status)!;
  const team = useTeam();
  const member = team.find((m) => m.name === task.assignee);
  const todayStr = new Date().toISOString().split("T")[0];
  const isOverdue = task.status !== "done" && task.due_date ? task.due_date < todayStr : false;

  // Comments & activity from API
  const [comments, setComments] = useState<CrmTaskComment[]>([]);
  const [subtasks, setSubtasks] = useState<CrmTaskSubtask[]>([]);
  const [commentText, setCommentText] = useState("");
  const [newSubtaskText, setNewSubtaskText] = useState("");
  const [loadingComments, setLoadingComments] = useState(true);
  const [loadingSubtasks, setLoadingSubtasks] = useState(true);

  // Fetch comments and subtasks on mount
  useEffect(() => {
    setLoadingComments(true);
    fetchComments(task.id).then((c) => { setComments(c); setLoadingComments(false); }).catch(() => setLoadingComments(false));
  }, [task.id]);

  useEffect(() => {
    setLoadingSubtasks(true);
    fetchSubtasks(task.id).then((s) => { setSubtasks(s); setLoadingSubtasks(false); }).catch(() => setLoadingSubtasks(false));
  }, [task.id]);

  const detailComments = useMemo(() => comments.filter((c) => c.type === "comment"), [comments]);
  const activityItems = useMemo(() => comments.filter((c) => c.type === "activity"), [comments]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  async function handleStatusChange(newStatus: TaskStatus) {
    await onUpdateTask(task.id, { status: newStatus, updated_by: "Karol" });
    await onRefresh();
  }

  async function handleSubmitComment() {
    if (!commentText.trim()) return;
    await addComment(task.id, { author: "Karol", body: commentText.trim(), type: "comment" });
    setCommentText("");
    const c = await fetchComments(task.id);
    setComments(c);
    await onRefresh();
  }

  async function handleToggleSubtask(st: CrmTaskSubtask) {
    await updateSubtask(st.id, { done: !st.done });
    const s = await fetchSubtasks(task.id);
    setSubtasks(s);
    await onRefresh();
  }

  async function handleAddSubtask() {
    if (!newSubtaskText.trim()) return;
    await addSubtask(task.id, { text: newSubtaskText.trim() });
    setNewSubtaskText("");
    const s = await fetchSubtasks(task.id);
    setSubtasks(s);
    await onRefresh();
  }

  const subtaskDone = subtasks.filter((s) => s.done).length;
  const subtaskTotal = subtasks.length;

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50, transition: "opacity 0.2s" }} />

      {/* Panel */}
      <div ref={panelRef} style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: 680,
        background: BG_PAGE, borderLeft: `1px solid ${BORDER}`, zIndex: 51,
        display: "flex", flexDirection: "column", boxShadow: "-8px 0 40px rgba(0,0,0,0.4)",
        animation: "slideInRight 0.2s ease-out",
      }}>
        {/* Header */}
        <div style={{ padding: "18px 24px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <span style={{ color: TEXT_DIM, fontSize: 13, fontFamily: "monospace", fontWeight: 600 }}>CRM-{task.id}</span>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={{ background: "none", border: "none", color: TEXT_DIM, cursor: "pointer", padding: 4, borderRadius: 4 }}
            onMouseEnter={(e) => (e.currentTarget.style.background = `${BORDER}`)}
            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}>
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>

          {/* Title */}
          <h2 style={{ color: TEXT, fontSize: 20, fontWeight: 600, margin: "0 0 20px 0", lineHeight: 1.35 }}>{task.title}</h2>

          {/* Status bar — inline fields like Jira */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 28 }}>
            {/* Status */}
            <DetailField label="Status">
              <select
                value={task.status}
                onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
                style={{
                  padding: "5px 12px", borderRadius: 6, background: `${sCfg.color}12`,
                  border: `1px solid ${sCfg.color}30`, color: sCfg.color,
                  fontSize: 12, fontWeight: 600, cursor: "pointer", outline: "none",
                  appearance: "auto",
                }}
              >
                {STATUS_COLUMNS.map((s) => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>
            </DetailField>

            {/* Priority */}
            <DetailField label="Priority">
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 6, background: `${pCfg.color}12`, border: `1px solid ${pCfg.color}30` }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: pCfg.color }} />
                <span style={{ color: pCfg.color, fontSize: 12, fontWeight: 600 }}>{pCfg.label}</span>
              </div>
            </DetailField>

            {/* Assignee */}
            <DetailField label="Assignee">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Avatar name={task.assignee || "?"} size={26} />
                <div>
                  <div style={{ color: TEXT, fontSize: 12, fontWeight: 600 }}>{task.assignee || "Unassigned"}</div>
                  {member && <div style={{ color: TEXT_DIM, fontSize: 10 }}>{member.role}</div>}
                </div>
              </div>
            </DetailField>

            {/* Due Date */}
            <DetailField label="Due Date">
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Calendar size={13} style={{ color: isOverdue ? RED : TEXT_DIM }} />
                <span style={{ color: isOverdue ? RED : TEXT, fontSize: 12, fontWeight: isOverdue ? 600 : 400 }}>
                  {task.due_date ? formatDateLong(task.due_date) : "No date"}
                </span>
                {isOverdue && <span style={{ color: RED, fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 4, background: `${RED}15` }}>OVERDUE</span>}
              </div>
            </DetailField>

            {/* Property */}
            <DetailField label="Property">
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Building2 size={13} style={{ color: BLUE }} />
                <span style={{ color: TEXT, fontSize: 12 }}>{task.hotel_name || "—"}</span>
              </div>
            </DetailField>

            {/* Category */}
            <DetailField label="Category">
              <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 5, background: `${cCfg.color}12`, color: cCfg.color, fontWeight: 600 }}>{cCfg.label}</span>
            </DetailField>
          </div>

          {/* Tags */}
          {task.tags.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ color: TEXT_DIM, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>Tags</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {task.tags.map((tag) => (
                  <span key={tag} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 5, background: INPUT_BG, color: TEXT_MID, border: `1px solid ${BORDER}` }}>{tag}</span>
                ))}
              </div>
            </div>
          )}

          {/* Tabs: Details / Activity */}
          <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${BORDER}`, marginBottom: 20 }}>
            {(["details", "activity"] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                padding: "10px 20px", border: "none", cursor: "pointer",
                background: "transparent", color: activeTab === tab ? BLUE : TEXT_DIM,
                fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.02em",
                borderBottom: activeTab === tab ? `2px solid ${BLUE}` : "2px solid transparent",
                transition: "all 0.15s",
              }}>
                {tab === "details" ? "Details" : `Activity (${activityItems.length})`}
              </button>
            ))}
          </div>

          {/* Details Tab */}
          {activeTab === "details" && (
            <div>
              {/* Description */}
              {task.description && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ color: TEXT_DIM, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>Description</div>
                  <div style={{
                    color: TEXT_MID, fontSize: 13, lineHeight: 1.65, padding: "14px 16px",
                    background: CARD_BG, borderRadius: 8, border: `1px solid ${BORDER}`,
                    whiteSpace: "pre-wrap",
                  }}>
                    {task.description}
                  </div>
                </div>
              )}

              {/* Subtasks */}
              {!loadingSubtasks && subtaskTotal > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <div style={{ color: TEXT_DIM, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      Subtasks
                    </div>
                    <span style={{ color: TEXT_DIM, fontSize: 11 }}>{subtaskDone}/{subtaskTotal}</span>
                  </div>
                  {/* Progress bar */}
                  <div style={{ height: 4, background: BORDER, borderRadius: 2, marginBottom: 12, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${(subtaskDone / subtaskTotal) * 100}%`, background: subtaskDone === subtaskTotal ? GREEN : BLUE, borderRadius: 2, transition: "width 0.3s" }} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {subtasks.map((st) => (
                      <div key={st.id} onClick={() => handleToggleSubtask(st)} style={{
                        display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
                        borderRadius: 6, cursor: "pointer", transition: "background 0.12s",
                      }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(57,189,248,0.025)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                        <div style={{
                          width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                          border: st.done ? `2px solid ${GREEN}` : `2px solid ${TEXT_DIM}`,
                          background: st.done ? `${GREEN}15` : "transparent",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          {st.done && <CheckCircle2 size={12} style={{ color: GREEN }} />}
                        </div>
                        <span style={{ color: st.done ? TEXT_DIM : TEXT, fontSize: 12, textDecoration: st.done ? "line-through" : "none" }}>{st.text}</span>
                      </div>
                    ))}
                  </div>
                  {/* Add subtask */}
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <input
                      value={newSubtaskText}
                      onChange={(e) => setNewSubtaskText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleAddSubtask(); }}
                      placeholder="Add subtask..."
                      style={{
                        flex: 1, padding: "6px 10px", background: INPUT_BG,
                        border: `1px solid ${BORDER}`, borderRadius: 6, color: TEXT, fontSize: 12, outline: "none",
                      }}
                    />
                    <button onClick={handleAddSubtask} style={{
                      padding: "6px 12px", borderRadius: 6, border: "none",
                      background: `${BLUE}15`, color: BLUE, fontSize: 11, fontWeight: 600, cursor: "pointer",
                    }}>Add</button>
                  </div>
                </div>
              )}

              {/* Add subtask when none exist */}
              {!loadingSubtasks && subtaskTotal === 0 && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ color: TEXT_DIM, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>Subtasks</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      value={newSubtaskText}
                      onChange={(e) => setNewSubtaskText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleAddSubtask(); }}
                      placeholder="Add subtask..."
                      style={{
                        flex: 1, padding: "6px 10px", background: INPUT_BG,
                        border: `1px solid ${BORDER}`, borderRadius: 6, color: TEXT, fontSize: 12, outline: "none",
                      }}
                    />
                    <button onClick={handleAddSubtask} style={{
                      padding: "6px 12px", borderRadius: 6, border: "none",
                      background: `${BLUE}15`, color: BLUE, fontSize: 11, fontWeight: 600, cursor: "pointer",
                    }}>Add</button>
                  </div>
                </div>
              )}

              {/* Attachments count (default 0, not tracked in DB yet) */}
              {false && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ color: TEXT_DIM, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>Attachments</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: CARD_BG, borderRadius: 8, border: `1px solid ${BORDER}` }}>
                    <Paperclip size={14} style={{ color: TEXT_DIM }} />
                    <span style={{ color: TEXT_MID, fontSize: 12 }}>0 files attached</span>
                  </div>
                </div>
              )}

              {/* Comments in Details tab */}
              {detailComments.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ color: TEXT_DIM, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>Comments</div>
                  {detailComments.map((c) => (
                    <div key={c.id} style={{ marginBottom: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <Avatar name={c.author} size={22} />
                        <span style={{ color: TEXT, fontSize: 12, fontWeight: 600 }}>{c.author}</span>
                        <span style={{ color: TEXT_DIM, fontSize: 10 }}>{c.created_at}</span>
                      </div>
                      <div style={{
                        padding: "10px 14px", background: CARD_BG, borderRadius: 8,
                        border: `1px solid ${BORDER}`, color: TEXT_MID, fontSize: 12, lineHeight: 1.55,
                      }}>
                        {c.body}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Dates */}
              <div style={{ display: "flex", gap: 24, color: TEXT_DIM, fontSize: 11 }}>
                <span>Created {formatDateLong(task.created_at)}</span>
              </div>
            </div>
          )}

          {/* Activity Tab */}
          {activeTab === "activity" && (
            <div>
              {/* Comment box */}
              <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
                <Avatar name="Karol" size={28} />
                <div style={{ flex: 1, position: "relative" }}>
                  <input
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleSubmitComment(); }}
                    placeholder="Write a comment..."
                    style={{
                      width: "100%", padding: "10px 42px 10px 14px", background: CARD_BG,
                      border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT, fontSize: 12, outline: "none",
                    }}
                  />
                  <button onClick={handleSubmitComment} style={{
                    position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", color: BLUE, cursor: "pointer", padding: 4,
                  }}>
                    <Send size={14} />
                  </button>
                </div>
              </div>

              {/* Activity feed */}
              <div style={{ position: "relative", paddingLeft: 20 }}>
                {/* Timeline line */}
                <div style={{ position: "absolute", left: 13, top: 0, bottom: 0, width: 1, background: BORDER }} />

                {activityItems.slice().reverse().map((item) => {
                  const isComment = item.body.startsWith("commented:");
                  return (
                    <div key={item.id} style={{ position: "relative", paddingLeft: 24, marginBottom: isComment ? 16 : 10 }}>
                      {/* Timeline dot */}
                      <div style={{
                        position: "absolute", left: -1, top: isComment ? 6 : 3,
                        width: 8, height: 8, borderRadius: "50%",
                        background: isComment ? BLUE : TEXT_DIM, border: `2px solid ${BG_PAGE}`,
                      }} />

                      {isComment ? (
                        /* Comment bubble */
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                            <Avatar name={item.author} size={22} />
                            <span style={{ color: TEXT, fontSize: 12, fontWeight: 600 }}>{item.author}</span>
                            <span style={{ color: TEXT_DIM, fontSize: 10 }}>{item.created_at}</span>
                          </div>
                          <div style={{
                            padding: "10px 14px", background: CARD_BG, borderRadius: 8,
                            border: `1px solid ${BORDER}`, color: TEXT_MID, fontSize: 12, lineHeight: 1.55,
                          }}>
                            {item.body.replace(/^commented:\s*/, "")}
                          </div>
                        </div>
                      ) : (
                        /* System event */
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <Avatar name={item.author} size={18} />
                          <span style={{ color: TEXT_MID, fontSize: 11 }}>
                            <strong style={{ color: TEXT }}>{item.author}</strong> {item.body}
                          </span>
                          <span style={{ color: TEXT_DIM, fontSize: 10, marginLeft: 4 }}>{item.created_at}</span>
                        </div>
                      )}
                    </div>
                  );
                })}

                {activityItems.length === 0 && !loadingComments && (
                  <div style={{ padding: "20px 0", color: TEXT_DIM, fontSize: 12, textAlign: "center" }}>No activity yet</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Slide-in animation */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}


// ═══════════════════════════════════════════════════
// CREATE TASK PANEL
// ═══════════════════════════════════════════════════

type NewPriority = "normal" | "urgent";

function CreateTaskPanel({
  onClose,
  onCreateTask,
  hotelNames,
}: {
  onClose: () => void;
  onCreateTask: (data: Record<string, unknown>) => Promise<CrmTask>;
  hotelNames: string[];
}) {
  const teamMembers = useTeam();
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selAssignee, setSelAssignee] = useState<string>("");
  const [selPriority, setSelPriority] = useState<NewPriority>("normal");
  const [selCategory, setSelCategory] = useState<TaskCategory>("distribution");
  const [selChannel, setSelChannel] = useState<string>("");
  const [selectedHotel, setSelectedHotel] = useState<string>("");
  const [showPropertyPicker, setShowPropertyPicker] = useState(false);
  const [propertySearch, setPropertySearch] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dueDate, setDueDate] = useState<string>("");
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() }; });
  const [notifyAssignee, setNotifyAssignee] = useState(true);
  const [reminder, setReminder] = useState<"none" | "morning" | "day_before">("morning");
  const [escalate, setEscalate] = useState(false);
  const [creating, setCreating] = useState(false);

  const propertyRef = useRef<HTMLDivElement>(null);
  const dateRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (propertyRef.current && !propertyRef.current.contains(e.target as Node)) setShowPropertyPicker(false);
      if (dateRef.current && !dateRef.current.contains(e.target as Node)) setShowDatePicker(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const propertyLabel = selectedHotel || "Select property...";

  // Calendar helpers
  const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const DAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

  function getCalendarDays(year: number, month: number) {
    const firstDay = new Date(year, month, 1).getDay();
    const offset = firstDay === 0 ? 6 : firstDay - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < offset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  }

  function selectDate(day: number) {
    const m = String(calMonth.month + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    setDueDate(`${calMonth.year}-${m}-${d}`);
    setShowDatePicker(false);
  }

  function formatDisplayDate(d: string) {
    if (!d) return "";
    const date = new Date(d + "T00:00:00");
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  }

  async function handleCreate() {
    if (!title.trim()) return;
    setCreating(true);
    try {
      await onCreateTask({
        title: title.trim(),
        description: description.trim() || null,
        assignee: selAssignee || null,
        priority: selPriority === "urgent" ? "urgent" : "medium",
        category: selCategory,
        due_date: dueDate || null,
        tags: selChannel ? [selChannel] : [],
        created_by: "Karol",
      });
      onClose();
    } catch (err) {
      console.error("Failed to create task", err);
    } finally {
      setCreating(false);
    }
  }

  const calDays = getCalendarDays(calMonth.year, calMonth.month);
  const todayStr = new Date().toISOString().split("T")[0];

  const filteredHotels = hotelNames.filter((h) => !propertySearch || h.toLowerCase().includes(propertySearch.toLowerCase()));

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", zIndex: 50 }} />
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: 620,
        background: CARD_BG, borderLeft: `1px solid ${BORDER}`, zIndex: 51,
        display: "flex", flexDirection: "column",
        boxShadow: "0 0 20px rgba(57,189,248,0.08), -8px 0 40px rgba(0,0,0,0.4)",
        animation: "slideInRight 0.2s ease-out",
      }}>
        {/* Header */}
        <div style={{ padding: "20px 24px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 4, background: BLUE, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Plus size={18} style={{ color: "#0a0a0a" }} />
            </div>
            <div>
              <div style={{ color: TEXT, fontSize: 20, fontWeight: 600, letterSpacing: "-0.025em", textTransform: "uppercase" }}>New Task</div>
              <div style={{ color: TEXT_MID, fontSize: 13, marginTop: 2 }}>Create and assign a task</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: TEXT_DIM, cursor: "pointer", padding: 4 }}
            onMouseEnter={(e) => (e.currentTarget.style.color = TEXT)}
            onMouseLeave={(e) => (e.currentTarget.style.color = TEXT_DIM)}>
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>

          {/* Title */}
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs to be done?"
            style={{
              width: "100%", padding: "10px 12px", background: INPUT_BG,
              border: `1px solid ${BORDER}`, borderRadius: 4,
              color: TEXT, fontSize: 18, fontWeight: 600, outline: "none",
              marginBottom: 24, lineHeight: 1.4,
              fontFamily: "system-ui, -apple-system, sans-serif",
            }}
          />

          {/* Fields card */}
          <div style={{ marginBottom: 24, background: BG_PAGE, borderRadius: 4, border: `1px solid ${BORDER}`, padding: "4px 16px" }}>

            {/* Assignee */}
            <InlineField label="Assignee" icon={<User size={14} />}>
              <div style={{ display: "flex", gap: 6 }}>
                {teamMembers.map((m) => (
                  <button key={m.name} onClick={() => setSelAssignee(m.name)} style={{
                    display: "flex", alignItems: "center", gap: 7, padding: "6px 12px", borderRadius: 6,
                    border: `1px solid ${selAssignee === m.name ? `${m.color}40` : BORDER}`,
                    background: selAssignee === m.name ? `${m.color}10` : "transparent",
                    cursor: "pointer", transition: "all 0.15s",
                  }}>
                    <Avatar name={m.name} size={22} />
                    <span style={{ color: selAssignee === m.name ? TEXT : TEXT_MID, fontSize: 12, fontWeight: selAssignee === m.name ? 600 : 400 }}>{m.name}</span>
                  </button>
                ))}
              </div>
            </InlineField>

            {/* Priority — Normal / Urgent */}
            <InlineField label="Priority" icon={<Flag size={14} />}>
              <div style={{ display: "flex", gap: 6 }}>
                {([
                  { key: "normal" as NewPriority, label: "Normal", color: BLUE },
                  { key: "urgent" as NewPriority, label: "Urgent", color: RED },
                ]).map((p) => (
                  <button key={p.key} onClick={() => setSelPriority(p.key)} style={{
                    padding: "7px 16px", borderRadius: 6, border: `1px solid ${selPriority === p.key ? `${p.color}40` : BORDER}`,
                    background: selPriority === p.key ? `${p.color}12` : "transparent",
                    color: selPriority === p.key ? p.color : TEXT_DIM,
                    fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                    transition: "all 0.15s",
                  }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: selPriority === p.key ? p.color : TEXT_DIM }} />
                    {p.label}
                  </button>
                ))}
              </div>
            </InlineField>

            {/* Property — dropdown from hotel names */}
            <InlineField label="Property" icon={<Building2 size={14} />}>
              <div ref={propertyRef} style={{ position: "relative" }}>
                <button onClick={() => setShowPropertyPicker(!showPropertyPicker)} style={{
                  padding: "10px 12px", background: INPUT_BG, border: `1px solid ${showPropertyPicker ? BLUE : BORDER}`,
                  borderRadius: 4, color: selectedHotel ? TEXT : TEXT_DIM, fontSize: 13, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 8, minWidth: 240, transition: "border-color 0.15s",
                  justifyContent: "space-between", fontFamily: "system-ui, -apple-system, sans-serif",
                }}>
                  <span>{propertyLabel}</span>
                  <ChevronDown size={14} style={{ color: TEXT_DIM, transition: "transform 0.15s", transform: showPropertyPicker ? "rotate(180deg)" : "none" }} />
                </button>

                {showPropertyPicker && (
                  <div style={{
                    position: "absolute", top: "100%", left: 0, marginTop: 6, zIndex: 100,
                    background: INPUT_BG, border: `1px solid ${BORDER}`, borderRadius: 10,
                    boxShadow: "0 8px 24px rgba(0,0,0,0.5)", width: 340, maxHeight: 380, display: "flex", flexDirection: "column",
                  }}>
                    {/* Search */}
                    <div style={{ padding: "10px 12px", borderBottom: `1px solid ${BORDER}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", background: INPUT_BG, borderRadius: 6, border: `1px solid ${BORDER}` }}>
                        <Search size={13} style={{ color: TEXT_DIM, flexShrink: 0 }} />
                        <input value={propertySearch} onChange={(e) => setPropertySearch(e.target.value)} placeholder="Search properties..." style={{
                          flex: 1, background: "transparent", border: "none", color: TEXT, fontSize: 12, outline: "none",
                        }} />
                      </div>
                    </div>

                    <div style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}>
                      {/* Individual hotels */}
                      {filteredHotels.map((h) => (
                        <PickerItem key={h} label={h} checked={selectedHotel === h} onClick={() => { setSelectedHotel(h); setShowPropertyPicker(false); }} />
                      ))}

                      {filteredHotels.length === 0 && (
                        <div style={{ padding: "16px 14px", color: TEXT_DIM, fontSize: 12, textAlign: "center" }}>No matches</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </InlineField>

            {/* Channel */}
            <InlineField label="Channel" icon={<Globe size={14} />}>
              <select value={selChannel} onChange={(e) => setSelChannel(e.target.value)} style={{
                padding: "10px 12px", background: INPUT_BG, border: `1px solid ${BORDER}`,
                borderRadius: 4, color: selChannel ? TEXT : TEXT_DIM, fontSize: 13, outline: "none", cursor: "pointer", minWidth: 200,
                fontFamily: "system-ui, -apple-system, sans-serif",
              }}>
                <option value="">None</option>
                {OTA_CHANNELS_LIST.map((ch) => <option key={ch} value={ch}>{ch}</option>)}
              </select>
            </InlineField>

            {/* Category */}
            <InlineField label="Category" icon={<Tag size={14} />}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {(Object.entries(CATEGORY_CFG) as [TaskCategory, { color: string; label: string }][]).map(([key, cfg]) => (
                  <button key={key} onClick={() => setSelCategory(key)} style={{
                    padding: "6px 14px", borderRadius: 6, border: `1px solid ${selCategory === key ? `${cfg.color}40` : BORDER}`,
                    background: selCategory === key ? `${cfg.color}10` : "transparent",
                    color: selCategory === key ? cfg.color : TEXT_DIM,
                    fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
                  }}>
                    {cfg.label}
                  </button>
                ))}
              </div>
            </InlineField>

            {/* Due Date — custom calendar */}
            <InlineField label="Due Date" icon={<Calendar size={14} />}>
              <div ref={dateRef} style={{ position: "relative" }}>
                <button onClick={() => setShowDatePicker(!showDatePicker)} style={{
                  padding: "10px 12px", background: INPUT_BG, border: `1px solid ${showDatePicker ? BLUE : BORDER}`,
                  borderRadius: 4, color: dueDate ? TEXT : TEXT_DIM, fontSize: 13, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 8, minWidth: 200, transition: "border-color 0.15s",
                  fontFamily: "system-ui, -apple-system, sans-serif",
                }}>
                  <Calendar size={14} style={{ color: TEXT_DIM }} />
                  <span>{dueDate ? formatDisplayDate(dueDate) : "Select date..."}</span>
                </button>

                {showDatePicker && (
                  <div style={{
                    position: "absolute", top: "100%", left: 0, marginTop: 6, zIndex: 100,
                    background: INPUT_BG, border: `1px solid ${BORDER}`, borderRadius: 12,
                    padding: 16, boxShadow: "0 8px 24px rgba(0,0,0,0.5)", width: 280,
                  }}>
                    {/* Month nav */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                      <button onClick={() => setCalMonth((p) => p.month === 0 ? { year: p.year - 1, month: 11 } : { ...p, month: p.month - 1 })}
                        style={{ background: "none", border: "none", color: TEXT_DIM, cursor: "pointer", padding: 4, borderRadius: 4 }}>
                        <ChevronRight size={16} style={{ transform: "rotate(180deg)" }} />
                      </button>
                      <span style={{ color: TEXT, fontSize: 13, fontWeight: 600 }}>{MONTH_NAMES[calMonth.month]} {calMonth.year}</span>
                      <button onClick={() => setCalMonth((p) => p.month === 11 ? { year: p.year + 1, month: 0 } : { ...p, month: p.month + 1 })}
                        style={{ background: "none", border: "none", color: TEXT_DIM, cursor: "pointer", padding: 4, borderRadius: 4 }}>
                        <ChevronRight size={16} />
                      </button>
                    </div>

                    {/* Day labels */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
                      {DAY_LABELS.map((d) => (
                        <div key={d} style={{ textAlign: "center", color: TEXT_DIM, fontSize: 10, fontWeight: 600, padding: "4px 0" }}>{d}</div>
                      ))}
                    </div>

                    {/* Day grid */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
                      {calDays.map((day, i) => {
                        if (day === null) return <div key={`e${i}`} />;
                        const dateStr = `${calMonth.year}-${String(calMonth.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                        const isSelected = dateStr === dueDate;
                        const isToday = dateStr === todayStr;
                        return (
                          <button key={i} onClick={() => selectDate(day)} style={{
                            width: 34, height: 34, borderRadius: "50%", border: isToday && !isSelected ? `1px solid ${BLUE}40` : "none",
                            background: isSelected ? BLUE : "transparent",
                            color: isSelected ? "#0d0d0d" : isToday ? BLUE : TEXT,
                            fontSize: 12, fontWeight: isSelected || isToday ? 600 : 400,
                            cursor: "pointer", transition: "all 0.15s",
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}
                            onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "#2a2a2a"; }}
                            onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>

                    {/* Today shortcut */}
                    <button onClick={() => selectDate(new Date().getDate())} style={{
                      marginTop: 10, background: "none", border: "none", color: BLUE,
                      fontSize: 11, fontWeight: 600, cursor: "pointer", textTransform: "uppercase",
                      letterSpacing: "0.03em", padding: "4px 0",
                    }}>Today</button>
                  </div>
                )}
              </div>
            </InlineField>
          </div>

          {/* Description */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ color: TEXT_MID, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "-0.025em", marginBottom: 8 }}>Description</div>
            <textarea
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add details..."
              style={{
                width: "100%", padding: "10px 12px", background: INPUT_BG,
                border: `1px solid ${BORDER}`, borderRadius: 4, color: TEXT, fontSize: 13,
                outline: "none", resize: "vertical", lineHeight: 1.6,
                fontFamily: "system-ui, -apple-system, sans-serif",
              }}
            />
          </div>

          {/* Notifications */}
          <div style={{ background: BG_PAGE, borderRadius: 4, border: `1px solid ${BORDER}`, padding: "16px" }}>
            <div style={{ color: BLUE, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "-0.025em", marginBottom: 14 }}>Notifications</div>

            {/* Notify assignee */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div>
                <div style={{ color: TEXT, fontSize: 13, fontWeight: 500 }}>Notify assignee</div>
                <div style={{ color: TEXT_DIM, fontSize: 11, marginTop: 2 }}>Email sent when task is created</div>
              </div>
              <ToggleSwitch on={notifyAssignee} onToggle={() => setNotifyAssignee(!notifyAssignee)} />
            </div>

            <div style={{ height: 1, background: BORDER, marginBottom: 14 }} />

            {/* Smart reminder */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div>
                <div style={{ color: TEXT, fontSize: 13, fontWeight: 500 }}>Remind before due</div>
                <div style={{ color: TEXT_DIM, fontSize: 11, marginTop: 2 }}>Auto-nudge the assignee</div>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                {([
                  { key: "none" as const, label: "Off" },
                  { key: "day_before" as const, label: "1 day" },
                  { key: "morning" as const, label: "Morning of" },
                ]).map((r) => (
                  <button key={r.key} onClick={() => setReminder(r.key)} style={{
                    padding: "5px 11px", borderRadius: 5, border: `1px solid ${reminder === r.key ? `${BLUE}40` : BORDER}`,
                    background: reminder === r.key ? `${BLUE}10` : "transparent",
                    color: reminder === r.key ? BLUE : TEXT_DIM,
                    fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
                  }}>{r.label}</button>
                ))}
              </div>
            </div>

            <div style={{ height: 1, background: BORDER, marginBottom: 14 }} />

            {/* Escalation */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ color: TEXT, fontSize: 13, fontWeight: 500 }}>Escalate if overdue</div>
                <div style={{ color: TEXT_DIM, fontSize: 11, marginTop: 2 }}>Notify director when task passes due date</div>
              </div>
              <ToggleSwitch on={escalate} onToggle={() => setEscalate(!escalate)} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, padding: "24px", borderTop: `1px solid ${BORDER}`, flexShrink: 0 }}>
          <button onClick={onClose} style={{
            height: 40, padding: "0 20px", borderRadius: 4, border: `1px solid ${BORDER}`,
            background: INPUT_BG, color: TEXT, fontSize: 13, cursor: "pointer",
            fontFamily: "system-ui, -apple-system, sans-serif", transition: "all 0.2s",
          }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${BLUE}40`; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = BORDER; }}
          >Cancel</button>
          <button onClick={handleCreate} disabled={creating} style={{
            height: 40, padding: "0 24px", borderRadius: 4, border: "none",
            background: BLUE, color: "#0a0a0a",
            fontSize: 13, fontWeight: 600, cursor: creating ? "wait" : "pointer",
            fontFamily: "system-ui, -apple-system, sans-serif", transition: "background 0.2s",
            opacity: creating ? 0.7 : 1,
          }}
            onMouseEnter={(e) => { if (!creating) e.currentTarget.style.background = "#29ADEE"; }}
            onMouseLeave={(e) => { if (!creating) e.currentTarget.style.background = BLUE; }}
          >{creating ? "Creating..." : "Create"}</button>
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}

// ── Property picker item ──
function PickerItem({ label, checked, partial, bold, onClick }: { label: string; checked: boolean; partial?: boolean; bold?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px 14px",
      background: "transparent", border: "none", cursor: "pointer", transition: "background 0.12s",
      textAlign: "left",
    }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(57,189,248,0.05)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <div style={{
        width: 16, height: 16, borderRadius: 4, flexShrink: 0,
        border: `1.5px solid ${checked ? BLUE : partial ? BLUE : "#444"}`,
        background: checked ? BLUE : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 0.15s",
      }}>
        {checked && <CheckCircle2 size={10} style={{ color: "#0d0d0d" }} />}
        {partial && !checked && <div style={{ width: 8, height: 2, borderRadius: 1, background: BLUE }} />}
      </div>
      <span style={{ color: checked ? TEXT : TEXT_MID, fontSize: 12, fontWeight: bold ? 600 : 400 }}>{label}</span>
    </button>
  );
}

// ── Toggle switch ──
function ToggleSwitch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} style={{
      width: 38, height: 22, borderRadius: 11, border: "none", cursor: "pointer",
      background: on ? BLUE : "#3f3f46", transition: "background 0.2s", position: "relative", flexShrink: 0,
    }}>
      <div style={{
        width: 16, height: 16, borderRadius: "50%", background: "#fff",
        position: "absolute", top: 3,
        left: on ? 19 : 3, transition: "left 0.2s",
      }} />
    </button>
  );
}


// ═══════════════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════════════

function TaskCard({ task, onClick }: { task: CrmTask; onClick: () => void }) {
  const pCfg = PRIORITY_CFG[task.priority];
  const cCfg = CATEGORY_CFG[task.category];
  const todayStr = new Date().toISOString().split("T")[0];
  const isOverdue = task.status !== "done" && task.due_date ? task.due_date < todayStr : false;
  const hotelDisplay = task.hotel_name || "\u2014";

  return (
    <div onClick={onClick} style={{
      backgroundColor: CARD_BG, borderRadius: 8, border: `1px solid ${BORDER}`,
      padding: "12px 14px", cursor: "pointer", transition: "all 0.15s",
      borderLeft: `3px solid ${pCfg.color}`,
    }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${BLUE}30`; e.currentTarget.style.boxShadow = `0 2px 12px rgba(57,189,248,0.08)`; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderLeftColor = pCfg.color; }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ color: TEXT_DIM, fontSize: 10, fontFamily: "monospace" }}>CRM-{task.id}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: pCfg.color }} />
          <span style={{ color: pCfg.color, fontSize: 9, fontWeight: 600, textTransform: "uppercase" }}>{pCfg.label}</span>
        </div>
      </div>
      <div style={{ color: TEXT, fontSize: 12, fontWeight: 500, lineHeight: 1.45, marginBottom: 8 }}>{task.title}</div>
      {task.tags.length > 0 && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
          {task.tags.slice(0, 3).map((tag) => (
            <span key={tag} style={{ fontSize: 9, padding: "2px 7px", borderRadius: 4, background: INPUT_BG, color: TEXT_DIM, border: `1px solid ${BORDER}` }}>{tag}</span>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 4, background: `${cCfg.color}12`, color: cCfg.color, fontWeight: 600 }}>{cCfg.label}</span>
        {task.channel_name && <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 4, background: INPUT_BG, color: TEXT_MID, border: `1px solid ${BORDER}` }}>{task.channel_name}</span>}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Avatar name={task.assignee || "?"} size={20} />
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <span style={{ color: TEXT_MID, fontSize: 10, fontWeight: 500 }}>{task.assignee || "Unassigned"}</span>
            <span style={{ color: TEXT_DIM, fontSize: 9 }}>{hotelDisplay.length > 20 ? hotelDisplay.slice(0, 20) + "\u2026" : hotelDisplay}</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {task.subtask_total > 0 && <span style={{ color: task.subtask_done === task.subtask_total ? GREEN : TEXT_DIM, fontSize: 10, display: "flex", alignItems: "center", gap: 2 }}><CheckCircle2 size={9} /> {task.subtask_done}/{task.subtask_total}</span>}
          {task.comment_count > 0 && <span style={{ color: TEXT_DIM, fontSize: 10, display: "flex", alignItems: "center", gap: 2 }}><MessageSquare size={9} /> {task.comment_count}</span>}
        </div>
      </div>
      <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 4 }}>
        {isOverdue && <AlertTriangle size={9} style={{ color: RED }} />}
        <Clock size={9} style={{ color: isOverdue ? RED : TEXT_DIM }} />
        <span style={{ color: isOverdue ? RED : TEXT_DIM, fontSize: 10, fontWeight: isOverdue ? 600 : 400 }}>
          {isOverdue ? "Overdue \u2014 " : ""}{task.due_date ? formatDate(task.due_date) : "\u2014"}
        </span>
      </div>
    </div>
  );
}

function Avatar({ name, size = 24 }: { name: string; size?: number }) {
  const team = useTeam();
  const member = team.find((m) => m.name === name);
  const color = member?.color || BLUE;
  const initials = member?.initials || name.slice(0, 2).toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: 9999, flexShrink: 0,
      background: `${color}15`, border: `1px solid ${color}30`,
      display: "flex", alignItems: "center", justifyContent: "center",
      color, fontSize: size * 0.38, fontWeight: 700,
    }}>
      {initials}
    </div>
  );
}

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ color: TEXT_DIM, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

function InlineField({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 0, padding: "12px 0",
      borderBottom: `1px solid ${BORDER}`,
    }}>
      <div style={{ width: 130, display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <span style={{ color: TEXT_DIM }}>{icon}</span>
        <span style={{ color: TEXT_MID, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "-0.025em", fontFamily: "system-ui, -apple-system, sans-serif" }}>{label}</span>
      </div>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

function LayoutIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <rect x="0.5" y="0.5" width="4" height="11" rx="1" stroke="currentColor" strokeWidth="1" />
      <rect x="7.5" y="0.5" width="4" height="11" rx="1" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

function formatDate(d: string) {
  const date = new Date(d + "T00:00:00");
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function formatDateLong(d: string) {
  const date = new Date(d + "T00:00:00");
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
