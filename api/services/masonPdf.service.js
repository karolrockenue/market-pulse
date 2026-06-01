/**
 * @file masonPdf.service.js
 * @brief Builds the Sales Flash PDF data object (the "M" shape the landscape
 *        PDF template renders) for any M&F hotel + reporting month. Pure data —
 *        calls the same mason.service functions the live dashboard uses, so the
 *        PDF and the dashboard never diverge.
 *
 * Amenity revenue is intentionally empty: in the live app it's a client-side
 * upload (localStorage) with no server source, so the PDF omits that page until
 * ancillary gets backend persistence.
 */
const S = require("./mason.service");

const pad2 = (n) => String(n).padStart(2, "0");
const shiftMonth = (mk, n) => { let [y, m] = mk.split("-").map(Number); m += n; while (m < 1) { m += 12; y--; } while (m > 12) { m -= 12; y++; } return `${y}-${pad2(m)}`; };
const MN = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monName = (mk) => MN[Number(mk.split("-")[1])];

/**
 * @param {number} hotelId
 * @param {string} monthKey  'YYYY-MM' reporting month
 * @param {object} cfg       MF_HOTELS[hotelId] — { name, shortName, accountingCategories, serviceIds }
 * @returns {Promise<object>} the M data object the PDF template renders
 */
