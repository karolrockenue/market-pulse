import { useState } from "react";
import { Copy, Check } from "lucide-react";

// ── Rockenue Email Signatures ──
// Gmail-safe: table layout, inline styles only, no gradients/SVG/custom fonts,
// hosted images only (no base64), no flex/grid, max ~460px wide.
//
// Palette tuned for readability on white (the Gmail reading pane):
//   #0F172A  near-black, primary text
//   #64748B  muted slate, secondary text
//   #E2E8F0  light divider
//   #1E3A8A  deep navy — single brand accent (replaces the old teal + gold)

const R = {
  bg: "#14181D",
  card: "#1C2228",
  border: "#2A3240",
  accent: "#F3F5F7",
  text: "#B0B8C4",
  textMid: "#7A8494",
  textDim: "#4E5868",
  brand: "#1E3A8A",     // deep navy — signature accent
  divider: "#CBD5E1",   // muted slate for in-signature separators
};

// Signature-HTML palette (hex literals — tables need inline styles only)
const INK = "#0F172A";
const MUTED = "#64748B";
const LINE = "#E2E8F0";
const DOT = "#94A3B8";
const BRAND = "#1E3A8A";

const PEOPLE = [
  { name: "Karol Zymek", title: "Managing Director", email: "karol@rockenue.com" },
  { name: "Ruslana Doroschuk", title: "Distribution Manager", email: "ruslana@rockenue.com" },
  { name: "Ruslana Doroschuk", title: "Executive Assistant", email: "ruslana@rockenue.com" },
  { name: "Ruslana Doroschuk", title: "Operations Manager", email: "ruslana@rockenue.com" },
];

const PHONE = "+44 20 7946 0123";
const WEB = "rockenue.com";

const BANNER_PLACEHOLDER = "https://www.rockenue.com/sig-banner.png";

// Brand mark — inline, no SVG. Single-accent brackets.
function brandMark(size: "sm" | "md" = "md") {
  const bracket = size === "md" ? 15 : 14;
  const word = size === "md" ? 10 : 9;
  return `<span style="color:${BRAND};font-size:${bracket}px;font-weight:300;">(</span>` +
    `<span style="font-weight:bold;color:${INK};font-size:${word}px;letter-spacing:1.5px;">ROCKENUE</span>` +
    `<span style="color:${BRAND};font-size:${bracket}px;font-weight:300;">)</span>`;
}

type Person = typeof PEOPLE[0];

// ── 1. Monoline — hairline + single-row contact, tightest footprint ──
function sigMonoline(p: Person) {
  return `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;max-width:460px;">
  <tr>
    <td style="font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:${INK};padding-bottom:10px;">
      ${p.name}<span style="color:${DOT};padding:0 8px;">·</span><span style="color:${MUTED};font-weight:400;letter-spacing:0.3px;text-transform:none;">${p.title}</span>
    </td>
  </tr>
  <tr>
    <td style="border-top:1px solid ${BRAND};padding-top:10px;font-size:11px;color:${MUTED};line-height:1.5;">
      ${brandMark("sm")}<span style="color:${DOT};padding:0 10px;">·</span><a href="mailto:${p.email}" style="color:${INK};text-decoration:none;">${p.email}</a><span style="color:${DOT};padding:0 8px;">·</span><a href="tel:${PHONE.replace(/\s/g, "")}" style="color:${MUTED};text-decoration:none;">${PHONE}</a><span style="color:${DOT};padding:0 8px;">·</span><a href="https://${WEB}" style="color:${BRAND};text-decoration:none;">${WEB}</a>
    </td>
  </tr>
</table>`;
}

