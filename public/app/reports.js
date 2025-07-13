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
  const today = new Date();
  let startDate, endDate;
  const dayOfWeek = today.getDay() === 0 ? 6 : today.getDay() - 1; // Monday is 0, Sunday is 6
  if (preset === "current-week") {
    startDate = new Date(today);
    startDate.setDate(today.getDate() - dayOfWeek);
    endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
  } else if (preset === "last-week") {
    startDate = new Date(today);
    startDate.setDate(today.getDate() - dayOfWeek - 7);
    endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
  } else if (preset === "current-month") {
    startDate = new Date(today.getFullYear(), today.getMonth(), 1);
    endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  } else if (preset === "next-month") {
    startDate = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    endDate = new Date(today.getFullYear(), today.getMonth() + 2, 0);
  } else if (preset === "this-year") {
    startDate = new Date(today.getFullYear(), 0, 1);
    endDate = new Date(today.getFullYear(), 11, 31);
  } else {
    return; // No valid preset
  }
  document.getElementById("start-date").value = formatDateForInput(startDate);
  document.getElementById("end-date").value = formatDateForInput(endDate);
}

function handleGenerateReport(component) {
  const reportContainer = document.getElementById("report-results-container");
  const selectedColumns = getSelectedColumns(); // Use the local helper
  const allSelected = [...selectedColumns.hotel, ...selectedColumns.market];
  if (allSelected.length === 0) {
    reportContainer.innerHTML =
      '<div class="bg-white rounded-xl border p-8 text-center text-gray-500">Please select at least one metric.</div>';
    return;
  }
  const startDate = parseDateFromInput(
    document.getElementById("start-date").value
  );
  const endDate = parseDateFromInput(document.getElementById("end-date").value);
  const addComparisons = document.getElementById(
    "add-comparisons-toggle"
  )?.checked;
  const displayOrder = document.querySelector(
    'input[name="comparison-order"]:checked'
  )?.value;

  // Use the granularity from the component state passed as an argument
  const granularity = component.granularity;
  const shouldDisplayTotals = component.displayTotals;

  if (!startDate || !endDate || !granularity || !displayOrder) return;

  const mockData = generateMockData(
    startDate,
    endDate,
    allSelected,
    granularity
  );
  renderReportTable(
    mockData,
    selectedColumns,
    shouldDisplayTotals,
    granularity,
    addComparisons,
    displayOrder
  );
}

// --- PREVIOUSLY MOVED FUNCTIONS ---

function generateMockData(startDate, endDate, columns, granularity) {
  const dailyData = [];
  let currentDate = new Date(startDate.getTime());
  const capacity = 100;
  while (currentDate <= endDate) {
    let row = { date: formatDateForInput(currentDate) };
    const roomsSold = Math.floor(Math.random() * 20 + 75);
    const totalRevenue = (Math.random() * 60 + 120) * roomsSold;
    columns.forEach((col) => {
      row[col] = generateMockValue(col, { roomsSold, totalRevenue, capacity });
    });
    dailyData.push(row);
    currentDate.setDate(currentDate.getDate() + 1);
  }

  if (granularity === "daily") return dailyData;

  const aggregatedData = {};
  dailyData.forEach((row) => {
    let key;
    const rowDate = parseDateFromInput(row.date);
    if (granularity === "weekly") {
      const weekStart = new Date(rowDate);
      const day = rowDate.getDay();
      const diff = rowDate.getDate() - day + (day === 0 ? -6 : 1);
      weekStart.setDate(diff);
      key = formatDateForInput(weekStart);
    } else {
      key = row.date.substring(0, 7) + "-01";
    }
    if (!aggregatedData[key]) {
      aggregatedData[key] = { date: key, dayCount: 0 };
      columns.forEach((col) => (aggregatedData[key][col] = 0));
    }
    columns.forEach((col) => (aggregatedData[key][col] += row[col]));
    aggregatedData[key].dayCount++;
  });

  return Object.values(aggregatedData).map((row) => {
    const newRow = { date: row.date };
    columns.forEach((col) => {
      const lowerCol = col.toLowerCase();
      if (
        lowerCol.includes("occupancy") ||
        lowerCol.includes("adr") ||
        lowerCol.includes("revpar")
      ) {
        newRow[col] = row[col] / row.dayCount;
      } else {
        newRow[col] = row[col];
      }
    });
    return newRow;
  });
}

function generateMockValue(columnName, baseData) {
  const { roomsSold, totalRevenue, capacity } = baseData;
  const lowerCaseCol = columnName.toLowerCase();
  if (lowerCaseCol === "rooms sold") return roomsSold;
  if (lowerCaseCol === "total revenue") return totalRevenue;
  if (lowerCaseCol === "occupancy") return roomsSold / capacity;
  if (lowerCaseCol === "adr")
    return roomsSold > 0 ? totalRevenue / roomsSold : 0;
  if (lowerCaseCol === "revpar") return totalRevenue / capacity;
  if (lowerCaseCol === "rooms unsold") return capacity - roomsSold;
  const marketFactor = Math.random() * 0.1 + 0.95;
  if (lowerCaseCol.includes("market")) {
    const baseMetricName = lowerCaseCol.replace("market ", "");
    return generateMockValue(baseMetricName, baseData) * marketFactor;
  }
  return 0;
}

function formatDateForInput(date) {
  if (!date) return "";
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
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
  return new Date(year, month - 1, day);
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
  ["8:00 AM", "4:00 PM"].forEach((time) => {
    const option = document.createElement("option");
    option.value = time;
    option.textContent = time;
    timeSelect.appendChild(option);
  });
}

function saveSchedule(component) {
  if (!component.newScheduleName) {
    alert("Please enter a name for the report.");
    return;
  }
  component.schedules.push({
    id: component.nextScheduleId++,
    name: component.newScheduleName,
    recipients: component.newScheduleRecipients,
    frequency: component.newScheduleFrequency,
    period: component.newSchedulePeriod,
  });
  component.newScheduleName = "";
  component.newScheduleRecipients = "";
  component.isScheduleModalOpen = false;
}

function deleteSchedule(component, id) {
  component.schedules = component.schedules.filter(
    (schedule) => schedule.id !== id
  );
}

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
window.generateMockData = generateMockData;
window.generateReportTitle = generateReportTitle;
window.formatDateForInput = formatDateForInput;
window.formatDateForDisplay = formatDateForDisplay;
window.parseDateFromInput = parseDateFromInput;
window.exportToCSV = exportToCSV;
window.formatValue = formatValue;
window.handleFrequencyChange = handleFrequencyChange;
window.saveSchedule = saveSchedule;
window.deleteSchedule = deleteSchedule;
window.renderReportTable = renderReportTable;
window.handlePresetChange = handlePresetChange; // Expose new function
window.handleGenerateReport = handleGenerateReport; // Expose new function

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
