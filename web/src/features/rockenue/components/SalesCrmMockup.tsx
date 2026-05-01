import { useState, useMemo, useEffect, createContext, useContext } from "react";
import { R } from "../../../styles/tokens";
import {
  Search,
  Plus,
  X,
  Filter,
  Building2,
  User as UserIcon,
  Users,
  Mail,
  Phone,
  MessageSquare,
  ExternalLink,
  Calendar,
  Star,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  Activity as ActivityIcon,
  FileText,
  Send,
  Sparkles,
  ClipboardList,
  Briefcase,
  Globe,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

// ── Brand palette (mirrors CrmBoard.tsx) ──
const BLUE = R.warmTeal;
const GOLD = R.gold;
const GREEN = "#10b981";
const AMBER = "#f59e0b";
const RED = "#ef4444";
const PURPLE = "#7A8AB8";
const PINK = "#ec4899";
const ORANGE = "#f97316";
const BG_PAGE = R.bg;
const CARD_BG = R.darkBand;
const INPUT_BG = R.card;
const BORDER = R.border;
const TEXT = R.accent;
const TEXT_MID = R.textMid;
const TEXT_DIM = R.textDim;

// ─────────────────────────────────────────────
// TYPES (mirror prospective DB schema)
// ─────────────────────────────────────────────
type ProspectStatus =
  | "cold"
  | "studied"
  | "outreached"
  | "in_conversation"
  | "proposal"
  | "lost";

type Tab = "pipeline" | "companies" | "people" | "activity";

interface Person {
  id: number;
  full_name: string;
  job_title?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  linkedin_url?: string;
}

interface Company {
  id: number;
  name: string;
  companies_house_number?: string;
  company_type: "management_co" | "operating_co" | "holding_co" | "family_office" | "unknown";
  website?: string;
  hotel_count: number;
  primary_contact_id?: number;
  notes?: string;
}

interface ActivityEntry {
  id: number;
  hotel_id: number;
  hotel_name: string;
  type:
    | "email_sent" | "email_received" | "whatsapp_sent" | "whatsapp_received"
    | "call" | "meeting" | "study_generated" | "note" | "status_change"
    | "prospect_scored" | "agent_research";
  actor: string;
  subject?: string;
  body?: string;
  artifact_url?: string;
  created_at: string;
}

interface Prospect {
  hotel_id: number;
  property_name: string;
  city: string;
  rooms: number;
  star_rating: 3 | 4 | 5;
  prospect_status: ProspectStatus;
  prospect_score?: number;
  prospect_owner?: string;
  company_id?: number;
  primary_person_id?: number;
  last_activity_at?: string;
  last_activity_summary?: string;
  study_generated_at?: string;
  study_artifact_url?: string;
  booking_property_id?: string;
  parity_leak_pct?: number;
  b2b_coverage_pct?: number;
  // Transient sub-states (rendered as card badges, not separate columns)
  agent_busy?: boolean;       // currently being researched by agent
  demo_at?: string;           // upcoming demo (in_conversation column)
  signed_at?: string;         // signed, promoting to Live (proposal column)
}

// ─────────────────────────────────────────────
// SALES DATA CONTEXT
// (Lets the same UI render against either hardcoded mocks (Studio entry) or
//  live API data (real Sales entry) without prop drilling.)
// ─────────────────────────────────────────────
interface SalesData {
  prospects: Prospect[];
  companies: Company[];
  people: Person[];
  activities: ActivityEntry[];
}

interface SalesContextValue extends SalesData {
  setProspects: (updater: (prev: Prospect[]) => Prospect[]) => void;
  readOnly: boolean;
}

const SalesDataContext = createContext<SalesContextValue | null>(null);

function useSalesData(): SalesContextValue {
  const ctx = useContext(SalesDataContext);
  if (!ctx) throw new Error("useSalesData must be used inside <SalesDataContext.Provider>");
  return ctx;
}

// ─────────────────────────────────────────────
// STATUS CONFIG
// ─────────────────────────────────────────────
const STATUS_COLUMNS: { key: ProspectStatus; label: string; color: string; description: string }[] = [
  { key: "cold", label: "Cold", color: TEXT_MID, description: "Discovered, no contact yet" },
  { key: "studied", label: "Studied", color: BLUE, description: "Study done, ready to outreach" },
  { key: "outreached", label: "Outreached", color: GOLD, description: "Message sent, awaiting reply" },
  { key: "in_conversation", label: "In Conversation", color: AMBER, description: "Replied, demo, follow-ups" },
  { key: "proposal", label: "Proposal", color: PINK, description: "Proposal sent — auto-promotes to Live on signature" },
  { key: "lost", label: "Lost", color: RED, description: "Did not convert" },
];

const COMPANY_TYPE_CFG: Record<Company["company_type"], { label: string; color: string }> = {
  management_co: { label: "Management Co", color: BLUE },
  operating_co: { label: "Operating Co", color: PURPLE },
  holding_co: { label: "Holding", color: GOLD },
  family_office: { label: "Family Office", color: PINK },
  unknown: { label: "Unknown", color: TEXT_DIM },
};

const ACTIVITY_TYPE_CFG: Record<ActivityEntry["type"], { label: string; icon: typeof Mail; color: string }> = {
  email_sent: { label: "Email sent", icon: Send, color: BLUE },
  email_received: { label: "Email received", icon: Mail, color: GREEN },
  whatsapp_sent: { label: "WhatsApp sent", icon: Send, color: BLUE },
  whatsapp_received: { label: "WhatsApp received", icon: MessageSquare, color: GREEN },
  call: { label: "Call", icon: Phone, color: BLUE },
  meeting: { label: "Meeting", icon: Calendar, color: ORANGE },
  study_generated: { label: "Study generated", icon: FileText, color: PURPLE },
  note: { label: "Note", icon: ClipboardList, color: TEXT_MID },
  status_change: { label: "Status change", icon: ArrowRight, color: GOLD },
  prospect_scored: { label: "Re-scored", icon: TrendingUp, color: BLUE },
  agent_research: { label: "Agent research", icon: Sparkles, color: PURPLE },
};

// ─────────────────────────────────────────────
// MOCK DATA
// ─────────────────────────────────────────────
const STATIC_MOCK_COMPANIES: Company[] = [
  { id: 1, name: "Vilenza Hotels", companies_house_number: "08234567", company_type: "management_co", website: "vilenza.co.uk", hotel_count: 7, primary_contact_id: 1 },
  { id: 2, name: "Shreeji Hospitality Group", companies_house_number: "06123456", company_type: "holding_co", hotel_count: 11, primary_contact_id: 2 },
  { id: 3, name: "Clay Hill Management Ltd", companies_house_number: "11456789", company_type: "operating_co", hotel_count: 7, primary_contact_id: 3 },
  { id: 4, name: "Mason & Fifth Ltd", companies_house_number: "12345678", company_type: "operating_co", website: "masonandfifth.com", hotel_count: 3, primary_contact_id: 4 },
  { id: 5, name: "Heritage Properties Ltd", companies_house_number: "09876543", company_type: "operating_co", hotel_count: 1, primary_contact_id: 5 },
  { id: 6, name: "Soho Hospitality Group", company_type: "unknown", hotel_count: 1, primary_contact_id: 6 },
];

const STATIC_MOCK_PEOPLE: Person[] = [
  { id: 1, full_name: "Minaz Asaria", job_title: "Owner", email: "minaz@vilenza.co.uk", phone: "+44 20 7946 0001", whatsapp: "+447700900001" },
  { id: 2, full_name: "Rajesh Patel", job_title: "Director", email: "rajesh@shreeji.co.uk", phone: "+44 20 7946 0002" },
  { id: 3, full_name: "Robert Gabriele", job_title: "Asset Manager", email: "robert@clayhill.co.uk", phone: "+44 20 7946 0003", whatsapp: "+447700900003" },
  { id: 4, full_name: "James Penfold", job_title: "Co-Founder", email: "james@masonandfifth.com", linkedin_url: "linkedin.com/in/jpenfold" },
  { id: 5, full_name: "Sarah Whitman", job_title: "Owner", email: "sarah@heritageproperties.co.uk", phone: "+44 20 7946 0005" },
  { id: 6, full_name: "Mark Levinson", job_title: "Managing Director", email: "mark@sohohospitality.com", phone: "+44 20 7946 0006" },
  { id: 7, full_name: "Aisha Rahman", job_title: "Revenue Manager", email: "aisha.rahman@ealinginnhotel.com" },
  { id: 8, full_name: "Tom Bridgewater", job_title: "GM", email: "tom@bayswaterboutique.com", phone: "+44 20 7946 0008" },
  { id: 9, full_name: "Eleanor Vance", job_title: "Owner", email: "eleanor@ellenkensington.com", phone: "+44 20 7946 0009", linkedin_url: "linkedin.com/in/evance" },
  { id: 10, full_name: "Daniel Chen", job_title: "Asset Manager", email: "daniel@hydeparkheritage.com" },
  { id: 11, full_name: "Priya Shah", job_title: "Operations Director", email: "priya@bloomsburysquare.co.uk", phone: "+44 20 7946 0011" },
  { id: 12, full_name: "Oliver Hartwell", job_title: "Owner", email: "oliver@kingscrossannex.com" },
];

const STATIC_MOCK_PROSPECTS: Prospect[] = [
  // COLD
  { hotel_id: 9001, property_name: "The Ealing Inn", city: "London", rooms: 42, star_rating: 3, prospect_status: "cold", primary_person_id: 7, last_activity_at: "2026-04-26T22:14:00Z", last_activity_summary: "Discovered via Booking.com search", booking_property_id: "BK-9001", parity_leak_pct: 18 },
  { hotel_id: 9002, property_name: "Bayswater Boutique", city: "London", rooms: 64, star_rating: 4, prospect_status: "cold", primary_person_id: 8, last_activity_at: "2026-04-26T22:14:00Z", last_activity_summary: "Discovered via Booking.com search", booking_property_id: "BK-9002", parity_leak_pct: 24 },
  { hotel_id: 9003, property_name: "Camden Cross Hotel", city: "London", rooms: 51, star_rating: 3, prospect_status: "cold", last_activity_at: "2026-04-26T22:14:00Z", last_activity_summary: "Discovered via Booking.com search", booking_property_id: "BK-9003", parity_leak_pct: 12 },
  // COLD + agent busy (was previously its own "Researching" column)
  { hotel_id: 9010, property_name: "Marylebone Mews Hotel", city: "London", rooms: 38, star_rating: 4, prospect_status: "cold", agent_busy: true, prospect_score: 612, prospect_owner: "Karol", last_activity_at: "2026-04-27T07:32:00Z", last_activity_summary: "Agent generating study", booking_property_id: "BK-9010", parity_leak_pct: 31 },
  // STUDIED
  { hotel_id: 9020, property_name: "Ellen Kensington", city: "London", rooms: 78, star_rating: 4, prospect_status: "studied", prospect_score: 847, prospect_owner: "Karol", company_id: 5, primary_person_id: 9, last_activity_at: "2026-04-26T18:42:00Z", last_activity_summary: "Study generated — 34% parity leak", study_generated_at: "2026-04-26T18:42:00Z", study_artifact_url: "/studies/9020/20260426/dashboard.html", booking_property_id: "BK-9020", parity_leak_pct: 34, b2b_coverage_pct: 22 },
  { hotel_id: 9021, property_name: "Hyde Park Heritage", city: "London", rooms: 92, star_rating: 4, prospect_status: "studied", prospect_score: 731, prospect_owner: "Karol", primary_person_id: 10, last_activity_at: "2026-04-25T15:10:00Z", last_activity_summary: "Study ready for review", study_generated_at: "2026-04-25T15:10:00Z", study_artifact_url: "/studies/9021/20260425/dashboard.html", booking_property_id: "BK-9021", parity_leak_pct: 21, b2b_coverage_pct: 45 },
  { hotel_id: 9022, property_name: "Soho Lane Hotel", city: "London", rooms: 56, star_rating: 4, prospect_status: "studied", prospect_score: 689, prospect_owner: "Karol", company_id: 6, primary_person_id: 6, last_activity_at: "2026-04-24T12:00:00Z", last_activity_summary: "Study generated", study_generated_at: "2026-04-24T12:00:00Z", study_artifact_url: "/studies/9022/20260424/dashboard.html", booking_property_id: "BK-9022", parity_leak_pct: 19, b2b_coverage_pct: 67 },
  // OUTREACHED
  { hotel_id: 9030, property_name: "Pimlico Court", city: "London", rooms: 44, star_rating: 3, prospect_status: "outreached", prospect_score: 540, prospect_owner: "Karol", last_activity_at: "2026-04-23T09:15:00Z", last_activity_summary: "Cold email sent", booking_property_id: "BK-9030" },
  { hotel_id: 9031, property_name: "Earls Court Manor", city: "London", rooms: 67, star_rating: 4, prospect_status: "outreached", prospect_score: 612, prospect_owner: "Karol", last_activity_at: "2026-04-22T14:00:00Z", last_activity_summary: "Cold email + follow-up sent", booking_property_id: "BK-9031" },
  // IN CONVERSATION (replied, no demo yet)
  { hotel_id: 9040, property_name: "Greenwich Quay Hotel", city: "London", rooms: 88, star_rating: 4, prospect_status: "in_conversation", prospect_score: 778, prospect_owner: "Karol", last_activity_at: "2026-04-26T11:30:00Z", last_activity_summary: "GM replied — interested in 15-min call", booking_property_id: "BK-9040" },
  // IN CONVERSATION + demo on calendar
  { hotel_id: 9050, property_name: "Bloomsbury Square Hotel", city: "London", rooms: 102, star_rating: 4, prospect_status: "in_conversation", demo_at: "2026-05-02T10:00:00Z", prospect_score: 891, prospect_owner: "Karol", primary_person_id: 11, last_activity_at: "2026-04-25T16:00:00Z", last_activity_summary: "Demo confirmed for 2026-05-02 10:00", booking_property_id: "BK-9050" },
  // PROPOSAL
  { hotel_id: 9070, property_name: "Wapping Riverside Hotel", city: "London", rooms: 74, star_rating: 4, prospect_status: "proposal", prospect_score: 812, prospect_owner: "Karol", last_activity_at: "2026-04-26T09:00:00Z", last_activity_summary: "Proposal sent — awaiting signature", booking_property_id: "BK-9070" },
  // PROPOSAL + signed (transient — auto-promotes to Live in Task module)
  { hotel_id: 9071, property_name: "Maida Vale Townhouse", city: "London", rooms: 28, star_rating: 4, prospect_status: "proposal", signed_at: "2026-04-27T08:15:00Z", prospect_score: 855, prospect_owner: "Karol", last_activity_at: "2026-04-27T08:15:00Z", last_activity_summary: "Contract signed — promoting to Live", booking_property_id: "BK-9071" },
  // LOST
  { hotel_id: 9090, property_name: "Kings Cross Annex", city: "London", rooms: 36, star_rating: 3, prospect_status: "lost", prospect_score: 412, prospect_owner: "Karol", primary_person_id: 12, last_activity_at: "2026-04-15T10:00:00Z", last_activity_summary: "Lost to competitor (RoomPriceGenie)" },
];

const STATIC_MOCK_ACTIVITIES: ActivityEntry[] = [
  { id: 1, hotel_id: 9020, hotel_name: "Ellen Kensington", type: "study_generated", actor: "agent:study_generator", subject: "Study generated", body: "Parity leak: 34%. B2B coverage: 22%. Top angle: deep-deal stack visible on Hotelbeds.", artifact_url: "/studies/9020/20260426/dashboard.html", created_at: "2026-04-26T18:42:00Z" },
  { id: 2, hotel_id: 9020, hotel_name: "Ellen Kensington", type: "prospect_scored", actor: "agent:prospect_scorer", body: "Score: 847 (size 1.2 × leak 1.9 × persona 1.5 × recency 1.0)", created_at: "2026-04-26T18:45:00Z" },
  { id: 3, hotel_id: 9050, hotel_name: "Bloomsbury Square Hotel", type: "meeting", actor: "Karol", subject: "Demo booked", body: "Confirmed for 2026-05-02 10:00 GMT — calendar invite sent.", created_at: "2026-04-25T16:00:00Z" },
  { id: 4, hotel_id: 9040, hotel_name: "Greenwich Quay Hotel", type: "email_received", actor: "agent:reply_triager", subject: "Re: Quick parity question", body: "Yes happy to chat. Thursday afternoon any good?", created_at: "2026-04-26T11:30:00Z" },
  { id: 5, hotel_id: 9030, hotel_name: "Pimlico Court", type: "email_sent", actor: "Karol", subject: "Quick parity question for Pimlico Court", body: "Hi — noticed your Booking.com rates lag your direct site by ~12% on weekday stays. Worth a quick chat?", created_at: "2026-04-23T09:15:00Z" },
  { id: 6, hotel_id: 9001, hotel_name: "The Ealing Inn", type: "agent_research", actor: "agent:prospect_discoverer", subject: "Discovered via Booking.com search", body: "3-star, 42 keys, independent. Parity violations visible in Hotelbeds + Mr & Mrs Smith.", created_at: "2026-04-26T22:14:00Z" },
  { id: 7, hotel_id: 9020, hotel_name: "Ellen Kensington", type: "agent_research", actor: "agent:prospect_discoverer", subject: "Section 14 scrape complete", body: "147 rate rows captured across 5 OTAs + 2 metasearch. B2B leakage: 22% of inventory.", created_at: "2026-04-26T18:30:00Z" },
  { id: 8, hotel_id: 9090, hotel_name: "Kings Cross Annex", type: "status_change", actor: "Karol", subject: "Marked as Lost", body: "Reason: competitor_won (RoomPriceGenie). Notes: 'Already 6 months in.'", created_at: "2026-04-15T10:00:00Z" },
  { id: 9, hotel_id: 9050, hotel_name: "Bloomsbury Square Hotel", type: "whatsapp_received", actor: "agent:inbound_triage", subject: "WhatsApp from Priya Shah", body: "Hi Karol — got your email. Free to chat tomorrow at 14:00?", created_at: "2026-04-24T17:42:00Z" },
  { id: 10, hotel_id: 9022, hotel_name: "Soho Lane Hotel", type: "study_generated", actor: "agent:study_generator", subject: "Study generated", body: "Parity leak: 19%. B2B coverage: 67%. Lower-priority — owner already on RM tool.", artifact_url: "/studies/9022/20260424/dashboard.html", created_at: "2026-04-24T12:00:00Z" },
];

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7);
  return `${w}w ago`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function getInitials(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function Avatar({ name, size = 24, color }: { name: string; size?: number; color?: string }) {
  const isAgent = name.startsWith("agent:");
  const display = isAgent ? "AI" : getInitials(name);
  const bg = color ?? (isAgent ? PURPLE : BLUE);
  return (
    <div style={{
      width: size, height: size, borderRadius: size / 2,
      background: `${bg}25`, color: bg,
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      fontSize: Math.max(9, size * 0.42), fontWeight: 700,
      border: `1px solid ${bg}40`, flexShrink: 0,
    }}>
      {display}
    </div>
  );
}

function StatusPill({ status }: { status: ProspectStatus }) {
  const cfg = STATUS_COLUMNS.find((s) => s.key === status)!;
  return (
    <span style={{
      fontSize: 10, padding: "2px 8px", borderRadius: 10,
      background: `${cfg.color}15`, color: cfg.color,
      border: `1px solid ${cfg.color}30`,
      fontWeight: 600, letterSpacing: "0.3px", textTransform: "uppercase",
      whiteSpace: "nowrap",
    }}>
      {cfg.label}
    </span>
  );
}

function ScoreBadge({ score }: { score?: number }) {
  if (score === undefined) return null;
  const tone = score >= 800 ? GREEN : score >= 600 ? GOLD : score >= 400 ? AMBER : TEXT_DIM;
  return (
    <span style={{
      fontSize: 10, padding: "2px 6px", borderRadius: 4,
      background: `${tone}15`, color: tone,
      border: `1px solid ${tone}25`,
      fontWeight: 700, fontFamily: "monospace",
    }}>
      {Math.round(score)}
    </span>
  );
}

// ─────────────────────────────────────────────
// PRESENTATIONAL UI (consumes SalesDataContext)
// ─────────────────────────────────────────────
function SalesUI({ headerVariant = "mockup" }: { headerVariant?: "mockup" | "live" }) {
  const { prospects: MOCK_PROSPECTS, companies: MOCK_COMPANIES, people: MOCK_PEOPLE, activities: MOCK_ACTIVITIES } = useSalesData();

  const [tab, setTab] = useState<Tab>("pipeline");
  const [search, setSearch] = useState("");
  const [selectedProspectId, setSelectedProspectId] = useState<number | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(null);

  const selectedProspect = useMemo(
    () => MOCK_PROSPECTS.find((p) => p.hotel_id === selectedProspectId) ?? null,
    [selectedProspectId, MOCK_PROSPECTS]
  );

  const counts = useMemo(() => {
    const c: Record<ProspectStatus, number> = {
      cold: 0, studied: 0, outreached: 0,
      in_conversation: 0, proposal: 0, lost: 0,
    };
    for (const p of MOCK_PROSPECTS) c[p.prospect_status]++;
    return c;
  }, [MOCK_PROSPECTS]);

  const totalProspects = MOCK_PROSPECTS.filter((p) => p.prospect_status !== "lost").length;
  const lateStage = counts.in_conversation + counts.proposal;
  const awaitingFollowUp = MOCK_PROSPECTS.filter((p) => p.prospect_status === "in_conversation" && !p.demo_at).length;

  return (
    <div style={{
      minHeight: "100vh", background: BG_PAGE, color: TEXT,
      fontFamily: "Inter, system-ui, sans-serif",
      display: "flex", flexDirection: "column",
    }}>
      <style>{`
        @keyframes salesPulse {
          0%, 100% { opacity: 0.4; transform: scale(0.85); }
          50% { opacity: 1; transform: scale(1.15); }
        }
      `}</style>

      {/* HEADER */}
      <div style={{
        padding: "20px 28px 0 28px", borderBottom: `1px solid ${BORDER}`,
        background: BG_PAGE, position: "sticky", top: 0, zIndex: 5,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <Briefcase size={18} color={GOLD} />
              <h1 style={{ fontSize: 18, fontWeight: 600, letterSpacing: "0.2px", margin: 0, color: TEXT }}>
                Sales
              </h1>
              <span style={{
                fontSize: 9, padding: "2px 8px", borderRadius: 10,
                background: headerVariant === "live" ? `${GREEN}15` : `${GOLD}15`,
                color: headerVariant === "live" ? GREEN : GOLD,
                border: `1px solid ${headerVariant === "live" ? GREEN : GOLD}30`,
                fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase",
              }}>
                {headerVariant === "live" ? "Live" : "Mockup"}
              </span>
            </div>
            <div style={{ fontSize: 12, color: TEXT_DIM }}>
              {totalProspects} active prospects · {lateStage} late-stage · {awaitingFollowUp} awaiting follow-up
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <SearchBox value={search} onChange={setSearch} />
            <button style={btnSecondary}>
              <Filter size={13} />
              Filters
            </button>
            <button style={btnPrimary}>
              <Plus size={13} />
              Add Prospect
            </button>
          </div>
        </div>

        {/* TABS */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <TabButton active={tab === "pipeline"} onClick={() => setTab("pipeline")} icon={<TrendingUp size={13} />} label="Pipeline" count={totalProspects} />
          <TabButton active={tab === "companies"} onClick={() => setTab("companies")} icon={<Building2 size={13} />} label="Companies" count={MOCK_COMPANIES.length} />
          <TabButton active={tab === "people"} onClick={() => setTab("people")} icon={<Users size={13} />} label="People" count={MOCK_PEOPLE.length} />
          <TabButton active={tab === "activity"} onClick={() => setTab("activity")} icon={<ActivityIcon size={13} />} label="Activity" count={MOCK_ACTIVITIES.length} />
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ flex: 1, padding: "20px 28px", overflow: "auto" }}>
        {tab === "pipeline" && (
          <PipelineTab
            search={search}
            onCardClick={(id) => setSelectedProspectId(id)}
          />
        )}
        {tab === "companies" && (
          <CompaniesTab
            search={search}
            onRowClick={(id) => setSelectedCompanyId(id)}
          />
        )}
        {tab === "people" && (
          <PeopleTab
            search={search}
            onRowClick={(id) => setSelectedPersonId(id)}
          />
        )}
        {tab === "activity" && <ActivityTab search={search} onHotelClick={(id) => setSelectedProspectId(id)} />}
      </div>

      {/* SIDE PANELS */}
      {selectedProspect && (
        <ProspectDetailPanel
          prospect={selectedProspect}
          onClose={() => setSelectedProspectId(null)}
        />
      )}
      {selectedCompanyId !== null && (
        <CompanyDetailPanel
          companyId={selectedCompanyId}
          onClose={() => setSelectedCompanyId(null)}
        />
      )}
      {selectedPersonId !== null && (
        <PersonDetailPanel
          personId={selectedPersonId}
          onClose={() => setSelectedPersonId(null)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// HEADER PRIMITIVES
// ─────────────────────────────────────────────
function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "6px 12px", borderRadius: 8,
      background: INPUT_BG, border: `1px solid ${BORDER}`,
      width: 260,
    }}>
      <Search size={13} color={TEXT_DIM} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search hotels, people, companies…"
        style={{
          flex: 1, background: "transparent", border: "none", outline: "none",
          color: TEXT, fontSize: 12, padding: 0,
        }}
      />
      {value && (
        <X size={13} color={TEXT_DIM} style={{ cursor: "pointer" }} onClick={() => onChange("")} />
      )}
    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "7px 14px", borderRadius: 8,
  background: GOLD, color: "#1a1a1a",
  fontSize: 12, fontWeight: 600, border: "none",
  cursor: "pointer", letterSpacing: "0.2px",
};

const btnSecondary: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "7px 12px", borderRadius: 8,
  background: INPUT_BG, color: TEXT,
  fontSize: 12, fontWeight: 500,
  border: `1px solid ${BORDER}`,
  cursor: "pointer",
};

function TabButton({ active, onClick, icon, label, count }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string; count: number;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 7,
        padding: "10px 16px",
        background: "transparent", border: "none",
        borderBottom: `2px solid ${active ? GOLD : "transparent"}`,
        color: active ? TEXT : TEXT_MID,
        fontSize: 12, fontWeight: active ? 600 : 500,
        cursor: "pointer", letterSpacing: "0.2px",
        transition: "all 0.15s",
      }}
    >
      {icon}
      {label}
      <span style={{
        fontSize: 10, padding: "1px 7px", borderRadius: 8,
        background: active ? `${GOLD}20` : INPUT_BG,
        color: active ? GOLD : TEXT_DIM,
        fontWeight: 700,
      }}>
        {count}
      </span>
    </button>
  );
}

