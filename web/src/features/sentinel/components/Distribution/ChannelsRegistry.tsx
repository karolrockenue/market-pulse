import { useState, useEffect } from "react";
import {
  Plus,
  X,
  Users,
  Mail,
  Phone,
  ChevronRight,
  Zap,
  Shield,
  Pencil,
  Percent,
  Building2,
  Layers,
  Cable,
  FileText,
  User,
  MessageSquare,
  Trash2,
} from "lucide-react";

// ── Brand palette ──
const BLUE = "#39BDF8";
const GREEN = "#10b981";
const AMBER = "#f59e0b";
const BG_PAGE = "#1d1d1c";
const CARD_BG = "#1a1a1a";
const INPUT_BG = "#2C2C2C";
const BORDER = "#2a2a2a";
const TEXT = "#e5e5e5";
const TEXT_MID = "#9ca3af";
const TEXT_DIM = "#6b7280";

type AgreementType = "group" | "individual" | "direct" | "meta";
type ChannelTier = "primary" | "secondary" | "experimental";
type IntegrationType = "channel_manager" | "direct_api" | "extranet" | "meta_search";

interface ChannelContact {
  name: string;
  role: string;
  email: string;
  phone?: string;
}

interface InternalNote {
  id: string;
  text: string;
  author: string;
  createdAt: string;
}

interface Channel {
  id: string;
  name: string;
  agreement: AgreementType;
  tier: ChannelTier;
  integration: IntegrationType;
  commission: number;
  propertiesConnected: number;
  contacts: ChannelContact[];
  contractExpiry?: string;
  notes?: string;
  internalNotes: InternalNote[];
  addedAt: string;
}

const AGREEMENT_CFG: Record<AgreementType, { color: string; label: string }> = {
  group: { color: BLUE, label: "Group" },
  individual: { color: AMBER, label: "Individual" },
  direct: { color: GREEN, label: "Direct" },
  meta: { color: "#8b5cf6", label: "Meta" },
};

const TIER_CFG: Record<ChannelTier, { color: string; label: string }> = {
  primary: { color: GREEN, label: "Primary" },
  secondary: { color: TEXT_MID, label: "Secondary" },
  experimental: { color: AMBER, label: "Experimental" },
};

const INTEGRATION_CFG: Record<IntegrationType, { label: string }> = {
  channel_manager: { label: "Channel Manager" },
  direct_api: { label: "Direct API" },
  extranet: { label: "Extranet" },
  meta_search: { label: "Meta Search" },
};

