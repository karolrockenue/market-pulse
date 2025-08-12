// public/app/reports.js

// --- HELPER for handleGenerateReport ---
// --- HELPER for handleGenerateReport ---
// This function now correctly accepts the component's state as a parameter.
function getSelectedColumns(component) {
  // Use the passed-in component's state, which is much more reliable.
  const selectedKeys = component.selectedMetricKeys || [];

  const selected = { hotel: [], market: [] };

  selectedKeys.forEach((key) => {
    // Find the metric's details from the component's metric list.
    const metric = component.reportMetrics.find((m) => m.key === key);
    if (!metric) return; // Skip if the metric isn't found

    // Correctly sort the key into the 'hotel' or 'market' group.
    if (metric.group === "Market") {
      selected.market.push(key);
    } else {
      selected.hotel.push(key);
    }
  });

  return selected;
}
// public/app/reports.js

function handlePresetChange(preset) {
  const localToday = new Date();

  const year = localToday.getFullYear();
  const month = localToday.getMonth();
  const day = localToday.getDate();

  const today = new Date(Date.UTC(year, month, day));

  let startDate, endDate;
  const dayOfWeek = today.getUTCDay() === 0 ? 6 : today.getUTCDay() - 1;

  if (preset === "current-week") {
    startDate = new Date(today);
    startDate.setUTCDate(today.getUTCDate() - dayOfWeek);
    endDate = new Date(startDate);
    endDate.setUTCDate(startDate.getUTCDate() + 6);
  } else if (preset === "last-week") {
    startDate = new Date(today);
    startDate.setUTCDate(today.getUTCDate() - dayOfWeek - 7);
    endDate = new Date(startDate);
    endDate.setUTCDate(startDate.getUTCDate() + 6);
  } else if (preset === "current-month") {
    startDate = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)
    );
    endDate = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0)
    );
  } else if (preset === "next-month") {
    startDate = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1)
    );
    endDate = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 2, 0)
    );
  } else if (preset === "this-year") {
    startDate = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
    endDate = new Date(Date.UTC(today.getUTCFullYear(), 11, 31));
  } else if (preset === "year-to-date") {
    // --- NEW: Logic for Year-to-Date ---
    startDate = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
    endDate = today; // Uses today's date as the end date
  } else if (preset === "last-year") {
    // --- NEW: Logic for the previous full year ---
    const lastYear = today.getUTCFullYear() - 1;
    startDate = new Date(Date.UTC(lastYear, 0, 1));
    endDate = new Date(Date.UTC(lastYear, 11, 31));
  } else {
    return;
  }

  document.getElementById("start-date").value = formatDateForInput(startDate);
  document.getElementById("end-date").value = formatDateForInput(endDate);
}

async function handleGenerateReport(component, propertyId) {
  const reportContainer = document.getElementById("report-results-container");
  reportContainer.innerHTML =
    '<div class="bg-white rounded-xl border p-8 text-center text-gray-500">Loading live report data...</div>';

  try {
    if (!propertyId) {
      throw new Error(
        "No property selected. Please choose a property from the header dropdown."
      );
    }
    // This fix passes the component state down to the helper function.
    const selectedColumns = getSelectedColumns(component);
    const allSelected = [...selectedColumns.hotel, ...selectedColumns.market];

    if (allSelected.length === 0) {
      reportContainer.innerHTML =
        '<div class="bg-white rounded-xl border p-8 text-center text-gray-500">Please select at least one metric.</div>';
      return;
    }

    const startDate = parseDateFromInput(
      document.getElementById("start-date").value
    );
    const endDate = parseDateFromInput(
      document.getElementById("end-date").value
    );
    const addComparisons = component.addComparisons;
    const displayOrder = component.displayOrder;

    const granularity = component.granularity;
    const shouldDisplayTotals = component.displayTotals;

    if (!startDate || !endDate || !granularity || !displayOrder) return;

    const [yourData, marketData] = await Promise.all([
      fetchYourHotelMetrics(propertyId, startDate, endDate, granularity),
      fetchMarketMetrics(propertyId, startDate, endDate, granularity),
    ]);

    const liveData = processAndMergeData(yourData.metrics, marketData.metrics);

    // public/app/reports.js

    renderReportTable(
      liveData,
      selectedColumns,
      granularity,
      addComparisons,
      displayOrder,
      component // Pass the entire component state
    );
  } catch (error) {
    console.error("Failed to generate report:", error);
    reportContainer.innerHTML = `<div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg shadow-lg" role="alert">
      <strong class="font-bold">Error:</strong>
      <span class="block sm:inline">${error.message}</span>
    </div>`;
  }
}

