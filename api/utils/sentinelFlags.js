/**
 * [OVERRIDE MODEL v1] Feature-flag helpers.
 * See claude/rate-override-implementation.md.
 *
 * SENTINEL_OVERRIDES_ENABLED (master switch) — 'true' to enable.
 * SENTINEL_OVERRIDES_HOTEL_ALLOWLIST (optional) — comma-separated
 * hotel IDs. If set, only listed hotels use the new override model.
 * Unset means fleet-wide once the master switch is on.
 *
 * Read env on every call (no caching) so a flip via Railway's UI
 * takes effect at the next request without a restart.
 */
function isRateOverridesEnabled(hotelId) {
  if (process.env.SENTINEL_OVERRIDES_ENABLED !== "true") return false;
  const allowlist = (process.env.SENTINEL_OVERRIDES_HOTEL_ALLOWLIST || "").trim();
  if (!allowlist) return true;
  const allowed = allowlist.split(",").map((s) => s.trim()).filter(Boolean);
  return allowed.includes(String(hotelId));
}

module.exports = { isRateOverridesEnabled };
