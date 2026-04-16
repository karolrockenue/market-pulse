import { useState, useMemo, useRef, useEffect, useCallback, createContext, useContext } from "react";
import { R } from "../../../styles/tokens";
import {
  Search,
  Plus,
  X,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Filter,
  Calendar,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  Building2,
  User,
  Tag,
  Flag,
  Eye,
  ArrowRight,
  Send,
  Globe,
  Loader2,
  ClipboardList,
  Trash2,
  Repeat,
  Zap,
  Users,
  BarChart3,
  CheckSquare,
  Link2,
} from "lucide-react";
import { useCrmTasks } from "../hooks/useCrmTasks";
import {
  fetchComments,
  addComment,
  fetchTeam,
} from "../api/distribution.api";
import { format, differenceInCalendarDays, addDays, startOfWeek, endOfWeek, eachDayOfInterval } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as ShadcnCalendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import type {
  CrmTask,
  CrmTaskComment,
  Priority,
  TaskStatus,
  TaskCategory,
  TeamMember,
} from "../api/types";

// ── Brand palette ──
const BLUE = R.warmTeal;
const GREEN = "#10b981";
const AMBER = "#f59e0b";
const RED = "#ef4444";
const PURPLE = "#8b5cf6";
const BG_PAGE = R.bg;
const CARD_BG = R.darkBand;
const INPUT_BG = R.card;
const BORDER = R.border;
const TEXT = R.accent;
const TEXT_MID = R.textMid;
const TEXT_DIM = R.textDim;

const OTA_CHANNELS_LIST = [
  "Booking.com", "Expedia", "Agoda", "Hotelbeds", "Trip.com", "HRS",
  "Stuba", "WebBeds", "CN Travel", "Direct", "Google Hotels", "Trivago",
];

