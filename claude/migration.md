# Vercel → Railway Migration Plan

**Status:** Phase 4 in progress — DNS records updated at Hostinger, waiting for propagation
**Created:** 2026-04-05
**Last updated:** 2026-04-05 13:48 CEST
**Risk level:** Low if executed in parallel (see strategy below)

---

## Why We're Moving

Vercel's serverless model causes issues for Market Pulse:
- **Cold starts** on API routes (Node spins up per-request, no persistent process)
- **No persistent cron jobs** — Vercel crons are HTTP-triggered, not real schedulers
- **10s function timeout** on Hobby, 60s on Pro — long-running operations (Sentinel queue processing, bulk PMS rate pushes, Mews webhook processing with multiple API calls) can hit this
- **No WebSocket support** — limits future real-time features
- **No background workers** — Sentinel queue worker is a workaround (self-calling HTTP endpoint), not a real background process
- Railway gives us a persistent Node.js process, real cron, and long-running request support

---

## Zero-Downtime Migration Strategy

The entire approach is **parallel deployment** — Vercel stays live until we're confident Railway works.

### Phase 1: Railway Setup (No risk to production)

1. **Create Railway project** — connect to the `market-pulse` GitHub repo
2. **Set up Railway service** — Node.js, `npm start` (runs `node server.js`)
3. **Configure build**:
   - Root build: `npm install`
   - Frontend build: `cd web && yarn install && yarn build`
   - Railway needs to produce `web/build/` before `server.js` starts serving static files
   - Build command should be: `npm install && cd web && yarn install && yarn build`
   - Start command: `node server.js`
4. **Copy ALL environment variables** from Vercel to Railway (see full list below)
5. **Deploy** — Railway gives you a URL like `market-pulse-production.up.railway.app`

### Phase 2: Code Changes for Railway Compatibility

These are the Vercel-specific patterns that need to become platform-agnostic:

#### 2a. `VERCEL_ENV` references (CRITICAL)

The codebase uses `process.env.VERCEL_ENV` in many places. On Railway this won't exist. Need a platform-agnostic approach.

**Files that reference `VERCEL_ENV`:**
- `server.js` — CORS (localhost check), cookie `secure` flag, dev-login gate
- `api/routes/auth.router.js` — OAuth redirect URL resolution, Cloudbeds redirect URI, Mews webhook URL
- `api/routes/mews.onboarding.router.js` — webhook URL selection
- `api/routes/sentinel.router.js` — self-call URL for queue processing
- `api/adapters/cloudbedsAdapter.js` — OAuth callback URL
- `api/adapters/operaAdapter.js` — callback URL
- `api/utils/pdf.utils.js` — Chromium binary selection

**Fix:** Add a single env var `NODE_ENV=production` on Railway. Then replace all `process.env.VERCEL_ENV === "production"` checks with:
```js
process.env.NODE_ENV === "production"
```

Or, for a less invasive approach, just set `VERCEL_ENV=production` on Railway as a compatibility shim (works immediately, zero code changes needed for Phase 2 testing). Clean up later.

#### 2b. `VERCEL_URL` / `VERCEL_BRANCH_URL` references

Used for self-referencing URLs (e.g., Sentinel queue worker calls itself, OAuth callbacks).

**Files:**
- `api/routes/sentinel.router.js` (line ~74-75) — builds base URL for process-queue self-call
- `api/routes/auth.router.js` (lines ~222-228) — OAuth redirect URL for preview deployments

