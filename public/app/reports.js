// public/app/reports.js

// --- HELPER for handleGenerateReport ---
// Kept private to this module, no need to expose on window
function getSelectedColumns() {
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
}

// --- CORE LOGIC MOVED FROM HTML ---
function handlePresetChange(preset) {
  // --- THIS IS THE FIX ---
  // We now create a date object representing the start of today in UTC.
  const localToday = new Date();
  const today = new Date(
    Date.UTC(
      localToday.getFullYear(),
      localToday.getMonth(),
      localToday.getDate()
    )
  );

  let startDate, endDate;

  // The day of the week is now also calculated based on UTC.
  const dayOfWeek = today.getUTCDay() === 0 ? 6 : today.getUTCDay() - 1; // Monday is 0, Sunday is 6

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
  } else {
    return; // No valid preset
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

    const selectedColumns = getSelectedColumns();
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
    const addComparisons = document.getElementById(
      "add-comparisons-toggle"
    )?.checked;
    const displayOrder = document.querySelector(
      'input[name="comparison-order"]:checked'
    )?.value;

    const granularity = component.granularity;
    const shouldDisplayTotals = component.displayTotals;

    if (!startDate || !endDate || !granularity || !displayOrder) return;

    const [yourData, marketData] = await Promise.all([
      fetchYourHotelMetrics(propertyId, startDate, endDate, granularity),
      fetchMarketMetrics(propertyId, startDate, endDate, granularity),
    ]);
    console.log("RAW 'Your Hotel' METRICS FROM SERVER:", yourData.metrics);
    const liveData = processAndMergeData(yourData.metrics, marketData.metrics);

    renderReportTable(
      liveData,
      selectedColumns,
      shouldDisplayTotals,
      granularity,
      addComparisons,
      displayOrder
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
  const processRow = (row) => {
    const date = (row.period || row.stay_date).substring(0, 10);
    if (!dataMap.has(date)) {
      dataMap.set(date, { date });
    }
    const entry = dataMap.get(date);
    const roomsSold = parseInt(row.rooms_sold, 10);
    const capacity = parseInt(row.capacity_count, 10);
    const roomsUnsold = capacity - roomsSold;

    const metrics = {
      Occupancy: parseFloat(row.occupancy_direct),
      ADR: parseFloat(row.adr),
      RevPAR: parseFloat(row.revpar),
      "Total Revenue": parseFloat(row.total_revenue),
      "Rooms Sold": roomsSold,
      "Rooms Unsold": roomsUnsold,
      "Market Occupancy": parseFloat(row.market_occupancy),
      "Market ADR": parseFloat(row.market_adr),
      "Market Total Revenue": parseFloat(row.market_total_revenue),
      "Market Rooms Sold": parseInt(row.market_rooms_sold, 10),
    };
    for (const key in metrics) {
      if (!isNaN(metrics[key])) {
        entry[key] = metrics[key];
      }
    }
  };
  yourData.forEach(processRow);
  marketData.forEach(processRow);
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

  // --- THIS IS THE FIX ---
  // We now correctly read the propertyId from the component's state.
  if (!component.propertyId) {
    alert("Cannot save schedule: No property is currently selected.");
    return;
  }

  const selectedColumns = getSelectedColumns();

  const payload = {
    propertyId: component.propertyId, // And include it in the payload.
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
  };

  const response = await fetch("/api/scheduled-reports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    alert("Failed to save the schedule. Please try again.");
    return;
  }

  const newSchedule = await response.json();
  component.schedules.push(newSchedule);

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

function generateReportTitle(selected) {
  const hotelName = "Rockenue Partner Account";
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

function exportToCSV() {
  const table = document.querySelector("#report-results-container table");
  if (!table) {
    alert("No report table found to export.");
    return;
  }
  const reportTitle = window.generateReportTitle(
    window.getSelectedColumnsForExport()
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

function exportToExcel() {
  const table = document.querySelector("#report-results-container table");
  if (!table) {
    alert("No report table found to export.");
    return;
  }
  const reportTitle = window.generateReportTitle(
    window.getSelectedColumnsForExport()
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

function formatValue(value, columnName, isDelta = false) {
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
    formattedValue =
      sign +
      Math.abs(value).toLocaleString("en-GB", {
        style: "currency",
        currency: "GBP",
        minimumFractionDigits: 2,
      });
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
function buildTableHeaders(selected, addComparisons, displayOrder) {
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
  if (!addComparisons) {
    masterOrder.forEach((metric) => {
      if (hotelMetricsSet.has(metric))
        headers.push({
          label: metric.toUpperCase(),
          key: metric,
          separator: true,
        });
      const marketMetric = `Market ${metric}`;
      if (marketMetricsSet.has(marketMetric))
        headers.push({
          label: marketMetric.toUpperCase(),
          key: marketMetric,
          separator: true,
        });
    });
  } else {
    if (displayOrder === "source") {
      hotelMetrics.forEach((metric) =>
        headers.push({
          label: metric.toUpperCase(),
          key: metric,
          separator: true,
        })
      );
      marketMetrics.forEach((metric) => {
        const baseMetric = metric.replace("Market ", "");
        headers.push({
          label: `MKT ${baseMetric.toUpperCase()}`,
          key: metric,
          separator: false,
        });
        if (hotelMetricsSet.has(baseMetric))
          headers.push({
            label: "DELTA",
            key: `${baseMetric}_delta`,
            separator: true,
          });
      });
    } else {
      masterOrder.forEach((metric) => {
        const hotelMetricLabel = metric;
        const marketMetricLabel = `Market ${metric}`;
        let groupHasContent = false;
        if (hotelMetricsSet.has(hotelMetricLabel)) {
          headers.push({
            label: `YOUR ${metric.toUpperCase()}`,
            key: hotelMetricLabel,
          });
          groupHasContent = true;
        }
        if (marketMetricsSet.has(marketMetricLabel)) {
          headers.push({
            label: `MKT ${metric.toUpperCase()}`,
            key: marketMetricLabel,
          });
          groupHasContent = true;
          if (hotelMetricsSet.has(hotelMetricLabel))
            headers.push({ label: "DELTA", key: `${metric}_delta` });
        }
        if (groupHasContent && headers.length > 1)
          headers[headers.length - 1].separator = true;
      });
    }
  }
  if (headers.length > 1) headers[headers.length - 1].separator = false;
  return headers.map((h) => ({ align: "right", ...h }));
}

function buildTableBody(data, headers) {
  return data
    .map((row, index) => {
      const cells = headers.map((header) => {
        let content;
        if (header.key === "date") content = formatDateForDisplay(row.date);
        else if (header.key.endsWith("_delta")) {
          const baseMetric = header.key.replace("_delta", "");
          const marketMetric = `Market ${baseMetric}`;
          const delta = (row[baseMetric] || 0) - (row[marketMetric] || 0);
          content = formatValue(delta, baseMetric, true);
        } else {
          content = formatValue(row[header.key], header.key);
        }
        const alignClass =
          header.key === "date" ? "text-gray-700 font-semibold" : "font-data";
        const separatorClass = header.separator
          ? "border-r border-slate-200"
          : "";
        return `<td class="px-4 py-3 whitespace-nowrap text-sm text-right ${alignClass} ${separatorClass}">${content}</td>`;
      });
      cells[0] = cells[0].replace("text-right", "text-left");
      return `<tr class="${
        index % 2 === 0 ? "bg-white" : "bg-slate-50/50"
      } hover:bg-blue-50">${cells.join("")}</tr>`;
    })
    .join("");
}

function buildTableTotalsRow(data, headers) {
  const totals = {};
  const allKeys = headers.map((h) => h.key).filter((k) => k !== "date");
  allKeys.forEach((key) => {
    if (!key.endsWith("_delta"))
      totals[key] = data.reduce((sum, row) => sum + (row[key] || 0), 0);
  });
  const avgMetrics = ["Occupancy", "ADR", "RevPAR"];
  allKeys.forEach((key) => {
    const baseMetric = key.replace("Market ", "");
    if (avgMetrics.includes(baseMetric)) totals[key] /= data.length;
  });
  const cells = headers.map((header) => {
    let content = "";
    if (header.key === "date") content = "Totals / Averages";
    else if (header.key.endsWith("_delta")) {
      const baseMetric = header.key.replace("_delta", "");
      const marketMetric = `Market ${baseMetric}`;
      const delta = (totals[baseMetric] || 0) - (totals[marketMetric] || 0);
      content = formatValue(delta, baseMetric, true);
    } else if (totals[header.key] !== undefined) {
      content = formatValue(totals[header.key], header.key);
    }
    const alignClass =
      header.key === "date"
        ? "text-slate-800 text-left totals-label"
        : "font-data text-slate-800 text-right";
    const separatorClass = header.separator ? "border-r border-slate-200" : "";
    return `<td class="px-4 py-3 whitespace-nowrap text-sm ${alignClass} ${separatorClass}">${content}</td>`;
  });
  return `<tr class="totals-row bg-slate-100 font-semibold border-t-2 border-slate-300">${cells.join(
    ""
  )}</tr>`;
}

function renderReportTable(
  data,
  selected,
  shouldDisplayTotals,
  granularity,
  addComparisons,
  displayOrder
) {
  const container = document.getElementById("report-results-container");
  if (!data || data.length === 0) {
    container.innerHTML =
      '<div class="bg-white rounded-xl border p-8 text-center text-gray-500">No data available.</div>';
    return;
  }
  const headers = buildTableHeaders(selected, addComparisons, displayOrder);
  let bodyRows = buildTableBody(data, headers);
  if (shouldDisplayTotals) {
    bodyRows += buildTableTotalsRow(data, headers);
  }
  const dynamicTitle = generateReportTitle(selected);
  const tableHTML = `
    <div class="bg-white rounded-xl border border-gray-200 overflow-x-auto">
      <table class="min-w-full">
        <caption class="text-left p-4 bg-white">
          <h3 class="text-lg font-semibold text-gray-800">${dynamicTitle}</h3>
          <p class="text-sm text-gray-500 mt-1">Displaying <strong>${
            granularity.charAt(0).toUpperCase() + granularity.slice(1)
          }</strong> data from <strong>${formatDateForDisplay(
    data[0].date
  )}</strong> to <strong>${formatDateForDisplay(
    data[data.length - 1].date
  )}</strong></p>
        </caption>
        <thead class="bg-white">
          <tr class="border-y border-gray-200">
            ${headers
              .map(
                (h) =>
                  `<th class="px-4 py-2.5 text-left font-semibold text-gray-500 text-xs uppercase tracking-wider ${
                    h.separator ? "border-r border-slate-200" : ""
                  } ${h.align === "right" ? "text-right" : ""}">${h.label}</th>`
              )
              .join("")}
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">${bodyRows}</tbody>
      </table>
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