// --- LIVE DATA FETCHING & PROCESSING ---
async function fetchYourHotelMetrics(
  propertyId,
  startDate,
  endDate,
  granularity
) {
  const url = `/api/metrics-from-db?startDate=${formatDateForInput(
    startDate
  )}&endDate=${formatDateForInput(
    endDate
  )}&granularity=${granularity}&propertyId=${propertyId}`;
  const response = await fetch(url);
  if (!response.ok)
    throw new Error("Could not load your hotel data from the server.");
  return response.json();
}

async function fetchMarketMetrics(propertyId, startDate, endDate, granularity) {
  const url = `/api/competitor-metrics?startDate=${formatDateForInput(
    startDate
  )}&endDate=${formatDateForInput(
    endDate
  )}&granularity=${granularity}&propertyId=${propertyId}`;
  const response = await fetch(url);
  if (!response.ok)
    throw new Error("Could not load market data from the server.");
  return response.json();
}

function processAndMergeData(yourData, marketData) {
  const dataMap = new Map();

  // Helper to add data to our map, prefixing keys with 'your_' or 'market_'
  const processRow = (row, prefix) => {
    const date = (row.period || row.stay_date).substring(0, 10);
    if (!dataMap.has(date)) {
      dataMap.set(date, { date });
    }
    const entry = dataMap.get(date);
    for (const key in row) {
      if (key !== "period" && key !== "stay_date") {
        // Use the original key for non-financial metrics like 'rooms_sold'
        // and create prefixed keys for all metrics for consistency.
        const baseKey = key.replace(`${prefix}_`, "");
        entry[`${prefix}_${baseKey}`] = row[key];
      }
    }
  };

  yourData.forEach((row) => processRow(row, "your"));
  marketData.forEach((row) => processRow(row, "market"));

  const mergedData = Array.from(dataMap.values());
  return mergedData.sort((a, b) => new Date(a.date) - new Date(b.date));
}

// --- SCHEDULE API FUNCTIONS ---
async function fetchSchedules() {
  const response = await fetch("/api/scheduled-reports");
  if (!response.ok) {
    alert("Could not load your scheduled reports.");
    return [];
  }
  return response.json();
}

async function saveSchedule(component) {
  if (!component.newScheduleName) {
    alert("Please enter a name for the report.");
    return;
  }

  if (!component.propertyId) {
    alert("Cannot save schedule: No property is currently selected.");
    return;
  }

  // Pass the component state directly to the helper function.
  const selectedColumns = getSelectedColumns(component);

  const payload = {
    propertyId: component.propertyId,
    reportName: component.newScheduleName,
    recipients: component.newScheduleRecipients,
    frequency: component.newScheduleFrequency,
    dayOfWeek: document.getElementById("schedule-weekly-day")?.value,
    dayOfMonth: document.getElementById("schedule-monthly-day")?.value,
    timeOfDay: document.getElementById("schedule-time")?.value,
    reportPeriod: component.newSchedulePeriod,
    metricsHotel: selectedColumns.hotel,
    metricsMarket: selectedColumns.market,
    addComparisons: component.addComparisons,
    displayOrder: document.querySelector(
      'input[name="comparison-order"]:checked'
    )?.value,
    displayTotals: component.displayTotals,
    includeTaxes: document.getElementById("include-taxes-toggle")?.checked,
    // --- THIS IS THE FIX ---
    // We now correctly include the selected formats in the payload.
    attachmentFormats: component.newScheduleFormats,
  };

  const response = await fetch("/api/scheduled-reports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    // This will now show the detailed error from the server in the console.
    console.error("Failed to save schedule:", await response.json());
    alert("Failed to save the schedule. Please try again.");
    return;
  }

  const newSchedule = await response.json();
  // We need to update the frontend list to include the property name for the new item.
  // The easiest way is to just reload all schedules from the server.
  component.schedules = await window.fetchSchedules();

  component.newScheduleName = "";
  component.newScheduleRecipients = "";
  component.isScheduleModalOpen = false;
}
async function deleteSchedule(component, id) {
  if (!confirm("Are you sure you want to delete this scheduled report?")) {
    return;
  }
  const response = await fetch(`/api/scheduled-reports/${id}`, {
    method: "DELETE",
  });

  if (response.status === 204) {
    component.schedules = component.schedules.filter((s) => s.id !== id);
  } else {
    alert("Failed to delete the schedule.");
  }
}