// ── 2. Framed — navy-bordered business-card with centred brand mark ──
function sigFramed(p: Person) {
  return `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;max-width:460px;border:1px solid ${BRAND};">
  <tr>
    <td bgcolor="#FFFFFF" style="padding:18px 22px;background:#FFFFFF;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td align="center" style="padding-bottom:14px;border-bottom:1px solid ${LINE};">
            ${brandMark("md")}
          </td>
        </tr>
        <tr>
          <td style="padding-top:14px;">
            <span style="font-size:15px;font-weight:bold;color:${INK};">${p.name}</span>
            <span style="font-size:11px;color:${MUTED};padding-left:10px;letter-spacing:0.3px;">${p.title}</span>
          </td>
        </tr>
        <tr>
          <td style="padding-top:10px;font-size:11px;color:${MUTED};line-height:1.6;">
            <a href="mailto:${p.email}" style="color:${INK};text-decoration:none;">${p.email}</a><br/>
            <a href="tel:${PHONE.replace(/\s/g, "")}" style="color:${MUTED};text-decoration:none;">${PHONE}</a><span style="color:${DOT};padding:0 8px;">·</span><a href="https://${WEB}" style="color:${BRAND};text-decoration:none;">${WEB}</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

// ── 3. Accent Bar — navy top stripe (identity) + slate bottom stripe (contact) ──
function sigAccentBar(p: Person) {
  return `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;max-width:460px;">
  <tr>
    <td width="4" bgcolor="${BRAND}" style="width:4px;font-size:0;line-height:0;">&nbsp;</td>
    <td style="padding:0 0 12px 16px;">
      <div style="font-size:15px;font-weight:bold;color:${INK};">${p.name}</div>
      <div style="font-size:11px;color:${MUTED};">${p.title}</div>
    </td>
  </tr>
  <tr>
    <td width="4" bgcolor="${MUTED}" style="width:4px;font-size:0;line-height:0;">&nbsp;</td>
    <td style="padding:0 0 0 16px;">
      <div style="padding-bottom:6px;">
        ${brandMark("sm")}<span style="font-size:10px;color:${MUTED};padding-left:8px;">Independent hotel operator</span>
      </div>
      <div style="font-size:11px;color:${MUTED};line-height:1.55;">
        <a href="mailto:${p.email}" style="color:${INK};text-decoration:none;">${p.email}</a><span style="color:${DOT};padding:0 6px;">·</span><a href="tel:${PHONE.replace(/\s/g, "")}" style="color:${MUTED};text-decoration:none;">${PHONE}</a><span style="color:${DOT};padding:0 6px;">·</span><a href="https://${WEB}" style="color:${BRAND};text-decoration:none;">${WEB}</a>
      </div>
    </td>
  </tr>
</table>`;
}

// ── 4. Pill Contact — rounded chip links, solid-navy web CTA ──
function sigPillContact(p: Person) {
  return `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;max-width:460px;">
  <tr>
    <td style="padding-bottom:14px;">
      <div style="font-size:16px;font-weight:bold;color:${INK};">${p.name}</div>
      <div style="font-size:11px;color:${MUTED};padding-top:2px;">${p.title}<span style="color:${DOT};padding:0 8px;">·</span>${brandMark("sm")}</div>
    </td>
  </tr>
  <tr>
    <td>
      <a href="mailto:${p.email}" style="display:inline-block;padding:6px 12px;background:#F1F5F9;color:${INK};text-decoration:none;font-size:11px;border-radius:14px;border:1px solid ${LINE};margin-right:6px;margin-bottom:4px;">&#9993; ${p.email}</a>
      <a href="tel:${PHONE.replace(/\s/g, "")}" style="display:inline-block;padding:6px 12px;background:#F1F5F9;color:${MUTED};text-decoration:none;font-size:11px;border-radius:14px;border:1px solid ${LINE};margin-right:6px;margin-bottom:4px;">&#9742; ${PHONE}</a>
      <a href="https://${WEB}" style="display:inline-block;padding:6px 12px;background:${BRAND};color:#FFFFFF;text-decoration:none;font-size:11px;font-weight:600;border-radius:14px;margin-bottom:4px;">${WEB}</a>
    </td>
  </tr>
</table>`;
}

// Aurora tile wrapper for banner preview
function AuroraTile({ height, children }: { height: number; children: React.ReactNode }) {
  return (
    <div style={{
      width: 460, height, background: "#111519", borderRadius: 8,
      display: "flex", alignItems: "center", justifyContent: "center",
      position: "relative", overflow: "hidden",
      border: "1px solid #2A3240",
    }}>
      <div style={{
        position: "absolute", top: -60, right: -60, width: 180, height: 180, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(30,58,138,0.30) 0%, transparent 65%)",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", bottom: -60, left: -60, width: 180, height: 180, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(148,163,184,0.20) 0%, transparent 65%)",
        pointerEvents: "none",
      }} />
      <div style={{ position: "relative", width: "100%", padding: "0 28px", boxSizing: "border-box" }}>
        {children}
      </div>
    </div>
  );
}

function bannerPreview() {
  return (
    <AuroraTile height={88}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 11, color: "#F3F5F7", fontWeight: 600, letterSpacing: 0.5, marginBottom: 6 }}>
          Meet us at <span style={{ color: "#93C5FD" }}>The Hotel Show Dubai</span>
        </div>
        <div style={{ fontSize: 9, color: "#7A8494", letterSpacing: 1, textTransform: "uppercase" }}>
          16–18 September 2026&nbsp;&nbsp;·&nbsp;&nbsp;Stand H3-240
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 10 }}>
          <span style={{ color: "#93C5FD", fontSize: 16, fontWeight: 200 }}>(</span>
          <span style={{ color: "#F3F5F7", fontSize: 9, fontWeight: 700, letterSpacing: 2 }}>ROCKENUE</span>
          <span style={{ color: "#93C5FD", fontSize: 16, fontWeight: 200 }}>)</span>
        </div>
      </div>
    </AuroraTile>
  );
}

// Optional event-banner HTML appendable to any signature
function withBanner(sigHtml: string) {
  return sigHtml + `
<table cellpadding="0" cellspacing="0" border="0" style="max-width:460px;">
  <tr><td style="padding-top:14px;">
    <a href="https://rockenue.com" target="_blank" style="text-decoration:none;">
      <img src="${BANNER_PLACEHOLDER}" width="460" height="88" alt="Rockenue" style="display:block;border:0;outline:none;" />
    </a>
  </td></tr>
</table>`;
}

type SigFn = (p: Person) => string;
const VARIANTS: { id: string; label: string; description: string; fn: SigFn }[] = [
  { id: "1", label: "Monoline", description: "Hairline divider, contact on one row — tightest footprint", fn: sigMonoline },
  { id: "2", label: "Framed", description: "Navy-bordered business-card with centred brand mark", fn: sigFramed },
  { id: "3", label: "Accent Bar", description: "Navy top stripe, slate bottom stripe — identity vs. contact", fn: sigAccentBar },
  { id: "4", label: "Pill Contact", description: "Contact as rounded chips, solid-navy CTA for web", fn: sigPillContact },
];

export function EmailSignatures() {
  const [copied, setCopied] = useState<string | null>(null);
  const [bannerOn, setBannerOn] = useState<Record<string, boolean>>({});

  const handleCopy = (id: string, html: string) => {
    navigator.clipboard.writeText(html);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div style={{ minHeight: "100vh", background: R.bg, color: R.accent, fontFamily: "'Inter', system-ui, sans-serif", padding: "40px 64px" }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <div style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", color: R.brand }}>
            Brand Assets
          </span>
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: -1, margin: "0 0 8px", color: R.accent }}>
          Email Signatures
        </h1>
        <p style={{ fontSize: 13, color: R.textMid, margin: "0 0 40px", lineHeight: 1.6 }}>
          Four Gmail-compatible layouts in a navy-on-white palette tuned for readability in the Gmail reading pane.
          Copy any HTML and paste into Gmail &gt; Settings &gt; Signature. Toggle the event banner per variant to append a hosted PNG below.
        </p>

        {VARIANTS.map(({ id, label, description, fn }) => {
          const isBannerOn = !!bannerOn[id];
          return (
            <div key={id} style={{ marginBottom: 52 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                <span style={{ fontSize: 22, fontWeight: 700, color: R.brand, lineHeight: 1 }}>{id}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: R.accent }}>{label}</div>
                  <div style={{ fontSize: 12, color: R.textMid, marginTop: 2 }}>{description}</div>
                </div>
                <button
                  onClick={() => setBannerOn((s) => ({ ...s, [id]: !s[id] }))}
                  style={{
                    padding: "5px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer",
                    background: isBannerOn ? `${R.brand}25` : "transparent",
                    color: isBannerOn ? R.accent : R.textDim,
                    border: `1px solid ${isBannerOn ? R.brand : R.border}`,
                    transition: "all 0.2s",
                  }}
                >
                  {isBannerOn ? "Event banner ON" : "+ Event banner"}
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {PEOPLE.map((person, pi) => {
                  const key = `${id}-${pi}`;
                  const baseHtml = fn(person);
                  const html = isBannerOn ? withBanner(baseHtml) : baseHtml;
                  const isCopied = copied === key;
                  return (
                    <div key={key}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                        <span style={{ fontSize: 11, color: R.textDim, fontWeight: 500 }}>{person.name} — {person.title}</span>
                        <button
                          onClick={() => handleCopy(key, html)}
                          style={{
                            display: "flex", alignItems: "center", gap: 4,
                            padding: "4px 10px", borderRadius: 5, fontSize: 10, fontWeight: 600, cursor: "pointer",
                            background: isCopied ? `${R.brand}25` : R.card,
                            color: isCopied ? R.accent : R.textDim,
                            border: `1px solid ${isCopied ? R.brand : R.border}`,
                            transition: "all 0.2s",
                          }}
                        >
                          {isCopied ? <Check size={10} /> : <Copy size={10} />}
                          {isCopied ? "Copied" : "Copy HTML"}
                        </button>
                      </div>
                      <div style={{
                        background: "#ffffff", borderRadius: 8, padding: "20px 24px",
                        border: `1px solid ${R.border}`,
                      }}>
                        <div dangerouslySetInnerHTML={{ __html: baseHtml }} />
                        {isBannerOn && (
                          <div style={{ marginTop: 14 }}>
                            <div style={{ fontSize: 9, color: "#94a3b8", marginBottom: 6, fontFamily: "Arial, sans-serif" }}>
                              Banner preview — export as PNG and host, replace URL in HTML:
                            </div>
                            {bannerPreview()}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        <div style={{
          marginTop: 8, padding: "16px 20px", background: R.card, borderRadius: 8,
          border: `1px solid ${R.border}`, fontSize: 11, color: R.textDim, lineHeight: 1.7,
        }}>
          <strong style={{ color: R.textMid }}>Gmail notes:</strong> Tables + inline styles only, system fonts (Arial/Helvetica), max width 460px.
          Accent colour is <code style={{ color: R.textMid }}>#1E3A8A</code> (deep navy) — replaces the previous teal + gold, which wash out on white.
          Event banner expects a hosted PNG — screenshot the preview, upload over HTTPS, swap the placeholder URL in the copied HTML.
          Pill chips rely on <code style={{ color: R.textMid }}>display:inline-block</code> which Gmail honours on web; iOS Mail may collapse to stacked — acceptable fallback.
        </div>
      </div>
    </div>
  );
}

export default EmailSignatures;
