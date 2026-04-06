const pool = require("../utils/db");
const logger = require("../utils/logger");

// City → IATA airport codes mapping
const CITY_AIRPORTS = {
  london: ["LHR", "LGW", "STN"],
  // Add new cities here as needed
  // "las-vegas": ["LAS"],
  // "paris": ["CDG", "ORY"],
};

const RAPIDAPI_HOST = "aerodatabox.p.rapidapi.com";
const BASE_URL = `https://${RAPIDAPI_HOST}`;

function getRapidApiKey() {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) {
    logger.error({ msg: "RAPIDAPI_KEY is not set in environment" });
  }
  return key;
}

// Startup check
logger.info({ msg: "Flight service loaded", rapidApiKeyPresent: !!process.env.RAPIDAPI_KEY, cities: Object.keys(CITY_AIRPORTS) });

// Cache TTL: 24 hours (re-fetch if older)
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Fetch flights for a single 12-hour window from AeroDataBox FIDS.
 * Returns { arrivals: number, departures: number }
 */
async function fetchFlightWindow(airportCode, fromLocal, toLocal) {
  const apiKey = getRapidApiKey();
  if (!apiKey) return { arrivals: 0, departures: 0 };

  const url = `${BASE_URL}/flights/airports/iata/${airportCode}/${fromLocal}/${toLocal}?direction=Both&withCodeshared=false&withCargo=false&withPrivate=false`;

  logger.info({ msg: "AeroDataBox request", airportCode, fromLocal, toLocal });

  const res = await fetch(url, {
    headers: {
      "X-RapidAPI-Key": apiKey,
      "X-RapidAPI-Host": RAPIDAPI_HOST,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    logger.error({ msg: "AeroDataBox API error", status: res.status, airportCode, fromLocal, body: text.substring(0, 200) });
    return { arrivals: 0, departures: 0 };
  }

  const data = await res.json();
  const arrivals = Array.isArray(data.arrivals) ? data.arrivals.length : 0;
  const departures = Array.isArray(data.departures) ? data.departures.length : 0;
  logger.info({ msg: "AeroDataBox response", airportCode, fromLocal, arrivals, departures });

  return { arrivals, departures };
}

/**
 * Fetch full-day flight counts for an airport (2 × 12h windows).
 * Adds a 500ms delay between the two calls to be polite.
 */
async function fetchDayFlights(airportCode, dateStr) {
  const morning = await fetchFlightWindow(
    airportCode,
    `${dateStr}T00:00`,
    `${dateStr}T11:59`
  );

  await new Promise((r) => setTimeout(r, 500));

  const afternoon = await fetchFlightWindow(
    airportCode,
    `${dateStr}T12:00`,
    `${dateStr}T23:59`
  );

  return {
    arrivals: morning.arrivals + afternoon.arrivals,
    departures: morning.departures + afternoon.departures,
  };
}

/**
 * Get flight demand data for a city over a date range.
 * Returns cached data where available, fetches fresh data for stale/missing dates.
 */
async function getFlightDemand(citySlug, days = 90) {
  const airports = CITY_AIRPORTS[citySlug];
  if (!airports) {
    return { citySlug, airports: [], data: [], source: "no-config" };
  }

  const today = new Date();
  const dates = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    dates.push(d.toISOString().split("T")[0]);
  }

  // Check cache for all airports + dates
  const cached = await pool.query(
    `SELECT airport_code, flight_date::text AS flight_date, arrival_count, departure_count, fetched_at
     FROM flight_demand_snapshots
     WHERE airport_code = ANY($1) AND flight_date >= $2 AND flight_date <= $3`,
    [airports, dates[0], dates[dates.length - 1]]
  );

  const cacheMap = new Map();
  for (const row of cached.rows) {
    cacheMap.set(`${row.airport_code}_${row.flight_date}`, row);
  }

  // Build result: aggregate all airports per date
  const result = dates.map((date) => {
    let totalArrivals = 0;
    let totalDepartures = 0;
    for (const code of airports) {
      const row = cacheMap.get(`${code}_${date}`);
      if (row) {
        totalArrivals += parseInt(row.arrival_count, 10);
        totalDepartures += parseInt(row.departure_count, 10);
      }
    }
    return {
      date,
      arrivals: totalArrivals,
      departures: totalDepartures,
      totalFlights: totalArrivals + totalDepartures,
    };
  });

  return { citySlug, airports, data: result, source: "cache" };
}

/**
 * Refresh flight demand data from AeroDataBox for a city.
 * Only fetches dates that are missing or stale (older than CACHE_TTL_MS).
 * Returns { fetched, skipped } counts.
 */
async function refreshFlightDemand(citySlug, days = 90) {
  if (!getRapidApiKey()) {
    throw new Error("RAPIDAPI_KEY environment variable not set");
  }

  const airports = CITY_AIRPORTS[citySlug];
  if (!airports) {
    return { citySlug, airports: [], fetched: 0, skipped: 0, totalDates: 0, message: "No airport config for this city" };
  }

  const today = new Date();
  const dates = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    dates.push(d.toISOString().split("T")[0]);
  }

  // Check what we already have cached (and is fresh)
  const cached = await pool.query(
    `SELECT airport_code, flight_date::text AS flight_date, fetched_at
     FROM flight_demand_snapshots
     WHERE airport_code = ANY($1) AND flight_date >= $2 AND flight_date <= $3`,
    [airports, dates[0], dates[dates.length - 1]]
  );

  const freshSet = new Set();
  const now = Date.now();
  for (const row of cached.rows) {
    const age = now - new Date(row.fetched_at).getTime();
    if (age < CACHE_TTL_MS) {
      freshSet.add(`${row.airport_code}_${row.flight_date}`);
    }
  }

  let fetched = 0;
  let skipped = 0;

  for (const airportCode of airports) {
    for (const dateStr of dates) {
      const key = `${airportCode}_${dateStr}`;
      if (freshSet.has(key)) {
        skipped++;
        continue;
      }

      try {
        const counts = await fetchDayFlights(airportCode, dateStr);

        await pool.query(
          `INSERT INTO flight_demand_snapshots (airport_code, flight_date, arrival_count, departure_count, fetched_at)
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT (airport_code, flight_date) DO UPDATE SET
             arrival_count = EXCLUDED.arrival_count,
             departure_count = EXCLUDED.departure_count,
             fetched_at = NOW()`,
          [airportCode, dateStr, counts.arrivals, counts.departures]
        );

        fetched++;
        logger.info({ msg: "Flight data fetched", airportCode, dateStr, ...counts });

        // Rate limit: 1 second between full-day fetches
        await new Promise((r) => setTimeout(r, 1000));
      } catch (err) {
        logger.error({ msg: "Flight fetch error", airportCode, dateStr, error: err.message });
      }
    }
  }

  return { citySlug, airports, fetched, skipped, totalDates: dates.length * airports.length };
}

/**
 * Get supported cities and their airport configs
 */
function getSupportedCities() {
  return Object.entries(CITY_AIRPORTS).map(([slug, airports]) => ({ slug, airports }));
}

/**
 * Refresh flight demand for ALL configured cities.
 * Designed to run as a daily cron job.
 */
async function refreshAllCities(days = 90) {
  const cities = Object.keys(CITY_AIRPORTS);
  logger.info({ msg: "Flight demand refresh starting", cities, days });

  const results = [];
  for (const city of cities) {
    try {
      const result = await refreshFlightDemand(city, days);
      results.push(result);
      logger.info({ msg: "Flight demand refresh complete", city, fetched: result.fetched, skipped: result.skipped });
    } catch (err) {
      logger.error({ msg: "Flight demand refresh failed", city, error: err.message });
      results.push({ citySlug: city, error: err.message });
    }
  }

  return results;
}

module.exports = {
  getFlightDemand,
  refreshFlightDemand,
  refreshAllCities,
  getSupportedCities,
  CITY_AIRPORTS,
};