// ── Config ──
const PRIORITY_CFG: Record<Priority, { color: string; label: string; order: number }> = {
  urgent: { color: RED, label: "Urgent", order: 0 },
  high: { color: AMBER, label: "High", order: 1 },
  medium: { color: BLUE, label: "Medium", order: 2 },
  low: { color: TEXT_DIM, label: "Low", order: 3 },
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

// ── View modes ──
type ViewMode = "board" | "hotel" | "user" | "timeline" | "my_work";

// ── Mock data stores (mockup stage — local state only) ──
type Automation = { id: string; name: string; trigger: string; action: string; enabled: boolean };
type TaskDependency = { taskId: number; type: "blocks" | "blocked_by"; linkedTaskId: number };
type TaskWatcher = { taskId: number; name: string };
const DEFAULT_WIP_LIMITS: Record<TaskStatus, number> = { todo: 0, in_progress: 8, review: 5, done: 0 };

const MOCK_AUTOMATIONS: Automation[] = [
  { id: "a1", name: "Auto-assign reviewer", trigger: "When status changes to Review", action: "Set assignee to Karol", enabled: true },
  { id: "a2", name: "Notify on overdue", trigger: "When task becomes overdue", action: "Send email to assignee + Karol", enabled: true },
  { id: "a3", name: "Close stale tasks", trigger: "When task in Done for 14 days", action: "Archive task", enabled: false },
  { id: "a4", name: "Escalate urgent", trigger: "When urgent task has no update for 24h", action: "Send Slack notification to #ops", enabled: true },
];

interface CrmBoardProps {
  initialFilter?: { hotel_id?: number; channel_id?: number } | null;
  onClearFilter?: () => void;
  userName: string;
}

export function CrmBoard({ initialFilter, onClearFilter, userName }: CrmBoardProps) {
  const { tasks, loading, createTask, createTasksBulk, updateTask, deleteTask, refresh } = useCrmTasks(
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
  const [newTaskDefaultStatus, setNewTaskDefaultStatus] = useState<TaskStatus | null>(null);
  const [expandedHotel, setExpandedHotel] = useState<string | null>(null);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [showAutomations, setShowAutomations] = useState(false);

  // ── WIP limits ──
  const [wipLimits, setWipLimits] = useState<Record<TaskStatus, number>>(DEFAULT_WIP_LIMITS);

  // ── Bulk selection ──
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<number>>(new Set());

  // ── Context menu ──
  const [contextMenu, setContextMenu] = useState<{ taskId: number; x: number; y: number } | null>(null);

  // ── Mock stores (mockup — no backend) ──
  const [dependencies, setDependencies] = useState<TaskDependency[]>([]);
  const [watchers, setWatchers] = useState<TaskWatcher[]>([]);
  const [automations, setAutomations] = useState<Automation[]>(MOCK_AUTOMATIONS);

  // ── Drag-and-drop state ──
  const [dragTaskId, setDragTaskId] = useState<number | null>(null);
  const [dragOverCol, setDragOverCol] = useState<TaskStatus | null>(null);

  const handleDragStart = useCallback((taskId: number, e: React.DragEvent) => {
    setDragTaskId(taskId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(taskId));
    if (e.currentTarget instanceof HTMLElement) {
      requestAnimationFrame(() => { (e.currentTarget as HTMLElement).style.opacity = "0.4"; });
    }
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    setDragTaskId(null);
    setDragOverCol(null);
    if (e.currentTarget instanceof HTMLElement) e.currentTarget.style.opacity = "1";
  }, []);

  const handleColumnDragOver = useCallback((status: TaskStatus, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCol(status);
  }, []);

  const handleColumnDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverCol(null);
  }, []);

  const handleColumnDrop = useCallback((status: TaskStatus, e: React.DragEvent) => {
    e.preventDefault();
    const taskId = Number(e.dataTransfer.getData("text/plain"));
    setDragTaskId(null);
    setDragOverCol(null);
    if (!taskId) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === status) return;
    updateTask(taskId, { status });
  }, [tasks, updateTask]);

  // ── Bulk actions ──
  function toggleBulkSelect(id: number) {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function bulkUpdate(data: Record<string, unknown>) {
    for (const id of selectedTaskIds) {
      await updateTask(id, data);
    }
    setSelectedTaskIds(new Set());
    setBulkMode(false);
  }

  async function bulkDeleteTasks() {
    if (!confirm(`Delete ${selectedTaskIds.size} task${selectedTaskIds.size > 1 ? "s" : ""}? This cannot be undone.`)) return;
    for (const id of selectedTaskIds) {
      await deleteTask(id);
    }
    setSelectedTaskIds(new Set());
    setBulkMode(false);
  }

  // ── Context menu handlers ──
  function handleContextMenu(taskId: number, e: React.MouseEvent) {
    e.preventDefault();
    setContextMenu({ taskId, x: e.clientX, y: e.clientY });
  }

  useEffect(() => {
    const handler = () => setContextMenu(null);
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, []);

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

  const hotelNames = useMemo(() => {
    const names = new Set<string>();
    tasks.forEach((t) => { if (t.hotel_name) names.add(t.hotel_name); });
    return Array.from(names).sort();
  }, [tasks]);

  const todayStr = new Date().toISOString().split("T")[0];

  // ── Due date tier ──
  function dueDateTier(task: CrmTask): "overdue" | "today" | "this_week" | "normal" | "none" {
    if (!task.due_date || task.status === "done") return "none";
    const diff = differenceInCalendarDays(new Date(task.due_date + "T00:00:00"), new Date());
    if (diff < 0) return "overdue";
    if (diff === 0) return "today";
    if (diff <= 7) return "this_week";
    return "normal";
  }

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
    <div style={{ flex: 1, background: R.bg, color: R.accent, paddingBottom: 64 }}>
      <div style={{ padding: "24px 28px" }}>

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
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setShowAutomations(true)} style={{
              display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 8,
              border: `1px solid ${BORDER}`, background: INPUT_BG, color: TEXT_MID,
              fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}>
              <Zap size={13} /> Automations
            </button>
            <button onClick={() => { setBulkMode(!bulkMode); setSelectedTaskIds(new Set()); }} style={{
              display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 8,
              border: `1px solid ${bulkMode ? BLUE + "40" : BORDER}`, background: bulkMode ? `${BLUE}10` : INPUT_BG,
              color: bulkMode ? BLUE : TEXT_MID, fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}>
              <CheckSquare size={13} /> Bulk
            </button>
            <button onClick={() => { setShowNewTask(true); setNewTaskDefaultStatus(null); }} style={{
              display: "flex", alignItems: "center", gap: 6, padding: "9px 20px", borderRadius: 8,
              border: "none", background: BLUE, color: R.sidebar,
              fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}>
              <Plus size={14} /> New Task
            </button>
          </div>
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

      {/* ── Bulk action bar ── */}
      {bulkMode && selectedTaskIds.size > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", marginBottom: 16,
          background: `${BLUE}08`, border: `1px solid ${BLUE}25`, borderRadius: 8,
        }}>
          <span style={{ color: BLUE, fontSize: 12, fontWeight: 600 }}>{selectedTaskIds.size} selected</span>
          <div style={{ width: 1, height: 20, background: BORDER }} />
          <span style={{ color: TEXT_DIM, fontSize: 11 }}>Move to:</span>
          {STATUS_COLUMNS.map((s) => (
            <button key={s.key} onClick={() => bulkUpdate({ status: s.key })} style={{
              padding: "4px 10px", borderRadius: 5, border: `1px solid ${s.color}30`,
              background: `${s.color}10`, color: s.color, fontSize: 11, fontWeight: 600, cursor: "pointer",
            }}>{s.label}</button>
          ))}
          <div style={{ width: 1, height: 20, background: BORDER }} />
          <span style={{ color: TEXT_DIM, fontSize: 11 }}>Assign:</span>
          {teamMembers.slice(0, 4).map((m) => (
            <button key={m.name} onClick={() => bulkUpdate({ assignee: m.name })} style={{
              padding: "4px 10px", borderRadius: 5, border: `1px solid ${BORDER}`,
              background: INPUT_BG, color: TEXT_MID, fontSize: 11, cursor: "pointer",
            }}>{m.name}</button>
          ))}
          <div style={{ width: 1, height: 20, background: BORDER }} />
          <span style={{ color: TEXT_DIM, fontSize: 11 }}>Priority:</span>
          {(Object.entries(PRIORITY_CFG) as [Priority, typeof PRIORITY_CFG["urgent"]][]).map(([k, v]) => (
            <button key={k} onClick={() => bulkUpdate({ priority: k })} style={{
              padding: "4px 10px", borderRadius: 5, border: `1px solid ${v.color}30`,
              background: `${v.color}10`, color: v.color, fontSize: 11, fontWeight: 600, cursor: "pointer",
            }}>{v.label}</button>
          ))}
          <div style={{ width: 1, height: 20, background: BORDER }} />
          <button onClick={bulkDeleteTasks} style={{
            padding: "4px 10px", borderRadius: 5, border: `1px solid ${RED}30`,
            background: `${RED}10`, color: RED, fontSize: 11, fontWeight: 600, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 4,
          }}><Trash2 size={11} /> Delete</button>
          <button onClick={() => { setSelectedTaskIds(new Set()); setBulkMode(false); }} style={{
            marginLeft: "auto", padding: "4px 10px", borderRadius: 5, border: `1px solid ${BORDER}`,
            background: INPUT_BG, color: TEXT_DIM, fontSize: 11, cursor: "pointer",
          }}>Cancel</button>
        </div>
      )}

      {/* ── Toolbar ── */}
      <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", background: INPUT_BG, borderRadius: 8, border: `1px solid ${BORDER}`, overflow: "hidden" }}>
          {([
            { key: "board" as ViewMode, label: "Board", icon: <LayoutIcon /> },
            { key: "timeline" as ViewMode, label: "Timeline", icon: <BarChart3 size={12} /> },
            { key: "my_work" as ViewMode, label: "My Work", icon: <User size={12} /> },
            { key: "hotel" as ViewMode, label: "By Hotel", icon: <Building2 size={12} /> },
            { key: "user" as ViewMode, label: "By Person", icon: <Users size={12} /> },
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

      {/* ═════════════════════════════════════════════ */}
      {/* BOARD VIEW (Kanban)                           */}
      {/* ═════════════════════════════════════════════ */}
      {viewMode === "board" && (
        <KanbanBoard
          tasks={filteredTasks}
          allTasks={tasks}
          wipLimits={wipLimits}
          dragTaskId={dragTaskId}
          dragOverCol={dragOverCol}
          bulkMode={bulkMode}
          selectedTaskIds={selectedTaskIds}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onColumnDragOver={handleColumnDragOver}
          onColumnDragLeave={handleColumnDragLeave}
          onColumnDrop={handleColumnDrop}
          onTaskClick={(id) => setSelectedTaskId(id)}
          onTaskContext={handleContextMenu}
          onToggleBulk={toggleBulkSelect}
          onQuickAdd={(status) => { setNewTaskDefaultStatus(status); setShowNewTask(true); }}
          dueDateTier={dueDateTier}
        />
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* TIMELINE VIEW (Gantt-style)                 */}
      {/* ═══════════════════════════════════════════ */}
      {viewMode === "timeline" && (
        <TimelineView tasks={filteredTasks} todayStr={todayStr} onTaskClick={(id) => setSelectedTaskId(id)} />
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* MY WORK VIEW — personal dashboard            */}
      {/* ═══════════════════════════════════════════ */}
      {viewMode === "my_work" && (
        <MyWorkView
          tasks={filteredTasks}
          todayStr={todayStr}
          onTaskClick={(id) => setSelectedTaskId(id)}
          dueDateTier={dueDateTier}
          userName={userName}
        />
      )}

      {/* ── Hotel View ── */}
      {viewMode === "hotel" && (
        <HotelView
          tasks={filteredTasks}
          todayStr={todayStr}
          expandedHotel={expandedHotel}
          setExpandedHotel={setExpandedHotel}
          onTaskClick={(id) => setSelectedTaskId(id)}
        />
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
                    <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 140px 100px 90px 90px", padding: "8px 20px", background: R.card }}>
                      {["ID", "Task", "Property", "Category", "Priority", "Due"].map((h) => (
                        <span key={h} style={{ color: TEXT_DIM, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" }}>{h}</span>
                      ))}
                    </div>
                    {memberTasks
                      .sort((a, b) => PRIORITY_CFG[a.priority].order - PRIORITY_CFG[b.priority].order || (a.due_date || "").localeCompare(b.due_date || ""))
                      .map((task, i) => {
                        const pCfg = PRIORITY_CFG[task.priority];
                        const cCfg = CATEGORY_CFG[task.category];
                        const isOverdue = task.due_date ? task.due_date < todayStr : false;
                        const sCfg = STATUS_COLUMNS.find((s) => s.key === task.status)!;
                        const hotelDisplay = task.hotel_names?.length > 1 ? `${task.hotel_names.length} properties` : task.hotel_names?.[0] || task.hotel_name || "\u2014";
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
                              {task.due_date ? formatDate(task.due_date) : "\u2014"}
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

      {/* ── Right-click context menu ── */}
      {contextMenu && (
        <ContextMenuPopup
          x={contextMenu.x}
          y={contextMenu.y}
          task={tasks.find((t) => t.id === contextMenu.taskId)!}
          onUpdateTask={updateTask}
          onDeleteTask={deleteTask}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* ── Task Detail Panel ── */}
      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          allTasks={tasks}
          onClose={() => setSelectedTaskId(null)}
          onUpdateTask={updateTask}
          onDeleteTask={deleteTask}
          onRefresh={refresh}
          dependencies={dependencies}
          setDependencies={setDependencies}
          watchers={watchers}
          setWatchers={setWatchers}
          onNavigateTask={(id) => setSelectedTaskId(id)}
          userName={userName}
        />
      )}

      {/* ── Create Task Panel ── */}
      {showNewTask && (
        <CreateTaskPanel
          onClose={() => { setShowNewTask(false); setNewTaskDefaultStatus(null); }}
          onCreateTask={createTask}
          onCreateBulk={createTasksBulk}
          hotelNames={hotelNames}
          defaultStatus={newTaskDefaultStatus}
          userName={userName}
        />
      )}

      {/* ── Automations Panel ── */}
      {showAutomations && (
        <AutomationsPanel
          automations={automations}
          setAutomations={setAutomations}
          onClose={() => setShowAutomations(false)}
        />
      )}

      </div>
    </div>
    </TeamContext.Provider>
  );
}


// ═══════════════════════════════════════════════════
// KANBAN BOARD (reusable for swimlanes)
// ═══════════════════════════════════════════════════

function KanbanBoard({
  tasks, allTasks, wipLimits, dragTaskId, dragOverCol,
  bulkMode, selectedTaskIds,
  onDragStart, onDragEnd, onColumnDragOver, onColumnDragLeave, onColumnDrop,
  onTaskClick, onTaskContext, onToggleBulk, onQuickAdd, dueDateTier, compact,
}: {
  tasks: CrmTask[];
  allTasks: CrmTask[];
  wipLimits: Record<TaskStatus, number>;
  dragTaskId: number | null;
  dragOverCol: TaskStatus | null;
  bulkMode: boolean;
  selectedTaskIds: Set<number>;
  onDragStart: (id: number, e: React.DragEvent) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onColumnDragOver: (status: TaskStatus, e: React.DragEvent) => void;
  onColumnDragLeave: (e: React.DragEvent) => void;
  onColumnDrop: (status: TaskStatus, e: React.DragEvent) => void;
  onTaskClick: (id: number) => void;
  onTaskContext: (id: number, e: React.MouseEvent) => void;
  onToggleBulk: (id: number) => void;
  onQuickAdd: (status: TaskStatus) => void;
  dueDateTier: (task: CrmTask) => string;
  compact?: boolean;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, alignItems: "start" }}>
      {STATUS_COLUMNS.map((col) => {
        const colTasks = tasks.filter((t) => t.status === col.key);
        const isDropTarget = dragTaskId !== null && dragOverCol === col.key;
        const draggedTask = dragTaskId ? allTasks.find((t) => t.id === dragTaskId) : null;
        const isDragSource = draggedTask?.status === col.key;
        const wipLimit = wipLimits[col.key];
        const isOverWip = wipLimit > 0 && colTasks.length > wipLimit;
        return (
          <div
            key={col.key}
            onDragOver={(e) => onColumnDragOver(col.key, e)}
            onDragLeave={onColumnDragLeave}
            onDrop={(e) => onColumnDrop(col.key, e)}
            style={{
              borderRadius: 12,
              padding: isDropTarget && !isDragSource ? 4 : 0,
              border: isDropTarget && !isDragSource ? `2px dashed ${col.color}60` : "2px dashed transparent",
              background: isDropTarget && !isDragSource ? `${col.color}08` : "transparent",
              transition: "all 0.15s ease",
              minHeight: dragTaskId ? 120 : undefined,
            }}
          >
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: compact ? "12px 12px" : "18px 16px", marginBottom: compact ? 8 : 12, borderRadius: 10,
              background: `${col.color}08`, border: `1px solid ${isOverWip ? RED + "50" : col.color + "20"}`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: col.color }} />
                <span style={{ color: TEXT, fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: "-0.01em" }}>{col.label}</span>
                {wipLimit > 0 && (
                  <span style={{
                    fontSize: 10, padding: "1px 6px", borderRadius: 4,
                    background: isOverWip ? `${RED}15` : `${TEXT_DIM}15`,
                    color: isOverWip ? RED : TEXT_DIM, fontWeight: 600,
                  }}>
                    {colTasks.length}/{wipLimit}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ color: col.color, fontSize: 13, fontWeight: 700, background: `${col.color}15`, padding: "4px 12px", borderRadius: 10 }}>
                  {colTasks.length}
                </span>
                <button onClick={() => onQuickAdd(col.key)} style={{
                  width: 24, height: 24, borderRadius: 6, border: `1px solid ${BORDER}`,
                  background: "transparent", color: TEXT_DIM, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.15s",
                }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = `${col.color}15`; e.currentTarget.style.color = col.color; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = TEXT_DIM; }}
                >
                  <Plus size={13} />
                </button>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {colTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onClick={() => onTaskClick(task.id)}
                  onContextMenu={(e) => onTaskContext(task.id, e)}
                  onDragStart={(e) => onDragStart(task.id, e)}
                  onDragEnd={onDragEnd}
                  isDragging={dragTaskId === task.id}
                  bulkMode={bulkMode}
                  bulkSelected={selectedTaskIds.has(task.id)}
                  onToggleBulk={() => onToggleBulk(task.id)}
                  dueTier={dueDateTier(task)}
                />
              ))}
              {colTasks.length === 0 && (
                <div style={{
                  padding: isDropTarget && !isDragSource ? "28px 16px" : "40px 16px",
                  textAlign: "center", color: isDropTarget ? col.color : TEXT_DIM, fontSize: 12,
                  border: `1px dashed ${isDropTarget ? col.color + "40" : BORDER}`, borderRadius: 8,
                  transition: "all 0.15s",
                }}>
                  {isDropTarget ? "Drop here" : "No tasks"}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}


// ═══════════════════════════════════════════════════
// HOTEL VIEW (grouped by management group + portfolio)
// ═══════════════════════════════════════════════════

function HotelView({
  tasks, todayStr, expandedHotel, setExpandedHotel, onTaskClick,
}: {
  tasks: CrmTask[];
  todayStr: string;
  expandedHotel: string | null;
  setExpandedHotel: (h: string | null) => void;
  onTaskClick: (id: number) => void;
}) {
  // Fetch hotels to get management_group info
  const [hotelGroups, setHotelGroups] = useState<Record<string, string | null>>({});
  useEffect(() => {
    fetch("/api/hotels").then(r => r.json()).then(data => {
      const map: Record<string, string | null> = {};
      for (const h of data) {
        if (h.property_name) map[h.property_name] = h.management_group || null;
      }
      setHotelGroups(map);
    }).catch(console.error);
  }, []);

  const activeTasks = tasks.filter((t) => t.status !== "done");

  // Group tasks into sections: portfolio-wide (no hotel), per management group, individual hotels
  const portfolioTasks = activeTasks.filter((t) => !t.hotel_name);

  // Build management group -> hotels map
  const mgmtGroups = useMemo(() => {
    const groups: Record<string, Set<string>> = {};
    for (const [hotel, group] of Object.entries(hotelGroups)) {
      if (group) {
        if (!groups[group]) groups[group] = new Set();
        groups[group].add(hotel);
      }
    }
    return groups;
  }, [hotelGroups]);

  // Find tasks assigned to a management group (task has a hotel that belongs to a group)
  // Group the individual hotels under their management group headers
  type Section = { key: string; label: string; icon: "portfolio" | "group" | "hotel"; color: string; tasks: CrmTask[] };

  const sections = useMemo(() => {
    const result: Section[] = [];

    // 1. Entire Portfolio (tasks with no hotel assigned)
    if (portfolioTasks.length > 0) {
      result.push({ key: "__portfolio__", label: "Entire Portfolio", icon: "portfolio", color: AMBER, tasks: portfolioTasks });
    }

    // 2. Management groups (as parent sections containing hotel sub-rows)
    const hotelsSeen = new Set<string>();
    for (const [groupName, groupHotels] of Object.entries(mgmtGroups).sort(([a], [b]) => a.localeCompare(b))) {
      const groupTasks = activeTasks.filter((t) => t.hotel_name && groupHotels.has(t.hotel_name));
      if (groupTasks.length > 0) {
        result.push({ key: `__group__${groupName}`, label: groupName, icon: "group", color: PURPLE, tasks: groupTasks });
        groupHotels.forEach((h) => hotelsSeen.add(h));
      }
    }

    // 3. Individual hotels not in any group
    const ungroupedHotels = new Set<string>();
    activeTasks.forEach((t) => { if (t.hotel_name && !hotelsSeen.has(t.hotel_name)) ungroupedHotels.add(t.hotel_name); });
    for (const hotel of Array.from(ungroupedHotels).sort()) {
      const hotelTasks = activeTasks.filter((t) => t.hotel_name === hotel);
      if (hotelTasks.length > 0) {
        result.push({ key: hotel, label: hotel, icon: "hotel", color: BLUE, tasks: hotelTasks });
      }
    }

    return result;
  }, [activeTasks, portfolioTasks, mgmtGroups]);

  function renderTaskRow(task: CrmTask, i: number) {
    const pCfg = PRIORITY_CFG[task.priority];
    const cCfg = CATEGORY_CFG[task.category];
    const isOverdue = task.due_date ? task.due_date < todayStr : false;
    return (
      <div key={task.id} onClick={() => onTaskClick(task.id)} style={{
        display: "grid", gridTemplateColumns: "260px 1fr 100px 100px 110px 100px",
        padding: "10px 16px 10px 52px", alignItems: "center",
        borderTop: `1px solid ${BORDER}`, background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
        transition: "background 0.12s", cursor: "pointer",
      }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(57,189,248,0.03)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)")}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: TEXT_DIM, fontSize: 11 }}>CRM-{task.id}</span>
          {task.hotel_name && <span style={{ color: TEXT_DIM, fontSize: 9, padding: "1px 6px", borderRadius: 3, background: `${BLUE}10`, border: `1px solid ${BLUE}15` }}>{task.hotel_name.length > 22 ? task.hotel_name.slice(0, 22) + "\u2026" : task.hotel_name}</span>}
        </div>
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
          {task.due_date ? formatDate(task.due_date) : "\u2014"}
        </span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <div style={{
        display: "grid", gridTemplateColumns: "260px 1fr 100px 100px 110px 100px",
        padding: "10px 16px", backgroundColor: R.card, borderRadius: "8px 8px 0 0",
        border: `1px solid ${BORDER}`, borderBottom: "none",
      }}>
        {["Scope", "Task", "Category", "Priority", "Assignee", "Due Date"].map((h) => (
          <span key={h} style={{ color: TEXT_DIM, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" }}>{h}</span>
        ))}
      </div>

      {sections.map((section) => {
        const isExpanded = expandedHotel === section.key;
        const iconEl = section.icon === "portfolio"
          ? <Globe size={14} style={{ color: section.color }} />
          : section.icon === "group"
            ? <Users size={14} style={{ color: section.color }} />
            : <Building2 size={14} style={{ color: section.color }} />;

        return (
          <div key={section.key} style={{ backgroundColor: CARD_BG, border: `1px solid ${BORDER}`, borderBottom: "none" }}>
            <div onClick={() => setExpandedHotel(isExpanded ? null : section.key)}
              style={{ display: "grid", gridTemplateColumns: "260px 1fr 100px", padding: "12px 16px", cursor: "pointer", transition: "background 0.12s", alignItems: "center" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(57,189,248,0.025)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <ChevronDown size={14} style={{ color: TEXT_DIM, transform: isExpanded ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.15s" }} />
                {iconEl}
                <span style={{ color: TEXT, fontSize: 13, fontWeight: 600 }}>{section.label}</span>
                {section.icon !== "hotel" && (
                  <span style={{
                    fontSize: 9, padding: "1px 8px", borderRadius: 10,
                    background: `${section.color}15`, color: section.color, fontWeight: 600,
                    textTransform: "uppercase", letterSpacing: "0.03em",
                  }}>
                    {section.icon === "portfolio" ? "Portfolio" : "Group"}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {Object.entries(CATEGORY_CFG).map(([cat, cfg]) => {
                  const count = section.tasks.filter((t) => t.category === cat).length;
                  if (!count) return null;
                  return <span key={cat} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: `${cfg.color}15`, color: cfg.color, fontWeight: 500 }}>{cfg.label} {count}</span>;
                })}
              </div>
              <span style={{ color: TEXT_DIM, fontSize: 12, textAlign: "right" }}>
                {section.tasks.length} task{section.tasks.length !== 1 ? "s" : ""}
              </span>
            </div>
            {isExpanded && section.tasks.map((task, i) => renderTaskRow(task, i))}
          </div>
        );
      })}

      {sections.length === 0 && (
        <div style={{ padding: "40px 16px", textAlign: "center", color: TEXT_DIM, fontSize: 12, backgroundColor: CARD_BG, border: `1px solid ${BORDER}` }}>
          No active tasks
        </div>
      )}
      <div style={{ borderBottom: `1px solid ${BORDER}`, borderRadius: "0 0 8px 8px" }} />
    </div>
  );
}


// ═══════════════════════════════════════════════════
// CONTEXT MENU (right-click)
// ═══════════════════════════════════════════════════

function ContextMenuPopup({
  x, y, task, onUpdateTask, onDeleteTask, onClose,
}: {
  x: number; y: number;
  task: CrmTask;
  onUpdateTask: (id: number, data: Record<string, unknown>) => Promise<CrmTask>;
  onDeleteTask: (id: number) => Promise<void>;
  onClose: () => void;
}) {
  const team = useTeam();

  function item(label: string, icon: React.ReactNode, action: () => void, color?: string) {
    return (
      <button onClick={(e) => { e.stopPropagation(); action(); onClose(); }} style={{
        display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 12px",
        background: "transparent", border: "none", cursor: "pointer", color: color || TEXT_MID,
        fontSize: 12, textAlign: "left", transition: "background 0.1s",
      }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(57,189,248,0.05)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        {icon} {label}
      </button>
    );
  }

  function divider() {
    return <div style={{ height: 1, background: BORDER, margin: "4px 0" }} />;
  }

  return (
    <div style={{
      position: "fixed", left: x, top: y, zIndex: 999,
      background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 10,
      boxShadow: "0 8px 32px rgba(0,0,0,0.6)", padding: "6px 0", minWidth: 200,
    }}>
      <div style={{ padding: "6px 12px 8px", color: TEXT_DIM, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        CRM-{task.id}
      </div>
      {divider()}

      <div style={{ padding: "4px 12px 2px", color: TEXT_DIM, fontSize: 10, fontWeight: 600 }}>Move to</div>
      {STATUS_COLUMNS.filter((s) => s.key !== task.status).map((s) => (
        item(s.label, <div style={{ width: 8, height: 8, borderRadius: "50%", background: s.color }} />, () => onUpdateTask(task.id, { status: s.key }), s.color)
      ))}

      {divider()}

      <div style={{ padding: "4px 12px 2px", color: TEXT_DIM, fontSize: 10, fontWeight: 600 }}>Priority</div>
      {(Object.entries(PRIORITY_CFG) as [Priority, typeof PRIORITY_CFG["urgent"]][])
        .filter(([k]) => k !== task.priority)
        .map(([k, v]) => item(v.label, <div style={{ width: 8, height: 8, borderRadius: "50%", background: v.color }} />, () => onUpdateTask(task.id, { priority: k }), v.color))
      }

      {divider()}

      <div style={{ padding: "4px 12px 2px", color: TEXT_DIM, fontSize: 10, fontWeight: 600 }}>Assign to</div>
      {team.filter((m) => m.name !== task.assignee).slice(0, 5).map((m) => (
        item(m.name, <Avatar name={m.name} size={16} />, () => onUpdateTask(task.id, { assignee: m.name }))
      ))}

      {divider()}
      {item("Delete", <Trash2 size={13} />, () => onDeleteTask(task.id), RED)}
    </div>
  );
}


// ═══════════════════════════════════════════════════
// TIMELINE VIEW (Gantt-style)
// ═══════════════════════════════════════════════════

function TimelineView({
  tasks, todayStr, onTaskClick,
}: {
  tasks: CrmTask[];
  todayStr: string;
  onTaskClick: (id: number) => void;
}) {
  const today = new Date();
  const start = startOfWeek(today, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start, end: addDays(start, 27) }); // 4 weeks
  const tasksWithDates = tasks.filter((t) => t.due_date && t.status !== "done")
    .sort((a, b) => (a.due_date || "").localeCompare(b.due_date || ""));

  return (
    <div style={{ background: CARD_BG, borderRadius: 10, border: `1px solid ${BORDER}`, overflow: "hidden" }}>
      {/* Header — dates */}
      <div style={{ display: "grid", gridTemplateColumns: `240px repeat(${days.length}, 1fr)`, borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ padding: "10px 16px", background: R.card }}>
          <span style={{ color: TEXT_DIM, fontSize: 10, fontWeight: 600, textTransform: "uppercase" }}>Task</span>
        </div>
        {days.map((d) => {
          const ds = format(d, "yyyy-MM-dd");
          const isToday = ds === todayStr;
          const isWeekend = d.getDay() === 0 || d.getDay() === 6;
          return (
            <div key={ds} style={{
              padding: "6px 2px", textAlign: "center", background: isToday ? `${BLUE}10` : isWeekend ? "rgba(255,255,255,0.015)" : R.card,
              borderLeft: `1px solid ${BORDER}`, borderBottom: isToday ? `2px solid ${BLUE}` : "none",
            }}>
              <div style={{ color: isToday ? BLUE : TEXT_DIM, fontSize: 9, fontWeight: 600 }}>{format(d, "EEE")}</div>
              <div style={{ color: isToday ? BLUE : TEXT_MID, fontSize: 11, fontWeight: isToday ? 700 : 400 }}>{format(d, "d")}</div>
            </div>
          );
        })}
      </div>

      {/* Rows */}
      {tasksWithDates.length === 0 && (
        <div style={{ padding: "40px 16px", textAlign: "center", color: TEXT_DIM, fontSize: 12 }}>
          No tasks with due dates in this period
        </div>
      )}
      {tasksWithDates.map((task, i) => {
        const pCfg = PRIORITY_CFG[task.priority];
        const dueDateObj = new Date(task.due_date! + "T00:00:00");
        const createdDateObj = new Date(task.created_at + "T00:00:00");
        const startCol = Math.max(0, differenceInCalendarDays(createdDateObj, start));
        const endCol = differenceInCalendarDays(dueDateObj, start);
        const isOverdue = task.due_date! < todayStr;

        return (
          <div key={task.id} onClick={() => onTaskClick(task.id)} style={{
            display: "grid", gridTemplateColumns: `240px repeat(${days.length}, 1fr)`,
            borderTop: i > 0 ? `1px solid ${BORDER}` : "none",
            cursor: "pointer", transition: "background 0.12s",
          }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(57,189,248,0.02)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <div style={{ padding: "10px 16px", display: "flex", alignItems: "center", gap: 8, borderRight: `1px solid ${BORDER}` }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: pCfg.color, flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ color: TEXT, fontSize: 11, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{task.title}</div>
                <div style={{ color: TEXT_DIM, fontSize: 10 }}>{task.assignee || "Unassigned"}</div>
              </div>
            </div>
            {days.map((d, di) => {
              const ds = format(d, "yyyy-MM-dd");
              const isInRange = di >= Math.max(0, startCol) && di <= endCol;
              const isStart = di === Math.max(0, startCol) && startCol >= 0;
              const isEnd = di === endCol;
              const isDueDay = ds === task.due_date;
              const isWeekend = d.getDay() === 0 || d.getDay() === 6;

              return (
                <div key={ds} style={{
                  borderLeft: `1px solid ${BORDER}`,
                  background: isWeekend ? "rgba(255,255,255,0.01)" : "transparent",
                  position: "relative", padding: "4px 1px", display: "flex", alignItems: "center",
                }}>
                  {isInRange && (
                    <div style={{
                      height: 22, width: "100%",
                      background: isOverdue ? `${RED}20` : `${pCfg.color}20`,
                      borderRadius: isStart && isEnd ? 4 : isStart ? "4px 0 0 4px" : isEnd ? "0 4px 4px 0" : 0,
                      border: isDueDay ? `1px solid ${isOverdue ? RED : pCfg.color}40` : "none",
                    }} />
                  )}
                  {isDueDay && (
                    <div style={{
                      position: "absolute", right: 2, top: "50%", transform: "translateY(-50%)",
                      width: 8, height: 8, borderRadius: "50%",
                      background: isOverdue ? RED : pCfg.color,
                    }} />
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}


// ═══════════════════════════════════════════════════
// MY WORK VIEW — personal dashboard
// ═══════════════════════════════════════════════════

function MyWorkView({
  tasks, todayStr, onTaskClick, dueDateTier, userName,
}: {
  tasks: CrmTask[];
  todayStr: string;
  onTaskClick: (id: number) => void;
  dueDateTier: (task: CrmTask) => string;
  userName: string;
}) {
  const myName = userName;
  const myTasks = tasks.filter((t) => t.assignee === myName && t.status !== "done");
  const overdue = myTasks.filter((t) => dueDateTier(t) === "overdue");
  const dueToday = myTasks.filter((t) => dueDateTier(t) === "today");
  const dueThisWeek = myTasks.filter((t) => dueDateTier(t) === "this_week");
  const upcoming = myTasks.filter((t) => !["overdue", "today", "this_week"].includes(dueDateTier(t)));
  const watching = tasks.filter((t) => t.assignee !== myName && t.status !== "done").slice(0, 5);

  function renderSection(title: string, items: CrmTask[], color: string, icon: React.ReactNode) {
    if (items.length === 0) return null;
    return (
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          {icon}
          <span style={{ color, fontSize: 13, fontWeight: 600 }}>{title}</span>
          <span style={{ color: TEXT_DIM, fontSize: 11 }}>({items.length})</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {items.map((task) => {
            const pCfg = PRIORITY_CFG[task.priority];
            const sCfg = STATUS_COLUMNS.find((s) => s.key === task.status)!;
            return (
              <div key={task.id} onClick={() => onTaskClick(task.id)} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "10px 16px",
                background: CARD_BG, borderRadius: 8, border: `1px solid ${BORDER}`,
                borderLeft: `3px solid ${pCfg.color}`, cursor: "pointer", transition: "all 0.12s",
              }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${BLUE}30`; e.currentTarget.style.boxShadow = "0 2px 8px rgba(57,189,248,0.06)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderLeftColor = pCfg.color; }}
              >
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: sCfg.color, flexShrink: 0 }} />
                <span style={{ color: TEXT, fontSize: 12, fontWeight: 500, flex: 1 }}>{task.title}</span>
                <span style={{ color: TEXT_DIM, fontSize: 10 }}>{task.hotel_name || "\u2014"}</span>
                <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: `${pCfg.color}12`, color: pCfg.color, fontWeight: 600 }}>{pCfg.label}</span>
                <span style={{ color: TEXT_DIM, fontSize: 10 }}>{task.due_date ? formatDate(task.due_date) : "\u2014"}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 28 }}>
        {[
          { label: "My Open Tasks", value: myTasks.length, color: BLUE },
          { label: "Overdue", value: overdue.length, color: RED },
          { label: "Due Today", value: dueToday.length, color: AMBER },
          { label: "Due This Week", value: dueThisWeek.length, color: PURPLE },
        ].map((card) => (
          <div key={card.label} style={{
            padding: "18px 20px", background: CARD_BG, borderRadius: 10, border: `1px solid ${BORDER}`,
          }}>
            <div style={{ color: TEXT_DIM, fontSize: 10, fontWeight: 600, textTransform: "uppercase", marginBottom: 8 }}>{card.label}</div>
            <div style={{ color: card.value > 0 ? card.color : TEXT_DIM, fontSize: 28, fontWeight: 700 }}>{card.value}</div>
          </div>
        ))}
      </div>

      {renderSection("Overdue", overdue, RED, <AlertTriangle size={14} style={{ color: RED }} />)}
      {renderSection("Due Today", dueToday, AMBER, <Clock size={14} style={{ color: AMBER }} />)}
      {renderSection("Due This Week", dueThisWeek, PURPLE, <Calendar size={14} style={{ color: PURPLE }} />)}
      {renderSection("Upcoming", upcoming, BLUE, <ArrowRight size={14} style={{ color: BLUE }} />)}

      {myTasks.length === 0 && (
        <div style={{ padding: "60px 16px", textAlign: "center", color: TEXT_DIM, fontSize: 14 }}>
          No open tasks assigned to you. Nice!
        </div>
      )}

      {/* Watching section */}
      {watching.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Eye size={14} style={{ color: TEXT_DIM }} />
            <span style={{ color: TEXT_DIM, fontSize: 13, fontWeight: 600 }}>Watching</span>
            <span style={{ color: TEXT_DIM, fontSize: 11 }}>(tasks assigned to others)</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {watching.map((task) => (
              <div key={task.id} onClick={() => onTaskClick(task.id)} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "8px 16px",
                background: "transparent", borderRadius: 6, border: `1px solid ${BORDER}`,
                cursor: "pointer", transition: "background 0.12s", opacity: 0.7,
              }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(57,189,248,0.02)"; e.currentTarget.style.opacity = "1"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.opacity = "0.7"; }}
              >
                <Avatar name={task.assignee || "?"} size={20} />
                <span style={{ color: TEXT_MID, fontSize: 11, width: 80 }}>{task.assignee}</span>
                <span style={{ color: TEXT, fontSize: 12, flex: 1 }}>{task.title}</span>
                <span style={{ color: TEXT_DIM, fontSize: 10 }}>{task.due_date ? formatDate(task.due_date) : "\u2014"}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════
// AUTOMATIONS PANEL
// ═══════════════════════════════════════════════════

function AutomationsPanel({
  automations, setAutomations, onClose,
}: {
  automations: Automation[];
  setAutomations: (a: Automation[]) => void;
  onClose: () => void;
}) {
  const [showNewRule, setShowNewRule] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTrigger, setNewTrigger] = useState("When status changes to Done");
  const [newAction, setNewAction] = useState("Send email to assignee");

  const triggers = [
    "When status changes to Done",
    "When status changes to Review",
    "When status changes to In Progress",
    "When task becomes overdue",
    "When urgent task has no update for 24h",
    "When task is created",
    "When priority changes to Urgent",
  ];

  const actions = [
    "Send email to assignee",
    "Send email to assignee + Karol",
    "Set assignee to Karol",
    "Set assignee to Maya",
    "Send Slack notification to #ops",
    "Archive task",
    "Set priority to Urgent",
    "Move to Review column",
  ];

  function toggleEnabled(id: string) {
    setAutomations(automations.map((a) => a.id === id ? { ...a, enabled: !a.enabled } : a));
  }

  function deleteAutomation(id: string) {
    setAutomations(automations.filter((a) => a.id !== id));
  }

  function addAutomation() {
    if (!newName.trim()) return;
    setAutomations([...automations, {
      id: `a${Date.now()}`,
      name: newName.trim(),
      trigger: newTrigger,
      action: newAction,
      enabled: true,
    }]);
    setNewName("");
    setShowNewRule(false);
  }

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50 }} />
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: 560,
        background: BG_PAGE, borderLeft: `1px solid ${BORDER}`, zIndex: 51,
        display: "flex", flexDirection: "column", boxShadow: "-8px 0 40px rgba(0,0,0,0.4)",
        animation: "slideInRight 0.2s ease-out",
      }}>
        <div style={{ padding: "18px 24px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <Zap size={18} style={{ color: AMBER }} />
          <span style={{ color: TEXT, fontSize: 16, fontWeight: 600, flex: 1 }}>Automations</span>
          <button onClick={() => setShowNewRule(!showNewRule)} style={{
            display: "flex", alignItems: "center", gap: 5, padding: "6px 14px", borderRadius: 6,
            border: "none", background: BLUE, color: R.sidebar, fontSize: 12, fontWeight: 600, cursor: "pointer",
          }}>
            <Plus size={13} /> New Rule
          </button>
          <button onClick={onClose} style={{ background: "none", border: "none", color: TEXT_DIM, cursor: "pointer", padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
          {showNewRule && (
            <div style={{ marginBottom: 20, padding: 16, background: CARD_BG, borderRadius: 10, border: `1px solid ${BLUE}30` }}>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Rule name..."
                style={{ width: "100%", padding: "8px 10px", background: INPUT_BG, border: `1px solid ${BORDER}`, borderRadius: 6, color: TEXT, fontSize: 13, outline: "none", marginBottom: 12 }} />
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ color: TEXT_DIM, fontSize: 10, fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Trigger</div>
                  <select value={newTrigger} onChange={(e) => setNewTrigger(e.target.value)}
                    style={{ width: "100%", padding: "7px 10px", background: INPUT_BG, border: `1px solid ${BORDER}`, borderRadius: 6, color: TEXT, fontSize: 12, outline: "none" }}>
                    {triggers.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: TEXT_DIM, fontSize: 10, fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Action</div>
                  <select value={newAction} onChange={(e) => setNewAction(e.target.value)}
                    style={{ width: "100%", padding: "7px 10px", background: INPUT_BG, border: `1px solid ${BORDER}`, borderRadius: 6, color: TEXT, fontSize: 12, outline: "none" }}>
                    {actions.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button onClick={() => setShowNewRule(false)} style={{ padding: "6px 14px", borderRadius: 6, border: `1px solid ${BORDER}`, background: INPUT_BG, color: TEXT_MID, fontSize: 12, cursor: "pointer" }}>Cancel</button>
                <button onClick={addAutomation} style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: BLUE, color: R.sidebar, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Add Rule</button>
              </div>
            </div>
          )}

          {automations.length === 0 && <div style={{ padding: "40px 0", textAlign: "center", color: TEXT_DIM, fontSize: 13 }}>No automation rules yet</div>}

          {automations.map((a) => (
            <div key={a.id} style={{
              display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", marginBottom: 8,
              background: CARD_BG, borderRadius: 8, border: `1px solid ${BORDER}`, opacity: a.enabled ? 1 : 0.5,
            }}>
              <Zap size={16} style={{ color: a.enabled ? AMBER : TEXT_DIM, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: TEXT, fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{a.name}</div>
                <div style={{ color: TEXT_DIM, fontSize: 11 }}>{a.trigger} &rarr; {a.action}</div>
              </div>
              <ToggleSwitch on={a.enabled} onToggle={() => toggleEnabled(a.id)} />
              <button onClick={() => deleteAutomation(a.id)} style={{
                background: "none", border: "none", color: TEXT_DIM, cursor: "pointer", padding: 4,
              }}><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      </div>
      <style>{`@keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
    </>
  );
}


// ═══════════════════════════════════════════════════
// TASK DETAIL PANEL (Jira-style slide-out)
// ═══════════════════════════════════════════════════

function TaskDetailPanel({
  task, allTasks, onClose, onUpdateTask, onDeleteTask, onRefresh,
  dependencies, setDependencies, watchers, setWatchers,
  onNavigateTask, userName,
}: {
  task: CrmTask;
  allTasks: CrmTask[];
  onClose: () => void;
  onUpdateTask: (id: number, data: Record<string, unknown>) => Promise<CrmTask>;
  onDeleteTask: (id: number) => Promise<void>;
  onRefresh: () => Promise<void>;
  dependencies: TaskDependency[];
  setDependencies: (d: TaskDependency[]) => void;
  watchers: TaskWatcher[];
  setWatchers: (w: TaskWatcher[]) => void;
  onNavigateTask: (id: number) => void;
  userName: string;
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

  const [comments, setComments] = useState<CrmTaskComment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [loadingComments, setLoadingComments] = useState(true);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const commentInputRef = useRef<HTMLInputElement>(null);

  // Local states for features
  const [newDepInput, setNewDepInput] = useState("");
  const [newDepType, setNewDepType] = useState<"blocks" | "blocked_by">("blocks");
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showAssigneePicker, setShowAssigneePicker] = useState(false);
  const [showPriorityPicker, setShowPriorityPicker] = useState(false);

  const taskDeps = dependencies.filter((d) => d.taskId === task.id);
  const taskWatchers = watchers.filter((w) => w.taskId === task.id);

  useEffect(() => {
    setLoadingComments(true);
    fetchComments(task.id).then((c) => { setComments(c); setLoadingComments(false); }).catch(() => setLoadingComments(false));
  }, [task.id]);

  const detailComments = useMemo(() => comments.filter((c) => c.type === "comment"), [comments]);
  const activityItems = useMemo(() => comments.filter((c) => c.type === "activity"), [comments]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  async function handleStatusChange(newStatus: TaskStatus) {
    setShowStatusPicker(false);
    await onUpdateTask(task.id, { status: newStatus, updated_by: userName });
    await onRefresh();
  }

  async function handlePriorityChange(newPriority: Priority) {
    setShowPriorityPicker(false);
    await onUpdateTask(task.id, { priority: newPriority, updated_by: userName });
    await onRefresh();
  }

  async function handleAssigneeChange(name: string) {
    setShowAssigneePicker(false);
    await onUpdateTask(task.id, { assignee: name, updated_by: userName });
    await onRefresh();
  }

  function handleCommentChange(value: string) {
    setCommentText(value);
    // Detect @mention trigger
    const cursorPos = commentInputRef.current?.selectionStart ?? value.length;
    const textBeforeCursor = value.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@(\w*)$/);
    if (atMatch) {
      setMentionOpen(true);
      setMentionFilter(atMatch[1].toLowerCase());
    } else {
      setMentionOpen(false);
      setMentionFilter("");
    }
  }

  function insertMention(name: string) {
    const cursorPos = commentInputRef.current?.selectionStart ?? commentText.length;
    const textBeforeCursor = commentText.slice(0, cursorPos);
    const atIdx = textBeforeCursor.lastIndexOf("@");
    if (atIdx >= 0) {
      const before = commentText.slice(0, atIdx);
      const after = commentText.slice(cursorPos);
      setCommentText(`${before}@${name} ${after}`);
    }
    setMentionOpen(false);
    setMentionFilter("");
    commentInputRef.current?.focus();
  }

  const mentionCandidates = team.filter((m) => m.name.toLowerCase().includes(mentionFilter));

  async function handleSubmitComment() {
    if (!commentText.trim()) return;
    await addComment(task.id, { author: userName, body: commentText.trim(), type: "comment" });
    setCommentText("");
    setMentionOpen(false);
    const c = await fetchComments(task.id);
    setComments(c);
    await onRefresh();
  }

  function addDependency() {
    const linkedId = parseInt(newDepInput);
    if (!linkedId || !allTasks.find((t) => t.id === linkedId) || linkedId === task.id) return;
    setDependencies([...dependencies, { taskId: task.id, type: newDepType, linkedTaskId: linkedId }]);
    setNewDepInput("");
  }

  function removeDependency(idx: number) {
    const taskSpecificDeps = dependencies.filter((d) => d.taskId === task.id);
    const toRemove = taskSpecificDeps[idx];
    if (toRemove) setDependencies(dependencies.filter((d) => d !== toRemove));
  }

  function addWatcher(name: string) {
    if (taskWatchers.find((w) => w.name === name)) return;
    setWatchers([...watchers, { taskId: task.id, name }]);
  }

  function removeWatcher(name: string) {
    setWatchers(watchers.filter((w) => !(w.taskId === task.id && w.name === name)));
  }

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50, transition: "opacity 0.2s" }} />

      <div ref={panelRef} style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: 720,
        background: BG_PAGE, borderLeft: `1px solid ${BORDER}`, zIndex: 51,
        display: "flex", flexDirection: "column", boxShadow: "-8px 0 40px rgba(0,0,0,0.4)",
        animation: "slideInRight 0.2s ease-out",
      }}>
        {/* Header */}
        <div style={{ padding: "14px 24px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <span style={{ color: TEXT_DIM, fontSize: 13, fontFamily: "monospace", fontWeight: 600 }}>CRM-{task.id}</span>
          <div style={{ flex: 1 }} />
          <button onClick={async () => { await onDeleteTask(task.id); onClose(); }} style={{
            background: "none", border: "none", color: TEXT_DIM, cursor: "pointer", padding: 4, borderRadius: 4,
          }}
            onMouseEnter={(e) => { e.currentTarget.style.color = RED; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = TEXT_DIM; }}
          >
            <Trash2 size={16} />
          </button>
          <button onClick={onClose} style={{ background: "none", border: "none", color: TEXT_DIM, cursor: "pointer", padding: 4, borderRadius: 4 }}
            onMouseEnter={(e) => (e.currentTarget.style.background = `${BORDER}`)}
            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}>
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>

          {/* Title */}
          <h2 style={{ color: TEXT, fontSize: 18, fontWeight: 600, margin: "0 0 18px 0", lineHeight: 1.35 }}>{task.title}</h2>

          {/* Status bar */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
            {/* Status */}
            <DetailField label="Status">
              <div style={{ position: "relative" }}>
                <button onClick={() => setShowStatusPicker(!showStatusPicker)} style={{
                  display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px",
                  borderRadius: 6, background: `${sCfg.color}12`, border: `1px solid ${sCfg.color}30`,
                  cursor: "pointer", transition: "all 0.15s",
                }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: sCfg.color }} />
                  <span style={{ color: sCfg.color, fontSize: 12, fontWeight: 600 }}>{sCfg.label}</span>
                  <ChevronDown size={11} style={{ color: sCfg.color }} />
                </button>
                {showStatusPicker && (
                  <div style={{
                    position: "absolute", top: "100%", left: 0, marginTop: 4, zIndex: 100,
                    background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 8,
                    boxShadow: "0 8px 24px rgba(0,0,0,0.5)", padding: "4px 0", minWidth: 160,
                  }}>
                    {STATUS_COLUMNS.map((s) => (
                      <button key={s.key} onClick={() => handleStatusChange(s.key)} style={{
                        display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 12px",
                        background: s.key === task.status ? `${s.color}10` : "transparent",
                        border: "none", cursor: "pointer", color: s.color, fontSize: 12, fontWeight: 600,
                      }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = `${s.color}10`)}
                        onMouseLeave={(e) => (e.currentTarget.style.background = s.key === task.status ? `${s.color}10` : "transparent")}
                      >
                        <div style={{ width: 7, height: 7, borderRadius: "50%", background: s.color }} />
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </DetailField>

            {/* Priority — editable dropdown */}
            <DetailField label="Priority">
              <div style={{ position: "relative" }}>
                <button onClick={() => setShowPriorityPicker(!showPriorityPicker)} style={{
                  display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px",
                  borderRadius: 6, background: `${pCfg.color}12`, border: `1px solid ${pCfg.color}30`,
                  cursor: "pointer", transition: "all 0.15s",
                }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: pCfg.color }} />
                  <span style={{ color: pCfg.color, fontSize: 12, fontWeight: 600 }}>{pCfg.label}</span>
                  <ChevronDown size={11} style={{ color: pCfg.color }} />
                </button>
                {showPriorityPicker && (
                  <div style={{
                    position: "absolute", top: "100%", left: 0, marginTop: 4, zIndex: 100,
                    background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 8,
                    boxShadow: "0 8px 24px rgba(0,0,0,0.5)", padding: "4px 0", minWidth: 140,
                  }}>
                    {(Object.entries(PRIORITY_CFG) as [Priority, typeof PRIORITY_CFG["urgent"]][]).map(([k, v]) => (
                      <button key={k} onClick={() => handlePriorityChange(k)} style={{
                        display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 12px",
                        background: k === task.priority ? `${v.color}10` : "transparent",
                        border: "none", cursor: "pointer", color: v.color, fontSize: 12, fontWeight: 600,
                      }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = `${v.color}10`)}
                        onMouseLeave={(e) => (e.currentTarget.style.background = k === task.priority ? `${v.color}10` : "transparent")}
                      >
                        <div style={{ width: 7, height: 7, borderRadius: "50%", background: v.color }} />
                        {v.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </DetailField>

            {/* Assignee — editable */}
            <DetailField label="Assignee">
              <div style={{ position: "relative" }}>
                <button onClick={() => setShowAssigneePicker(!showAssigneePicker)} style={{
                  display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px",
                  borderRadius: 6, background: `${member?.color || BLUE}12`, border: `1px solid ${member?.color || BLUE}30`,
                  cursor: "pointer", transition: "all 0.15s",
                }}>
                  <Avatar name={task.assignee || "?"} size={20} />
                  <span style={{ color: member?.color || TEXT, fontSize: 12, fontWeight: 600 }}>{task.assignee || "Unassigned"}</span>
                  <ChevronDown size={11} style={{ color: member?.color || TEXT_DIM }} />
                </button>
                {showAssigneePicker && (
                  <div style={{
                    position: "absolute", top: "100%", left: 0, marginTop: 4, zIndex: 100,
                    background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 8,
                    boxShadow: "0 8px 24px rgba(0,0,0,0.5)", padding: "4px 0", minWidth: 180,
                  }}>
                    {team.map((m) => (
                      <button key={m.name} onClick={() => handleAssigneeChange(m.name)} style={{
                        display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 12px",
                        background: m.name === task.assignee ? `${m.color}10` : "transparent",
                        border: "none", cursor: "pointer",
                      }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = `${m.color}10`)}
                        onMouseLeave={(e) => (e.currentTarget.style.background = m.name === task.assignee ? `${m.color}10` : "transparent")}
                      >
                        <Avatar name={m.name} size={22} />
                        <span style={{ color: TEXT, fontSize: 12 }}>{m.name}</span>
                      </button>
                    ))}
                  </div>
                )}
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
            <DetailField label={task.hotel_names?.length > 1 ? `Properties (${task.hotel_names.length})` : "Property"}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <Building2 size={13} style={{ color: BLUE, flexShrink: 0 }} />
                {task.hotel_names?.length > 0
                  ? task.hotel_names.map((n) => (
                    <span key={n} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: `${BLUE}10`, color: TEXT, border: `1px solid ${BLUE}15` }}>{n}</span>
                  ))
                  : <span style={{ color: TEXT, fontSize: 12 }}>{task.hotel_name || "\u2014"}</span>
                }
              </div>
            </DetailField>

            {/* Category */}
            <DetailField label="Category">
              <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 5, background: `${cCfg.color}12`, color: cCfg.color, fontWeight: 600 }}>{cCfg.label}</span>
            </DetailField>
          </div>

          {/* Watchers */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ color: TEXT_DIM, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
              <Eye size={11} /> Watchers
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              {taskWatchers.map((w) => (
                <div key={w.name} style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px 3px 4px", borderRadius: 6, background: INPUT_BG, border: `1px solid ${BORDER}` }}>
                  <Avatar name={w.name} size={18} />
                  <span style={{ color: TEXT_MID, fontSize: 11 }}>{w.name}</span>
                  <button onClick={() => removeWatcher(w.name)} style={{ background: "none", border: "none", color: TEXT_DIM, cursor: "pointer", padding: 0, lineHeight: 1 }}><X size={10} /></button>
                </div>
              ))}
              <div style={{ position: "relative" }}>
                <Popover>
                  <PopoverTrigger asChild>
                    <button style={{
                      width: 24, height: 24, borderRadius: 6, border: `1px dashed ${BORDER}`,
                      background: "transparent", color: TEXT_DIM, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}><Plus size={12} /></button>
                  </PopoverTrigger>
                  <PopoverContent className="z-[60]" style={{ background: CARD_BG, border: `1px solid ${BORDER}`, padding: "4px 0", width: 160, zIndex: 60 }} align="start">
                    {team.filter((m) => !taskWatchers.find((w) => w.name === m.name)).map((m) => (
                      <button key={m.name} onClick={() => addWatcher(m.name)} style={{
                        display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "6px 12px",
                        background: "transparent", border: "none", cursor: "pointer",
                      }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(57,189,248,0.05)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <Avatar name={m.name} size={18} />
                        <span style={{ color: TEXT_MID, fontSize: 11 }}>{m.name}</span>
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          {/* Tags */}
          {task.tags.length > 0 && (
            <div style={{ marginBottom: 20 }}>
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
                  }}>{task.description}</div>
                </div>
              )}

              {/* Dependencies */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ color: TEXT_DIM, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                  <Link2 size={11} /> Dependencies
                </div>
                {taskDeps.map((dep, idx) => {
                  const linked = allTasks.find((t) => t.id === dep.linkedTaskId);
                  return (
                    <div key={idx} style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", marginBottom: 4,
                      background: CARD_BG, borderRadius: 6, border: `1px solid ${BORDER}`,
                    }}>
                      <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 3, background: dep.type === "blocks" ? `${RED}15` : `${AMBER}15`, color: dep.type === "blocks" ? RED : AMBER, fontWeight: 600 }}>
                        {dep.type === "blocks" ? "BLOCKS" : "BLOCKED BY"}
                      </span>
                      <span onClick={() => { if (linked) onNavigateTask(linked.id); }} style={{ color: BLUE, fontSize: 12, cursor: "pointer" }}>
                        CRM-{dep.linkedTaskId}
                      </span>
                      <span style={{ color: TEXT_MID, fontSize: 11, flex: 1 }}>{linked?.title || "Unknown task"}</span>
                      <button onClick={() => removeDependency(idx)} style={{ background: "none", border: "none", color: TEXT_DIM, cursor: "pointer", padding: 2 }}><X size={12} /></button>
                    </div>
                  );
                })}
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  <select value={newDepType} onChange={(e) => setNewDepType(e.target.value as any)}
                    style={{ padding: "5px 8px", background: INPUT_BG, border: `1px solid ${BORDER}`, borderRadius: 5, color: TEXT, fontSize: 11, outline: "none" }}>
                    <option value="blocks">Blocks</option>
                    <option value="blocked_by">Blocked by</option>
                  </select>
                  <input value={newDepInput} onChange={(e) => setNewDepInput(e.target.value)} placeholder="Task ID..." type="number"
                    style={{ width: 80, padding: "5px 8px", background: INPUT_BG, border: `1px solid ${BORDER}`, borderRadius: 5, color: TEXT, fontSize: 11, outline: "none" }} />
                  <button onClick={addDependency} style={{ padding: "5px 10px", borderRadius: 5, border: "none", background: `${BLUE}15`, color: BLUE, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Link</button>
                </div>
              </div>

              {/* Comments */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ color: TEXT_DIM, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>Comments</div>

                {/* Comment input with @mention */}
                <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                  <Avatar name={userName} size={28} />
                  <div style={{ flex: 1, position: "relative" }}>
                    <input
                      ref={commentInputRef}
                      value={commentText} onChange={(e) => handleCommentChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (mentionOpen && e.key === "Escape") { setMentionOpen(false); e.preventDefault(); return; }
                        if (mentionOpen && e.key === "Enter" && mentionCandidates.length > 0) { insertMention(mentionCandidates[0].name); e.preventDefault(); return; }
                        if (e.key === "Enter") handleSubmitComment();
                      }}
                      placeholder="Write a comment... (type @ to mention)"
                      style={{
                        width: "100%", padding: "10px 42px 10px 14px", background: CARD_BG,
                        border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT, fontSize: 12, outline: "none",
                      }}
                    />
                    <button onClick={handleSubmitComment} style={{
                      position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)",
                      background: "none", border: "none", color: BLUE, cursor: "pointer", padding: 4,
                    }}><Send size={14} /></button>
                    {/* @mention dropdown */}
                    {mentionOpen && mentionCandidates.length > 0 && (
                      <div style={{
                        position: "absolute", left: 0, top: "100%", marginTop: 4, zIndex: 100,
                        background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 8,
                        padding: 4, minWidth: 180, boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                      }}>
                        {mentionCandidates.slice(0, 6).map((m) => (
                          <div key={m.name} onClick={() => insertMention(m.name)} style={{
                            display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
                            borderRadius: 6, cursor: "pointer", fontSize: 12, color: TEXT,
                          }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = `rgba(255,255,255,0.04)`)}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          >
                            <Avatar name={m.name} size={20} />
                            <span style={{ fontWeight: 500 }}>{m.name}</span>
                            {m.role && <span style={{ color: TEXT_DIM, fontSize: 10, marginLeft: "auto" }}>{m.role}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

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
                    }}>{c.body.split(/(@\w+)/g).map((part, pi) =>
                      part.startsWith("@") ? <span key={pi} style={{ color: BLUE, fontWeight: 600 }}>{part}</span> : part
                    )}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: 24, color: TEXT_DIM, fontSize: 11 }}>
                <span>Created {formatDateLong(task.created_at)}</span>
              </div>
            </div>
          )}

          {/* Activity Tab */}
          {activeTab === "activity" && (
            <div>
              <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
                <Avatar name={userName} size={28} />
                <div style={{ flex: 1, position: "relative" }}>
                  <input
                    value={commentText} onChange={(e) => handleCommentChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (mentionOpen && e.key === "Escape") { setMentionOpen(false); e.preventDefault(); return; }
                      if (mentionOpen && e.key === "Enter" && mentionCandidates.length > 0) { insertMention(mentionCandidates[0].name); e.preventDefault(); return; }
                      if (e.key === "Enter") handleSubmitComment();
                    }}
                    placeholder="Write a comment... (type @ to mention)"
                    style={{
                      width: "100%", padding: "10px 42px 10px 14px", background: CARD_BG,
                      border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT, fontSize: 12, outline: "none",
                    }}
                  />
                  <button onClick={handleSubmitComment} style={{
                    position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", color: BLUE, cursor: "pointer", padding: 4,
                  }}><Send size={14} /></button>
                  {mentionOpen && mentionCandidates.length > 0 && (
                    <div style={{
                      position: "absolute", left: 0, top: "100%", marginTop: 4, zIndex: 100,
                      background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 8,
                      padding: 4, minWidth: 180, boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                    }}>
                      {mentionCandidates.slice(0, 6).map((m) => (
                        <div key={m.name} onClick={() => insertMention(m.name)} style={{
                          display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
                          borderRadius: 6, cursor: "pointer", fontSize: 12, color: TEXT,
                        }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = `rgba(255,255,255,0.04)`)}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        >
                          <Avatar name={m.name} size={20} />
                          <span style={{ fontWeight: 500 }}>{m.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ position: "relative", paddingLeft: 20 }}>
                <div style={{ position: "absolute", left: 13, top: 0, bottom: 0, width: 1, background: BORDER }} />
                {activityItems.slice().reverse().map((item) => {
                  const isComment = item.body.startsWith("commented:");
                  return (
                    <div key={item.id} style={{ position: "relative", paddingLeft: 24, marginBottom: isComment ? 16 : 10 }}>
                      <div style={{
                        position: "absolute", left: -1, top: isComment ? 6 : 3,
                        width: 8, height: 8, borderRadius: "50%",
                        background: isComment ? BLUE : TEXT_DIM, border: `2px solid ${BG_PAGE}`,
                      }} />
                      {isComment ? (
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                            <Avatar name={item.author} size={22} />
                            <span style={{ color: TEXT, fontSize: 12, fontWeight: 600 }}>{item.author}</span>
                            <span style={{ color: TEXT_DIM, fontSize: 10 }}>{item.created_at}</span>
                          </div>
                          <div style={{
                            padding: "10px 14px", background: CARD_BG, borderRadius: 8,
                            border: `1px solid ${BORDER}`, color: TEXT_MID, fontSize: 12, lineHeight: 1.55,
                          }}>{item.body.replace(/^commented:\s*/, "")}</div>
                        </div>
                      ) : (
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

      <style>{`@keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
    </>
  );
}


// ═══════════════════════════════════════════════════
// CREATE TASK PANEL
// ═══════════════════════════════════════════════════

type NewPriority = "normal" | "urgent";

function CreateTaskPanel({
  onClose, onCreateTask, onCreateBulk, hotelNames, defaultStatus, userName,
}: {
  onClose: () => void;
  onCreateTask: (data: Record<string, unknown>) => Promise<CrmTask>;
  onCreateBulk: (tasks: Record<string, unknown>[]) => Promise<unknown>;
  hotelNames: string[];
  defaultStatus: TaskStatus | null;
  userName: string;
}) {
  const teamMembers = useTeam();
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const [allHotels, setAllHotels] = useState<{ hotel_id: number; property_name: string; management_group: string | null }[]>([]);
  useEffect(() => {
    fetch("/api/hotels").then(r => r.json()).then(data => {
      const managed = data.filter((h: any) => h.is_rockenue_managed && !h.is_disconnected);
      setAllHotels(managed.map((h: any) => ({ hotel_id: h.hotel_id, property_name: h.property_name, management_group: h.management_group })));
    }).catch(console.error);
  }, []);

  const allHotelNames = useMemo(() => allHotels.map(h => h.property_name).sort(), [allHotels]);

  const propertyGroups = useMemo(() => {
    const groups: { label: string; hotels: string[] }[] = [
      { label: "All Properties", hotels: allHotelNames },
    ];
    const groupMap: Record<string, string[]> = {};
    for (const h of allHotels) {
      if (h.management_group) {
        if (!groupMap[h.management_group]) groupMap[h.management_group] = [];
        groupMap[h.management_group].push(h.property_name);
      }
    }
    for (const [name, hotels] of Object.entries(groupMap).sort(([a], [b]) => a.localeCompare(b))) {
      if (hotels.length > 1) groups.push({ label: name, hotels });
    }
    return groups;
  }, [allHotels, allHotelNames]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selAssignee, setSelAssignee] = useState<string>("");
  const [selPriority, setSelPriority] = useState<NewPriority>("normal");
  const [selCategory, setSelCategory] = useState<TaskCategory>("distribution");
  const [selChannels, setSelChannels] = useState<string[]>([]);
  const [selectedHotels, setSelectedHotels] = useState<string[]>([]);
  const [showPropertyPicker, setShowPropertyPicker] = useState(false);
  const [propertySearch, setPropertySearch] = useState("");
  const [showChannelPicker, setShowChannelPicker] = useState(false);
  const [channelSearch, setChannelSearch] = useState("");
  const [dueDate, setDueDate] = useState<string>("");
  const [notifyAssignee, setNotifyAssignee] = useState(true);
  const [reminder, setReminder] = useState<"none" | "morning" | "day_before">("morning");
  const [escalate, setEscalate] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurFreq, setRecurFreq] = useState<"daily" | "weekly" | "biweekly" | "monthly">("weekly");
  const [creating, setCreating] = useState(false);
  const [titleError, setTitleError] = useState(false);
  const [selStatus, setSelStatus] = useState<TaskStatus>(defaultStatus || "todo");
  const [splitByChannel, setSplitByChannel] = useState(false);

  const propertyRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (propertyRef.current && !propertyRef.current.contains(e.target as Node)) setShowPropertyPicker(false);
      if (channelRef.current && !channelRef.current.contains(e.target as Node)) setShowChannelPicker(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function toggleHotel(h: string) { setSelectedHotels((prev) => prev.includes(h) ? prev.filter((x) => x !== h) : [...prev, h]); }
  function toggleGroup(hotels: string[]) {
    const available = hotels.filter((h) => allHotelNames.includes(h));
    const allSelected = available.every((h) => selectedHotels.includes(h));
    setSelectedHotels(allSelected ? (prev) => prev.filter((h) => !available.includes(h)) : (prev) => [...new Set([...prev, ...available])]);
  }
  function isGroupFullySelected(hotels: string[]) {
    const available = hotels.filter((h) => allHotelNames.includes(h));
    return available.length > 0 && available.every((h) => selectedHotels.includes(h));
  }
  function isGroupPartiallySelected(hotels: string[]) {
    const available = hotels.filter((h) => allHotelNames.includes(h));
    return available.some((h) => selectedHotels.includes(h)) && !available.every((h) => selectedHotels.includes(h));
  }
  function toggleChannel(ch: string) { setSelChannels((prev) => prev.includes(ch) ? prev.filter((x) => x !== ch) : [...prev, ch]); }

  const propertyLabel = selectedHotels.length === 0 ? "Select properties..." : selectedHotels.length === 1 ? selectedHotels[0] : `${selectedHotels.length} properties selected`;
  const channelLabel = selChannels.length === 0 ? "Select channels..." : selChannels.length === 1 ? selChannels[0] : `${selChannels.length} channels`;

  async function handleCreate() {
    if (creating) return;
    if (!title.trim()) {
      setTitleError(true);
      setTimeout(() => setTitleError(false), 1500);
      return;
    }
    setCreating(true);
    try {
      const hotelIds = selectedHotels
        .map((name) => allHotels.find((h) => h.property_name === name)?.hotel_id)
        .filter((id): id is number => id != null);

      const basePayload = {
        description: description.trim() || null,
        assignee: selAssignee || null,
        priority: selPriority === "urgent" ? "urgent" : "medium",
        status: selStatus,
        category: selCategory,
        due_date: dueDate || null,
        hotel_ids: hotelIds.length > 0 ? hotelIds : undefined,
        created_by: userName,
      };

      if (splitByChannel && selChannels.length > 1) {
        const tasks = selChannels.map((ch) => ({
          ...basePayload,
          title: `${title.trim()} — ${ch}`,
          tags: [ch],
        }));
        await onCreateBulk(tasks);
      } else {
        await onCreateTask({
          ...basePayload,
          title: title.trim(),
          tags: selChannels.length > 0 ? selChannels : [],
        } as any);
      }
      onClose();
    } catch (err) {
      console.error("Failed to create task", err);
    } finally {
      setCreating(false);
    }
  }

  const filteredHotels = allHotelNames.filter((h) => !propertySearch || h.toLowerCase().includes(propertySearch.toLowerCase()));
  const filteredChannels = OTA_CHANNELS_LIST.filter((ch) => !channelSearch || ch.toLowerCase().includes(channelSearch.toLowerCase()));

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
        <div style={{ padding: "20px 24px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 4, background: BLUE, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Plus size={18} style={{ color: R.sidebar }} />
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

        <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
          <div style={{ marginBottom: 24 }}>
            <input value={title} onChange={(e) => { setTitle(e.target.value); if (titleError) setTitleError(false); }} placeholder="What needs to be done?"
              autoFocus
              style={{
                width: "100%", padding: "10px 12px", background: INPUT_BG,
                border: `1px solid ${titleError ? RED : BORDER}`, borderRadius: 6,
                color: TEXT, fontSize: 18, fontWeight: 600, outline: "none",
                lineHeight: 1.4,
                fontFamily: "system-ui, -apple-system, sans-serif",
                animation: titleError ? "shake 0.4s ease" : "none",
                boxShadow: titleError ? `0 0 0 2px ${RED}30` : "none",
                transition: "border-color 0.2s, box-shadow 0.2s",
              }} />
            {titleError && <div style={{ color: RED, fontSize: 11, marginTop: 6, fontWeight: 500 }}>Task title is required</div>}
          </div>

          <div style={{ marginBottom: 24, background: BG_PAGE, borderRadius: 8, border: `1px solid ${BORDER}`, padding: "4px 16px" }}>

            {/* Status — when quick-adding from column */}
            <InlineField label="Status" icon={<Circle size={14} />}>
              <div style={{ display: "flex", gap: 6 }}>
                {STATUS_COLUMNS.map((s) => (
                  <button key={s.key} onClick={() => setSelStatus(s.key)} style={{
                    padding: "6px 14px", borderRadius: 6,
                    border: `1px solid ${selStatus === s.key ? `${s.color}40` : BORDER}`,
                    background: selStatus === s.key ? `${s.color}10` : "transparent",
                    color: selStatus === s.key ? s.color : TEXT_DIM,
                    fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
                  }}>{s.label}</button>
                ))}
              </div>
            </InlineField>

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
                  }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: selPriority === p.key ? p.color : TEXT_DIM }} />
                    {p.label}
                  </button>
                ))}
              </div>
            </InlineField>

            <InlineField label="Property" icon={<Building2 size={14} />}>
              <div ref={propertyRef} style={{ position: "relative" }}>
                <button onClick={() => setShowPropertyPicker(!showPropertyPicker)} style={{
                  padding: "10px 12px", background: INPUT_BG, border: `1px solid ${showPropertyPicker ? BLUE : BORDER}`,
                  borderRadius: 4, color: selectedHotels.length > 0 ? TEXT : TEXT_DIM, fontSize: 13, cursor: "pointer",
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
                    boxShadow: "0 8px 24px rgba(0,0,0,0.5)", width: 340, maxHeight: 440, display: "flex", flexDirection: "column",
                  }}>
                    <div style={{ padding: "10px 12px", borderBottom: `1px solid ${BORDER}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", background: INPUT_BG, borderRadius: 6, border: `1px solid ${BORDER}` }}>
                        <Search size={13} style={{ color: TEXT_DIM, flexShrink: 0 }} />
                        <input autoFocus value={propertySearch} onChange={(e) => setPropertySearch(e.target.value)} placeholder="Search properties..." style={{ flex: 1, background: "transparent", border: "none", color: TEXT, fontSize: 12, outline: "none" }} />
                      </div>
                    </div>
                    <div style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}>
                      {!propertySearch && propertyGroups.map((g) => (
                        <PickerItem key={g.label} label={g.label} bold checked={isGroupFullySelected(g.hotels)} partial={isGroupPartiallySelected(g.hotels)} onClick={() => toggleGroup(g.hotels)} />
                      ))}
                      {!propertySearch && <div style={{ height: 1, background: BORDER, margin: "6px 14px" }} />}
                      {filteredHotels.map((h) => <PickerItem key={h} label={h} checked={selectedHotels.includes(h)} onClick={() => toggleHotel(h)} />)}
                      {filteredHotels.length === 0 && <div style={{ padding: "16px 14px", color: TEXT_DIM, fontSize: 12, textAlign: "center" }}>No matches</div>}
                    </div>
                  </div>
                )}
              </div>
            </InlineField>

            <InlineField label="Channel" icon={<Globe size={14} />}>
              <div ref={channelRef} style={{ position: "relative" }}>
                <button onClick={() => setShowChannelPicker(!showChannelPicker)} style={{
                  padding: "10px 12px", background: INPUT_BG, border: `1px solid ${showChannelPicker ? BLUE : BORDER}`,
                  borderRadius: 4, color: selChannels.length > 0 ? TEXT : TEXT_DIM, fontSize: 13, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 8, minWidth: 240, transition: "border-color 0.15s",
                  justifyContent: "space-between", fontFamily: "system-ui, -apple-system, sans-serif",
                }}>
                  <span>{channelLabel}</span>
                  <ChevronDown size={14} style={{ color: TEXT_DIM, transition: "transform 0.15s", transform: showChannelPicker ? "rotate(180deg)" : "none" }} />
                </button>
                {showChannelPicker && (
                  <div style={{
                    position: "absolute", top: "100%", left: 0, marginTop: 6, zIndex: 100,
                    background: INPUT_BG, border: `1px solid ${BORDER}`, borderRadius: 10,
                    boxShadow: "0 8px 24px rgba(0,0,0,0.5)", width: 300, maxHeight: 340, display: "flex", flexDirection: "column",
                  }}>
                    <div style={{ padding: "10px 12px", borderBottom: `1px solid ${BORDER}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", background: INPUT_BG, borderRadius: 6, border: `1px solid ${BORDER}` }}>
                        <Search size={13} style={{ color: TEXT_DIM, flexShrink: 0 }} />
                        <input autoFocus value={channelSearch} onChange={(e) => setChannelSearch(e.target.value)} placeholder="Search channels..." style={{ flex: 1, background: "transparent", border: "none", color: TEXT, fontSize: 12, outline: "none" }} />
                      </div>
                    </div>
                    <div style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}>
                      {filteredChannels.map((ch) => <PickerItem key={ch} label={ch} checked={selChannels.includes(ch)} onClick={() => toggleChannel(ch)} />)}
                      {filteredChannels.length === 0 && <div style={{ padding: "16px 14px", color: TEXT_DIM, fontSize: 12, textAlign: "center" }}>No matches</div>}
                    </div>
                  </div>
                )}
              </div>
            </InlineField>

            {selChannels.length > 1 && (
              <InlineField label="" icon={<ClipboardList size={14} />}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flex: 1 }}>
                  <span style={{ color: TEXT, fontSize: 12, fontWeight: 500 }}>
                    Create <span style={{ color: BLUE, fontWeight: 700 }}>{selChannels.length} separate tasks</span> <span style={{ color: TEXT_DIM }}>(1 per channel)</span>
                  </span>
                  <ToggleSwitch on={splitByChannel} onToggle={() => setSplitByChannel(!splitByChannel)} />
                </div>
              </InlineField>
            )}

            <InlineField label="Category" icon={<Tag size={14} />}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {(Object.entries(CATEGORY_CFG) as [TaskCategory, { color: string; label: string }][]).map(([key, cfg]) => (
                  <button key={key} onClick={() => setSelCategory(key)} style={{
                    padding: "6px 14px", borderRadius: 6, border: `1px solid ${selCategory === key ? `${cfg.color}40` : BORDER}`,
                    background: selCategory === key ? `${cfg.color}10` : "transparent",
                    color: selCategory === key ? cfg.color : TEXT_DIM,
                    fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
                  }}>{cfg.label}</button>
                ))}
              </div>
            </InlineField>

            <InlineField label="Due Date" icon={<Calendar size={14} />}>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-start text-left h-9" style={{
                    backgroundColor: INPUT_BG, border: `1px solid ${BORDER}`,
                    color: dueDate ? TEXT : TEXT_DIM, fontSize: 13, minWidth: 200, borderRadius: 6,
                    fontFamily: "system-ui, -apple-system, sans-serif",
                  }}>
                    <Calendar size={14} style={{ marginRight: 8, color: TEXT_DIM }} />
                    {dueDate ? format(new Date(dueDate + "T00:00:00"), "dd MMM yyyy") : "Select date..."}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-[60]" align="start" style={{ backgroundColor: CARD_BG, border: `1px solid ${BORDER}`, zIndex: 60 }}>
                  <ShadcnCalendar mode="single" selected={dueDate ? new Date(dueDate + "T00:00:00") : undefined}
                    onSelect={(d) => d && setDueDate(format(d, "yyyy-MM-dd"))} initialFocus />
                </PopoverContent>
              </Popover>
            </InlineField>

            {/* Recurring toggle */}
            <InlineField label="Recurring" icon={<Repeat size={14} />}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <ToggleSwitch on={isRecurring} onToggle={() => setIsRecurring(!isRecurring)} />
                {isRecurring && (
                  <div style={{ display: "flex", gap: 4 }}>
                    {(["daily", "weekly", "biweekly", "monthly"] as const).map((f) => (
                      <button key={f} onClick={() => setRecurFreq(f)} style={{
                        padding: "5px 11px", borderRadius: 5, border: `1px solid ${recurFreq === f ? `${BLUE}40` : BORDER}`,
                        background: recurFreq === f ? `${BLUE}10` : "transparent",
                        color: recurFreq === f ? BLUE : TEXT_DIM,
                        fontSize: 11, fontWeight: 600, cursor: "pointer", textTransform: "capitalize",
                      }}>{f}</button>
                    ))}
                  </div>
                )}
              </div>
            </InlineField>
          </div>

          {/* Description */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ color: TEXT_MID, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "-0.025em", marginBottom: 8 }}>Description</div>
            <textarea rows={5} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Add details..."
              style={{
                width: "100%", padding: "10px 12px", background: INPUT_BG,
                border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT, fontSize: 13,
                outline: "none", resize: "vertical", lineHeight: 1.6,
                fontFamily: "system-ui, -apple-system, sans-serif",
              }} />
          </div>

          {/* Notifications */}
          <div style={{ background: BG_PAGE, borderRadius: 8, border: `1px solid ${BORDER}`, padding: "16px" }}>
            <div style={{ color: BLUE, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "-0.025em", marginBottom: 14 }}>Notifications</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div>
                <div style={{ color: TEXT, fontSize: 13, fontWeight: 500 }}>Notify assignee</div>
                <div style={{ color: TEXT_DIM, fontSize: 11, marginTop: 2 }}>Email sent when task is created</div>
              </div>
              <ToggleSwitch on={notifyAssignee} onToggle={() => setNotifyAssignee(!notifyAssignee)} />
            </div>
            <div style={{ height: 1, background: BORDER, marginBottom: 14 }} />
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
                    fontSize: 11, fontWeight: 600, cursor: "pointer",
                  }}>{r.label}</button>
                ))}
              </div>
            </div>
            <div style={{ height: 1, background: BORDER, marginBottom: 14 }} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ color: TEXT, fontSize: 13, fontWeight: 500 }}>Escalate if overdue</div>
                <div style={{ color: TEXT_DIM, fontSize: 11, marginTop: 2 }}>Notify director when task passes due date</div>
              </div>
              <ToggleSwitch on={escalate} onToggle={() => setEscalate(!escalate)} />
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, padding: "16px 24px", borderTop: `1px solid ${BORDER}`, flexShrink: 0 }}>
          <button onClick={onClose} style={{
            height: 40, padding: "0 20px", borderRadius: 6, border: `1px solid ${BORDER}`,
            background: INPUT_BG, color: TEXT, fontSize: 13, cursor: "pointer",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${BLUE}40`; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = BORDER; }}
          >Cancel</button>
          <button onClick={handleCreate} disabled={creating} style={{
            height: 40, padding: "0 24px", borderRadius: 6, border: "none",
            background: BLUE, color: R.sidebar,
            fontSize: 13, fontWeight: 600, cursor: creating ? "wait" : "pointer",
            fontFamily: "system-ui, -apple-system, sans-serif",
            opacity: creating ? 0.7 : 1,
          }}
            onMouseEnter={(e) => { if (!creating) e.currentTarget.style.background = "#29ADEE"; }}
            onMouseLeave={(e) => { if (!creating) e.currentTarget.style.background = BLUE; }}
          >{creating ? "Creating..." : (splitByChannel && selChannels.length > 1) ? `Create ${selChannels.length} Tasks` : "Create"}</button>
        </div>
      </div>

      <style>{`
        @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 20%, 60% { transform: translateX(-6px); } 40%, 80% { transform: translateX(6px); } }
      `}</style>
    </>
  );
}


// ═══════════════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════════════

function TaskCard({ task, onClick, onContextMenu, onDragStart, onDragEnd, isDragging, bulkMode, bulkSelected, onToggleBulk, dueTier }: {
  task: CrmTask;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  isDragging?: boolean;
  bulkMode: boolean;
  bulkSelected: boolean;
  onToggleBulk: () => void;
  dueTier: string;
}) {
  const pCfg = PRIORITY_CFG[task.priority];
  const cCfg = CATEGORY_CFG[task.category];
  const hotelDisplay = task.hotel_names?.length > 1 ? `${task.hotel_names.length} properties` : task.hotel_names?.[0] || task.hotel_name || "\u2014";
  const dueDateColor = dueTier === "overdue" ? RED : dueTier === "today" ? AMBER : dueTier === "this_week" ? PURPLE : TEXT_DIM;
  const dueDateLabel = dueTier === "overdue" ? "Overdue" : dueTier === "today" ? "Due today" : dueTier === "this_week" ? "This week" : "";

  return (
    <div
      draggable={!bulkMode}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={(e) => { if (bulkMode) { e.stopPropagation(); onToggleBulk(); } else onClick(); }}
      onContextMenu={onContextMenu}
      style={{
        backgroundColor: bulkSelected ? `${BLUE}08` : CARD_BG,
        borderRadius: 6, border: `1px solid ${bulkSelected ? `${BLUE}30` : BORDER}`,
        padding: "8px 10px", cursor: bulkMode ? "pointer" : "grab", transition: "all 0.15s",
        borderLeft: `3px solid ${cCfg.color}`,
        opacity: isDragging ? 0.4 : 1,
      }}
      onMouseEnter={(e) => { if (!isDragging) { e.currentTarget.style.borderColor = `${BLUE}30`; e.currentTarget.style.boxShadow = `0 2px 12px rgba(57,189,248,0.08)`; } }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = bulkSelected ? `${BLUE}30` : BORDER; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderLeftColor = cCfg.color; }}>
      {/* Row 1: ID + priority dot | assignee + badges */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          {bulkMode && (
            <div style={{
              width: 14, height: 14, borderRadius: 3, flexShrink: 0,
              border: `1.5px solid ${bulkSelected ? BLUE : "#444"}`,
              background: bulkSelected ? BLUE : "transparent",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {bulkSelected && <CheckCircle2 size={8} style={{ color: "#0d0d0d" }} />}
            </div>
          )}
          <span style={{ color: TEXT_DIM, fontSize: 9, fontFamily: "monospace" }}>CRM-{task.id}</span>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: pCfg.color, flexShrink: 0 }} title={pCfg.label} />
          {dueTier === "overdue" && <span style={{ color: RED, fontSize: 8, fontWeight: 700, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 2 }}><AlertTriangle size={8} /> Overdue</span>}
          {dueTier === "today" && <span style={{ color: AMBER, fontSize: 8, fontWeight: 600, textTransform: "uppercase" }}>Today</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {task.subtask_total > 0 && <span style={{ color: task.subtask_done === task.subtask_total ? GREEN : TEXT_DIM, fontSize: 9, display: "flex", alignItems: "center", gap: 2 }}><CheckCircle2 size={8} /> {task.subtask_done}/{task.subtask_total}</span>}
          {task.comment_count > 0 && <span style={{ color: TEXT_DIM, fontSize: 9, display: "flex", alignItems: "center", gap: 2 }}><MessageSquare size={8} /> {task.comment_count}</span>}
          <span style={{ color: TEXT, fontSize: 12, fontWeight: 600 }}>{task.assignee || "—"}</span>
          <Avatar name={task.assignee || "?"} size={24} />
        </div>
      </div>
      {/* Row 2: Title */}
      <div style={{ color: TEXT, fontSize: 12, fontWeight: 500, lineHeight: 1.4, marginBottom: 4 }}>{task.title}</div>
      {/* Row 3: Properties */}
      {hotelDisplay !== "\u2014" && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
          <Building2 size={9} style={{ color: TEXT_DIM, flexShrink: 0 }} />
          <span style={{ color: TEXT_MID, fontSize: 10, fontWeight: 500 }}>{hotelDisplay}</span>
        </div>
      )}
      {/* Row 4: Channel tags */}
      {task.tags.length > 0 && (
        <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginTop: 2 }}>
          {task.tags.slice(0, 4).map((tag) => (
            <span key={tag} style={{ fontSize: 9, padding: "1px 6px", borderRadius: 3, background: INPUT_BG, color: TEXT_DIM, border: `1px solid ${BORDER}`, whiteSpace: "nowrap" }}>{tag}</span>
          ))}
          {task.tags.length > 4 && <span style={{ fontSize: 9, color: TEXT_DIM }}>+{task.tags.length - 4}</span>}
        </div>
      )}
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
    }}>{initials}</div>
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
    <div style={{ display: "flex", alignItems: "center", gap: 0, padding: "12px 0", borderBottom: `1px solid ${BORDER}` }}>
      <div style={{ width: 130, display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <span style={{ color: TEXT_DIM }}>{icon}</span>
        <span style={{ color: TEXT_MID, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "-0.025em", fontFamily: "system-ui, -apple-system, sans-serif" }}>{label}</span>
      </div>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

function PickerItem({ label, checked, partial, bold, onClick }: { label: string; checked: boolean; partial?: boolean; bold?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px 14px",
      background: "transparent", border: "none", cursor: "pointer", transition: "background 0.12s", textAlign: "left",
    }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(57,189,248,0.05)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <div style={{
        width: 16, height: 16, borderRadius: 4, flexShrink: 0,
        border: `1.5px solid ${checked ? BLUE : partial ? BLUE : "#444"}`,
        background: checked ? BLUE : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {checked && <CheckCircle2 size={10} style={{ color: "#0d0d0d" }} />}
        {partial && !checked && <div style={{ width: 8, height: 2, borderRadius: 1, background: BLUE }} />}
      </div>
      <span style={{ color: checked ? TEXT : TEXT_MID, fontSize: 12, fontWeight: bold ? 600 : 400 }}>{label}</span>
    </button>
  );
}

function ToggleSwitch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} style={{
      width: 38, height: 22, borderRadius: 11, border: "none", cursor: "pointer",
      background: on ? BLUE : "#3f3f46", transition: "background 0.2s", position: "relative", flexShrink: 0,
    }}>
      <div style={{
        width: 16, height: 16, borderRadius: "50%", background: "#fff",
        position: "absolute", top: 3, left: on ? 19 : 3, transition: "left 0.2s",
      }} />
    </button>
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
