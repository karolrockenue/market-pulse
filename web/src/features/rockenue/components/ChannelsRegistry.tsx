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
  Layers,
  Cable,
  FileText,
  MessageSquare,
  Trash2,
  Loader2,
  Globe,
} from "lucide-react";
import { useChannels } from "../hooks/useChannels";
import type {
  DistributionChannel,
  ChannelContact,
  ChannelNote,
  AgreementType,
  ChannelTier,
  IntegrationType,
  ChannelType,
  PaymentMethod,
} from "../api/types";

// ── New palette (matching MP mockups) ──
const R = {
  bg: "#14181D", card: "#121519", cardRaised: "#1C2228", border: "#1E2330", sep: "rgba(255,255,255,0.04)", accent: "#F3F5F7",
  text: "#B0B8C4", textMid: "#7A8494", textDim: "#4E5868", teal: "#38C6BA", gold: "#C8A66E",
  darkBand: "#0C0E12", green: "#34D068", red: "#ef4444",
};
// Aliases for backward compat within this file
const BLUE = R.warmTeal;
const GREEN = R.green;
const AMBER = R.gold;
const BG_PAGE = R.bg;
const CARD_BG = R.card;
const INPUT_BG = R.cardRaised;
const BORDER = R.border;
const TEXT = R.accent;
const TEXT_MID = R.textMid;
const TEXT_DIM = R.textDim;

