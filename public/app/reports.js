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
// public/app/reports.js

function handlePresetChange(preset) {
  // --- START DEBUGGING BLOCK ---
  console.clear(); // Clears the console for a clean view

  const localToday = new Date();

  const year = localToday.getFullYear();
  const month = localToday.getMonth();
  const day = localToday.getDate();

  const today = new Date(Date.UTC(year, month, day));

  let startDate, endDate;
  const dayOfWeek = today.getUTCDay() === 0 ? 6 : today.getUTCDay() - 1; // Monday is 0

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

  // This function's only job is to set the date inputs.
  document.getElementById("start-date").value = formatDateForInput(startDate);
  document.getElementById("end-date").value = formatDateForInput(endDate);

  // --- END DEBUGGING BLOCK ---
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

  if (!component.propertyId) {
    alert("Cannot save schedule: No property is currently selected.");
    return;
  }

  const selectedColumns = getSelectedColumns();

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

function buildTableHeaders(selected, addComparisons, displayOrder, component) {
  const { includeTaxes, propertyTaxRate, propertyTaxName } = component;
  const taxLabel = includeTaxes ? "Gross" : "Net";

  // Build the new dynamic tooltip text
  let tooltipText = "Values are exclusive of any taxes (net)";
  if (includeTaxes) {
    const ratePercent = (propertyTaxRate * 100).toFixed(0);
    tooltipText = `Values are inclusive of ${
      propertyTaxName || "Tax"
    } @ ${ratePercent}% (gross)`;
  }

  // This is a simple, filled SVG icon for the tooltip
  const svgIcon = `<svg class="inline-block h-3 w-3 -mt-0.5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path></svg>`;

  const createFinancialLabel = (metric) => {
    return `${metric.toUpperCase()} (${taxLabel}) <span class="tooltip">${svgIcon}<span class="tooltip-text">${tooltipText}</span></span>`;
  };

  // The rest of the function remains the same logic as before...
  const financialMetrics = new Set(["ADR", "RevPAR", "Total Revenue"]);
  let headers = [{ label: "Date", align: "left", key: "date" }];
  const { hotel: hotelMetrics, market: marketMetrics } = selected;
  const hotelMetricsSet = new Set(hotelMetrics);
  const masterOrder = [
    "Rooms Sold",
    "Rooms Unsold",
    "Occupancy",
    "ADR",
    "RevPAR",
    "Total Revenue",
  ];

  masterOrder.forEach((metric) => {
    if (hotelMetricsSet.has(metric)) {
      const label = financialMetrics.has(metric)
        ? createFinancialLabel(metric)
        : metric.toUpperCase();
      headers.push({ label: label, key: metric, separator: !addComparisons });
    }
    if (addComparisons && marketMetrics.includes(`Market ${metric}`)) {
      const marketKey = `Market ${metric}`;
      const label = financialMetrics.has(metric)
        ? `MKT ${createFinancialLabel(metric)}`
        : `MKT ${metric.toUpperCase()}`;
      headers.push({ label: label, key: marketKey });
      if (hotelMetricsSet.has(metric)) {
        headers.push({
          label: "DELTA",
          key: `${metric}_delta`,
          separator: true,
        });
      } else {
        headers[headers.length - 1].separator = true;
      }
    }
  });

  if (headers.length > 1) headers[headers.length - 1].separator = false;
  return headers.map((h) => ({ align: "right", ...h }));
}
// public/app/reports.js
// public/app/reports.js
// public/app/reports.js

// FIXED: This is the final, correct version of the body rendering logic.
function buildTableBody(data, headers, component) {
  const { includeTaxes, propertyTaxRate, propertyTaxType, currencyCode } =
    component;
  const financialKeys = new Set([
    "ADR",
    "RevPAR",
    "Total Revenue",
    "Market ADR",
    "Market RevPAR",
    "Market Total Revenue",
  ]);

  return data
    .map((row, index) => {
      const cells = headers.map((header) => {
        let value = row[header.key];
        if (
          !includeTaxes &&
          financialKeys.has(header.key) &&
          propertyTaxType === "inclusive" &&
          propertyTaxRate > 0
        ) {
          if (typeof value === "number") {
            value = value / (1 + propertyTaxRate);
          }
        }

        let content;
        if (header.key === "date") {
          content = formatDateForDisplay(row.date);
        } else if (header.key.endsWith("_delta")) {
          const baseMetric = header.key.replace("_delta", "");
          let yourValue = row[baseMetric] || 0;
          let marketValue = row[`Market ${baseMetric}`] || 0;
          if (
            !includeTaxes &&
            financialKeys.has(baseMetric) &&
            propertyTaxType === "inclusive" &&
            propertyTaxRate > 0
          ) {
            yourValue = yourValue / (1 + propertyTaxRate);
            marketValue = marketValue / (1 + propertyTaxRate);
          }
          content = formatValue(
            yourValue - marketValue,
            baseMetric,
            true,
            currencyCode
          );
        } else {
          content = formatValue(value, header.key, false, currencyCode);
        }
        const alignClass =
          header.key === "date"
            ? "font-data text-gray-700 font-medium"
            : "font-data";
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

// public/app/reports.js

// FIXED: Final, correct version of the totals row logic.
function buildTableTotalsRow(data, headers, component) {
  const { includeTaxes, propertyTaxRate, propertyTaxType, currencyCode } =
    component;
  const financialKeys = new Set([
    "ADR",
    "RevPAR",
    "Total Revenue",
    "Market ADR",
    "Market RevPAR",
    "Market Total Revenue",
  ]);
  const avgKeys = new Set([
    "Occupancy",
    "ADR",
    "RevPAR",
    "Market Occupancy",
    "Market ADR",
    "Market RevPAR",
  ]);

  const totals = {};
  headers.forEach((h) => {
    if (h.key !== "date" && !h.key.endsWith("_delta")) {
      totals[h.key] = data.reduce((sum, row) => sum + (row[h.key] || 0), 0);
      if (avgKeys.has(h.key) && data.length > 0) {
        totals[h.key] /= data.length;
      }
    }
  });

  const cells = headers.map((header) => {
    let value = totals[header.key];
    if (
      !includeTaxes &&
      financialKeys.has(header.key) &&
      propertyTaxType === "inclusive" &&
      propertyTaxRate > 0
    ) {
      if (typeof value === "number") value = value / (1 + propertyTaxRate);
    }

    let content = "";
    if (header.key === "date") {
      content = "Totals / Averages";
    } else if (header.key.endsWith("_delta")) {
      const baseMetric = header.key.replace("_delta", "");
      let yourTotal = totals[baseMetric] || 0;
      let marketTotal = totals[`Market ${baseMetric}`] || 0;
      if (
        !includeTaxes &&
        propertyTaxType === "inclusive" &&
        propertyTaxRate > 0
      ) {
        if (financialKeys.has(baseMetric))
          yourTotal = yourTotal / (1 + propertyTaxRate);
        if (financialKeys.has(`Market ${baseMetric}`))
          marketTotal = marketTotal / (1 + propertyTaxRate);
      }
      content = formatValue(
        yourTotal - marketTotal,
        baseMetric,
        true,
        currencyCode
      );
    } else if (value !== undefined) {
      content = formatValue(value, header.key, false, currencyCode);
    }

    const alignClass =
      header.key === "date"
        ? "font-data text-slate-800 text-left"
        : "font-data text-slate-800 text-right";
    const separatorClass = header.separator ? "border-r border-slate-200" : "";
    return `<td class="px-4 py-3 whitespace-nowrap text-sm font-semibold ${alignClass} ${separatorClass}">${content}</td>`;
  });
  return `<tr class="bg-slate-100 border-t-2 border-slate-300">${cells.join(
    ""
  )}</tr>`;
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
