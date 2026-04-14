import { useState } from "react";
import { Copy, Check } from "lucide-react";

// ── Rockenue Email Signature ──
// Gmail-safe: table layout, inline styles only, no gradients/SVG/custom fonts,
// hosted images only (no base64), no flex/grid, max ~600px wide.

const R = {
  bg: "#14181D",
  card: "#1C2228",
  border: "#2A3240",
  accent: "#F3F5F7",
  text: "#B0B8C4",
  textMid: "#7A8494",
  textDim: "#4E5868",
  teal: "#38C6BA",
  gold: "#C8A66E",
};

const PEOPLE = [
  { name: "Karol Marcu", title: "Managing Director", email: "karol@rockenue.com" },
  { name: "Ruslana Doroschuk", title: "Distribution Manager", email: "ruslana@rockenue.com" },
  { name: "Ruslana Doroschuk", title: "Executive Assistant", email: "ruslana@rockenue.com" },
  { name: "Ruslana Doroschuk", title: "Operations Manager", email: "ruslana@rockenue.com" },
];

const PHONE = "+44 20 7946 0123";
const WEB = "rockenue.com";

const BANNER_PLACEHOLDER = "https://www.rockenue.com/sig-banner.png";

// ── THE signature: Gold accent line, two-tone layout ──
function sigC(p: typeof PEOPLE[0]) {
  return `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;max-width:460px;">
  <tr>
    <td style="padding-bottom:10px;">
      <span style="font-size:15px;font-weight:bold;color:#0f172a;">${p.name}</span>
      <span style="font-size:12px;color:#94a3b8;padding-left:8px;">${p.title}</span>
    </td>
  </tr>
  <tr>
    <td style="border-top:2px solid #C8A66E;padding-top:10px;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td style="vertical-align:top;">
            <span style="color:#38C6BA;font-size:15px;font-weight:300;">(</span>
            <span style="font-weight:bold;color:#0f172a;font-size:10px;letter-spacing:1.5px;">ROCKENUE</span>
            <span style="color:#C8A66E;font-size:15px;font-weight:300;">)</span>
            <br/>
            <span style="font-size:10px;color:#94a3b8;">Independent hotel operator</span>
          </td>
          <td style="text-align:right;vertical-align:top;font-size:11px;color:#64748b;">
            <a href="mailto:${p.email}" style="color:#0f172a;text-decoration:none;">${p.email}</a><br/>
            <a href="tel:${PHONE.replace(/\s/g, "")}" style="color:#64748b;text-decoration:none;">${PHONE}</a><br/>
            <a href="https://${WEB}" style="color:#38C6BA;text-decoration:none;">${WEB}</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

// ── Signature + aurora announcement banner ──
function sigC_withBanner() {
  return sigC() + `
<table cellpadding="0" cellspacing="0" border="0" style="max-width:460px;">
  <tr><td style="padding-top:12px;">
    <a href="https://rockenue.com" target="_blank" style="text-decoration:none;">
      <img src="${BANNER_PLACEHOLDER}" width="460" height="88" alt="Rockenue" style="display:block;border:0;outline:none;" />
    </a>
  </td></tr>
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
        background: "radial-gradient(circle, rgba(56,198,186,0.25) 0%, transparent 65%)",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", bottom: -60, left: -60, width: 180, height: 180, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(200,166,110,0.25) 0%, transparent 65%)",
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
          Meet us at <span style={{ color: "#38C6BA" }}>The Hotel Show Dubai</span>
        </div>
        <div style={{ fontSize: 9, color: "#7A8494", letterSpacing: 1, textTransform: "uppercase" }}>
          16–18 September 2026&nbsp;&nbsp;·&nbsp;&nbsp;Stand H3-240
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 10 }}>
          <span style={{ color: "#38C6BA", fontSize: 16, fontWeight: 200 }}>(</span>
          <span style={{ color: "#F3F5F7", fontSize: 9, fontWeight: 700, letterSpacing: 2 }}>ROCKENUE</span>
          <span style={{ color: "#C8A66E", fontSize: 16, fontWeight: 200 }}>)</span>
        </div>
      </div>
    </AuroraTile>
  );
}

