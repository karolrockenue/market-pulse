/**
 * One-off occupancy re-backfill for Mason Mews hotels (Westbourne + Primrose).
 *
 * Root cause: a handful of historical daily_metrics_snapshots rows in the Long
 * Stay migration window (late Apr–mid May 2026) were frozen with inflated
 * rooms_sold (some > capacity) written by a mid-May backfill that summed across
 * services. The nightly refresh only re-pulls forward dates, so these never
 * self-corrected. Live Mews short-service availability (the shared room pool)
 * is authoritative. See Dom Comments.md / mason-and-fifth.md §19.4.
 *
 * Writes rooms_sold ONLY (+ recomputes net_adr/gross_adr which divide by it).
 * Revenue, capacity_count and RevPAR are untouched. Idempotent — re-running
 * after it's correct is a no-op. Pass --commit to write; default is dry-run.
 *   node scripts/rebackfill-mf-occupancy.js --commit
 */
require("dotenv").config();
const pg=require("../api/utils/db.js");
const mews=require("../api/adapters/mewsAdapter.js");
const TZ="Europe/London";
const COMMIT=process.argv.includes("--commit");
const HOTELS=[[318341,"Westbourne"],[318343,"Primrose"]];
const START="2026-04-01", END="2026-05-31";
const addDays=(d,n)=>{const x=new Date(d+"T00:00:00Z");x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10);};

(async()=>{
  console.log(`MODE: ${COMMIT?"COMMIT (writing)":"DRY-RUN"}  range ${START}..${END}\n`);
  let totalChanged=0;
  for(const [H,name] of HOTELS){
    const creds=await mews.getCredentials(H);
    const sid=(await pg.query(`SELECT pms_credentials->>'serviceId' s FROM hotels WHERE hotel_id=$1`,[H])).rows[0].s;
    const cap=await mews.probeCapacity(creds,sid);
    const live={};
    let cs=START;
    while(cs<=END){
      const ce=addDays(cs,59)<END?addDays(cs,59):END;
      const m=await mews.getOccupancyMetrics(creds,sid,cs,ce,TZ,cap);
      for(const r of m) live[r.date]=r.occupied;
      cs=addDays(ce,1);
    }
    const sr=await pg.query(`SELECT stay_date::text d, rooms_sold, net_revenue, gross_revenue FROM daily_metrics_snapshots WHERE hotel_id=$1 AND stay_date BETWEEN $2 AND $3`,[H,START,END]);
    let changed=0;
    for(const row of sr.rows){
      const lv=live[row.d];
      if(lv==null) continue;
      const oldSold=Number(row.rooms_sold);
      if(oldSold===lv) continue;
      changed++;
      const nadr=lv>0?Number(row.net_revenue)/lv:0;
      const gadr=lv>0?Number(row.gross_revenue)/lv:0;
      console.log(`${name} ${row.d}: rooms_sold ${oldSold} -> ${lv}${lv>cap?' <<still>cap?':''}`);
      if(COMMIT){
        await pg.query(`UPDATE daily_metrics_snapshots SET rooms_sold=$3, net_adr=$4, gross_adr=$5, updated_at=NOW() WHERE hotel_id=$1 AND stay_date=$2`,[H,row.d,lv,nadr,gadr]).catch(async()=>{
          await pg.query(`UPDATE daily_metrics_snapshots SET rooms_sold=$3, net_adr=$4, gross_adr=$5 WHERE hotel_id=$1 AND stay_date=$2`,[H,row.d,lv,nadr,gadr]);
        });
      }
    }
    console.log(`-- ${name}: ${changed} rows ${COMMIT?"updated":"would change"}\n`);
    totalChanged+=changed;
  }
  console.log(`TOTAL: ${totalChanged} rows ${COMMIT?"written":"to change"}`);
  process.exit(0);
})().catch(e=>{console.error("ERR",e.message,e.stack);process.exit(1);});