**Fix:** Add env var `BASE_URL=https://market-pulse-production.up.railway.app` (or later the custom domain). Replace `VERCEL_URL` usage with `BASE_URL`:
```js
const baseUrl = process.env.BASE_URL || `https://${process.env.VERCEL_URL}` || "http://localhost:3000";
```

#### 2c. `vercel.json` configuration

Railway doesn't use `vercel.json`. The equivalent configs need to be handled:

| vercel.json feature | Railway equivalent |
|---|---|
| `builds` → `@vercel/node` | Not needed — Railway runs `node server.js` directly |
| `rewrites` → `/(.*) → /server.js` | Not needed — Express handles routing natively |
| `headers` → Cache-Control | Already handled in `server.js` catch-all route |
| `crons` | Railway Cron Jobs (see Phase 2d) |

#### 2d. Cron Jobs

Current Vercel crons (from `vercel.json`):

| Schedule | Path | Purpose |
|---|---|---|
| `* * * * *` | `/api/sentinel/process-queue` | Sentinel rate push worker |
| `0 6 * * *` | `/api/cron/daily-refresh` | Daily metrics refresh |
| `*/5 * * * *` | `/api/send-scheduled-reports` | Scheduled email reports |
| `0 6 * * *` | `/api/sync-rockenue-assets` | Asset sync |

**Railway approach — two options:**

**Option A (Simple, recommended for start):** Keep the HTTP-trigger pattern. Set up Railway Cron Jobs that `curl` the endpoints:
```
* * * * *    curl -s https://<railway-url>/api/sentinel/process-queue
0 6 * * *    curl -H "Authorization: Bearer $CRON_SECRET" https://<railway-url>/api/cron/daily-refresh
*/5 * * * *  curl -s https://<railway-url>/api/send-scheduled-reports
0 6 * * *    curl -s https://<railway-url>/api/sync-rockenue-assets
```

**Option B (Better long-term):** Since Railway runs a persistent process, use `node-cron` or `setInterval` inside `server.js` to run cron jobs in-process. No HTTP overhead, no auth needed. This is more reliable but requires code changes.

#### 2e. CORS — Allow Railway domain

In `server.js`, the CORS config allows `*.vercel.app`. Add Railway's domain too:

```js
// Add to CORS origin check:
if (origin.endsWith(".up.railway.app")) {
  callback(null, true);
  return;
}
```

And add the Railway URL to `allowedOrigins` if using custom domain.

#### 2f. Static file serving

Already works — `server.js` serves from `web/build/` via `express.static`. The `publicPath` uses `process.cwd()` which works on Railway. The only question is ensuring the Vite build runs during Railway's build step (see Phase 1 step 3).

#### 2g. Session cookie `secure` flag

Currently tied to `VERCEL_ENV === "production"`. Will be fixed by 2a above. Must be `true` when serving over HTTPS (Railway always serves HTTPS on public URLs).

### Phase 3: Test on Railway URL — COMPLETED 2026-04-05

With Railway deployed and env vars set, test:

- [x] App loads at Railway URL (React SPA renders)
- [x] Login works (session cookie set correctly over HTTPS)
- [x] API calls work (CORS allows Railway origin) — **FIX APPLIED:** added `.up.railway.app` to CORS whitelist in `server.js`
- [x] Dashboard data loads (DB connection via `DATABASE_URL`)
- [x] Sentinel Control Panel loads configs
- [x] Rate Manager fetches rates from PMS
- [x] Manual rate override → Cloudbeds push works (tested hotel 230719, 9 rates queued)
- [x] DGX AI trigger works (hotel 308760, success response) — **FIX APPLIED:** typo in `DGX_API_URL` env var (`tai1` → `tail`)
- [x] Cron jobs fire correctly — **FIX APPLIED:** added `node-cron` in-process scheduler, gated by `RAILWAY_ENVIRONMENT_NAME`
- [x] PDF generation works — **FIX APPLIED:** Railway-aware browser launch in `pdf.utils.js`, Playwright Chromium installed via build command
- [x] Email sending works (SendGrid) — Shreeji report PDF delivered to karol@rockenue.com
- [x] Smoke test script: 29/29 endpoints pass (`scripts/smoke-test.js`)
- [ ] Mews webhooks — will auto-route after DNS switch (URL is `www.market-pulse.io`)
- [ ] Cloudbeds webhooks — will auto-route after DNS switch
- [ ] OAuth flow — redirect URI already set to `www.market-pulse.io`, works after DNS switch

#### Code changes made during Phase 3:
1. `server.js` — added `.up.railway.app` to CORS origins
2. `server.js` — added in-process cron jobs via `node-cron` (Railway only)
3. `api/utils/pdf.utils.js` — Railway-aware Chromium launch (detects `RAILWAY_ENVIRONMENT_NAME`)
4. `package.json` — added `node-cron` dependency
5. `scripts/smoke-test.js` — new smoke test script for endpoint verification

#### Railway configuration:
- **URL:** `market-pulse-production-106e.up.railway.app`
- **Build command:** `npm install && cd web && npm install --legacy-peer-deps && npm run build && cd .. && npx playwright install --with-deps chromium`
- **Start command:** `node server.js`
- **Region:** US East (Virginia)
- **Plan:** Pro
- **31 env vars** copied from Vercel + `VERCEL_ENV=production` (compatibility shim) + `NODE_ENV=production`

#### DGX_API_URL fix:
- Vercel had: `https://spark-828c.tail62d605.ts.net` (correct)
- Railway initially had: `https://spark-828c.tai162d605.ts.net` (typo, missing `l`)
- Fixed to match Vercel value