// ── Variant B: Same layout as C but with dark line instead of gold ──
function sigCdark(p: typeof PEOPLE[0]) {
  return `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;max-width:460px;">
  <tr>
    <td style="padding-bottom:10px;">
      <span style="font-size:15px;font-weight:bold;color:#0f172a;">${p.name}</span>
      <span style="font-size:12px;color:#94a3b8;padding-left:8px;">${p.title}</span>
    </td>
  </tr>
  <tr>
    <td style="border-top:2px solid #0f172a;padding-top:10px;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td style="vertical-align:top;">
            <span style="color:#38C6BA;font-size:15px;font-weight:300;">(</span>
            <span style="font-weight:bold;color:#0f172a;font-size:10px;letter-spacing:1.5px;">ROCKENUE</span>
            <span style="color:#C8A66E;font-size:15px;font-weight:300;">)</span>
            <br/>
            <span style="font-size:10px;color:#94a3b8;">Independent hotel operator</span>
          </td>
          <td style="text-align:right;vertical-align:top;font-size:11px;color:#64748b;">
            <a href="mailto:${p.email}" style="color:#0f172a;text-decoration:none;">${p.email}</a><br/>
            <a href="tel:${PHONE.replace(/\s/g, "")}" style="color:#64748b;text-decoration:none;">${PHONE}</a><br/>
            <a href="https://${WEB}" style="color:#38C6BA;text-decoration:none;">${WEB}</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

type SigFn = (p: typeof PEOPLE[0]) => string;
const VARIANTS: { id: string; label: string; fn: SigFn; banner?: () => JSX.Element }[] = [
  { id: "A", label: "Gold accent line", fn: sigC },
  { id: "B", label: "Dark accent line", fn: sigCdark },
  { id: "Event", label: "With aurora announcement banner", fn: sigC, banner: bannerPreview },
];

export function EmailSignatures() {
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = (id: string, html: string) => {
    navigator.clipboard.writeText(html);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div style={{ minHeight: "100vh", background: R.bg, color: R.accent, fontFamily: "'Inter', system-ui, sans-serif", padding: "40px 64px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", color: R.gold }}>
            Brand Assets
          </span>
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: -1, margin: "0 0 8px", color: R.accent }}>
          Email Signature
        </h1>
        <p style={{ fontSize: 13, color: R.textMid, margin: "0 0 40px", lineHeight: 1.6 }}>
          Gmail-compatible. Copy the HTML and paste into Gmail Settings &gt; Signature.
        </p>

        {VARIANTS.map(({ id, label, fn, banner }) => (
          <div key={id} style={{ marginBottom: 48 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: R.teal }}>{id}</span>
              <span style={{ fontSize: 13, color: R.textMid, fontWeight: 500 }}>{label}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {PEOPLE.map((person, pi) => {
                const key = `${id}-${pi}`;
                const html = fn(person);
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
                          background: isCopied ? "#38C6BA20" : R.card,
                          color: isCopied ? R.teal : R.textDim,
                          border: `1px solid ${isCopied ? R.teal + "50" : R.border}`,
                          transition: "all 0.2s",
                        }}
                      >
                        {isCopied ? <Check size={10} /> : <Copy size={10} />}
                        {isCopied ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <div style={{
                      background: "#ffffff", borderRadius: 8, padding: "20px 24px",
                      border: `1px solid ${R.border}`,
                    }}>
                      <div dangerouslySetInnerHTML={{ __html: html }} />
                      {banner && pi === 0 && (
                        <div style={{ marginTop: 12 }}>
                          <div style={{ fontSize: 9, color: "#94a3b8", marginBottom: 6, fontFamily: "Arial, sans-serif" }}>
                            Banner preview (export as PNG, host, replace URL):
                          </div>
                          {banner()}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <div style={{
          marginTop: 8, padding: "16px 20px", background: R.card, borderRadius: 8,
          border: `1px solid ${R.border}`, fontSize: 11, color: R.textDim, lineHeight: 1.7,
        }}>
          <strong style={{ color: R.textMid }}>Gmail notes:</strong> Tables only, inline styles, system fonts (Arial/Helvetica).
          Banner must be a hosted PNG — screenshot the preview, upload to HTTPS, swap the placeholder URL in the HTML.
        </div>
      </div>
    </div>
  );
}

export default EmailSignatures;