async function buildSalesFlashPdfData(hotelId, monthKey, cfg) {
  const ACC = cfg.accountingCategories;
  const SVC = cfg.serviceIds;
  const MK = monthKey;

  const reportYear = Number(MK.split("-")[0]);
  const reportMonth = Number(MK.split("-")[1]);
  const fyStartYear = reportMonth >= 4 ? reportYear : reportYear - 1;
  const fyStartMK = `${fyStartYear}-04`, fyEndMK = `${fyStartYear + 1}-03`;
  const priorMK = shiftMonth(MK, -1), nextMK = shiftMonth(MK, 1), pyMK = S.shiftYear(MK, -1);

  const otb = await S.getMonthlyKpis(hotelId, (priorMK < fyStartMK ? priorMK : fyStartMK), fyEndMK, ACC, SVC);
  const byM = new Map(otb.months.map((m) => [m.monthKey, m]));
  const lyMap = await S.getFinalLyKpis(hotelId, S.shiftYear(fyStartMK, -1), S.shiftYear(fyEndMK, -1));
  const budgets = await S.getServiceBudgets(hotelId, fyStartYear);
  const hasBud = Object.values(budgets).some((b) => b.hasData);
  const [ds, dsPM] = await Promise.all([S.getDirectShareForMonth(hotelId, MK), S.getDirectShareForMonth(hotelId, priorMK)]);
  const pyKpi = (await S.getKpiHistory(hotelId, pyMK)) || {};
  const budgetKpi = (await S.getKpiHistory(hotelId, MK)) || {};
  const [aC, aP, aY] = await Promise.all([S.getAlosByService(hotelId, MK, SVC), S.getAlosByService(hotelId, priorMK, SVC), S.getAlosByService(hotelId, pyMK, SVC)]);
  const [ltC, ltP, ltY] = await Promise.all([S.getLeadTimeByService(hotelId, MK, SVC), S.getLeadTimeByService(hotelId, priorMK, SVC), S.getLeadTimeByService(hotelId, pyMK, SVC)]);
  const pySeg = await S.getSegmentRevenueActuals(hotelId, pyMK);

  const cur = byM.get(MK), pm = byM.get(priorMK), py = lyMap.get(pyMK) || null;
  const bCur = budgets[MK] || {};
  const bN = bCur.nights || { short: 0, mid: 0, long: 0 };
  const bTotRev = (bCur.short || 0) + (bCur.mid || 0) + (bCur.long || 0);
  const bTotN = (bN.short || 0) + (bN.mid || 0) + (bN.long || 0);
  const cap = cur?.total.capacity || 0;
  const hasBN = !!bCur.hasNights;
  const bOcc = hasBN && cap > 0 ? (bTotN / cap) * 100 : null;
  const bAdr = hasBN && bTotN > 0 ? bTotRev / bTotN : null;
  const bRevpar = bCur.hasData && cap > 0 ? bTotRev / cap : null;
  const bAdrS = hasBN && bN.short > 0 ? (bCur.short || 0) / bN.short : null;
  const bAdrM = hasBN && bN.mid > 0 ? (bCur.mid || 0) / bN.mid : null;

  const card = (mk, tag, report) => { const r = byM.get(mk); return r && {
    mn: `${monName(mk)} ${mk.split("-")[0]}`, tag, report,
    occ: (r.total.occupancy ?? 0) / 100, adrBlend: r.total.adr ?? 0, revpar: r.total.revpar ?? 0,
    ss: r.byRole.short.adr ?? 0, ms: r.byRole.mid.adr ?? 0, ls: r.byRole.long.adr ?? 0, lsMo: (r.byRole.long.adr ?? 0) * 30.44,
  }; };

  const f100 = (v) => (v == null ? null : v / 100);
  const NZ = (v, min) => (typeof v === "number" && isFinite(v) && Math.abs(v) >= (min || 0.0001) ? v : null);
  const M = {
    property: `Mason & Fifth — ${cfg.shortName}`, period: `${monName(MK)} ${reportYear}`,
    fy: `FY${String(fyStartYear).slice(2)}/${String(fyStartYear + 1).slice(2)} (Apr–Mar)`, generated: S.todayIso(),
    cap: Math.round((await S.getMonthlyUnitPacing(hotelId, MK))?.capacity || cap / S.daysInMonth(MK) || 0) || 1,
    cards: [card(priorMK, "Prior"), card(MK, "Reporting", true), card(nextMK, "Next (OTB)")].filter(Boolean),
    kpis: [
      { k: "Occupancy", a: NZ(f100(cur?.total.occupancy), .02), pm: NZ(f100(pm?.total.occupancy), .02), py: NZ(f100(pyKpi.occupancy ?? py?.occupancy), .02), b: NZ(f100(bOcc), .02), pct: true },
      { k: "ADR (blended)", a: NZ(cur?.total.adr, 1), pm: NZ(pm?.total.adr, 1), py: NZ(pyKpi.adr_blended ?? py?.adr, 1), b: NZ(bAdr, 1), cur: true },
      { k: "RevPAR (blended)", a: NZ(cur?.total.revpar, 1), pm: NZ(pm?.total.revpar, 1), py: NZ(pyKpi.revpar_blended ?? py?.revpar, 1), b: NZ(bRevpar, 1), cur: true },
      { k: "Short Stay ADR", a: NZ(cur?.byRole.short.adr, 1), pm: NZ(pm?.byRole.short.adr, 1), py: NZ(pyKpi.ss_adr, 1), b: NZ(bAdrS, 1), cur: true },
      { k: "Mid Stay ADR", a: NZ(cur?.byRole.mid.adr, 1), pm: NZ(pm?.byRole.mid.adr, 1), py: NZ(pyKpi.ms_adr, 1), b: NZ(bAdrM, 1), cur: true },
      { k: "Long Stay ADR", a: NZ(cur?.byRole.long.adr, 1), pm: NZ(pm?.byRole.long.adr, 1), py: NZ(pyKpi.ls_adr, 1), b: NZ(budgetKpi.ls_adr_budget, 1), cur: true },
      { k: "SS Direct", a: NZ(ds?.directPct, .001), pm: NZ(dsPM?.directPct, .001), py: NZ(pyKpi.ss_direct_pct, .001), b: NZ(budgetKpi.ss_direct_pct_budget, .001), pct: true },
      { k: "SS Indirect", a: NZ(ds?.indirectPct, .001), pm: NZ(dsPM?.indirectPct, .001), py: NZ(pyKpi.ss_indirect_pct, .001), b: NZ(budgetKpi.ss_indirect_pct_budget, .001), pct: true },
    ],
    source: { direct: ds?.directPct ?? 0, indirect: ds?.indirectPct ?? 0 },
    alos: [
      { seg: "Short Stay", a: aC.short, pm: aP.short, py: aY.short },
      { seg: "Mid Stay", a: aC.mid, pm: aP.mid, py: aY.mid },
      { seg: "Long Stay", a: aC.long, pm: aP.long, py: aY.long },
    ],
  };

  const ann = [];
  for (let i = 0; i < 12; i++) {
    const mn = ((3 + i) % 12) + 1, yr = i < 9 ? fyStartYear : fyStartYear + 1, mk = `${yr}-${pad2(mn)}`;
    const r = byM.get(mk), b = budgets[mk];
    ann.push({ mk, mo: MN[mn], rev: r?.total.revenue ?? 0, bud: hasBud ? ((b?.short || 0) + (b?.mid || 0) + (b?.long || 0)) : 0,
      otb: !(`${mk}-31` < S.todayIso()),
      occ: r?.total.occupancy ?? null, nights: r?.total.roomNights ?? 0, cap: r?.total.capacity ?? 0,
      roleRev: { short: r?.byRole.short.revenue ?? 0, mid: r?.byRole.mid.revenue ?? 0, long: r?.byRole.long.revenue ?? 0 },
      roleBud: { short: b?.short || 0, mid: b?.mid || 0, long: b?.long || 0 } });
  }
  M.annual = ann.map((a) => ({ mo: a.mo, rev: a.rev, bud: a.bud, otb: a.otb, occ: a.occ }));
  const _fyN = ann.filter((a) => !a.otb).reduce((s, a) => s + a.nights, 0);
  const _fyC = ann.filter((a) => !a.otb).reduce((s, a) => s + a.cap, 0);
  M.fytdOccupancy = _fyC > 0 ? (_fyN / _fyC) * 100 : null;

  const revRow = (label, actT, pmT, pyV, budV) => ({ k: label, rev: true,
    a: NZ(actT, 1), pm: NZ(pmT, 1), py: NZ(pyV, 1), b: hasBud ? NZ(budV, 1) : null });
  M.revenue = [
    revRow("Short Stay Revenue", cur?.byRole.short.revenue, pm?.byRole.short.revenue, pySeg?.short, bCur.short),
    revRow("Mid Stay Revenue", cur?.byRole.mid.revenue, pm?.byRole.mid.revenue, pySeg?.mid, bCur.mid),
    revRow("Long Stay Revenue", cur?.byRole.long.revenue, pm?.byRole.long.revenue, pySeg?.long, bCur.long),
    revRow("Total Accommodation", cur?.total.revenue, pm?.total.revenue, pySeg?.total ?? py?.revenue, bTotRev),
  ];

  M.leadTime = [
    { seg: "Short Stay", a: NZ(ltC.short, .1), pm: NZ(ltP.short, .1), py: NZ(ltY.short, .1) },
    { seg: "Mid Stay", a: NZ(ltC.mid, .1), pm: NZ(ltP.mid, .1), py: NZ(ltY.mid, .1) },
    { seg: "Long Stay", a: NZ(ltC.long, .1), pm: NZ(ltP.long, .1), py: NZ(ltY.long, .1) },
  ];
  const roles = ["short", "mid", "long"], segName = { short: "Short Stay", mid: "Mid Stay", long: "Long Stay" };
  const dotVar = { short: "var(--segShort)", mid: "var(--segMid)", long: "var(--segLong)" };
  M.pacingCols = ann.map((a) => a.mo);
  const segFull = { short: "Short Stay (<1 month)", mid: "Mid Stay (1-6 months)", long: "Long Stay (6+ months)" };
  M.pacing = roles.map((role) => {
    const months = ann.map((a) => { const r = byM.get(a.mk); return {
      rev: r?.byRole[role].revenue ?? 0, nights: r?.byRole[role].nights ?? 0,
      adr: r?.byRole[role].adr ?? null, bud: a.roleBud[role] }; });
    const totRev = months.reduce((s, m) => s + m.rev, 0), totN = months.reduce((s, m) => s + m.nights, 0), totBud = months.reduce((s, m) => s + (m.bud || 0), 0);
    return { seg: segFull[role], months, totRev, totN, totAdr: totN > 0 ? totRev / totN : null, totBud };
  });
  M.bob = roles.map((role) => ({ seg: segName[role], dot: dotVar[role],
    bob: ann.filter((a) => a.otb).reduce((s, a) => s + a.roleRev[role], 0),
    done: ann.filter((a) => !a.otb).reduce((s, a) => s + a.roleRev[role], 0) }));

  const today = new Date(); const dow = today.getUTCDay() || 7;
  const monday = new Date(today); monday.setUTCDate(today.getUTCDate() - (dow - 1)); monday.setUTCHours(0, 0, 0, 0);
  const weekStarts = []; for (let i = 0; i < 5; i++) { const w = new Date(monday); w.setUTCDate(monday.getUTCDate() + i * 7); weekStarts.push(w.toISOString().slice(0, 10)); }
  const up = await S.getWeeklyUnitPacing(hotelId, weekStarts);
  const upM = await S.getMonthlyUnitPacing(hotelId, MK);
  const wkLabel = (iso) => { const d = new Date(iso + "T00:00:00Z"); return `Wk ${d.getUTCDate()} ${MN[d.getUTCMonth() + 1]}`; };
  const rrow = (sel) => [Math.round(upM?.[sel]?.rooms ?? 0), ...up.map((w) => Math.round(w[sel].rooms))];
  M.unit = {
    rows: ["Short Stay", "Mid Stay", "Long Stay", "Offline (OOO + blocks)", "Vacant"],
    cols: [`${monName(MK)} (avg/day)`, ...weekStarts.map(wkLabel)],
    dots: ["var(--segShort)", "var(--segMid)", "var(--segLong)", "var(--segOther)", "#cfcfc7"],
    data: [rrow("shortStay"), rrow("midStay"), rrow("longStay"), rrow("offline"), rrow("vacant")],
  };

  const rate = await S.getRateBreakdowns(hotelId, MK, SVC, {});
  const occ = await S.getDailyOccupancyByService(hotelId, SVC, 120, `${MK}-01`);
  const tiers = await S.getLeadTimeTiers(hotelId, 8, SVC);
  const anchorOf = (arr) => { const a = (arr || []).find((x) => x.name === "All"); return a ? Math.round(a.value) : null; };
  const barsOf = (arr) => (arr || []).filter((x) => x.name !== "All").map((x) => ({ l: x.name, v: Math.round(x.value) }));
  M.rateCharts = [
    { title: "Short Stay — ADR by studio", anchor: anchorOf(rate.ssAdrByCategory), color: "#7BAFD4", bars: barsOf(rate.ssAdrByCategory) },
    { title: "AMR by length-of-stay", anchor: null, color: "#50708F", bars: (rate.amrBySegment || []).map((x) => ({ l: x.name, v: Math.round(x.value) })) },
    { title: "Long Stay — AMR by studio", anchor: anchorOf(rate.lsAmrByCategory), color: "#1E3A57", bars: barsOf(rate.lsAmrByCategory) },
  ];
  M.occDays = (occ || []).map((d) => ({ d: d.date, short: d.short, mid: d.mid, long: d.long, other: d.other }));
  const wk = (iso) => { const d = new Date(iso + "T00:00:00Z"); return `${d.getUTCDate()} ${MN[d.getUTCMonth() + 1]}`; };
  const weekList = (tiers.ssWeekly || []).map((w) => w.weekStart);
  M.weeks = weekList.map(wk);
  const byWeek = (arr) => { const m = new Map((arr || []).map((w) => [w.weekStart, [w.bookings, w.roomNights, Math.round(w.revenue)]])); return weekList.map((ws) => m.get(ws) || [0, 0, 0]); };
  M.bookings = { short: byWeek(tiers.ssWeekly), mid: byWeek(tiers.msWeekly), long: byWeek(tiers.lsWeekly) };

  // Amenity: no server source (client-side upload in the live app) → omit the page.
  M.amenity = [];
  return M;
}

module.exports = { buildSalesFlashPdfData };