const AGREEMENT_CFG: Record<AgreementType, { color: string; label: string }> = {
  group: { color: BLUE, label: "Group" },
  individual: { color: AMBER, label: "Individual" },
  direct: { color: GREEN, label: "Direct" },
  meta: { color: R.warmTeal, label: "Meta" },
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

const CHANNEL_TYPE_CFG: Record<ChannelType, { color: string; label: string }> = {
  ota: { color: BLUE, label: "OTA" },
  wholesaler: { color: AMBER, label: "Wholesaler" },
  flash_sale: { color: R.gold, label: "Flash Sale" },
  direct: { color: GREEN, label: "Direct" },
  meta: { color: R.warmTeal, label: "Meta" },
};

const PAYMENT_CFG: Record<PaymentMethod, { label: string }> = {
  guest_pays: { label: "Guest Pays at Hotel" },
  vcc: { label: "VCC" },
  bacs: { label: "BACS" },
};

// ══════════════════════════════════════════

export function ChannelsRegistry() {
  const {
    channels,
    loading,
    createChannel,
    updateChannel,
    deleteChannel,
    addContact,
    deleteContact,
    addNote,
    deleteNote,
  } = useChannels();

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showPanel, setShowPanel] = useState(false);
  const [editingChannel, setEditingChannel] = useState<DistributionChannel | null>(null);
  const [noteInputs, setNoteInputs] = useState<Record<number, string>>({});

  function openAdd() {
    setEditingChannel(null);
    setShowPanel(true);
  }

  function openEdit(ch: DistributionChannel) {
    setEditingChannel(ch);
    setShowPanel(true);
  }

  async function handleSave(data: Partial<DistributionChannel>) {
    if (editingChannel) {
      await updateChannel(editingChannel.id, data);
    } else {
      await createChannel(data);
    }
  }

  async function handleAddNote(channelId: number) {
    const text = (noteInputs[channelId] || "").trim();
    if (!text) return;
    await addNote(channelId, { author: "User", body: text });
    setNoteInputs({ ...noteInputs, [channelId]: "" });
  }

  const totalProperties = 21;

  if (loading) {
    return (
      <div style={{ padding: "0 32px 64px", display: "flex", justifyContent: "center", alignItems: "center", minHeight: 200 }}>
        <Loader2 size={28} style={{ color: BLUE, animation: "spin 1s linear infinite" }} />
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

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
          display: "grid", gridTemplateColumns: "2fr 90px 1fr 1fr 100px 90px 70px 40px",
          padding: "13px 18px", borderBottom: `1px solid ${BORDER}`, background: BG_PAGE,
          gap: 12, alignItems: "center",
        }}>
          {["Channel", "Type", "Agreement", "Tier", "Payment", "Commission", "Hotels", ""].map((h) => (
            <span key={h} style={{ color: TEXT_DIM, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" }}>{h}</span>
          ))}
        </div>

        {/* Rows */}
        {channels.map((ch) => {
          const expanded = expandedId === ch.id;
          const aCfg = AGREEMENT_CFG[ch.agreement_type];
          const tCfg = TIER_CFG[ch.tier];
          const coverage = Math.round((ch.properties_connected / totalProperties) * 100);
          const primaryContact = ch.contacts[0];

          return (
            <div key={ch.id}>
              {/* Main row */}
              <div
                onClick={() => setExpandedId(expanded ? null : ch.id)}
                style={{
                  display: "grid", gridTemplateColumns: "2fr 90px 1fr 1fr 100px 90px 70px 40px",
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

                {/* Channel Type */}
                {ch.channel_type ? (() => {
                  const ctCfg = CHANNEL_TYPE_CFG[ch.channel_type];
                  return <span style={{ color: ctCfg?.color || TEXT_DIM, fontSize: 11, fontWeight: 500 }}>{ctCfg?.label || ch.channel_type}</span>;
                })() : <span style={{ color: TEXT_DIM, fontSize: 11 }}>—</span>}

                {/* Agreement */}
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px",
                  borderRadius: 4, background: `${aCfg.color}10`, color: aCfg.color,
                  fontSize: 12, fontWeight: 500, width: "fit-content",
                }}>
                  {ch.agreement_type === "group" ? <Users size={11} /> : ch.agreement_type === "meta" ? <Zap size={10} /> : <Shield size={10} />}
                  {aCfg.label}
                </span>

                {/* Tier */}
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: tCfg.color }} />
                  <span style={{ color: tCfg.color, fontSize: 12, fontWeight: 500 }}>{tCfg.label}</span>
                </div>

                {/* Payment */}
                <span style={{ color: TEXT_MID, fontSize: 11 }}>{ch.payment_method ? (PAYMENT_CFG[ch.payment_method]?.label || ch.payment_method) : "—"}</span>

                {/* Commission */}
                <span style={{
                  color: ch.commission_pct == null ? TEXT_DIM : ch.commission_pct === 0 ? GREEN : ch.commission_pct >= 20 ? AMBER : TEXT,
                  fontSize: 13, fontWeight: 600,
                }}>
                  {ch.commission_pct == null ? "—" : ch.commission_pct === 0 ? "Free" : `${ch.commission_pct}%`}
                </span>

                {/* Hotels coverage */}
                <div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
                    <span style={{ color: TEXT, fontSize: 13, fontWeight: 600 }}>{ch.properties_connected}</span>
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
                          {ch.contacts.map((c) => (
                            <div key={c.id} style={{
                              padding: "10px 12px", borderRadius: 6, background: "rgba(255,255,255,0.02)",
                              border: `1px solid ${BORDER}`,
                            }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                <div>
                                  <div style={{ color: TEXT, fontSize: 12, fontWeight: 500 }}>{c.name}</div>
                                  <div style={{ color: TEXT_DIM, fontSize: 10, marginBottom: 6 }}>{c.role}</div>
                                </div>
                                <button
                                  onClick={(e) => { e.stopPropagation(); deleteContact(c.id); }}
                                  style={{
                                    background: "none", border: "none", color: TEXT_DIM, cursor: "pointer", padding: 2,
                                    opacity: 0.4, transition: "opacity 0.15s", flexShrink: 0,
                                  }}
                                  onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.4"; }}
                                >
                                  <X size={12} />
                                </button>
                              </div>
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
                        {ch.channel_type && <DetailRow label="Channel" value={CHANNEL_TYPE_CFG[ch.channel_type]?.label || ch.channel_type} valueColor={CHANNEL_TYPE_CFG[ch.channel_type]?.color} />}
                        {ch.payment_method && <DetailRow label="Payment" value={PAYMENT_CFG[ch.payment_method]?.label || ch.payment_method} />}
                        <DetailRow label="Commission" value={ch.commission_pct == null ? "—" : ch.commission_pct === 0 ? "Free" : `${ch.commission_pct}%`} />
                        <DetailRow label="Integration" value={INTEGRATION_CFG[ch.integration_type].label} />
                        {ch.contract_expiry && (
                          <DetailRow label="Contract Expiry" value={ch.contract_expiry} valueColor={ch.contract_expiry < "2026-06-01" ? AMBER : TEXT_MID} />
                        )}
                        <DetailRow label="Properties" value={`${ch.properties_connected} / ${totalProperties}`} />
                        <DetailRow label="Coverage" value={`${coverage}%`} valueColor={coverage === 100 ? GREEN : coverage > 50 ? BLUE : AMBER} />
                        <DetailRow label="Added" value={ch.added_at} />
                        {ch.notes && <DetailRow label="Notes" value={ch.notes} />}
                      </div>

                      {/* Edit / Delete buttons — bottom of this column */}
                      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); openEdit(ch); }}
                          style={{
                            display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 5,
                            border: `1px solid ${BORDER}`, background: "transparent", color: TEXT_DIM,
                            fontSize: 11, fontWeight: 500, cursor: "pointer", transition: "all 0.15s",
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${BLUE}50`; e.currentTarget.style.color = BLUE; e.currentTarget.style.background = `${BLUE}08`; }}
                          onMouseLeave={(e) => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = TEXT_DIM; e.currentTarget.style.background = "transparent"; }}
                        >
                          <Pencil size={10} /> Edit Channel
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteChannel(ch.id); setExpandedId(null); }}
                          style={{
                            display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 5,
                            border: `1px solid ${BORDER}`, background: "transparent", color: TEXT_DIM,
                            fontSize: 11, fontWeight: 500, cursor: "pointer", transition: "all 0.15s",
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#ef444450"; e.currentTarget.style.color = "#ef4444"; e.currentTarget.style.background = "#ef444408"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = TEXT_DIM; e.currentTarget.style.background = "transparent"; }}
                        >
                          <Trash2 size={10} /> Delete
                        </button>
                      </div>
                    </div>

                    {/* Col 3 — Internal notes thread */}
                    <div>
                      <div style={{ color: TEXT_DIM, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>
                        Internal Notes{ch.internal_notes.length > 0 && <span style={{ color: TEXT_DIM, fontWeight: 400 }}> ({ch.internal_notes.length})</span>}
                      </div>

                      {ch.internal_notes.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
                          {ch.internal_notes.map((note) => (
                            <div key={note.id} style={{
                              padding: "8px 10px", borderRadius: 6, background: "rgba(255,255,255,0.02)",
                              border: `1px solid ${BORDER}`, borderLeft: `2px solid ${BLUE}30`,
                              display: "flex", gap: 8, alignItems: "flex-start",
                            }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ color: TEXT_MID, fontSize: 11, lineHeight: 1.45 }}>{note.body}</div>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5 }}>
                                  <span style={{ color: TEXT_DIM, fontSize: 9, fontWeight: 600 }}>{note.author}</span>
                                  <span style={{ color: TEXT_DIM, fontSize: 9, opacity: 0.5 }}>{note.created_at}</span>
                                </div>
                              </div>
                              <button
                                onClick={(e) => { e.stopPropagation(); deleteNote(note.id); }}
                                style={{
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

                      {/* Add note inline */}
                      <div style={{ display: "flex", gap: 6 }}>
                        <input
                          value={noteInputs[ch.id] || ""}
                          onChange={(e) => setNoteInputs({ ...noteInputs, [ch.id]: e.target.value })}
                          onKeyDown={(e) => { if (e.key === "Enter") handleAddNote(ch.id); }}
                          placeholder="Add a note..."
                          style={{
                            flex: 1, padding: "6px 10px", background: INPUT_BG,
                            border: `1px solid ${BORDER}`, borderRadius: 5,
                            color: TEXT, fontSize: 11, outline: "none",
                          }}
                        />
                        <button
                          onClick={() => handleAddNote(ch.id)}
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

      {/* Slide-out Panel (Add / Edit) */}
      {showPanel && (
        <ChannelPanel
          channel={editingChannel}
          onClose={() => { setShowPanel(false); setEditingChannel(null); }}
          onSave={handleSave}
          onAddContact={addContact}
          onDeleteContact={deleteContact}
          onAddNote={addNote}
          onDeleteNote={deleteNote}
        />
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════
// CHANNEL PANEL — Jira/Monday-style slide-out
// ═══════════════════════════════════════════════════

interface PanelContact {
  id?: number;
  name: string;
  role: string;
  email: string;
  phone: string;
}

function ChannelPanel({ channel, onClose, onSave, onAddContact, onDeleteContact, onAddNote, onDeleteNote }: {
  channel: DistributionChannel | null;
  onClose: () => void;
  onSave: (data: Partial<DistributionChannel>) => Promise<void>;
  onAddContact: (channelId: number, data: { name: string; role: string; email: string; phone?: string }) => Promise<void>;
  onDeleteContact: (id: number) => Promise<void>;
  onAddNote: (channelId: number, data: { author: string; body: string }) => Promise<void>;
  onDeleteNote: (id: number) => Promise<void>;
}) {
  const isEdit = !!channel;

  const [name, setName] = useState(channel?.name || "");
  const [agreement, setAgreement] = useState<AgreementType>(channel?.agreement_type || "individual");
  const [tier, setTier] = useState<ChannelTier>(channel?.tier || "experimental");
  const [integration, setIntegration] = useState<IntegrationType>(channel?.integration_type || "channel_manager");
  const [channelType, setChannelType] = useState<ChannelType | "">(channel?.channel_type || "");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">(channel?.payment_method || "");
  const [commission, setCommission] = useState<number | "">(channel?.commission_pct ?? "");
  const [contacts, setContacts] = useState<PanelContact[]>(
    channel?.contacts.map((c) => ({ id: c.id, name: c.name, role: c.role || "", email: c.email || "", phone: c.phone || "" })) || []
  );
  const [contractExpiry, setContractExpiry] = useState(channel?.contract_expiry || "");
  const [notes, setNotes] = useState(channel?.notes || "");
  const [panelNotes, setPanelNotes] = useState<ChannelNote[]>(channel?.internal_notes || []);
  const [newNoteText, setNewNoteText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  function addLocalContact() {
    setContacts([...contacts, { name: "", role: "", email: "", phone: "" }]);
  }

  function updateLocalContact(idx: number, field: keyof PanelContact, value: string) {
    setContacts(contacts.map((c, i) => (i === idx ? { ...c, [field]: value } : c)));
  }

  function removeLocalContact(idx: number) {
    setContacts(contacts.filter((_, i) => i !== idx));
  }

  async function addPanelNote() {
    const text = newNoteText.trim();
    if (!text) return;
    if (isEdit && channel) {
      await onAddNote(channel.id, { author: "User", body: text });
      // Note will appear after refresh; add optimistically for panel display
      setPanelNotes([...panelNotes, { id: Date.now(), channel_id: channel.id, author: "User", body: text, created_at: new Date().toISOString().split("T")[0] }]);
    } else {
      setPanelNotes([...panelNotes, { id: Date.now(), channel_id: 0, author: "User", body: text, created_at: new Date().toISOString().split("T")[0] }]);
    }
    setNewNoteText("");
  }

  async function removePanelNote(noteId: number) {
    if (isEdit) {
      await onDeleteNote(noteId);
    }
    setPanelNotes(panelNotes.filter((n) => n.id !== noteId));
  }

  async function handleSubmit() {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      const cleanContacts = contacts.filter((c) => c.name.trim() || c.email.trim());

      if (isEdit && channel) {
        // Update channel fields
        await onSave({
          name,
          agreement_type: agreement,
          tier,
          integration_type: integration,
          channel_type: channelType || null,
          payment_method: paymentMethod || null,
          commission_pct: commission === "" ? null : commission,
          contract_expiry: contractExpiry || null,
          notes: notes || null,
        } as any);

        // Handle contacts: delete removed, add new
        const existingIds = new Set(cleanContacts.filter((c) => c.id).map((c) => c.id!));
        for (const orig of channel.contacts) {
          if (!existingIds.has(orig.id)) {
            await onDeleteContact(orig.id);
          }
        }
        for (const c of cleanContacts) {
          if (!c.id) {
            await onAddContact(channel.id, { name: c.name, role: c.role, email: c.email, phone: c.phone || undefined });
          }
        }
      } else {
        // Create channel
        await onSave({
          name,
          agreement_type: agreement,
          tier,
          integration_type: integration,
          channel_type: channelType || null,
          payment_method: paymentMethod || null,
          commission_pct: commission === "" ? null : commission,
          contract_expiry: contractExpiry || null,
          notes: notes || null,
        } as any);

        // Add contacts to newly created channel — handled after panel close + refresh
      }

      onClose();
    } catch (err) {
      console.error("Channel save failed:", err);
    } finally {
      setSaving(false);
    }
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

            <InlineField label="Channel Type" icon={<Globe size={13} />}>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {(Object.entries(CHANNEL_TYPE_CFG) as [ChannelType, { color: string; label: string }][]).map(([key, cfg]) => (
                  <button key={key} onClick={() => setChannelType(key)} style={{
                    padding: "7px 14px", borderRadius: 6, border: `1px solid ${channelType === key ? `${cfg.color}40` : BORDER}`,
                    background: channelType === key ? `${cfg.color}12` : "transparent",
                    color: channelType === key ? cfg.color : TEXT_DIM,
                    fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
                  }}>
                    {cfg.label}
                  </button>
                ))}
              </div>
            </InlineField>

            <InlineField label="Payment Method" icon={<Cable size={13} />}>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {(Object.entries(PAYMENT_CFG) as [PaymentMethod, { label: string }][]).map(([key, cfg]) => (
                  <button key={key} onClick={() => setPaymentMethod(key)} style={{
                    padding: "7px 14px", borderRadius: 6, border: `1px solid ${paymentMethod === key ? `${BLUE}40` : BORDER}`,
                    background: paymentMethod === key ? `${BLUE}12` : "transparent",
                    color: paymentMethod === key ? BLUE : TEXT_DIM,
                    fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
                  }}>
                    {cfg.label}
                  </button>
                ))}
              </div>
            </InlineField>

            <InlineField label="Commission" icon={<Percent size={13} />}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="number" min={0} max={50} value={commission} onChange={(e) => setCommission(e.target.value === "" ? "" : Number(e.target.value))} placeholder="—" style={{
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
              <button onClick={addLocalContact} style={{
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
                    <button onClick={() => removeLocalContact(i)} style={{
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
                    <input value={c.name} onChange={(e) => updateLocalContact(i, "name", e.target.value)} placeholder="Name" style={compactInputStyle} />
                    <input value={c.role} onChange={(e) => updateLocalContact(i, "role", e.target.value)} placeholder="Role" style={compactInputStyle} />
                    <input value={c.email} onChange={(e) => updateLocalContact(i, "email", e.target.value)} placeholder="Email" style={compactInputStyle} />
                    <input value={c.phone || ""} onChange={(e) => updateLocalContact(i, "phone", e.target.value)} placeholder="Phone" style={compactInputStyle} />
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
                      <div style={{ color: TEXT_MID, fontSize: 12, lineHeight: 1.5 }}>{note.body}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                        <span style={{ color: TEXT_DIM, fontSize: 10, fontWeight: 600 }}>{note.author}</span>
                        <span style={{ color: TEXT_DIM, fontSize: 10, opacity: 0.5 }}>{note.created_at}</span>
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
            opacity: name.trim() && !saving ? 1 : 0.4,
          }}
            onMouseEnter={(e) => { if (name.trim()) e.currentTarget.style.background = "#29ADEE"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = BLUE; }}
          >{saving ? "Saving..." : isEdit ? "Save" : "Create"}</button>
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