### Phase 4: DNS Switch — IN PROGRESS (2026-04-05 13:48 CEST)

1. ~~**Add custom domain** in Railway dashboard~~ ✅ Done — both `market-pulse.io` and `www.market-pulse.io` added
2. ~~**Railway provides** DNS records~~ ✅ Done
3. ~~**Update DNS** at Hostinger~~ ✅ Done — records updated:
   - `www` CNAME → `4fgsyptb.up.railway.app` (was `8e2ba2592d5579ba.vercel-dns-017.com`)
   - `@` ALIAS → `mo653s6f.up.railway.app` (was A record `216.155.11.x`)
   - TXT `_railway-verify` — added
   - TXT `_railway-verify.www` — added
   - Email records (MX, SendGrid, DMARC, SPF) — untouched
4. **Propagation** — waiting. Hostinger TTL was 14400 (4 hours). Railway shows "Waiting for DNS update".
5. **Keep Vercel deployed** for 48-72h as rollback. If anything breaks, flip DNS back.

#### Post-DNS verification checklist (once propagation completes):
- [ ] `www.market-pulse.io` loads and serves from Railway
- [ ] `market-pulse.io` (root) redirects or loads correctly
- [ ] Login via magic link works (email link points to `www.market-pulse.io`)
- [ ] Cloudbeds webhooks land on Railway (check Railway logs for webhook events)
- [ ] Mews webhooks land on Railway
- [ ] OAuth callback works (Cloudbeds redirect URI is `https://www.market-pulse.io/api/auth/cloudbeds/callback`)
- [ ] Morning Shreeji reports (07:30 UTC) send successfully from Railway
- [ ] DGX AI hourly cron pushes decisions via Bridge API to Railway
- [ ] All existing user sessions continue working (same DB, same session store)

#### Areas not yet fully verified (be mindful):
- Cloudbeds OAuth token refresh under load (33 hotels hourly)
- Mews webhook processing (ServiceOrderUpdated events)
- Long-running operations that previously hit Vercel timeouts (should work better on Railway)
- Memory usage under sustained load (Railway Pro: monitor via Metrics tab)

### Phase 5: Cleanup (After stable on Railway)

- [ ] Remove `vercel.json`
- [ ] Replace all `VERCEL_ENV` checks with `NODE_ENV` (see full list of files below)
- [ ] Replace `VERCEL_URL` / `VERCEL_BRANCH_URL` with `BASE_URL` env var
- [ ] Remove Vercel-specific CORS rules (`.vercel.app` check in `server.js`)
- [ ] Remove `VERCEL_ENV=production` compatibility shim from Railway env vars
- [ ] Cron jobs: already done (in-process via `node-cron`) — remove Vercel cron HTTP endpoints if desired
- [ ] Update Cloudbeds OAuth redirect URIs (remove Vercel URLs from Cloudbeds app settings)
- [ ] Update Mews webhook URL in Mews dashboard if needed
- [ ] Update `blueprint.md` — change "Deployed in a serverless-friendly way (Vercel)" to Railway
- [ ] Delete Vercel project

