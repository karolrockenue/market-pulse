// File: /api/utils/report.generators.js
// [NEW] A centralized "Logic Hub" for generating complex reports.

const pool = require("./db"); // Database connection pool
const cloudbedsAdapter = require("../adapters/cloudbedsAdapter"); // Cloudbeds adapter
const { generatePdfFromHtml } = require("./pdf.utils"); // PDF utility
const fetch = require("node-fetch"); // Needed for access token helper
const { format } = require("date-fns"); // For formatting the filename date
const ExcelJS = require("exceljs"); // XLSX generation

/**
 * A helper function to get a valid Cloudbeds access token for a given property.
 * Copied directly from rockenue.router.js.
 *
 */
async function getCloudbedsAccessToken(propertyId) {
  if (!propertyId) {
    throw new Error(
      "A propertyId is required to get a Cloudbeds access token."
    );
  }
  const credsResult = await pool.query(
    `SELECT pms_credentials FROM user_properties WHERE property_id = $1 AND pms_credentials->>'refresh_token' IS NOT NULL LIMIT 1`,
    [propertyId]
  );
  const refreshToken = credsResult.rows[0]?.pms_credentials?.refresh_token;
  if (!refreshToken) {
    throw new Error(
      `Could not find a valid refresh token for property ${propertyId}.`
    );
  }
  const { CLOUDBEDS_CLIENT_ID, CLOUDBEDS_CLIENT_SECRET } = process.env;
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: CLOUDBEDS_CLIENT_ID,
    client_secret: CLOUDBEDS_CLIENT_SECRET,
    refresh_token: refreshToken,
  });
  const response = await fetch(
    "https://hotels.cloudbeds.com/api/v1.1/access_token",
    {
      method: "POST",
      body: params,
    }
  );
  const tokenData = await response.json();
  if (!tokenData.access_token) {
    throw new Error(
      `Cloudbeds token refresh failed for property ${propertyId}.`
    );
  }
  return tokenData.access_token;
}
/**
 * [NEW] Fetches all required data for the Shreeji Report (without generating PDF).
 * Can be used by the Preview API endpoint or the PDF Generator.
 * * @param {string|number} hotelId
 * @param {string} date
 */
