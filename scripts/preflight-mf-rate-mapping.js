#!/usr/bin/env node
require("dotenv").config();
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const HOTELS = [
  { id: 318341, name: "Westbourne (control)" },
  { id: 318329, name: "Belsize" },
  { id: 318343, name: "Primrose" },
];

(async () => {
  for (const h of HOTELS) {
    console.log(`\n========== ${h.name} (${h.id}) ==========`);

    // Current state
    const cfg = await pool.query(
      `SELECT base_room_type_id, rate_id_map, is_autopilot_enabled,
              pms_rate_plans
       FROM sentinel_configurations WHERE hotel_id = $1`,
      [h.id],
    );
    const c = cfg.rows[0];
    console.log(`autopilot: ${c.is_autopilot_enabled}`);
    console.log(`base_room_type_id: ${c.base_room_type_id}`);

    const ratePlans = c.pms_rate_plans?.data || [];
    console.log(`\n  pms_rate_plans (${ratePlans.length} entries):`);
    ratePlans.forEach((rp) => {
      const isDerived = rp.isDerived ? " [DERIVED]" : "";
      const matchesBase = /\b(base|standard|rack|bar)\b/i.test(rp.ratePlanName) ? " ⚠ matches base|standard|rack|bar" : "";
      console.log(`    ${rp.rateID}  →  ${rp.ratePlanName}${isDerived}${matchesBase}`);
    });

    // Identify the OTA BASE: Flexible rate ID
    const otaBase = ratePlans.find(rp =>
      /^OTA BASE: Flexible/i.test(rp.ratePlanName) || /^OTA BASE.*Flexible/i.test(rp.ratePlanName)
    );
    if (otaBase) {
      console.log(`\n  ✅ OTA BASE: Flexible rate ID = ${otaBase.rateID}`);
    } else {
      console.log(`\n  ❌ NO match for "OTA BASE: Flexible" — investigate rate plan naming`);
    }

    // Current rate_id_map breakdown
    console.log(`\n  Current rate_id_map (${Object.keys(c.rate_id_map || {}).length} entries):`);
    for (const [roomTypeId, rateId] of Object.entries(c.rate_id_map || {})) {
      const rp = ratePlans.find(p => String(p.rateID) === String(rateId));
      const planName = rp ? rp.ratePlanName : "(rate ID not found in pms_rate_plans!)";
      const flag = otaBase && String(rateId) === String(otaBase.rateID) ? " ✅" : " ⚠ MISROUTE";
      console.log(`    ${roomTypeId}  →  ${rateId} (${planName})${flag}`);
    }

    // Build the proposed corrected map
    if (otaBase) {
      const proposed = {};
      for (const roomTypeId of Object.keys(c.rate_id_map || {})) {
        proposed[roomTypeId] = otaBase.rateID;
      }
      console.log(`\n  Proposed corrected rate_id_map:`);
      for (const [k, v] of Object.entries(proposed)) {
        console.log(`    ${k}  →  ${v}`);
      }
    }
  }

  await pool.end();
})().catch((e) => { console.error(e); process.exit(1); });