#### Files referencing `VERCEL_ENV` (for cleanup):
- `server.js` (3 refs: CORS, cookie secure flag x2)
- `api/utils/pdf.utils.js` (1 ref: browser launch — already Railway-aware)
- `api/adapters/cloudbedsAdapter.js` (1 ref: OAuth redirect)
- `api/adapters/operaAdapter.js` (1 ref: callback URL)
- `api/routes/auth.router.js` (8 refs: magic link URL, OAuth redirects, dev-login gate)
- `api/routes/mews.onboarding.router.js` (1 ref: webhook URL)
- `api/routes/sentinel.router.js` (1 ref: `VERCEL_URL` for process-queue self-call — now uses localhost via node-cron)

---

## Full Environment Variable List

Copy ALL of these from Vercel → Railway:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `SESSION_SECRET` | Express session signing |
| `CRON_SECRET` | Auth for daily-refresh cron |
| `INTERNAL_API_SECRET` | Internal API auth (admin sync, initial-sync) |
| `ENCRYPTION_KEY` | PMS credential encryption (hex) |
| `SENDGRID_API_KEY` | Transactional emails |
| `SENDGRID_FROM_EMAIL` | Sender address |
| `MEWS_CLIENT_TOKEN` | Mews PMS integration |
| `MEWS_API_URL` | Mews API base (production: `https://api.mews.com`) |
| `SENTINEL_DGX_KEY` | AI Bridge auth key |
| `DGX_API_URL` | DGX Tailscale URL |
| `BASE_URL` | **NEW** — `https://www.market-pulse.io` (replaces VERCEL_URL logic) |
| `PROXY_ENDPOINT` | Scraper proxy |
| `PROXY_USERNAME` | Scraper proxy auth |
| `PROXY_PASSWORD` | Scraper proxy auth |
| `CLOUDBEDS_CLIENT_ID` | OAuth (if stored as env var) |
| `CLOUDBEDS_CLIENT_SECRET` | OAuth |
| `CLOUDBEDS_REDIRECT_URI` | OAuth callback URL |
| `NODE_ENV` | Set to `production` on Railway |

**Compatibility shim (optional, for quick testing):**
| `VERCEL_ENV` | Set to `production` — avoids code changes in Phase 2 testing |

---

## Potential Gotchas

1. **Chromium / PDF generation** — `@sparticuz/chromium` is built for AWS Lambda. On Railway (Docker/Nixpacks), you may need to install Chromium via the system package manager instead. Test PDF generation early.

2. **Cloudbeds OAuth redirect URI** — The Cloudbeds app settings have a whitelist of redirect URIs. You'll need to add the Railway URL there during testing, and ensure the production domain stays listed.

3. **Mews webhook URL** — Currently `https://www.market-pulse.io/api/mews-webhooks`. This follows DNS, so it auto-switches. But if testing on Railway URL, you'd need a separate Mews webhook endpoint temporarily.

4. **Memory / CPU** — Vercel gives you 1024MB per function. Railway's Starter plan gives 8GB RAM / 8 vCPU. Much more headroom, but monitor usage to right-size the plan.

5. **Build output path** — Ensure `web/build/` is where Vite outputs. Check `web/vite.config.ts` for `build.outDir`. The `server.js` expects it at `web/build`.

6. **Railway sleep** — Free/Starter plans may sleep the service after inactivity. Make sure the plan keeps the service always-on for production, or the cron jobs will fail.

---

## Instruction for AI Sessions

When working on the Railway migration:

1. **Read this document first** — it has the full plan and all known gotchas
2. **Do NOT modify `server.js`, CORS config, env var checks, or cron routes on the main branch** until Railway is tested and confirmed working on a separate branch
3. **Create a branch** like `railway-migration` for all compatibility changes
4. **The safest first step** is: deploy to Railway with `VERCEL_ENV=production` set as a compatibility shim (zero code changes). Only refactor to `NODE_ENV` after confirming the app works
5. **Test checklist is in Phase 3** — work through it systematically
6. **Never touch DNS** without explicit user approval — that's the production cutover