async function fetchShreejiReportData(hotelId, date) {
  console.log(
    `[report.generators.js] Fetching Shreeji Report Data for hotel ${hotelId} on ${date}`
  );

  // --- 1. GATHER ALL DATA ---
  const snapshotResult = await pool.query(
    `SELECT
      rooms_sold,
      capacity_count,
      gross_revenue,
      gross_adr,
      gross_revpar
     FROM daily_metrics_snapshots
     WHERE hotel_id = $1::integer AND stay_date = $2::date`,
    [hotelId, date]
  );

  let summary = {
    vacant: "N/A",
    blocked: "N/A",
    sold: 0,
    occupancy: 0,
    revpar: 0,
    adr: 0,
    revenue: 0,
  };
  if (snapshotResult.rows.length > 0) {
    const snapshot = snapshotResult.rows[0];
    summary.sold = snapshot.rooms_sold || 0;
    summary.revenue = snapshot.gross_revenue || 0;
    summary.adr = snapshot.gross_adr || 0;
    summary.revpar = snapshot.gross_revpar || 0;
    summary.occupancy =
      snapshot.capacity_count > 0
        ? (snapshot.rooms_sold / snapshot.capacity_count) * 100
        : 0;
    summary.vacant =
      (snapshot.capacity_count || 0) - (snapshot.rooms_sold || 0);
  }

  const hotelInfoResult = await pool.query(
    "SELECT pms_type, pms_property_id, property_name FROM hotels WHERE hotel_id = $1",
    [hotelId]
  );
  if (hotelInfoResult.rows.length === 0) {
    throw new Error(`Hotel not found with ID: ${hotelId}`);
  }

  const { pms_type, pms_property_id, property_name } = hotelInfoResult.rows[0];
  const externalPropertyId = pms_property_id || hotelId;

  let reportData = [];
  let takingsData = {};
  let blockedRoomNames = [];
  let blockedRoomsCount = 0;

  if (pms_type === "cloudbeds") {
    const accessToken = await getCloudbedsAccessToken(hotelId);
    const [
      takingsResult,
      roomsResponse,
      overlappingReservations,
      roomBlocksResult,
    ] = await Promise.all([
      cloudbedsAdapter.getDailyTakings(accessToken, externalPropertyId, date),
      cloudbedsAdapter.getRooms(accessToken, externalPropertyId),
      cloudbedsAdapter.getReservations(accessToken, externalPropertyId, {
        checkInTo: date,
        checkOutFrom: date,
      }),
      cloudbedsAdapter.getRoomBlocks(accessToken, externalPropertyId, date),
    ]);

    const roomMap = new Map();
    const allRoomsForMap = roomsResponse[0]?.rooms || [];
    for (const room of allRoomsForMap) {
      roomMap.set(room.roomID, room.roomName);
    }

    const activeOvernightBlocks = roomBlocksResult.filter((block) => {
      return block.startDate <= date && block.endDate > date;
    });

    if (activeOvernightBlocks && activeOvernightBlocks.length > 0) {
      for (const block of activeOvernightBlocks) {
        for (const room of block.rooms) {
          const roomName = roomMap.get(room.roomID);
          if (roomName) {
            blockedRoomNames.push(roomName);
          }
        }
      }
    }
    blockedRoomsCount = blockedRoomNames.length;
    summary.blocked = blockedRoomsCount;

    takingsData = takingsResult;
    const allHotelRooms = roomsResponse[0]?.rooms || [];

    const inHouseReservations = overlappingReservations.filter((res) => {
      if (res.status === "canceled" || !res.startDate || !res.endDate) {
        return false;
      }
      const checkInDateOnly = res.startDate.substring(0, 10);
      const checkOutDateOnly = res.endDate.substring(0, 10);
      return checkInDateOnly <= date && checkOutDateOnly > date;
    });

    const occupiedRoomsData = new Map();
    if (inHouseReservations.length > 0) {
      const reservationIDs = inHouseReservations.map(
        (res) => res.reservationID
      );
      const detailedReservations =
        await cloudbedsAdapter.getReservationsWithDetails(
          accessToken,
          externalPropertyId,
          { reservationID: reservationIDs.join(",") }
        );

      for (const res of detailedReservations) {
        if (res.rooms && res.rooms.length > 0) {
          // [FIX] Iterate through ALL rooms in the booking, not just the first one
          for (const roomDetails of res.rooms) {
            if (roomDetails.roomName) {
              const roomName = roomDetails.roomName;
              const adults = parseInt(roomDetails.adults, 10) || 0;
              const children = parseInt(roomDetails.children, 10) || 0;

              let paxString = `${adults}`;
              if (children > 0) {
                paxString += `+${children}`;
              }

              // Use specific room total if available to avoid duplicating revenue, fallback to total if needed
              const roomRate = parseFloat(roomDetails.roomTotal) || 0;
              const displayRate =
                roomRate > 0 ? roomRate : parseFloat(res.total) || 0;

              occupiedRoomsData.set(roomName, {
                guestName: res.guestName || "N/A",
                pax: paxString,
                balance: res.balance || 0,
                source: res.sourceName || "N/A",
                checkInDate: res.reservationCheckIn,
                checkOutDate: res.reservationCheckOut,
                grandTotal: displayRate,
              });
            }
          }
        }
      }
    }

    reportData = allHotelRooms.map((room) => {
      const occupiedData = occupiedRoomsData.get(room.roomName);
      if (occupiedData) {
        return {
          roomName: room.roomName,
          ...occupiedData,
        };
      } else {
        return {
          roomName: room.roomName,
          guestName: "---",
          pax: "---",
          balance: 0,
          source: "---",
          checkInDate: "---",
          checkOutDate: "---",
          grandTotal: 0,
        };
      }
    });
  } else {
    // Handle Mews or other PMS types if necessary
    if (summary.sold === 0 && summary.revenue === 0) {
      throw new Error(
        `Report not implemented for Mews (or no data) for hotel ${hotelId} on ${date}.`
      );
    }
  }

  reportData.sort((a, b) =>
    a.roomName.localeCompare(b.roomName, undefined, { numeric: true })
  );

  return {
    reportData,
    summary,
    takings: takingsData,
    blocks: {
      count: blockedRoomsCount,
      names: blockedRoomNames.sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true })
      ),
    },
    hotelName: property_name,
    reportDate: date,
  };
}