const INITIAL_CHANNELS: Channel[] = [
  { id: "booking", name: "Booking.com", agreement: "group", tier: "primary", integration: "channel_manager", commission: 15, propertiesConnected: 21, contacts: [{ name: "Sarah Mitchell", role: "Market Manager — London", email: "s.mitchell@booking.com", phone: "+44 20 7946 0958" }, { name: "David Park", role: "Connectivity Support", email: "d.park@booking.com" }], contractExpiry: "2027-03-01", internalNotes: [{ id: "n1", text: "Renegotiated commission from 17% to 15% in Jan 2025. Next review due Q1 2027.", author: "Karol", createdAt: "2025-01-20" }], addedAt: "2024-01-15" },
  { id: "expedia", name: "Expedia", agreement: "group", tier: "primary", integration: "channel_manager", commission: 18, propertiesConnected: 17, contacts: [{ name: "James Liu", role: "Partner Success", email: "j.liu@expediagroup.com" }], contractExpiry: "2026-12-01", internalNotes: [], addedAt: "2024-01-15" },
  { id: "agoda", name: "Agoda", agreement: "group", tier: "secondary", integration: "channel_manager", commission: 15, propertiesConnected: 12, contacts: [{ name: "Priya Sharma", role: "Regional Account Manager", email: "priya.s@agoda.com" }], internalNotes: [], addedAt: "2024-03-20" },
  { id: "hotelbeds", name: "Hotelbeds", agreement: "group", tier: "secondary", integration: "direct_api", commission: 20, propertiesConnected: 8, contacts: [{ name: "Carlos Vega", role: "Wholesale Manager", email: "c.vega@hotelbeds.com", phone: "+34 971 780 000" }, { name: "Lisa Chen", role: "Tech Integration", email: "l.chen@hotelbeds.com" }], contractExpiry: "2026-09-15", internalNotes: [{ id: "n2", text: "Commission is high at 20% — push for 18% at next renewal.", author: "Karol", createdAt: "2025-03-10" }], addedAt: "2024-02-10" },
  { id: "trip", name: "Trip.com", agreement: "individual", tier: "secondary", integration: "channel_manager", commission: 15, propertiesConnected: 6, contacts: [], internalNotes: [], addedAt: "2024-06-01" },
  { id: "hrs", name: "HRS", agreement: "group", tier: "secondary", integration: "channel_manager", commission: 14, propertiesConnected: 5, contacts: [], internalNotes: [], addedAt: "2024-04-15" },
  { id: "stuba", name: "Stuba", agreement: "group", tier: "experimental", integration: "direct_api", commission: 22, propertiesConnected: 3, contacts: [{ name: "Tom Henley", role: "UK Sales", email: "t.henley@stuba.com" }], internalNotes: [], addedAt: "2025-01-10" },
  { id: "webbeds", name: "WebBeds", agreement: "group", tier: "secondary", integration: "direct_api", commission: 20, propertiesConnected: 4, contacts: [], internalNotes: [], addedAt: "2024-08-20" },
  { id: "cntravel", name: "CN Travel", agreement: "individual", tier: "experimental", integration: "extranet", commission: 12, propertiesConnected: 2, contacts: [], internalNotes: [], addedAt: "2025-02-01" },
  { id: "direct", name: "Direct", agreement: "direct", tier: "primary", integration: "direct_api", commission: 0, propertiesConnected: 21, contacts: [], notes: "Own website + walk-ins", internalNotes: [], addedAt: "2024-01-01" },
  { id: "google", name: "Google Hotels", agreement: "direct", tier: "primary", integration: "meta_search", commission: 0, propertiesConnected: 14, contacts: [], notes: "Free booking links + PPA campaigns", internalNotes: [], addedAt: "2024-05-10" },
  { id: "trivago", name: "Trivago", agreement: "direct", tier: "secondary", integration: "meta_search", commission: 0, propertiesConnected: 10, contacts: [], internalNotes: [], addedAt: "2024-07-01" },
];

// ══════════════════════════════════════════