// ─────────────────────────────────────────────
// PIPELINE TAB (kanban)
// ─────────────────────────────────────────────
function PipelineTab({ search, onCardClick }: {
  search: string;
  onCardClick: (hotelId: number) => void;
}) {
  const { prospects, setProspects, readOnly } = useSalesData();
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [hoveredColumn, setHoveredColumn] = useState<ProspectStatus | null>(null);

  const filtered = prospects.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.property_name.toLowerCase().includes(q) || p.city.toLowerCase().includes(q);
  });

  const handleDragStart = (hotelId: number, e: React.DragEvent) => {
    setDraggingId(hotelId);
    e.dataTransfer.setData("text/plain", String(hotelId));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setHoveredColumn(null);
  };

  const handleColumnDragOver = (col: ProspectStatus, e: React.DragEvent) => {
    if (readOnly) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (hoveredColumn !== col) setHoveredColumn(col);
  };

  const handleColumnDragLeave = (e: React.DragEvent) => {
    const related = e.relatedTarget as Node | null;
    if (related && (e.currentTarget as Node).contains(related)) return;
    setHoveredColumn(null);
  };

  const handleColumnDrop = async (col: ProspectStatus, e: React.DragEvent) => {
    e.preventDefault();
    setHoveredColumn(null);
    setDraggingId(null);
    if (readOnly) return;

    const raw = e.dataTransfer.getData("text/plain");
    const hotelId = Number(raw);
    if (!Number.isFinite(hotelId)) return;

    const target = prospects.find((p) => p.hotel_id === hotelId);
    if (!target) return;
    const previousStatus = target.prospect_status;
    if (previousStatus === col) return;

    // Optimistic local update
    setProspects((prev) =>
      prev.map((p) => (p.hotel_id === hotelId ? { ...p, prospect_status: col } : p))
    );

    try {
      const res = await fetch(`/api/sales/prospects/${hotelId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospect_status: col, actor: "user" }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(detail || `HTTP ${res.status}`);
      }
    } catch (err) {
      // Revert on failure
      setProspects((prev) =>
        prev.map((p) => (p.hotel_id === hotelId ? { ...p, prospect_status: previousStatus } : p))
      );
      toast.error(`Couldn't move ${target.property_name}`, {
        description: err instanceof Error ? err.message : "Network error",
      });
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Column rail */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(6, minmax(240px, 1fr))",
        gap: 12, alignItems: "start",
        overflowX: "auto", paddingBottom: 8,
      }}>
        {STATUS_COLUMNS.map((col) => {
          const colProspects = filtered.filter((p) => p.prospect_status === col.key);
          const isHovered = hoveredColumn === col.key && !readOnly;
          return (
            <div
              key={col.key}
              onDragOver={(e) => handleColumnDragOver(col.key, e)}
              onDragLeave={handleColumnDragLeave}
              onDrop={(e) => handleColumnDrop(col.key, e)}
              style={{
                minWidth: 220,
                borderRadius: 8,
                padding: 4,
                background: isHovered ? `${col.color}10` : "transparent",
                border: isHovered ? `1px dashed ${col.color}80` : "1px solid transparent",
                transition: "background 0.12s, border-color 0.12s",
              }}
            >
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                marginBottom: 10, padding: "0 4px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 4, background: col.color }} />
                  <span style={{
                    color: TEXT, fontSize: 11, fontWeight: 600,
                    textTransform: "uppercase", letterSpacing: "0.5px",
                  }}>
                    {col.label}
                  </span>
                  <span style={{ fontSize: 11, color: TEXT_DIM, fontWeight: 600 }}>
                    {colProspects.length}
                  </span>
                </div>
                <button style={{
                  width: 20, height: 20, borderRadius: 4, border: "none",
                  background: "transparent", color: TEXT_DIM, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Plus size={13} />
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {colProspects.map((p) => (
                  <ProspectCard
                    key={p.hotel_id}
                    prospect={p}
                    onClick={() => onCardClick(p.hotel_id)}
                    draggable={!readOnly}
                    isDragging={draggingId === p.hotel_id}
                    onDragStart={(e) => handleDragStart(p.hotel_id, e)}
                    onDragEnd={handleDragEnd}
                  />
                ))}
                {colProspects.length === 0 && (
                  <div style={{
                    padding: "32px 12px", textAlign: "center", color: TEXT_DIM, fontSize: 11,
                    border: `1px dashed ${BORDER}`, borderRadius: 8,
                  }}>
                    No prospects
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProspectCard({ prospect, onClick, draggable, isDragging, onDragStart, onDragEnd }: {
  prospect: Prospect;
  onClick: () => void;
  draggable?: boolean;
  isDragging?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}) {
  const { people: MOCK_PEOPLE } = useSalesData();
  const person = prospect.primary_person_id
    ? MOCK_PEOPLE.find((p) => p.id === prospect.primary_person_id)
    : null;
  const cfg = STATUS_COLUMNS.find((c) => c.key === prospect.prospect_status)!;
  const accentColor = prospect.signed_at ? GREEN : cfg.color;
  const cursor = draggable ? (isDragging ? "grabbing" : "grab") : "pointer";

  return (
    <div
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      style={{
        background: CARD_BG, borderRadius: 8,
        border: `1px solid ${prospect.signed_at ? `${GREEN}40` : BORDER}`,
        cursor, transition: "all 0.12s",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
        opacity: isDragging ? 0.5 : 1,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = `${accentColor}60`;
        e.currentTarget.style.background = `${accentColor}06`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = prospect.signed_at ? `${GREEN}40` : BORDER;
        e.currentTarget.style.background = CARD_BG;
      }}
    >
      {/* Signed banner — proposal column transient state */}
      {prospect.signed_at && (
        <div style={{
          background: `${GREEN}18`, color: GREEN,
          padding: "5px 10px", fontSize: 10, fontWeight: 700,
          textTransform: "uppercase", letterSpacing: "0.4px",
          display: "flex", alignItems: "center", gap: 6,
          borderBottom: `1px solid ${GREEN}25`,
        }}>
          <CheckCircle2 size={11} />
          Signed · promoting to Live
        </div>
      )}

      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {prospect.property_name}
            </div>
            <div style={{ fontSize: 10, color: TEXT_DIM, display: "flex", alignItems: "center", gap: 6 }}>
              <span>{prospect.city}</span>
              <span style={{ color: BORDER }}>·</span>
              <span>{prospect.rooms} keys</span>
              <span style={{ color: BORDER }}>·</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
                <Star size={9} fill={GOLD} color={GOLD} /> {prospect.star_rating}
              </span>
            </div>
          </div>
          <ScoreBadge score={prospect.prospect_score} />
        </div>

        {/* Sub-state badges: researching / demo / metrics */}
        {(prospect.agent_busy || prospect.demo_at || prospect.parity_leak_pct !== undefined || prospect.b2b_coverage_pct !== undefined || prospect.study_artifact_url) && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {prospect.agent_busy && (
              <span style={{
                fontSize: 9, padding: "2px 7px", borderRadius: 10,
                background: `${PURPLE}18`, color: PURPLE,
                border: `1px solid ${PURPLE}30`,
                fontWeight: 600, letterSpacing: "0.3px",
                display: "inline-flex", alignItems: "center", gap: 4,
              }}>
                <span style={{
                  width: 5, height: 5, borderRadius: 3, background: PURPLE,
                  animation: "salesPulse 1.4s ease-in-out infinite",
                }} />
                Researching…
              </span>
            )}
            {prospect.demo_at && (
              <span style={{
                fontSize: 9, padding: "2px 6px", borderRadius: 4,
                background: `${ORANGE}15`, color: ORANGE,
                border: `1px solid ${ORANGE}30`,
                fontWeight: 600,
                display: "inline-flex", alignItems: "center", gap: 4,
              }}>
                <Calendar size={9} />
                Demo {new Date(prospect.demo_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </span>
            )}
            {prospect.parity_leak_pct !== undefined && (
              <span style={{
                fontSize: 9, padding: "2px 6px", borderRadius: 4,
                background: prospect.parity_leak_pct >= 25 ? `${RED}15` : `${AMBER}15`,
                color: prospect.parity_leak_pct >= 25 ? RED : AMBER,
                fontWeight: 600,
              }}>
                {prospect.parity_leak_pct}% leak
              </span>
            )}
            {prospect.b2b_coverage_pct !== undefined && (
              <span style={{
                fontSize: 9, padding: "2px 6px", borderRadius: 4,
                background: `${BLUE}15`, color: BLUE, fontWeight: 600,
              }}>
                {prospect.b2b_coverage_pct}% B2B
              </span>
            )}
            {prospect.study_artifact_url && (
              <a
                href={prospect.study_artifact_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                title="Open study in new tab"
                style={{
                  fontSize: 9, padding: "2px 6px", borderRadius: 4,
                  background: `${PURPLE}18`, color: PURPLE,
                  border: `1px solid ${PURPLE}30`,
                  fontWeight: 600, letterSpacing: "0.3px",
                  display: "inline-flex", alignItems: "center", gap: 4,
                  textDecoration: "none",
                }}
              >
                <FileText size={9} />
                Study
              </a>
            )}
          </div>
        )}

        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 8, marginTop: 2,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            {person ? (
              <>
                <Avatar name={person.full_name} size={18} />
                <span style={{
                  fontSize: 11, color: TEXT_MID,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {person.full_name}
                </span>
              </>
            ) : (
              <span style={{ fontSize: 10, color: TEXT_DIM, fontStyle: "italic" }}>
                No contact yet
              </span>
            )}
          </div>
          {prospect.last_activity_at && (
            <span style={{ fontSize: 10, color: TEXT_DIM, whiteSpace: "nowrap" }}>
              {timeAgo(prospect.last_activity_at)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// COMPANIES TAB
// ─────────────────────────────────────────────
function CompaniesTab({ search, onRowClick }: {
  search: string;
  onRowClick: (id: number) => void;
}) {
  const { companies: MOCK_COMPANIES, people: MOCK_PEOPLE } = useSalesData();
  const filtered = MOCK_COMPANIES.filter((c) => {
    if (!search) return true;
    return c.name.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden" }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 140px 120px 120px 1fr 60px",
        padding: "12px 16px", gap: 12,
        borderBottom: `1px solid ${BORDER}`,
        background: INPUT_BG,
      }}>
        {["Name", "CH Number", "Type", "Hotels", "Primary Contact", ""].map((h, i) => (
          <span key={i} style={{
            fontSize: 10, color: TEXT_MID, fontWeight: 600,
            textTransform: "uppercase", letterSpacing: "0.5px",
          }}>
            {h}
          </span>
        ))}
      </div>
      {filtered.map((c, i) => {
        const cfg = COMPANY_TYPE_CFG[c.company_type];
        const contact = c.primary_contact_id ? MOCK_PEOPLE.find((p) => p.id === c.primary_contact_id) : null;
        return (
          <div
            key={c.id}
            onClick={() => onRowClick(c.id)}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 140px 120px 120px 1fr 60px",
              padding: "12px 16px", gap: 12, alignItems: "center",
              borderTop: i === 0 ? "none" : `1px solid ${BORDER}`,
              cursor: "pointer", transition: "background 0.12s",
              background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.012)",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = `${BLUE}08`; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.012)"; }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, color: TEXT, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {c.name}
              </div>
              {c.website && (
                <div style={{ fontSize: 10, color: TEXT_DIM, display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                  <Globe size={9} /> {c.website}
                </div>
              )}
            </div>
            <span style={{ fontSize: 11, color: TEXT_MID, fontFamily: "monospace" }}>
              {c.companies_house_number ?? "—"}
            </span>
            <span style={{
              fontSize: 10, padding: "2px 8px", borderRadius: 4,
              background: `${cfg.color}15`, color: cfg.color,
              border: `1px solid ${cfg.color}25`,
              fontWeight: 600, width: "fit-content",
            }}>
              {cfg.label}
            </span>
            <span style={{ fontSize: 12, color: TEXT, fontWeight: 600 }}>
              {c.hotel_count}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
              {contact ? (
                <>
                  <Avatar name={contact.full_name} size={20} />
                  <span style={{
                    fontSize: 11, color: TEXT_MID,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {contact.full_name}
                  </span>
                </>
              ) : (
                <span style={{ fontSize: 10, color: TEXT_DIM, fontStyle: "italic" }}>—</span>
              )}
            </div>
            <ArrowRight size={13} color={TEXT_DIM} />
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────
// PEOPLE TAB
// ─────────────────────────────────────────────
function PeopleTab({ search, onRowClick }: {
  search: string;
  onRowClick: (id: number) => void;
}) {
  const { people: MOCK_PEOPLE } = useSalesData();
  const filtered = MOCK_PEOPLE.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.full_name.toLowerCase().includes(q) || (p.email ?? "").toLowerCase().includes(q);
  });

  return (
    <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden" }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr 140px 100px 60px",
        padding: "12px 16px", gap: 12,
        borderBottom: `1px solid ${BORDER}`,
        background: INPUT_BG,
      }}>
        {["Name", "Title", "Email", "Phone", "Channels", ""].map((h, i) => (
          <span key={i} style={{
            fontSize: 10, color: TEXT_MID, fontWeight: 600,
            textTransform: "uppercase", letterSpacing: "0.5px",
          }}>
            {h}
          </span>
        ))}
      </div>
      {filtered.map((p, i) => (
        <div
          key={p.id}
          onClick={() => onRowClick(p.id)}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr 140px 100px 60px",
            padding: "12px 16px", gap: 12, alignItems: "center",
            borderTop: i === 0 ? "none" : `1px solid ${BORDER}`,
            cursor: "pointer", transition: "background 0.12s",
            background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.012)",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = `${BLUE}08`; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.012)"; }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <Avatar name={p.full_name} size={24} />
            <span style={{
              fontSize: 13, color: TEXT, fontWeight: 500,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {p.full_name}
            </span>
          </div>
          <span style={{ fontSize: 12, color: TEXT_MID, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {p.job_title ?? "—"}
          </span>
          <span style={{ fontSize: 11, color: TEXT_DIM, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {p.email ?? "—"}
          </span>
          <span style={{ fontSize: 11, color: TEXT_MID, fontFamily: "monospace" }}>
            {p.phone ?? "—"}
          </span>
          <div style={{ display: "flex", gap: 4 }}>
            {p.email && <ChannelDot color={BLUE} icon={<Mail size={9} />} />}
            {p.phone && <ChannelDot color={GREEN} icon={<Phone size={9} />} />}
            {p.whatsapp && <ChannelDot color={GREEN} icon={<MessageSquare size={9} />} />}
            {p.linkedin_url && <ChannelDot color={PURPLE} icon={<ExternalLink size={9} />} />}
          </div>
          <ArrowRight size={13} color={TEXT_DIM} />
        </div>
      ))}
    </div>
  );
}

function ChannelDot({ color, icon }: { color: string; icon: React.ReactNode }) {
  return (
    <span style={{
      width: 18, height: 18, borderRadius: 4,
      background: `${color}15`, color: color,
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      border: `1px solid ${color}25`,
    }}>
      {icon}
    </span>
  );
}

// ─────────────────────────────────────────────
// ACTIVITY TAB
// ─────────────────────────────────────────────
function ActivityTab({ search, onHotelClick }: {
  search: string;
  onHotelClick: (hotelId: number) => void;
}) {
  const { activities: MOCK_ACTIVITIES } = useSalesData();
  const filtered = MOCK_ACTIVITIES
    .filter((a) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return a.hotel_name.toLowerCase().includes(q) ||
             (a.subject ?? "").toLowerCase().includes(q) ||
             (a.body ?? "").toLowerCase().includes(q);
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden" }}>
      {filtered.map((a, i) => {
        const cfg = ACTIVITY_TYPE_CFG[a.type];
        const Icon = cfg.icon;
        const isAgent = a.actor.startsWith("agent:");
        return (
          <div
            key={a.id}
            style={{
              display: "grid",
              gridTemplateColumns: "32px 1fr 140px 120px",
              padding: "14px 16px", gap: 12, alignItems: "flex-start",
              borderTop: i === 0 ? "none" : `1px solid ${BORDER}`,
              transition: "background 0.12s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = `${BLUE}06`; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            <div style={{
              width: 28, height: 28, borderRadius: 14,
              background: `${cfg.color}15`, color: cfg.color,
              border: `1px solid ${cfg.color}25`,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}>
              <Icon size={13} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                <span style={{ fontSize: 11, color: cfg.color, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.3px" }}>
                  {cfg.label}
                </span>
                <span style={{ color: BORDER }}>·</span>
                <span
                  onClick={() => onHotelClick(a.hotel_id)}
                  style={{ fontSize: 12, color: TEXT, fontWeight: 500, cursor: "pointer", textDecoration: "underline", textDecorationColor: "transparent", textUnderlineOffset: 3 }}
                  onMouseEnter={(e) => { e.currentTarget.style.textDecorationColor = TEXT; }}
                  onMouseLeave={(e) => { e.currentTarget.style.textDecorationColor = "transparent"; }}
                >
                  {a.hotel_name}
                </span>
              </div>
              {a.subject && (
                <div style={{ fontSize: 12, color: TEXT, fontWeight: 500, marginBottom: 2 }}>
                  {a.subject}
                </div>
              )}
              {a.body && (
                <div style={{ fontSize: 11, color: TEXT_MID, lineHeight: 1.5 }}>
                  {a.body}
                </div>
              )}
              {a.artifact_url && (
                <div style={{ marginTop: 4, fontSize: 10, color: BLUE, display: "inline-flex", alignItems: "center", gap: 4, fontFamily: "monospace" }}>
                  <FileText size={10} /> {a.artifact_url}
                </div>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Avatar name={a.actor} size={20} color={isAgent ? PURPLE : BLUE} />
              <span style={{ fontSize: 11, color: TEXT_MID, fontFamily: isAgent ? "monospace" : undefined }}>
                {a.actor}
              </span>
            </div>
            <span style={{ fontSize: 11, color: TEXT_DIM, textAlign: "right" }}>
              {timeAgo(a.created_at)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────
// PROSPECT DETAIL SIDE PANEL
// ─────────────────────────────────────────────
function ProspectDetailPanel({ prospect, onClose }: {
  prospect: Prospect;
  onClose: () => void;
}) {
  const { companies: MOCK_COMPANIES, people: MOCK_PEOPLE, activities: MOCK_ACTIVITIES } = useSalesData();
  const cfg = STATUS_COLUMNS.find((s) => s.key === prospect.prospect_status)!;
  const company = prospect.company_id ? MOCK_COMPANIES.find((c) => c.id === prospect.company_id) : null;
  const person = prospect.primary_person_id ? MOCK_PEOPLE.find((p) => p.id === prospect.primary_person_id) : null;
  const activities = MOCK_ACTIVITIES.filter((a) => a.hotel_id === prospect.hotel_id);

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
        {/* HEADER */}
        <div style={{ padding: "20px 24px 16px 24px", borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <StatusPill status={prospect.prospect_status} />
                <ScoreBadge score={prospect.prospect_score} />
                {prospect.prospect_owner && (
                  <span style={{ fontSize: 10, color: TEXT_DIM }}>
                    Owner: <span style={{ color: TEXT_MID, fontWeight: 600 }}>{prospect.prospect_owner}</span>
                  </span>
                )}
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: TEXT, margin: 0, marginBottom: 4 }}>
                {prospect.property_name}
              </h2>
              <div style={{ fontSize: 12, color: TEXT_DIM, display: "flex", alignItems: "center", gap: 8 }}>
                <span>{prospect.city}</span>
                <span style={{ color: BORDER }}>·</span>
                <span>{prospect.rooms} keys</span>
                <span style={{ color: BORDER }}>·</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                  <Star size={10} fill={GOLD} color={GOLD} /> {prospect.star_rating}-star
                </span>
                {prospect.booking_property_id && (
                  <>
                    <span style={{ color: BORDER }}>·</span>
                    <span style={{ fontFamily: "monospace" }}>{prospect.booking_property_id}</span>
                  </>
                )}
              </div>
            </div>
            <button onClick={onClose} style={{
              background: "transparent", border: "none", color: TEXT_DIM,
              cursor: "pointer", padding: 4,
            }}>
              <X size={18} />
            </button>
          </div>

          {/* KEY METRICS */}
          {(prospect.parity_leak_pct !== undefined || prospect.b2b_coverage_pct !== undefined || prospect.study_artifact_url) && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {prospect.parity_leak_pct !== undefined && (
                <MetricChip label="Parity Leak" value={`${prospect.parity_leak_pct}%`} tone={prospect.parity_leak_pct >= 25 ? RED : AMBER} />
              )}
              {prospect.b2b_coverage_pct !== undefined && (
                <MetricChip label="B2B Coverage" value={`${prospect.b2b_coverage_pct}%`} tone={BLUE} />
              )}
              {prospect.study_artifact_url && (
                <a
                  href={prospect.study_artifact_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    ...btnSecondary, padding: "5px 10px", fontSize: 11,
                    borderColor: `${PURPLE}40`, color: PURPLE,
                    textDecoration: "none",
                    display: "inline-flex", alignItems: "center", gap: 6,
                  }}
                >
                  <FileText size={11} />
                  Open Study
                  <ExternalLink size={10} />
                </a>
              )}
            </div>
          )}
        </div>

        {/* ACTIONS */}
        <div style={{ padding: "12px 24px", display: "flex", gap: 8, borderBottom: `1px solid ${BORDER}`, flexWrap: "wrap" }}>
          <button style={{ ...btnPrimary, fontSize: 11, padding: "6px 12px" }}>
            <Send size={12} /> Draft Outreach
          </button>
          <button style={{ ...btnSecondary, fontSize: 11, padding: "6px 12px" }}>
            <Sparkles size={12} /> Generate Study
          </button>
          <button style={{ ...btnSecondary, fontSize: 11, padding: "6px 12px" }}>
            <ArrowRight size={12} /> Change Status
          </button>
          <button style={{ ...btnSecondary, fontSize: 11, padding: "6px 12px", color: RED, borderColor: `${RED}30` }}>
            <XCircle size={12} /> Mark Lost
          </button>
        </div>

        {/* BODY */}
        <div style={{ flex: 1, overflow: "auto", padding: "20px 24px" }}>
          {/* COMPANY */}
          <PanelSection title="Company" icon={<Building2 size={12} />}>
            {company ? (
              <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 12 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 13, color: TEXT, fontWeight: 600 }}>{company.name}</span>
                  <span style={{
                    fontSize: 9, padding: "2px 6px", borderRadius: 4,
                    background: `${COMPANY_TYPE_CFG[company.company_type].color}15`,
                    color: COMPANY_TYPE_CFG[company.company_type].color,
                    fontWeight: 600,
                  }}>
                    {COMPANY_TYPE_CFG[company.company_type].label}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: TEXT_DIM, display: "flex", alignItems: "center", gap: 10 }}>
                  {company.companies_house_number && (
                    <span style={{ fontFamily: "monospace" }}>CH: {company.companies_house_number}</span>
                  )}
                  <span>{company.hotel_count} hotel{company.hotel_count !== 1 ? "s" : ""}</span>
                </div>
              </div>
            ) : (
              <EmptySection text="No company linked yet — agent will populate from Companies House lookup." />
            )}
          </PanelSection>

          {/* PEOPLE */}
          <PanelSection title="People" icon={<Users size={12} />} action={<button style={btnGhost}>+ Add</button>}>
            {person ? (
              <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 12, display: "flex", alignItems: "center", gap: 12 }}>
                <Avatar name={person.full_name} size={36} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: TEXT, fontWeight: 600 }}>{person.full_name}</div>
                  <div style={{ fontSize: 11, color: TEXT_DIM, marginBottom: 4 }}>{person.job_title ?? "—"}</div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {person.email && <ContactLink icon={<Mail size={10} />} text={person.email} />}
                    {person.phone && <ContactLink icon={<Phone size={10} />} text={person.phone} />}
                    {person.whatsapp && <ContactLink icon={<MessageSquare size={10} />} text="WhatsApp" />}
                  </div>
                </div>
                <span style={{
                  fontSize: 9, padding: "2px 6px", borderRadius: 4,
                  background: `${GOLD}15`, color: GOLD, fontWeight: 600,
                  letterSpacing: "0.3px", textTransform: "uppercase",
                }}>
                  Primary
                </span>
              </div>
            ) : (
              <EmptySection text="No contacts yet — agent will research the GM/owner and add them." />
            )}
          </PanelSection>

          {/* STUDIES */}
          <PanelSection title="Studies" icon={<FileText size={12} />}>
            {prospect.study_artifact_url ? (
              <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 12 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: 6,
                      background: `${PURPLE}15`, color: PURPLE,
                      border: `1px solid ${PURPLE}25`,
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <FileText size={13} />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: TEXT, fontWeight: 600 }}>
                        Section 14 Rate Study
                      </div>
                      <div style={{ fontSize: 10, color: TEXT_DIM }}>
                        Generated {prospect.study_generated_at ? timeAgo(prospect.study_generated_at) : "—"}
                      </div>
                    </div>
                  </div>
                  <button style={{ ...btnSecondary, padding: "5px 10px", fontSize: 11 }}>
                    Open <ExternalLink size={10} />
                  </button>
                </div>
                <div style={{ fontSize: 11, color: TEXT_DIM, fontFamily: "monospace" }}>
                  {prospect.study_artifact_url}
                </div>
              </div>
            ) : (
              <EmptySection text="No study yet. Click Generate Study to run the Section 14 scrape + dashboard." />
            )}
          </PanelSection>

          {/* ACTIVITY TIMELINE */}
          <PanelSection title="Activity" icon={<ActivityIcon size={12} />}>
            {activities.length > 0 ? (
              <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 8, overflow: "hidden" }}>
                {activities.map((a, i) => {
                  const aCfg = ACTIVITY_TYPE_CFG[a.type];
                  const Icon = aCfg.icon;
                  return (
                    <div key={a.id} style={{
                      display: "grid", gridTemplateColumns: "28px 1fr",
                      padding: 12, gap: 10,
                      borderTop: i === 0 ? "none" : `1px solid ${BORDER}`,
                    }}>
                      <div style={{
                        width: 24, height: 24, borderRadius: 12,
                        background: `${aCfg.color}15`, color: aCfg.color,
                        border: `1px solid ${aCfg.color}25`,
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <Icon size={11} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 11, color: aCfg.color, fontWeight: 600 }}>{aCfg.label}</span>
                          <span style={{ color: BORDER }}>·</span>
                          <span style={{ fontSize: 10, color: TEXT_DIM }}>{a.actor}</span>
                          <span style={{ color: BORDER }}>·</span>
                          <span style={{ fontSize: 10, color: TEXT_DIM }}>{formatDate(a.created_at)}</span>
                        </div>
                        {a.subject && <div style={{ fontSize: 12, color: TEXT, fontWeight: 500, marginBottom: 2 }}>{a.subject}</div>}
                        {a.body && <div style={{ fontSize: 11, color: TEXT_MID, lineHeight: 1.5 }}>{a.body}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptySection text="No activity yet." />
            )}
          </PanelSection>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// COMPANY DETAIL PANEL
// ─────────────────────────────────────────────
function CompanyDetailPanel({ companyId, onClose }: { companyId: number; onClose: () => void }) {
  const { companies: MOCK_COMPANIES, people: MOCK_PEOPLE, prospects: MOCK_PROSPECTS } = useSalesData();
  const company = MOCK_COMPANIES.find((c) => c.id === companyId);
  if (!company) return null;
  const cfg = COMPANY_TYPE_CFG[company.company_type];
  const contact = company.primary_contact_id ? MOCK_PEOPLE.find((p) => p.id === company.primary_contact_id) : null;
  const linkedHotels = MOCK_PROSPECTS.filter((p) => p.company_id === companyId);

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "20px 24px 16px 24px", borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div>
              <span style={{
                fontSize: 10, padding: "2px 8px", borderRadius: 4,
                background: `${cfg.color}15`, color: cfg.color,
                fontWeight: 600, letterSpacing: "0.3px", textTransform: "uppercase",
                marginBottom: 8, display: "inline-block",
              }}>
                {cfg.label}
              </span>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: TEXT, margin: 0, marginBottom: 6 }}>
                {company.name}
              </h2>
              <div style={{ fontSize: 12, color: TEXT_DIM, display: "flex", alignItems: "center", gap: 10 }}>
                {company.companies_house_number && (
                  <span style={{ fontFamily: "monospace" }}>CH: {company.companies_house_number}</span>
                )}
                {company.website && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <Globe size={10} /> {company.website}
                  </span>
                )}
              </div>
            </div>
            <button onClick={onClose} style={{ background: "transparent", border: "none", color: TEXT_DIM, cursor: "pointer", padding: 4 }}>
              <X size={18} />
            </button>
          </div>
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: "20px 24px" }}>
          <PanelSection title="Primary Contact" icon={<UserIcon size={12} />}>
            {contact ? (
              <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 12, display: "flex", alignItems: "center", gap: 12 }}>
                <Avatar name={contact.full_name} size={36} />
                <div>
                  <div style={{ fontSize: 13, color: TEXT, fontWeight: 600 }}>{contact.full_name}</div>
                  <div style={{ fontSize: 11, color: TEXT_DIM }}>{contact.job_title}</div>
                </div>
              </div>
            ) : <EmptySection text="No primary contact yet." />}
          </PanelSection>
          <PanelSection title={`Hotels (${linkedHotels.length})`} icon={<Building2 size={12} />}>
            {linkedHotels.length > 0 ? (
              <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 8, overflow: "hidden" }}>
                {linkedHotels.map((h, i) => (
                  <div key={h.hotel_id} style={{
                    padding: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                    borderTop: i === 0 ? "none" : `1px solid ${BORDER}`,
                  }}>
                    <div>
                      <div style={{ fontSize: 13, color: TEXT, fontWeight: 500 }}>{h.property_name}</div>
                      <div style={{ fontSize: 10, color: TEXT_DIM }}>{h.city} · {h.rooms} keys</div>
                    </div>
                    <StatusPill status={h.prospect_status} />
                  </div>
                ))}
              </div>
            ) : <EmptySection text="No hotels linked yet." />}
          </PanelSection>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// PERSON DETAIL PANEL
// ─────────────────────────────────────────────
function PersonDetailPanel({ personId, onClose }: { personId: number; onClose: () => void }) {
  const { people: MOCK_PEOPLE, prospects: MOCK_PROSPECTS, companies: MOCK_COMPANIES } = useSalesData();
  const person = MOCK_PEOPLE.find((p) => p.id === personId);
  if (!person) return null;
  const linkedHotels = MOCK_PROSPECTS.filter((p) => p.primary_person_id === personId);
  const linkedCompanies = MOCK_COMPANIES.filter((c) => c.primary_contact_id === personId);

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "20px 24px 16px 24px", borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <Avatar name={person.full_name} size={48} />
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 600, color: TEXT, margin: 0, marginBottom: 4 }}>
                  {person.full_name}
                </h2>
                <div style={{ fontSize: 12, color: TEXT_DIM }}>{person.job_title ?? "—"}</div>
              </div>
            </div>
            <button onClick={onClose} style={{ background: "transparent", border: "none", color: TEXT_DIM, cursor: "pointer", padding: 4 }}>
              <X size={18} />
            </button>
          </div>
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: "20px 24px" }}>
          <PanelSection title="Contact" icon={<Mail size={12} />}>
            <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              {person.email && <ContactRow icon={<Mail size={12} color={BLUE} />} label="Email" value={person.email} />}
              {person.phone && <ContactRow icon={<Phone size={12} color={GREEN} />} label="Phone" value={person.phone} />}
              {person.whatsapp && <ContactRow icon={<MessageSquare size={12} color={GREEN} />} label="WhatsApp" value={person.whatsapp} />}
              {person.linkedin_url && <ContactRow icon={<ExternalLink size={12} color={PURPLE} />} label="LinkedIn" value={person.linkedin_url} />}
            </div>
          </PanelSection>
          {linkedCompanies.length > 0 && (
            <PanelSection title="Primary contact at" icon={<Building2 size={12} />}>
              {linkedCompanies.map((c) => (
                <div key={c.id} style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 12, marginBottom: 6 }}>
                  <div style={{ fontSize: 13, color: TEXT, fontWeight: 600 }}>{c.name}</div>
                  <div style={{ fontSize: 10, color: TEXT_DIM }}>{COMPANY_TYPE_CFG[c.company_type].label}</div>
                </div>
              ))}
            </PanelSection>
          )}
          <PanelSection title={`Hotels (${linkedHotels.length})`} icon={<Building2 size={12} />}>
            {linkedHotels.length > 0 ? (
              <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 8, overflow: "hidden" }}>
                {linkedHotels.map((h, i) => (
                  <div key={h.hotel_id} style={{
                    padding: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                    borderTop: i === 0 ? "none" : `1px solid ${BORDER}`,
                  }}>
                    <div>
                      <div style={{ fontSize: 13, color: TEXT, fontWeight: 500 }}>{h.property_name}</div>
                      <div style={{ fontSize: 10, color: TEXT_DIM }}>{h.city} · {h.rooms} keys</div>
                    </div>
                    <StatusPill status={h.prospect_status} />
                  </div>
                ))}
              </div>
            ) : <EmptySection text="No hotels linked yet." />}
          </PanelSection>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// SHARED PANEL PRIMITIVES
// ─────────────────────────────────────────────
const overlayStyle: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(8, 10, 14, 0.62)",
  zIndex: 50, display: "flex", justifyContent: "flex-end",
  backdropFilter: "blur(2px)",
};

const panelStyle: React.CSSProperties = {
  width: 540, maxWidth: "92vw", height: "100%",
  background: BG_PAGE, borderLeft: `1px solid ${BORDER}`,
  display: "flex", flexDirection: "column",
  boxShadow: "-12px 0 32px rgba(0,0,0,0.4)",
};

const btnGhost: React.CSSProperties = {
  fontSize: 11, padding: "3px 8px", borderRadius: 6,
  background: "transparent", color: TEXT_MID,
  border: `1px solid ${BORDER}`, cursor: "pointer",
  fontWeight: 500,
};

function PanelSection({ title, icon, action, children }: {
  title: string; icon: React.ReactNode; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: TEXT_MID }}>
          {icon}
          <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            {title}
          </span>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function MetricChip({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "5px 10px", borderRadius: 6,
      background: `${tone}10`, border: `1px solid ${tone}30`,
    }}>
      <span style={{ fontSize: 10, color: TEXT_DIM, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.3px" }}>
        {label}
      </span>
      <span style={{ fontSize: 12, color: tone, fontWeight: 700 }}>{value}</span>
    </div>
  );
}

function EmptySection({ text }: { text: string }) {
  return (
    <div style={{
      padding: 16, borderRadius: 8, border: `1px dashed ${BORDER}`,
      fontSize: 11, color: TEXT_DIM, textAlign: "center", lineHeight: 1.5,
    }}>
      {text}
    </div>
  );
}

function ContactLink({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: TEXT_MID, fontFamily: "monospace" }}>
      {icon}
      {text}
    </span>
  );
}

function ContactRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ width: 22, display: "flex", justifyContent: "center" }}>{icon}</div>
      <span style={{ fontSize: 10, color: TEXT_DIM, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.3px", width: 70 }}>
        {label}
      </span>
      <span style={{ fontSize: 12, color: TEXT, fontFamily: "monospace" }}>
        {value}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────

// Studio entry — hardcoded mocks for design preview.
const STATIC_MOCK_DATA: SalesData = {
  prospects: STATIC_MOCK_PROSPECTS,
  companies: STATIC_MOCK_COMPANIES,
  people: STATIC_MOCK_PEOPLE,
  activities: STATIC_MOCK_ACTIVITIES,
};

const STATIC_MOCK_CONTEXT: SalesContextValue = {
  ...STATIC_MOCK_DATA,
  setProspects: () => {},
  readOnly: true,
};

export function SalesCrmMockup() {
  return (
    <SalesDataContext.Provider value={STATIC_MOCK_CONTEXT}>
      <SalesUI headerVariant="mockup" />
    </SalesDataContext.Provider>
  );
}

// Live entry — fetches real data from /api/sales.
export function SalesHub() {
  const [data, setData] = useState<SalesData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const contextValue = useMemo<SalesContextValue | null>(() => {
    if (!data) return null;
    return {
      ...data,
      setProspects: (updater) =>
        setData((prev) => (prev ? { ...prev, prospects: updater(prev.prospects) } : prev)),
      readOnly: false,
    };
  }, [data]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [prospects, companies, people, activitiesRaw] = await Promise.all([
          fetch("/api/sales/prospects", { credentials: "include" }).then(r => r.ok ? r.json() : Promise.reject(new Error(`prospects: ${r.status}`))),
          fetch("/api/sales/companies", { credentials: "include" }).then(r => r.ok ? r.json() : Promise.reject(new Error(`companies: ${r.status}`))),
          fetch("/api/sales/people", { credentials: "include" }).then(r => r.ok ? r.json() : Promise.reject(new Error(`people: ${r.status}`))),
          fetch("/api/sales/activities?limit=50", { credentials: "include" }).then(r => r.ok ? r.json() : Promise.reject(new Error(`activities: ${r.status}`))),
        ]);

        const activities: ActivityEntry[] = activitiesRaw.map((a: any) => ({
          ...a,
          hotel_name: a.hotel_name ?? `Hotel ${a.hotel_id}`,
        }));

        if (cancelled) return;
        setData({
          prospects: prospects.map(prospectFromApi),
          companies: companies.map(companyFromApi),
          people: people.map(personFromApi),
          activities,
        });
      } catch (err: any) {
        if (!cancelled) setError(err.message || "Failed to load Sales data");
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (error) {
    return (
      <div style={{ minHeight: "100vh", background: BG_PAGE, color: TEXT, display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
        <div style={{ textAlign: "center", maxWidth: 400 }}>
          <div style={{ fontSize: 14, color: RED, fontWeight: 600, marginBottom: 8 }}>Failed to load Sales data</div>
          <div style={{ fontSize: 12, color: TEXT_DIM, fontFamily: "monospace" }}>{error}</div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ minHeight: "100vh", background: BG_PAGE, color: TEXT, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 12, color: TEXT_DIM }}>Loading Sales…</div>
      </div>
    );
  }

  return (
    <SalesDataContext.Provider value={contextValue}>
      <SalesUI headerVariant="live" />
    </SalesDataContext.Provider>
  );
}

// ─────────────────────────────────────────────
// API → component-shape adapters
// (Backend returns slightly different shapes than the mock — adapt here.)
// ─────────────────────────────────────────────
function prospectFromApi(p: any): Prospect {
  return {
    hotel_id: p.hotel_id,
    property_name: p.property_name,
    city: p.city ?? "—",
    rooms: p.rooms ?? p.total_rooms ?? 0,
    star_rating: (p.star_rating ?? 4) as 3 | 4 | 5,
    prospect_status: p.prospect_status,
    prospect_score: p.prospect_score != null ? Number(p.prospect_score) : undefined,
    prospect_owner: p.prospect_owner ?? undefined,
    company_id: p.company_id ?? undefined,
    last_activity_at: p.last_activity_at ?? undefined,
    last_activity_summary: undefined,
    study_generated_at: p.study_generated_at ?? undefined,
    study_artifact_url: p.study_artifact_url ?? undefined,
    booking_property_id: p.booking_property_id ?? undefined,
    primary_person_id: p.primary_person?.id ?? undefined,
    parity_leak_pct: undefined,
    b2b_coverage_pct: undefined,
  };
}

function companyFromApi(c: any): Company {
  return {
    id: c.id,
    name: c.name,
    companies_house_number: c.companies_house_number ?? undefined,
    company_type: c.company_type ?? "unknown",
    website: c.website ?? undefined,
    hotel_count: c.hotel_count ?? 0,
    primary_contact_id: c.primary_contact_id ?? undefined,
    notes: c.notes ?? undefined,
  };
}

function personFromApi(p: any): Person {
  return {
    id: p.id,
    full_name: p.full_name,
    job_title: p.job_title ?? undefined,
    email: p.email ?? undefined,
    phone: p.phone ?? undefined,
    whatsapp: p.whatsapp ?? undefined,
    linkedin_url: p.linkedin_url ?? undefined,
  };
}