/**
 * Generates the Shreeji Report PDF for a specific hotel and date.
 *
 * @param {string|number} hotelId - The hotel_id to generate the report for.
 * @param {string} date - The report date in 'YYYY-MM-DD' format.
 * @returns {Promise<object>} An object containing { pdfBuffer, fileName, hotelName, reportDate }.
 */
async function generateShreejiReport(hotelId, date) {
  try {
    // --- 1. GATHER DATA ---
    const data = await fetchShreejiReportData(hotelId, date);

    // --- 2. PREPARE DATA FOR PDF ---
    // (The fetch function returns exactly what the template expects)
    const dataForPdf = {
      ...data,
      takings: data.takings,
      blocks: data.blocks,
    };

    // --- 3. GENERATE PDF ---
    const pdfBuffer = await generatePdfFromHtml(
      "shreeji.template.html",
      dataForPdf
    );

    // --- 4. PREPARE FILENAME ---
    const dateObj = new Date(date + "T12:00:00Z");
    const formattedDate = format(dateObj, "dd-MMM-yyyy");
    const fileName = `Daily Chart - ${data.hotelName} - ${formattedDate}.pdf`;

    // --- 5. RETURN RESULTS ---
    return {
      pdfBuffer,
      fileName,
      hotelName: data.hotelName,
      reportDate: date,
    };
  } catch (error) {
    console.error(
      `[report.generators.js] Error generating Shreeji Report PDF for hotel ${hotelId}:`,
      error
    );
    throw error;
  }
}

/**
 * Generates the Performance Metrics PDF for a given hotel/date range.
 * Data comes from the same MetricsService.runDynamicReport() call that the
 * on-screen report uses, so the PDF matches the UI exactly.
 *
 * @param {object} params
 * @param {string|number} params.hotelId
 * @param {string} params.startDate - 'YYYY-MM-DD'
 * @param {string} params.endDate   - 'YYYY-MM-DD'
 * @param {string} params.granularity - 'daily' | 'weekly' | 'monthly'
 * @param {string[]} params.selectedMetrics - metric ids (e.g. ['occupancy', 'adr', ...])
 * @param {boolean} params.includeTaxes
 * @param {boolean} params.displayTotals
 * @param {string} params.currencySymbol - e.g. '£', '$', '€'
 * @param {string} params.propertyName
 * @param {any[]} params.rows - pre-fetched data rows from runDynamicReport
 * @returns {Promise<{ pdfBuffer: Buffer, fileName: string }>}
 */