// --- UTILITY FUNCTIONS ---
function formatDateForInput(date) {
  if (!date) return "";
  // --- THIS IS THE FIX ---
  // We explicitly get the UTC parts of the date to prevent timezone shifts.
  const year = date.getUTCFullYear();
  const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const day = date.getUTCDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateForDisplay(dateString) {
  if (!dateString) return "";
  const [year, month, day] = dateString.split("-");
  return `${day}/${month}/${year}`;
}

function parseDateFromInput(dateString) {
  if (!dateString) return null;
  const [year, month, day] = dateString.split("-").map(Number);
  // This creates the Date object in the UTC timezone, preventing timezone shift issues.
  return new Date(Date.UTC(year, month - 1, day));
}

// MODIFIED: The function now accepts hotelName as an argument instead of hardcoding it.
function generateReportTitle(selected, hotelName = "Your Hotel") {
  let title = `${hotelName} Report`;
  if (
    selected &&
    selected.market &&
    selected.hotel &&
    selected.market.length > 0 &&
    selected.hotel.length > 0
  ) {
    title += " vs The Market";
  }
  return title;
}

// MODIFIED: The function now accepts the dynamic propertyName.
function exportToCSV(propertyName) {
  const table = document.querySelector("#report-results-container table");
  if (!table) {
    alert("No report table found to export.");
    return;
  }
  // MODIFIED: Pass the propertyName to generate a dynamic title.
  const reportTitle = window.generateReportTitle(
    window.getSelectedColumnsForExport(),
    propertyName
  );
  const fileName = `${reportTitle
    .replace(/[^a-z0-9]/gi, "-")
    .toLowerCase()}.csv`;
  let csv = [];
  const headers = Array.from(table.querySelectorAll("thead th"))
    .map((th) => `"${th.textContent.trim()}"`)
    .join(",");
  csv.push(headers);
  const rows = table.querySelectorAll("tbody tr");
  rows.forEach((row) => {
    const rowData = Array.from(row.querySelectorAll("th, td"))
      .map((cell) => `"${cell.textContent.trim().replace(/"/g, '""')}"`)
      .join(",");
    csv.push(rowData);
  });
  const csvString = csv.join("\n");
  const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", fileName);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// MODIFIED: The function now accepts the dynamic propertyName.
function exportToExcel(propertyName) {
  const table = document.querySelector("#report-results-container table");
  if (!table) {
    alert("No report table found to export.");
    return;
  }
  // MODIFIED: Pass the propertyName to generate a dynamic title.
  const reportTitle = window.generateReportTitle(
    window.getSelectedColumnsForExport(),
    propertyName
  );
  const fileName = `${reportTitle
    .replace(/[^a-z0-9]/gi, "-")
    .toLowerCase()}.xlsx`;

  // Convert the HTML table to a worksheet object
  const ws = XLSX.utils.table_to_sheet(table);

  // Create a new workbook and append the worksheet
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Report");

  // Generate the .xlsx file and trigger the download
  XLSX.writeFile(wb, fileName);
}

// public/app/reports.js
// public/app/reports.js

function formatValue(value, columnName, isDelta = false, currencyCode = "USD") {
  if (typeof value !== "number" || isNaN(value)) return "-";
  const lowerCaseCol = columnName.toLowerCase();
  const sign = isDelta ? (value >= 0 ? "+" : "") : "";
  const colorClass = isDelta
    ? value >= 0
      ? "text-green-600"
      : "text-red-600"
    : "";

  let formattedValue;
  if (lowerCaseCol.includes("occupancy")) {
    const points = (value * 100).toFixed(1);
    formattedValue = isDelta ? `${sign}${points}pts` : `${points}%`;
  } else if (
    lowerCaseCol.includes("revenue") ||
    lowerCaseCol.includes("adr") ||
    lowerCaseCol.includes("revpar")
  ) {
    const options = {
      style: "currency",
      currency: currencyCode,
    };

    if (lowerCaseCol.includes("revenue")) {
      options.minimumFractionDigits = 0;
      options.maximumFractionDigits = 0;
    } else if (
      lowerCaseCol.includes("adr") ||
      lowerCaseCol.includes("revpar")
    ) {
      options.minimumFractionDigits = 1;
      options.maximumFractionDigits = 1;
    }

    try {
      // This new logic separates the currency symbol from the number.
      const formatter = new Intl.NumberFormat("en-GB", options);
      const parts = formatter.formatToParts(Math.abs(value));

      let currencySymbol = "";
      let numberValue = "";

      for (const part of parts) {
        if (part.type === "currency") {
          currencySymbol = part.value;
        } else {
          // This combines all other parts (integer, decimal, comma separators).
          numberValue += part.value;
        }
      }

      // Reconstruct the string with a space in between.
      formattedValue = `${sign}${currencySymbol} ${numberValue.trim()}`;
    } catch (e) {
      formattedValue = `${sign}${currencyCode} ${Math.abs(value).toFixed(
        options.minimumFractionDigits
      )}`;
    }
  } else {
    formattedValue = sign + value.toLocaleString("en-GB");
  }
  return `<span class="${colorClass}">${formattedValue}</span>`;
}

function handleFrequencyChange() {
  const timeSelect = document.getElementById("schedule-time");
  if (!timeSelect) return;
  timeSelect.innerHTML = "";
  // Add the standard, permanent options.
  ["08:00", "16:00"].forEach((time) => {
    const option = document.createElement("option");
    option.value = time;
    option.textContent = time + " UTC";
    timeSelect.appendChild(option);
  });
}

// --- RENDERING ENGINE ---
// public/app/reports.js
// public/app/reports.js

// This function is updated to handle both 'metric' and 'source' display orders.
// This function is updated with advanced logic to place separators correctly.
function buildTableHeaders(selected, addComparisons, displayOrder, component) {
  const { includeTaxes, propertyTaxRate, propertyTaxName } = component;
  const taxLabel = includeTaxes ? "Gross" : "Net";
  let tooltipText = "Values are exclusive of any taxes (net)";
  if (includeTaxes) {
    const ratePercent = (propertyTaxRate * 100).toFixed(0);
    tooltipText = `Values are inclusive of ${
      propertyTaxName || "Tax"
    } @ ${ratePercent}% (gross)`;
  }
  const svgIcon = `<svg class="inline-block h-3 w-3 -mt-0.5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path></svg>`;
  const createFinancialLabel = (metric) => {
    return `${metric.toUpperCase()} (${taxLabel}) <span class="tooltip">${svgIcon}<span class="tooltip-text">${tooltipText}</span></span>`;
  };
  const financialMetrics = new Set(["ADR", "RevPAR", "Total Revenue"]);
  let headers = [{ label: "Date", align: "left", key: "date" }];
  const { hotel: hotelMetrics, market: marketMetrics } = selected;
  const hotelMetricsSet = new Set(hotelMetrics);
  const marketMetricsSet = new Set(marketMetrics);
  const masterOrder = [
    "Rooms Sold",
    "Rooms Unsold",
    "Occupancy",
    "ADR",
    "RevPAR",
    "Total Revenue",
  ];

  // --- REFACTORED LOGIC ---
  // First, we build the individual groups of headers.
  let hotelHeaders = [];
  let marketHeaders = [];
  let deltaHeaders = [];

  masterOrder.forEach((metric) => {
    const isHotelMetricSelected = hotelMetricsSet.has(metric);
    const isMarketMetricSelected = marketMetricsSet.has(`Market ${metric}`);
    if (isHotelMetricSelected) {
      const label = financialMetrics.has(metric)
        ? createFinancialLabel(metric)
        : metric.toUpperCase();
      hotelHeaders.push({ label: label, key: metric });
    }
    if (isMarketMetricSelected) {
      const marketKey = `Market ${metric}`;
      const label = financialMetrics.has(metric)
        ? `MKT ${createFinancialLabel(metric)}`
        : `MKT ${metric.toUpperCase()}`;
      marketHeaders.push({ label: label, key: marketKey });
    }
    if (addComparisons && isHotelMetricSelected && isMarketMetricSelected) {
      deltaHeaders.push({ label: `DELTA (${metric})`, key: `${metric}_delta` });
    }
  });

  // Now, we assemble the final headers array based on the displayOrder.
  if (displayOrder === "source") {
    // For "Group by Source", we add borders between the main groups.
    if (addComparisons) {
      // Add a border after the last hotel metric, if there are market/delta columns following.
      if (
        hotelHeaders.length > 0 &&
        (marketHeaders.length > 0 || deltaHeaders.length > 0)
      ) {
        hotelHeaders[hotelHeaders.length - 1].separator = true;
      }
      // Add a border after the last market metric, if there are delta columns following.
      if (marketHeaders.length > 0 && deltaHeaders.length > 0) {
        marketHeaders[marketHeaders.length - 1].separator = true;
      }
    }
    headers.push(...hotelHeaders, ...marketHeaders, ...deltaHeaders);
  } else {
    // For "Group by Metric"
    masterOrder.forEach((metric) => {
      const metricGroup = [];
      const hotelHeader = hotelHeaders.find((h) => h.key === metric);
      if (hotelHeader) metricGroup.push(hotelHeader);

      const marketHeader = marketHeaders.find(
        (h) => h.key === `Market ${metric}`
      );
      if (marketHeader) metricGroup.push(marketHeader);

      const deltaHeader = deltaHeaders.find((h) => h.key === `${metric}_delta`);
      if (deltaHeader) metricGroup.push(deltaHeader);

      // Add a border to the end of the group, but only if comparisons are on.
      if (addComparisons && metricGroup.length > 0) {
        metricGroup[metricGroup.length - 1].separator = true;
      }
      headers.push(...metricGroup);
    });

    // This ensures the very last column in the table never has a border.
    if (headers.length > 1) {
      const lastHeader = headers[headers.length - 1];
      if (lastHeader.separator) {
        delete lastHeader.separator;
      }
    }
  }

  return headers.map((h) => ({ align: "right", ...h }));
}
// public/app/reports.js
function buildTableBody(data, headers, component) {
  const { includeTaxes, currencyCode } = component;

  return data
    .map((row, index) => {
      const cells = headers.map((header) => {
        let content = "";
        const key = header.key; // e.g., "ADR", "Market Occupancy", "Rooms Sold"

        const isMarket = key.startsWith("Market ");
        const prefix = isMarket ? "market" : "your";
        let baseMetricKey = isMarket ? key.substring(7) : key;

        if (baseMetricKey.startsWith("Market ")) {
          baseMetricKey = baseMetricKey.substring(7);
        }

        let value;

        // --- THE FIX: This switch now correctly handles all cases ---
        switch (baseMetricKey) {
          case "Rooms Sold":
            // Correctly uses the dynamic prefix for 'your_rooms_sold'
            value = row[`${prefix}_rooms_sold`];
            content = formatValue(
              parseFloat(value),
              baseMetricKey,
              false,
              currencyCode
            );
            break;
          case "Rooms Unsold":
            // Correctly uses the dynamic prefix for both properties
            const unsold =
              (row[`${prefix}_capacity_count`] || 0) -
              (row[`${prefix}_rooms_sold`] || 0);
            content = formatValue(unsold, baseMetricKey, false, currencyCode);
            break;
          case "Occupancy":
            value =
              prefix === "your"
                ? row[`your_occupancy_direct`]
                : row[`market_occupancy`];
            content = formatValue(
              parseFloat(value),
              baseMetricKey,
              false,
              currencyCode
            );
            break;
          case "ADR":
            value = includeTaxes
              ? row[`${prefix}_gross_adr`]
              : row[`${prefix}_net_adr`];
            content = formatValue(
              parseFloat(value),
              baseMetricKey,
              false,
              currencyCode
            );
            break;
          case "RevPAR":
            value = includeTaxes
              ? row[`${prefix}_gross_revpar`]
              : row[`${prefix}_net_revpar`];
            content = formatValue(
              parseFloat(value),
              baseMetricKey,
              false,
              currencyCode
            );
            break;
          case "Total Revenue":
            value = includeTaxes
              ? row[`${prefix}_gross_revenue`]
              : row[`${prefix}_net_revenue`];
            content = formatValue(
              parseFloat(value),
              baseMetricKey,
              false,
              currencyCode
            );
            break;
          default:
            if (key.endsWith("_delta")) {
              const deltaBaseMetric = key.replace("_delta", "").toLowerCase();
              let yourValue, marketValue;

              if (deltaBaseMetric === "occupancy") {
                yourValue = row["your_occupancy_direct"] || 0;
                marketValue = row["market_occupancy"] || 0;
              } else {
                const yourKey = includeTaxes
                  ? `your_gross_${deltaBaseMetric}`
                  : `your_net_${deltaBaseMetric}`;
                const marketKey = includeTaxes
                  ? `market_gross_${deltaBaseMetric}`
                  : `market_net_${deltaBaseMetric}`;
                yourValue = row[yourKey] || 0;
                marketValue = row[marketKey] || 0;
              }

              content = formatValue(
                parseFloat(yourValue) - parseFloat(marketValue),
                deltaBaseMetric,
                true,
                currencyCode
              );
            } else if (key === "date") {
              content = formatDateForDisplay(row.date);
            }
            break;
        }

        const isDate = key === "date";
        const alignClass = isDate
          ? "font-medium text-left"
          : "font-normal text-right";
        const cellTag = isDate ? "th" : "td";

        return `<${cellTag} class="px-4 py-4 whitespace-nowrap text-sm ${alignClass} ${
          header.separator ? "border-r border-slate-300" : ""
        }">${content || "-"}</${cellTag}>`;
      });

      return `<tr class="${
        index % 2 === 0 ? "bg-white" : "bg-slate-50/50"
      } hover:bg-slate-50 transition-colors">${cells.join("")}</tr>`;
    })
    .join("");
}

function buildTableTotalsRow(data, headers, component) {
  const { includeTaxes, currencyCode } = component;
  const totals = {};
  const avgKeys = new Set([
    "your_occupancy_direct",
    "market_occupancy",
    "your_net_adr",
    "your_gross_adr",
    "your_net_revpar",
    "your_gross_revpar",
    "market_net_adr",
    "market_gross_adr",
    "market_net_revpar",
    "market_gross_revpar",
  ]);

  data.forEach((row) => {
    for (const key in row) {
      if (key !== "date") {
        const val = parseFloat(row[key]) || 0;
        totals[key] = (totals[key] || 0) + val;
      }
    }
  });

  if (data.length > 0) {
    for (const key in totals) {
      if (avgKeys.has(key)) {
        totals[key] /= data.length;
      }
    }
  }

  const cells = headers.map((header) => {
    let content = "";
    const key = header.key;

    if (key === "date") {
      content = "Totals / Averages";
    } else if (key.endsWith("_delta")) {
      const baseMetric = key.replace("_delta", "").toLowerCase();
      let yourValue, marketValue;

      if (baseMetric === "occupancy") {
        yourValue = totals["your_occupancy_direct"] || 0;
        marketValue = totals["market_occupancy"] || 0;
      } else {
        const yourKey = includeTaxes
          ? `your_gross_${baseMetric}`
          : `your_net_${baseMetric}`;
        const marketKey = includeTaxes
          ? `market_gross_${baseMetric}`
          : `market_net_${baseMetric}`;
        yourValue = totals[yourKey] || 0;
        marketValue = totals[marketKey] || 0;
      }
      content = formatValue(
        yourValue - marketValue,
        baseMetric,
        true,
        currencyCode
      );
    } else {
      const isMarket = key.startsWith("Market ");
      const prefix = isMarket ? "market" : "your";
      const baseMetricKey = isMarket ? key.substring(7) : key;
      let value;

      switch (baseMetricKey) {
        case "Rooms Sold":
          value = totals[`${prefix}_rooms_sold`];
          break;
        case "Rooms Unsold":
          value =
            (totals[`${prefix}_capacity_count`] || 0) -
            (totals[`${prefix}_rooms_sold`] || 0);
          break;
        case "Occupancy":
          // THE FIX: Use the correct property name for market occupancy
          value =
            prefix === "your"
              ? totals["your_occupancy_direct"]
              : totals["market_occupancy"];
          break;
        case "ADR":
          value = includeTaxes
            ? totals[`${prefix}_gross_adr`]
            : totals[`${prefix}_net_adr`];
          break;
        case "RevPAR":
          value = includeTaxes
            ? totals[`${prefix}_gross_revpar`]
            : totals[`${prefix}_net_revpar`];
          break;
        case "Total Revenue":
          value = includeTaxes
            ? totals[`${prefix}_gross_revenue`]
            : totals[`${prefix}_net_revenue`];
          break;
      }
      content = formatValue(value, key, false, currencyCode);
    }

    const alignClass =
      key === "date" ? "font-semibold text-left" : "font-semibold text-right";
    return `<td class="px-4 py-3 whitespace-nowrap text-sm ${alignClass} ${
      header.separator ? "border-r border-slate-300" : ""
    }">${content}</td>`;
  });
  return `<tr class="bg-slate-100">${cells.join("")}</tr>`;
}
// public/app/reports.js

function renderReportTable(
  data,
  selected,
  granularity,
  addComparisons,
  displayOrder,
  component // Receive the full component state
) {
  const container = document.getElementById("report-results-container");
  if (!data || data.length === 0) {
    container.innerHTML =
      '<div class="bg-white rounded-xl border p-8 text-center text-gray-500">No data available.</div>';
    return;
  }

  // Pass the component state to the header builder
  const headers = buildTableHeaders(
    selected,
    addComparisons,
    displayOrder,
    component
  );

  // Pass the component state to the body builder
  let bodyRows = buildTableBody(data, headers, component);

  if (component.displayTotals) {
    // The totals row function will need its own logic for tax calculation, which we can add next if this works.
    // For now, let's focus on the main body.
    bodyRows += buildTableTotalsRow(data, headers, component);
  }

  // MODIFIED: Use the property name from the component state for the on-screen caption.
  const dynamicTitle = generateReportTitle(selected, component.propertyName);
  // - The outer div now only handles the full-width top border.
  // - A new inner div has been added with horizontal padding (px-4) and the overflow-x-auto
  //   to ensure the table has space on the sides and scrolls correctly.
  const tableHTML = `
    <div class="bg-white border-t border-gray-200">
      <div class="overflow-x-auto px-4 md:px-8">
        <table class="min-w-full">
          <caption class="text-left py-4 bg-white">
            <p class="text-sm font-semibold text-slate-600">Displaying <strong>${
              granularity.charAt(0).toUpperCase() + granularity.slice(1)
            }</strong> data from <strong>${formatDateForDisplay(
    data[0].date
  )}</strong> to <strong>${formatDateForDisplay(
    data[data.length - 1].date
  )}</strong></p>
          </caption>
          <thead class="sticky top-0 bg-white">
            <tr>
              ${headers
                .map(
                  (h) =>
                    // We remove the specific padding from the header cells now,
                    // as the new parent div is handling it.
                    // Added a check for h.isMarket to apply a subtle background color.
                    `<th class="py-3 px-4 text-left text-xs font-semibold text-[#a3a5a7] uppercase tracking-wider ${
                      h.align === "right" ? "text-right" : ""
                    } ${h.separator ? "border-r border-slate-300" : ""}">${
                      h.label
                    }</th>`
                )
                .join("")}
            </tr>
          </thead>
          <tbody class="text-[#3e4046]">${bodyRows}</tbody>
        </table>
      </div>
    </div>`;
  container.innerHTML = tableHTML;
}

// --- Expose functions on the window object ---
window.generateReportTitle = generateReportTitle;
window.formatDateForInput = formatDateForInput;
window.formatDateForDisplay = formatDateForDisplay;
window.parseDateFromInput = parseDateFromInput;
window.exportToCSV = exportToCSV;
window.exportToExcel = exportToExcel;
window.formatValue = formatValue;
window.handleFrequencyChange = handleFrequencyChange;
window.renderReportTable = renderReportTable;
window.handlePresetChange = handlePresetChange;
window.handleGenerateReport = handleGenerateReport;

// --- NEW LIVE SCHEDULE FUNCTIONS ---
window.fetchSchedules = fetchSchedules;
window.saveSchedule = saveSchedule;
window.deleteSchedule = deleteSchedule;

// Helper for the export function
window.getSelectedColumnsForExport = () => {
  const selected = { hotel: [], market: [] };
  document
    .querySelectorAll(
      '#report-options-container input[type="checkbox"]:checked'
    )
    .forEach((checkbox) => {
      const key = checkbox.dataset.metricKey;
      if (!key) return;
      if (key.startsWith("Market")) {
        selected.market.push(key);
      } else {
        selected.hotel.push(key);
      }
    });
  return selected;
};