export function ChannelsRegistry() {
  const [channels, setChannels] = useState<Channel[]>(INITIAL_CHANNELS);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showPanel, setShowPanel] = useState(false);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});

  function openAdd() {
    setEditingChannel(null);
    setShowPanel(true);
  }

  function openEdit(ch: Channel) {
    setEditingChannel(ch);
    setShowPanel(true);
  }

  function handleSave(ch: Channel) {
    if (editingChannel) {
      setChannels(channels.map((c) => (c.id === ch.id ? ch : c)));
    } else {
      setChannels([...channels, ch]);
    }
    setShowPanel(false);
    setEditingChannel(null);
  }

  function addNote(channelId: string) {
    const text = (noteInputs[channelId] || "").trim();
    if (!text) return;
    setChannels(channels.map((c) => {
      if (c.id !== channelId) return c;
      return { ...c, internalNotes: [...c.internalNotes, { id: `n${Date.now()}`, text, author: "You", createdAt: new Date().toISOString().split("T")[0] }] };
    }));
    setNoteInputs({ ...noteInputs, [channelId]: "" });
  }

  const totalProperties = 21;

  return (
    <div style={{ padding: "0 32px 64px" }}>
      {/* ── Add Channel button ── */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 18 }}>
        <button onClick={openAdd} style={{
          display: "flex", alignItems: "center", gap: 6, padding: "8px 18px", borderRadius: 6,
          border: "none", background: `linear-gradient(135deg, ${BLUE}, ${BLUE}cc)`, color: "#000",
          fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
          boxShadow: `0 2px 12px ${BLUE}30`,
        }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.9"; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
        >
          <Plus size={14} /> Add Channel
        </button>
      </div>

      {/* ── Channel rows ── */}
      <div style={{ backgroundColor: CARD_BG, borderRadius: 10, border: `1px solid ${BORDER}`, overflow: "hidden" }}>
        {/* Header */}
        <div style={{
          display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 100px 80px 40px",
          padding: "13px 18px", borderBottom: `1px solid ${BORDER}`, background: BG_PAGE,
          gap: 12, alignItems: "center",
        }}>
          {["Channel", "Agreement", "Tier", "Integration", "Commission", "Hotels", ""].map((h) => (
            <span key={h} style={{ color: TEXT_DIM, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" }}>{h}</span>
          ))}
        </div>

        {/* Rows */}
        {channels.map((ch) => {
          const expanded = expandedId === ch.id;
          const aCfg = AGREEMENT_CFG[ch.agreement];
          const tCfg = TIER_CFG[ch.tier];
          const coverage = Math.round((ch.propertiesConnected / totalProperties) * 100);
          const primaryContact = ch.contacts[0];

          return (
            <div key={ch.id}>
              {/* Main row */}
              <div
                onClick={() => setExpandedId(expanded ? null : ch.id)}
                style={{
                  display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 100px 80px 40px",
                  padding: "14px 20px", borderBottom: `1px solid ${BORDER}`, gap: 12,
                  alignItems: "center", cursor: "pointer", transition: "background 0.12s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(57,189,248,0.025)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                {/* Channel name */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: 6, background: `${aCfg.color}10`,
                    border: `1px solid ${aCfg.color}20`, display: "flex", alignItems: "center",
                    justifyContent: "center", flexShrink: 0,
                  }}>
                    <span style={{ color: aCfg.color, fontSize: 11, fontWeight: 700 }}>
                      {ch.name.substring(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <div style={{ color: TEXT, fontSize: 13, fontWeight: 500 }}>{ch.name}</div>
                    {primaryContact && (
                      <div style={{ color: TEXT_DIM, fontSize: 11, marginTop: 2 }}>
                        {primaryContact.name}{ch.contacts.length > 1 && <span style={{ color: TEXT_DIM, opacity: 0.6 }}> +{ch.contacts.length - 1}</span>}
                      </div>
                    )}
                  </div>
                </div>

                {/* Agreement */}
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px",
                  borderRadius: 4, background: `${aCfg.color}10`, color: aCfg.color,
                  fontSize: 12, fontWeight: 500, width: "fit-content",
                }}>
                  {ch.agreement === "group" ? <Users size={11} /> : ch.agreement === "meta" ? <Zap size={10} /> : <Shield size={10} />}
                  {aCfg.label}
                </span>

                {/* Tier */}
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: tCfg.color }} />
                  <span style={{ color: tCfg.color, fontSize: 12, fontWeight: 500 }}>{tCfg.label}</span>
                </div>

                {/* Integration */}
                <span style={{ color: TEXT_MID, fontSize: 12 }}>{INTEGRATION_CFG[ch.integration].label}</span>

                {/* Commission */}
                <span style={{
                  color: ch.commission === 0 ? GREEN : ch.commission >= 20 ? AMBER : TEXT,
                  fontSize: 13, fontWeight: 600,
                }}>
                  {ch.commission === 0 ? "Free" : `${ch.commission}%`}
                </span>

                {/* Hotels coverage */}
                <div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
                    <span style={{ color: TEXT, fontSize: 13, fontWeight: 600 }}>{ch.propertiesConnected}</span>
                    <span style={{ color: TEXT_DIM, fontSize: 10 }}>/ {totalProperties}</span>
                  </div>
                  <div style={{ width: "100%", height: 3, borderRadius: 2, background: "#333", marginTop: 4 }}>
                    <div style={{ width: `${coverage}%`, height: "100%", borderRadius: 2, background: coverage === 100 ? GREEN : BLUE, transition: "width 0.3s" }} />
                  </div>
                </div>

                {/* Expand arrow */}
                <ChevronRight size={14} style={{
                  color: TEXT_DIM, transition: "transform 0.2s",
                  transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
                }} />
              </div>

              {/* ── Expanded detail ── */}
              {expanded && (
                <div style={{ padding: "18px 24px", borderBottom: `1px solid ${BORDER}`, background: "rgba(57,189,248,0.015)" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>

                    {/* Col 1 — Contacts */}
                    <div>
                      <div style={{ color: TEXT_DIM, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>
                        Contacts{ch.contacts.length > 0 && <span style={{ color: TEXT_DIM, fontWeight: 400 }}> ({ch.contacts.length})</span>}
                      </div>
                      {ch.contacts.length > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                          {ch.contacts.map((c, i) => (
                            <div key={i} style={{
                              padding: "10px 12px", borderRadius: 6, background: "rgba(255,255,255,0.02)",
                              border: `1px solid ${BORDER}`,
                            }}>
                              <div style={{ color: TEXT, fontSize: 12, fontWeight: 500 }}>{c.name}</div>
                              <div style={{ color: TEXT_DIM, fontSize: 10, marginBottom: 6 }}>{c.role}</div>
                              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                  <Mail size={10} style={{ color: BLUE, flexShrink: 0 }} />
                                  <span style={{ color: TEXT_MID, fontSize: 11 }}>{c.email}</span>
                                </div>
                                {c.phone && (
                                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                    <Phone size={10} style={{ color: BLUE, flexShrink: 0 }} />
                                    <span style={{ color: TEXT_MID, fontSize: 11 }}>{c.phone}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ color: TEXT_DIM, fontSize: 11, fontStyle: "italic" }}>No contacts yet</div>
                      )}
                    </div>

                    {/* Col 2 — Agreement details */}
                    <div>
                      <div style={{ color: TEXT_DIM, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>Agreement</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                        <DetailRow label="Type" value={aCfg.label} valueColor={aCfg.color} />
                        <DetailRow label="Commission" value={ch.commission === 0 ? "Free" : `${ch.commission}%`} />
                        <DetailRow label="Integration" value={INTEGRATION_CFG[ch.integration].label} />
                        {ch.contractExpiry && (
                          <DetailRow label="Contract Expiry" value={ch.contractExpiry} valueColor={ch.contractExpiry < "2026-06-01" ? AMBER : TEXT_MID} />
                        )}
                        <DetailRow label="Properties" value={`${ch.propertiesConnected} / ${totalProperties}`} />
                        <DetailRow label="Coverage" value={`${coverage}%`} valueColor={coverage === 100 ? GREEN : coverage > 50 ? BLUE : AMBER} />
                        <DetailRow label="Added" value={ch.addedAt} />
                        {ch.notes && <DetailRow label="Notes" value={ch.notes} />}
                      </div>

                      {/* Edit button — bottom of this column */}
                      <button
                        onClick={(e) => { e.stopPropagation(); openEdit(ch); }}
                        style={{
                          display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 5,
                          border: `1px solid ${BORDER}`, background: "transparent", color: TEXT_DIM,
                          fontSize: 11, fontWeight: 500, cursor: "pointer", transition: "all 0.15s",
                          marginTop: 14,
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${BLUE}50`; e.currentTarget.style.color = BLUE; e.currentTarget.style.background = `${BLUE}08`; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = TEXT_DIM; e.currentTarget.style.background = "transparent"; }}
                      >
                        <Pencil size={10} /> Edit Channel
                      </button>
                    </div>

                    {/* Col 3 — Internal notes thread */}
                    <div>
                      <div style={{ color: TEXT_DIM, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>
                        Internal Notes{ch.internalNotes.length > 0 && <span style={{ color: TEXT_DIM, fontWeight: 400 }}> ({ch.internalNotes.length})</span>}
                      </div>

                      {ch.internalNotes.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
                          {ch.internalNotes.map((note) => (
                            <div key={note.id} style={{
                              padding: "8px 10px", borderRadius: 6, background: "rgba(255,255,255,0.02)",
                              border: `1px solid ${BORDER}`, borderLeft: `2px solid ${BLUE}30`,
                            }}>
                              <div style={{ color: TEXT_MID, fontSize: 11, lineHeight: 1.45 }}>{note.text}</div>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5 }}>
                                <span style={{ color: TEXT_DIM, fontSize: 9, fontWeight: 600 }}>{note.author}</span>
                                <span style={{ color: TEXT_DIM, fontSize: 9, opacity: 0.5 }}>{note.createdAt}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add note inline */}
                      <div style={{ display: "flex", gap: 6 }}>
                        <input
                          value={noteInputs[ch.id] || ""}
                          onChange={(e) => setNoteInputs({ ...noteInputs, [ch.id]: e.target.value })}
                          onKeyDown={(e) => { if (e.key === "Enter") addNote(ch.id); }}
                          placeholder="Add a note..."
                          style={{
                            flex: 1, padding: "6px 10px", background: INPUT_BG,
                            border: `1px solid ${BORDER}`, borderRadius: 5,
                            color: TEXT, fontSize: 11, outline: "none",
                          }}
                        />
                        <button
                          onClick={() => addNote(ch.id)}
                          style={{
                            padding: "6px 10px", borderRadius: 5, border: `1px solid ${BORDER}`,
                            background: "transparent", color: TEXT_DIM, cursor: "pointer",
                            fontSize: 11, transition: "all 0.15s", flexShrink: 0,
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${BLUE}50`; e.currentTarget.style.color = BLUE; }}
                          onMouseLeave={(e) => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = TEXT_DIM; }}
                        >
                          <MessageSquare size={12} />
                        </button>
                      </div>
                    </div>

                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ══ Slide-out Panel (Add / Edit) ══ */}
      {showPanel && (
        <ChannelPanel
          channel={editingChannel}
          onClose={() => { setShowPanel(false); setEditingChannel(null); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════
// CHANNEL PANEL — Jira/Monday-style slide-out
// ═══════════════════════════════════════════════════

function ChannelPanel({ channel, onClose, onSave }: {
  channel: Channel | null;
  onClose: () => void;
  onSave: (ch: Channel) => void;
}) {
  const isEdit = !!channel;

  const [name, setName] = useState(channel?.name || "");
  const [agreement, setAgreement] = useState<AgreementType>(channel?.agreement || "individual");
  const [tier, setTier] = useState<ChannelTier>(channel?.tier || "experimental");
  const [integration, setIntegration] = useState<IntegrationType>(channel?.integration || "channel_manager");
  const [commission, setCommission] = useState(channel?.commission ?? 15);
  const [contacts, setContacts] = useState<ChannelContact[]>(channel?.contacts || []);
  const [contractExpiry, setContractExpiry] = useState(channel?.contractExpiry || "");
  const [notes, setNotes] = useState(channel?.notes || "");
  const [panelNotes, setPanelNotes] = useState<InternalNote[]>(channel?.internalNotes || []);
  const [newNoteText, setNewNoteText] = useState("");

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  function addContact() {
    setContacts([...contacts, { name: "", role: "", email: "", phone: "" }]);
  }

  function updateContact(idx: number, field: keyof ChannelContact, value: string) {
    setContacts(contacts.map((c, i) => (i === idx ? { ...c, [field]: value } : c)));
  }

  function removeContact(idx: number) {
    setContacts(contacts.filter((_, i) => i !== idx));
  }

  function addPanelNote() {
    const text = newNoteText.trim();
    if (!text) return;
    setPanelNotes([...panelNotes, { id: `n${Date.now()}`, text, author: "You", createdAt: new Date().toISOString().split("T")[0] }]);
    setNewNoteText("");
  }

  function removePanelNote(id: string) {
    setPanelNotes(panelNotes.filter((n) => n.id !== id));
  }

  function handleSubmit() {
    if (!name.trim()) return;
    const id = channel?.id || name.toLowerCase().replace(/[^a-z0-9]/g, "-");
    const cleanContacts = contacts.filter((c) => c.name.trim() || c.email.trim());
    onSave({
      id, name, agreement, tier, integration, commission,
      propertiesConnected: channel?.propertiesConnected || 0,
      contacts: cleanContacts, contractExpiry: contractExpiry || undefined,
      notes: notes || undefined,
      internalNotes: panelNotes,
      addedAt: channel?.addedAt || new Date().toISOString().split("T")[0],
    });
  }

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
              {isEdit ? <Pencil size={18} style={{ color: "#0a0a0a" }} /> : <Plus size={18} style={{ color: "#0a0a0a" }} />}
            </div>
            <div>
              <div style={{ color: TEXT, fontSize: 20, fontWeight: 600, letterSpacing: "-0.025em", textTransform: "uppercase" }}>{isEdit ? "Edit Channel" : "Add Channel"}</div>
              <div style={{ color: TEXT_MID, fontSize: 13, marginTop: 2 }}>{isEdit ? "Update channel details" : "New OTA or distribution partner"}</div>
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

          {/* Name */}
          <input placeholder="Channel name" value={name} onChange={(e) => setName(e.target.value)} style={{
            width: "100%", padding: "10px 12px", background: INPUT_BG,
            border: `1px solid ${BORDER}`, borderRadius: 4,
            color: TEXT, fontSize: 18, fontWeight: 600, outline: "none",
            marginBottom: 24, lineHeight: 1.4,
            fontFamily: "system-ui, -apple-system, sans-serif",
          }} />

          {/* Inline field rows */}
          <div style={{ display: "flex", flexDirection: "column", gap: 0, marginBottom: 24, background: BG_PAGE, borderRadius: 4, border: `1px solid ${BORDER}`, padding: "4px 16px" }}>
            <InlineField label="Agreement" icon={<Users size={13} />}>
              <div style={{ display: "flex", gap: 4 }}>
                {(Object.entries(AGREEMENT_CFG) as [AgreementType, { color: string; label: string }][]).map(([key, cfg]) => (
                  <button key={key} onClick={() => setAgreement(key)} style={{
                    padding: "7px 14px", borderRadius: 6, border: `1px solid ${agreement === key ? `${cfg.color}40` : BORDER}`,
                    background: agreement === key ? `${cfg.color}12` : "transparent",
                    color: agreement === key ? cfg.color : TEXT_DIM,
                    fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                    transition: "all 0.15s",
                  }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: agreement === key ? cfg.color : TEXT_DIM }} />
                    {cfg.label}
                  </button>
                ))}
              </div>
            </InlineField>

            <InlineField label="Tier" icon={<Layers size={13} />}>
              <div style={{ display: "flex", gap: 4 }}>
                {(Object.entries(TIER_CFG) as [ChannelTier, { color: string; label: string }][]).map(([key, cfg]) => (
                  <button key={key} onClick={() => setTier(key)} style={{
                    padding: "7px 14px", borderRadius: 6, border: `1px solid ${tier === key ? `${cfg.color}40` : BORDER}`,
                    background: tier === key ? `${cfg.color}12` : "transparent",
                    color: tier === key ? cfg.color : TEXT_DIM,
                    fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                    transition: "all 0.15s",
                  }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: tier === key ? cfg.color : TEXT_DIM }} />
                    {cfg.label}
                  </button>
                ))}
              </div>
            </InlineField>

            <InlineField label="Integration" icon={<Cable size={13} />}>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {(Object.entries(INTEGRATION_CFG) as [IntegrationType, { label: string }][]).map(([key, cfg]) => (
                  <button key={key} onClick={() => setIntegration(key)} style={{
                    padding: "7px 14px", borderRadius: 6, border: `1px solid ${integration === key ? `${BLUE}40` : BORDER}`,
                    background: integration === key ? `${BLUE}12` : "transparent",
                    color: integration === key ? BLUE : TEXT_DIM,
                    fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
                  }}>
                    {cfg.label}
                  </button>
                ))}
              </div>
            </InlineField>

            <InlineField label="Commission" icon={<Percent size={13} />}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="number" min={0} max={50} value={commission} onChange={(e) => setCommission(Number(e.target.value))} style={{
                  width: 70, padding: "6px 10px", background: INPUT_BG, border: `1px solid ${BORDER}`,
                  borderRadius: 6, color: TEXT, fontSize: 13, fontWeight: 600, outline: "none", textAlign: "center",
                }} />
                <span style={{ color: TEXT_DIM, fontSize: 11 }}>%</span>
              </div>
            </InlineField>

            <InlineField label="Contract Expiry" icon={<FileText size={13} />}>
              <input type="date" value={contractExpiry} onChange={(e) => setContractExpiry(e.target.value)} style={{
                padding: "6px 10px", background: INPUT_BG, border: `1px solid ${BORDER}`,
                borderRadius: 6, color: TEXT, fontSize: 12, outline: "none", cursor: "pointer",
              }} />
            </InlineField>
          </div>

          {/* Contacts — multi */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ color: TEXT_DIM, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Contacts{contacts.length > 0 && ` (${contacts.length})`}
              </div>
              <button onClick={addContact} style={{
                display: "flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 5,
                border: `1px solid ${BORDER}`, background: "transparent", color: TEXT_DIM,
                fontSize: 10, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
              }}
                onMouseEnter={(e) => { e.currentTarget.style.color = BLUE; e.currentTarget.style.borderColor = `${BLUE}40`; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = TEXT_DIM; e.currentTarget.style.borderColor = BORDER; }}
              >
                <Plus size={10} /> Add
              </button>
            </div>

            {contacts.length === 0 && (
              <div style={{ color: TEXT_DIM, fontSize: 11, fontStyle: "italic", padding: "8px 0" }}>No contacts — click Add above</div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {contacts.map((c, i) => (
                <div key={i} style={{
                  padding: "12px 14px", borderRadius: 6, border: `1px solid ${BORDER}`,
                  background: "rgba(255,255,255,0.015)",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ color: TEXT_DIM, fontSize: 9, fontWeight: 600, textTransform: "uppercase" }}>Contact {i + 1}</span>
                    <button onClick={() => removeContact(i)} style={{
                      background: "none", border: "none", color: TEXT_DIM, cursor: "pointer", padding: 2,
                      opacity: 0.5, transition: "opacity 0.15s",
                    }}
                      onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.5"; }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <input value={c.name} onChange={(e) => updateContact(i, "name", e.target.value)} placeholder="Name" style={compactInputStyle} />
                    <input value={c.role} onChange={(e) => updateContact(i, "role", e.target.value)} placeholder="Role" style={compactInputStyle} />
                    <input value={c.email} onChange={(e) => updateContact(i, "email", e.target.value)} placeholder="Email" style={compactInputStyle} />
                    <input value={c.phone || ""} onChange={(e) => updateContact(i, "phone", e.target.value)} placeholder="Phone" style={compactInputStyle} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* General Notes */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ color: TEXT_MID, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "-0.025em", marginBottom: 8, fontFamily: "system-ui, -apple-system, sans-serif" }}>General Notes</div>
            <textarea rows={3} placeholder="General notes about this channel..." value={notes} onChange={(e) => setNotes(e.target.value)} style={{
              width: "100%", padding: "10px 12px", background: INPUT_BG,
              border: `1px solid ${BORDER}`, borderRadius: 4, color: TEXT, fontSize: 13,
              outline: "none", resize: "vertical", lineHeight: 1.6,
              fontFamily: "system-ui, -apple-system, sans-serif",
            }} />
          </div>

          {/* Internal Notes — multi */}
          <div>
            <div style={{ color: BLUE, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "-0.025em", marginBottom: 10, fontFamily: "system-ui, -apple-system, sans-serif" }}>
              Internal Notes{panelNotes.length > 0 && ` (${panelNotes.length})`}
            </div>

            {panelNotes.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                {panelNotes.map((note) => (
                  <div key={note.id} style={{
                    padding: "10px 12px", borderRadius: 6, background: BG_PAGE,
                    border: `1px solid ${BORDER}`, borderLeft: `2px solid ${BLUE}30`,
                    display: "flex", gap: 10, alignItems: "flex-start",
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: TEXT_MID, fontSize: 12, lineHeight: 1.5 }}>{note.text}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                        <span style={{ color: TEXT_DIM, fontSize: 10, fontWeight: 600 }}>{note.author}</span>
                        <span style={{ color: TEXT_DIM, fontSize: 10, opacity: 0.5 }}>{note.createdAt}</span>
                      </div>
                    </div>
                    <button onClick={() => removePanelNote(note.id)} style={{
                      background: "none", border: "none", color: TEXT_DIM, cursor: "pointer", padding: 2,
                      opacity: 0.4, transition: "opacity 0.15s", flexShrink: 0, marginTop: 2,
                    }}
                      onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.4"; }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add note */}
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addPanelNote(); }}
                placeholder="Add a note..."
                style={{
                  flex: 1, padding: "10px 12px", background: INPUT_BG,
                  border: `1px solid ${BORDER}`, borderRadius: 4,
                  color: TEXT, fontSize: 13, outline: "none",
                  fontFamily: "system-ui, -apple-system, sans-serif",
                }}
              />
              <button onClick={addPanelNote} style={{
                height: 38, padding: "0 16px", borderRadius: 4,
                background: newNoteText.trim() ? BLUE : "#141414",
                color: newNoteText.trim() ? "#0a0a0a" : TEXT_DIM,
                fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.2s",
                border: newNoteText.trim() ? "none" : `1px solid ${BORDER}`,
                fontFamily: "system-ui, -apple-system, sans-serif",
              }}>Save</button>
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
          <button onClick={handleSubmit} style={{
            height: 40, padding: "0 24px", borderRadius: 4, border: "none",
            background: BLUE, color: "#0a0a0a",
            fontSize: 13, fontWeight: 600, cursor: "pointer",
            fontFamily: "system-ui, -apple-system, sans-serif", transition: "background 0.2s",
            opacity: name.trim() ? 1 : 0.4,
          }}
            onMouseEnter={(e) => { if (name.trim()) e.currentTarget.style.background = "#29ADEE"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = BLUE; }}
          >{isEdit ? "Save" : "Create"}</button>
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


// ═══════════════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════════════

const compactInputStyle: React.CSSProperties = {
  padding: "8px 10px", background: INPUT_BG, border: `1px solid ${BORDER}`,
  borderRadius: 4, color: TEXT, fontSize: 12, outline: "none",
  fontFamily: "system-ui, -apple-system, sans-serif",
};

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

function DetailRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ color: TEXT_DIM, fontSize: 11 }}>{label}</span>
      <span style={{ color: valueColor || TEXT_MID, fontSize: 12, fontWeight: 500 }}>{value}</span>
    </div>
  );
}