async function generatePerformanceMetricsReport(params) {
  const {
    hotelId,
    startDate,
    endDate,
    granularity,
    selectedMetrics,
    displayTotals,
    currencySymbol,
    propertyName,
    rows,
  } = params;

  const generatedAt = format(new Date(), "dd MMM yyyy HH:mm");

  const dataForPdf = {
    propertyName: propertyName || `Hotel ${hotelId}`,
    startDate,
    endDate,
    granularity,
    selectedMetrics,
    displayTotals: !!displayTotals,
    currencySymbol: currencySymbol || "£",
    generatedAt,
    rows: Array.isArray(rows) ? rows : [],
  };

  const propertyNameSanitized = (propertyName || "Property")
    .replace(/[\/\\:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // All page furniture (dark bar, gradient strip, page number, property
  // name) lives in Playwright's native header/footer templates. These are
  // designed for repeating per-page page elements and are less prone to
  // the position:fixed + @page layout bugs we were hitting. Body content
  // has no page furniture — it's just metadata + table.
  //
  // Design sizing:
  //   A4 portrait at 96dpi = 794 × 1123 px (210 × 297 mm)
  //   Header = 18mm tall (dark bar). ViewBox 0 0 794 68.
  //   Footer = 16mm tall (page-number row + 6px gradient strip). ViewBox 0 0 794 60.
  //   Playwright margins match template heights exactly (no gaps, no stacking).
  //
  // Aggressive CSS resets on the wrapper divs override Chromium's default
  // header/footer padding. SVG content with preserveAspectRatio="none"
  // stretches to exactly fill the reserved margin area regardless of
  // Chromium's internal scale factor.

  const safePropName = propertyNameSanitized.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const RESET = "margin:0 !important; padding:0 !important; box-sizing:border-box;";
  const BLEED_HEADER = "margin:-8mm -25mm 0 -25mm !important; padding:0 !important; box-sizing:border-box;";
  const BLEED_FOOTER = "margin:0 -25mm -6mm -25mm !important; padding:0 !important; box-sizing:border-box;";

  // Dark bar + logo painted inside one SVG (rect + <text> elements),
  // rendered via headerTemplate so it repeats on every page. A thin 1px
  // white sliver remains on the right edge — Chromium's headerTemplate
  // container has an internal clip that no bleed/img trick could cross.
  // Cosmetic only; accepted in favour of multi-page coverage.
  const headerHtml = `
    <div style="${BLEED_HEADER} width:calc(100% + 50mm); display:block;">
      <svg width="100%" height="22mm" preserveAspectRatio="none" viewBox="0 0 794 68" xmlns="http://www.w3.org/2000/svg" style="display:block; ${RESET}">
        <rect x="0" y="0" width="794" height="68" fill="#14181D"/>
        <g font-family="Helvetica, Arial, sans-serif">
          <text x="113" y="43" font-size="20" font-weight="300" fill="#38C6BA">(</text>
          <text x="130" y="42" font-size="10.5" font-weight="700" fill="#F3F5F7" letter-spacing="1.4">MARKET PULSE</text>
          <text x="230" y="43" font-size="20" font-weight="300" fill="#C8A66E">)</text>
          <text x="681" y="42" font-size="9" font-weight="500" fill="#7A8494" letter-spacing="0.8" text-anchor="end">PERFORMANCE METRICS</text>
        </g>
      </svg>
    </div>
  `;

  // Footer: "prop name + Page X of Y" HTML row, then a SVG gradient strip
  // (two rects — teal left, gold right). Wrapper bleeds 25mm sides and 6mm
  // below so the strip hugs the page bottom.
  const footerHtml = `
    <div style="${BLEED_FOOTER} width:calc(100% + 50mm); display:block; font-family:Helvetica, Arial, sans-serif;">
      <div style="margin:0 !important; padding:4mm 37mm 0 37mm !important; box-sizing:border-box; display:flex; justify-content:space-between; align-items:baseline; color:#6B7280; font-size:8px; text-transform:uppercase; letter-spacing:0.08em;">
        <span>${safePropName}</span>
        <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
      </div>
      <svg width="100%" preserveAspectRatio="none" viewBox="0 0 100 10" xmlns="http://www.w3.org/2000/svg" style="display:block; margin:3mm 0 0 0 !important; padding:0 !important; height:6px; width:100%;">
        <rect x="0" y="0" width="50" height="10" fill="#38C6BA"/>
        <rect x="50" y="0" width="50" height="10" fill="#C8A66E"/>
      </svg>
    </div>
  `;

  const pdfOptions = {
    format: "A4",
    scale: 1.0,
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: headerHtml,
    footerTemplate: footerHtml,
    margin: {
      top: "26mm",     // 22mm dark bar + 4mm breathing gap before body content
      bottom: "16mm",  // reserves space for footerTemplate
      left: "0mm",
      right: "0mm",
    },
  };

  const pdfBuffer = await generatePdfFromHtml(
    "performance-metrics.template.html",
    dataForPdf,
    pdfOptions
  );

  const fileName = `Performance Metrics - ${propertyNameSanitized} - ${startDate} to ${endDate}.pdf`;
  return { pdfBuffer, fileName };
}

/**
 * Generates the Performance Metrics XLSX for a given hotel/date range.
 * Ships a clean, workable spreadsheet: column headers in row 1, data rows,
 * totals/avg row at the bottom. No metadata / logo headers. Native Excel
 * types (dates, percentages, currency) so user opens and is done.
 *
 * @param {object} params - same shape as generatePerformanceMetricsReport
 * @returns {Promise<{ xlsxBuffer: Buffer, fileName: string }>}
 */
async function generatePerformanceMetricsXlsx(params) {
  const {
    startDate,
    endDate,
    granularity,
    selectedMetrics,
    displayTotals,
    currencySymbol,
    propertyName,
    rows,
  } = params;

  const METRIC_LABELS = {
    "occupancy": "Occupancy",
    "adr": "ADR",
    "revpar": "RevPAR",
    "total-revenue": "Total Revenue",
    "rooms-sold": "Rooms Sold",
    "rooms-unsold": "Rooms Unsold",
    "market-occupancy": "Market Occ",
    "market-adr": "Market ADR",
    "market-revpar": "Market RevPAR",
    "market-total-revenue": "Market Total Revenue",
  };
  const VOLUME_METRICS = new Set([
    "total-revenue",
    "rooms-sold",
    "rooms-unsold",
    "market-total-revenue",
  ]);

  const selectedMetricsArr = Array.isArray(selectedMetrics) ? selectedMetrics : [];
  const showDow = granularity === "daily";
  const currency = currencySymbol || "£";
  const currencyFmt = `"${currency}"#,##0.00`;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Market Pulse";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Performance");

  const columns = [];
  if (granularity === "daily") {
    columns.push({ header: "Date", key: "date", width: 14, style: { numFmt: "dd/mm/yyyy" } });
  } else if (granularity === "monthly") {
    columns.push({ header: "Month", key: "date", width: 16, style: { numFmt: "mmm yyyy" } });
  } else {
    columns.push({ header: "Period", key: "date", width: 16 });
  }
  if (showDow) columns.push({ header: "DOW", key: "dow", width: 8 });

  for (const m of selectedMetricsArr) {
    const col = { header: METRIC_LABELS[m] || m, key: m, width: 18 };
    if (m.indexOf("occupancy") !== -1) {
      col.style = { numFmt: "0.0%" };
    } else if (
      m.indexOf("adr") !== -1 ||
      m.indexOf("revenue") !== -1 ||
      m.indexOf("revpar") !== -1
    ) {
      col.style = { numFmt: currencyFmt };
    } else {
      col.style = { numFmt: "#,##0" };
    }
    columns.push(col);
  }
  sheet.columns = columns;

  // Header row style
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FF1A1A1A" } };
  headerRow.alignment = { horizontal: "center", vertical: "middle" };
  headerRow.height = 18;

  // Parse period -> Date object (for daily / monthly)
  const parsePeriod = (period) => {
    if (!period) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(period));
    if (!m) return String(period);
    return new Date(Date.UTC(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10)));
  };

  const dowLabel = (dateObj) => {
    if (!(dateObj instanceof Date)) return "";
    return dateObj.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
  };

  for (const r of rows || []) {
    const rowData = {};
    rowData.date = parsePeriod(r.period);
    if (showDow) rowData.dow = dowLabel(rowData.date);
    for (const m of selectedMetricsArr) {
      rowData[m] = Number(r[m]) || 0;
    }
    sheet.addRow(rowData);
  }

  // Totals / Avg row
  if (displayTotals && rows && rows.length > 0) {
    const totalsData = { date: "Totals / Avg" };
    if (showDow) totalsData.dow = "";
    for (const m of selectedMetricsArr) {
      let sum = 0;
      for (const r of rows) sum += Number(r[m]) || 0;
      totalsData[m] = VOLUME_METRICS.has(m) ? sum : sum / rows.length;
    }
    const totalsRow = sheet.addRow(totalsData);
    totalsRow.font = { bold: true };
    totalsRow.eachCell((cell) => {
      cell.border = { top: { style: "thin", color: { argb: "FF999999" } } };
    });
    // The 'date' cell holds the label 'Totals / Avg' as text — override its
    // numFmt so Excel doesn't try to interpret the string as a date.
    totalsRow.getCell(1).numFmt = "@";
  }

  // Freeze the header row
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  const buffer = await workbook.xlsx.writeBuffer();

  const propertyNameSanitized = (propertyName || "Property")
    .replace(/[\/\\:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const fileName = `Performance Metrics - ${propertyNameSanitized} - ${startDate} to ${endDate}.xlsx`;

  return { xlsxBuffer: Buffer.from(buffer), fileName };
}

module.exports = {
  fetchShreejiReportData,
  generateShreejiReport,
  generatePerformanceMetricsReport,
  generatePerformanceMetricsXlsx,
};
