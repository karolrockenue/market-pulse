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

// Cache TTL: 24 hours for future dates, infinite for past dates (historical never changes)
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Fetch flights for a single 12-hour window from AeroDataBox FIDS.
 * Now also extracts origin airport/country from arrivals.
 * Returns { arrivals, departures, origins[] }
 */
async function fetchFlightWindow(airportCode, fromLocal, toLocal) {
  const apiKey = getRapidApiKey();
  if (!apiKey) return { arrivals: 0, departures: 0, origins: [] };

  const url = `${BASE_URL}/flights/airports/iata/${airportCode}/${fromLocal}/${toLocal}?direction=Both&withCodeshared=false&withCargo=false&withPrivate=false`;

  const res = await fetch(url, {
    headers: {
      "X-RapidAPI-Key": apiKey,
      "X-RapidAPI-Host": RAPIDAPI_HOST,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    logger.error({ msg: "AeroDataBox API error", status: res.status, airportCode, fromLocal, body: text.substring(0, 200) });
    return { arrivals: 0, departures: 0, origins: [] };
  }

  const data = await res.json();
  const arrivalList = Array.isArray(data.arrivals) ? data.arrivals : [];
  const departureList = Array.isArray(data.departures) ? data.departures : [];

  // Extract origin data from arrivals
  const originCounts = new Map();
  for (const flight of arrivalList) {
    const dep = flight.departure || flight.movement;
    const airport = dep?.airport;
    if (airport?.iata && airport?.countryCode) {
      const key = `${airport.iata}_${airport.countryCode.toUpperCase()}`;
      const existing = originCounts.get(key);
      if (existing) {
        existing.count++;
      } else {
        originCounts.set(key, {
          iata: airport.iata,
          name: airport.name || airport.iata,
          country: airport.countryCode.toUpperCase(),
          count: 1,
        });
      }
    }
  }

  return {
    arrivals: arrivalList.length,
    departures: departureList.length,
    origins: Array.from(originCounts.values()),
  };
}

/**
 * Fetch full-day flight counts for an airport (2 × 12h windows).
 * Merges origins from both windows.
 */
async function fetchDayFlights(airportCode, dateStr) {
  const morning = await fetchFlightWindow(
    airportCode,
    `${dateStr}T00:00`,
    `${dateStr}T11:59`
  );

  await new Promise((r) => setTimeout(r, 1500));

  const afternoon = await fetchFlightWindow(
    airportCode,
    `${dateStr}T12:00`,
    `${dateStr}T23:59`
  );

  // Merge origins from both windows
  const mergedOrigins = new Map();
  for (const o of [...morning.origins, ...afternoon.origins]) {
    const key = `${o.iata}_${o.country}`;
    const existing = mergedOrigins.get(key);
    if (existing) {
      existing.count += o.count;
    } else {
      mergedOrigins.set(key, { ...o });
    }
  }

  return {
    arrivals: morning.arrivals + afternoon.arrivals,
    departures: morning.departures + afternoon.departures,
    origins: Array.from(mergedOrigins.values()).sort((a, b) => b.count - a.count),
  };
}

/**
 * Generate date strings for a range
 */
function generateDates(startDate, days) {
  const dates = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}

/**
 * Get flight demand data for a city, optionally with YoY comparison.
 */
async function getFlightDemand(citySlug, days = 90, includeYoY = false) {
  citySlug = citySlug.toLowerCase();
  const airports = CITY_AIRPORTS[citySlug];
  if (!airports) {
    return { citySlug, airports: [], data: [], source: "no-config" };
  }

  const today = new Date();
  const dates = generateDates(today, days);

  // Also generate last year's dates (364 days back to align day-of-week)
  const yoyStart = new Date(today);
  yoyStart.setDate(today.getDate() - 364);
  const yoyDates = includeYoY ? generateDates(yoyStart, days) : [];

  const allDates = [...dates, ...yoyDates];
  const minDate = allDates.reduce((a, b) => a < b ? a : b);
  const maxDate = allDates.reduce((a, b) => a > b ? a : b);

  // Query all data in one hit
  const cached = await pool.query(
    `SELECT airport_code, flight_date::text AS flight_date, arrival_count, departure_count, origins, fetched_at
     FROM flight_demand_snapshots
     WHERE airport_code = ANY($1) AND flight_date >= $2 AND flight_date <= $3`,
    [airports, minDate, maxDate]
  );

  const cacheMap = new Map();
  for (const row of cached.rows) {
    cacheMap.set(`${row.airport_code}_${row.flight_date}`, row);
  }

  // Helper to aggregate a date across airports
  function aggregateDate(dateStr) {
    let totalArrivals = 0;
    let totalDepartures = 0;
    const mergedOrigins = new Map();

    for (const code of airports) {
      const row = cacheMap.get(`${code}_${dateStr}`);
      if (row) {
        totalArrivals += parseInt(row.arrival_count, 10);
        totalDepartures += parseInt(row.departure_count, 10);
        const origins = row.origins || [];
        for (const o of origins) {
          const key = `${o.iata}_${o.country}`;
          const existing = mergedOrigins.get(key);
          if (existing) {
            existing.count += o.count;
          } else {
            mergedOrigins.set(key, { ...o });
          }
        }
      }
    }

    return {
      arrivals: totalArrivals,
      departures: totalDepartures,
      totalFlights: totalArrivals + totalDepartures,
      origins: Array.from(mergedOrigins.values()).sort((a, b) => b.count - a.count),
    };
  }

  // Build result
  const result = dates.map((date, idx) => {
    const current = aggregateDate(date);
    const entry = { date, ...current };

    if (includeYoY && yoyDates[idx]) {
      const yoy = aggregateDate(yoyDates[idx]);
      entry.yoy = {
        date: yoyDates[idx],
        arrivals: yoy.arrivals,
        departures: yoy.departures,
        totalFlights: yoy.totalFlights,
      };
    }

    return entry;
  });

  return { citySlug, airports, data: result, source: "cache" };
}

/**
 * Refresh flight demand data from AeroDataBox for a city.
 * Now also stores origin data and optionally fetches YoY period.
 */
async function refreshFlightDemand(citySlug, days = 90, includeYoY = false) {
  citySlug = citySlug.toLowerCase();
  if (!getRapidApiKey()) {
    throw new Error("RAPIDAPI_KEY environment variable not set");
  }

  const airports = CITY_AIRPORTS[citySlug];
  if (!airports) {
    return { citySlug, airports: [], fetched: 0, skipped: 0, totalDates: 0, message: "No airport config for this city" };
  }

  const today = new Date();
  const dates = generateDates(today, days);

  // Add YoY dates (364 days back to align day-of-week)
  if (includeYoY) {
    const yoyStart = new Date(today);
    yoyStart.setDate(today.getDate() - 364);
    const yoyDates = generateDates(yoyStart, days);
    dates.push(...yoyDates);
  }

  // Deduplicate dates
  const uniqueDates = [...new Set(dates)];

  // Check what we already have cached (and is fresh)
  const minDate = uniqueDates.reduce((a, b) => a < b ? a : b);
  const maxDate = uniqueDates.reduce((a, b) => a > b ? a : b);

  const cached = await pool.query(
    `SELECT airport_code, flight_date::text AS flight_date, fetched_at
     FROM flight_demand_snapshots
     WHERE airport_code = ANY($1) AND flight_date >= $2 AND flight_date <= $3`,
    [airports, minDate, maxDate]
  );

  const freshSet = new Set();
  const now = Date.now();
  const todayStr = today.toISOString().split("T")[0];

  for (const row of cached.rows) {
    const age = now - new Date(row.fetched_at).getTime();
    const isPast = row.flight_date < todayStr;
    // Past dates with origins data are permanent cache (historical data doesn't change)
    // Future dates use TTL
    if (isPast || age < CACHE_TTL_MS) {
      freshSet.add(`${row.airport_code}_${row.flight_date}`);
    }
  }

  let fetched = 0;
  let skipped = 0;

  console.log(`[FLIGHT] Refresh loop starting: ${airports.length} airports × ${uniqueDates.length} dates, ${freshSet.size} already fresh`);

  for (const airportCode of airports) {
    for (const dateStr of uniqueDates) {
      const key = `${airportCode}_${dateStr}`;
      if (freshSet.has(key)) {
        skipped++;
        continue;
      }

      try {
        const counts = await fetchDayFlights(airportCode, dateStr);

        await pool.query(
          `INSERT INTO flight_demand_snapshots (airport_code, flight_date, arrival_count, departure_count, origins, fetched_at)
           VALUES ($1, $2, $3, $4, $5, NOW())
           ON CONFLICT (airport_code, flight_date) DO UPDATE SET
             arrival_count = EXCLUDED.arrival_count,
             departure_count = EXCLUDED.departure_count,
             origins = EXCLUDED.origins,
             fetched_at = NOW()`,
          [airportCode, dateStr, counts.arrivals, counts.departures, JSON.stringify(counts.origins)]
        );

        fetched++;
        console.log(`[FLIGHT] ${airportCode} ${dateStr}: ${counts.arrivals} arr, ${counts.departures} dep, ${counts.origins.length} origins`);

        // Rate limit: 2 seconds between full-day fetches
        await new Promise((r) => setTimeout(r, 2000));
      } catch (err) {
        logger.error({ msg: "Flight fetch error", airportCode, dateStr, error: err.message });
      }
    }
  }

  return { citySlug, airports, fetched, skipped, totalDates: uniqueDates.length * airports.length };
}

/**
 * Get supported cities and their airport configs
 */
function getSupportedCities() {
  return Object.entries(CITY_AIRPORTS).map(([slug, airports]) => ({ slug, airports }));
}

/**
 * Refresh flight demand for ALL configured cities (daily cron).
 */
async function refreshAllCities(days = 90) {
  const cities = Object.keys(CITY_AIRPORTS);
  logger.info({ msg: "Flight demand refresh starting", cities, days });

  const results = [];
  for (const city of cities) {
    try {
      const result = await refreshFlightDemand(city, days, true);
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
