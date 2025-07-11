// public/app/reports.js

document.addEventListener("DOMContentLoaded", () => {
  // --- Main Controls ---

  const granularityGroup = document.getElementById("granularity-group");
  const presetToggles = document.querySelectorAll("[data-preset]");
  const csvBtn = document.getElementById("csv-btn");

  // --- Scheduler & Manager Controls ---
  const openScheduleModalBtn = document.getElementById(
    "open-schedule-modal-btn"
  );
  const scheduleModal = document.getElementById("schedule-modal");
  const scheduleModalBackdrop = document.getElementById(
    "schedule-modal-backdrop"
  );
  const cancelScheduleBtn = document.getElementById("cancel-schedule-btn");
  const saveScheduleBtn = document.getElementById("save-schedule-btn");
  const scheduleFrequencySelect = document.getElementById("schedule-frequency");

  const manageSchedulesBtn = document.getElementById("manage-schedules-btn");
  const manageSchedulesModal = document.getElementById(
    "manage-schedules-modal"
  );
  const manageSchedulesModalBackdrop = document.getElementById(
    "manage-schedules-modal-backdrop"
  );
  const closeManageModalBtn = document.getElementById("close-manage-modal-btn");

  // --- Event Listeners ---

  if (csvBtn) csvBtn.addEventListener("click", exportToCSV);

  const cancelScheduleBtnClose = document.getElementById(
    "cancel-schedule-btn-close"
  );
  if (cancelScheduleBtnClose) {
    cancelScheduleBtnClose.addEventListener("click", closeScheduleModal);
  }

  if (granularityGroup) {
    granularityGroup.addEventListener("click", (e) => {
      if (e.target.tagName === "BUTTON") {
        granularityGroup
          .querySelectorAll("button")
          .forEach((btn) => btn.classList.remove("active"));
        e.target.classList.add("active");
        handleGenerateReport();
      }
    });
  }

  presetToggles.forEach((button) => {
    button.addEventListener("click", () => {
      handlePresetChange(button);
      handleGenerateReport();
    });
  });

  document
    .querySelectorAll(
      '#report-options-container input[type="checkbox"], #report-options-container input[type="radio"]'
    )
    .forEach((control) => {
      control.addEventListener("change", () => {
        const addComparisonsToggle = document.getElementById(
          "add-comparisons-toggle"
        );
        const comparisonOptions = document.getElementById(
          "comparison-display-options"
        );
        if (comparisonOptions) {
          comparisonOptions.disabled = !addComparisonsToggle.checked;
        }
        handleGenerateReport();
      });
    });

  if (openScheduleModalBtn) {
    openScheduleModalBtn.addEventListener("click", openScheduleModal);
  }
  if (cancelScheduleBtn) {
    cancelScheduleBtn.addEventListener("click", closeScheduleModal);
  }
  if (scheduleModalBackdrop) {
    scheduleModalBackdrop.addEventListener("click", closeScheduleModal);
  }
  if (saveScheduleBtn) {
    saveScheduleBtn.addEventListener("click", saveSchedule);
  }
  if (scheduleFrequencySelect) {
    scheduleFrequencySelect.addEventListener("change", handleFrequencyChange);
  }

  if (manageSchedulesBtn) {
    manageSchedulesBtn.addEventListener("click", openManageModal);
  }
  if (closeManageModalBtn) {
    closeManageModalBtn.addEventListener("click", closeManageModal);
  }
  if (manageSchedulesModalBackdrop) {
    manageSchedulesModalBackdrop.addEventListener("click", closeManageModal);
  }

  // --- Initial Load ---
  const defaultPreset = document.querySelector('[data-preset="current-month"]');
  if (defaultPreset) {
    handlePresetChange(defaultPreset);
    const addComparisonsToggle = document.getElementById(
      "add-comparisons-toggle"
    );
    const comparisonOptions = document.getElementById(
      "comparison-display-options"
    );
    if (comparisonOptions) {
      comparisonOptions.disabled = !addComparisonsToggle.checked;
    }
    handleGenerateReport();
  }
  updateScheduleCount();
});

// ==================================================================
// EXPORT FUNCTIONS
// ==================================================================

function exportToCSV() {
  const table = document.querySelector("#report-results-container table");
  if (!table) {
    alert("No report table found to export.");
    return;
  }

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

  const title = generateReportTitle(getSelectedColumns());
  const fileName = `${title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.csv`;
  link.setAttribute("download", fileName);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

async function exportToPDF(isLandscape = false) {
  const toggleBtn = document.getElementById("pdf-options-toggle-btn");
  const optionsMenu = document.getElementById("pdf-options-menu");
  const table = document.querySelector("#report-results-container table");

  if (!table) {
    alert("No report table found to export.");
    return;
  }

  optionsMenu.classList.add("hidden");
  const originalButtonContent = toggleBtn.innerHTML;
  toggleBtn.disabled = true;
  toggleBtn.innerHTML = `<svg class="animate-spin h-5 w-5 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;

  try {
    const pageStyles = document.querySelector("head style").innerHTML;
    const reportTitleText = generateReportTitle(getSelectedColumns());
    const reportDateRangeText =
      table.querySelector("caption p")?.textContent || "";
    const generationDate = new Date().toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const tableClone = table.cloneNode(true);
    tableClone.querySelector("caption")?.remove();

    // This is the new, robust logic
    const headerAbbreviations = {
      "Rooms Sold": "Rooms Sold",
      "Rooms Unsold": "Unsold",
      Occupancy: "Occ %",
      ADR: "ADR",
      RevPAR: "RevPAR",
      "Total Revenue": "Revenue",
      "Market Occupancy": "Mkt Occ %",
      "Market ADR": "Mkt ADR",
      Delta: "Δ",
    };

    tableClone.querySelectorAll("thead th").forEach((th) => {
      const fullText = th.textContent.trim();
      // Find the key that is included in the full header text
      const matchingKey = Object.keys(headerAbbreviations).find((key) =>
        fullText.includes(key)
      );
      if (matchingKey) {
        th.textContent = headerAbbreviations[matchingKey];
      }
    });
    // *** END NEW SECTION ***

    const tableHtml = tableClone.outerHTML;

    const logoSvg = `
      <svg class="h-10 w-auto text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="20" x2="12" y2="10"></line>
        <line x1="18" y1="20" x2="18" y2="4"></line>
        <line x1="6" y1="20" x2="6" y2="16"></line>
      </svg>
    `;

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            ${pageStyles}
            body { 
                background-color: white !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
            .report-container { 
                width: ${isLandscape ? "max-content" : "100%"}; 
                min-width: 100%;
            }
           table { 
    font-size: 7px; /* A single, small font size */
    table-layout: auto;
    width: 100%;
}
    th, td { 
    padding: 3px 5px; /* Reduced padding */
    white-space: nowrap; /* Prevent wrapping */
    word-wrap: normal;
}
                .totals-label {
    white-space: normal !important; 
}
            tbody .totals-row {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
          </style>
      </head>
      <body>
        <div class="p-8 report-container">
          <div class="flex justify-between items-start pb-4 mb-8 border-b">
            <div class="flex items-center">
              ${logoSvg}
              <div class="ml-4">
                <h1 class="text-xl font-bold text-gray-800">${reportTitleText}</h1>
                <p class="text-sm text-gray-500">${reportDateRangeText
                  .replace("Displaying", "")
                  .trim()}</p>
              </div>
            </div>
            <div class="text-right text-sm text-gray-600">
              <p>Generated On</p>
              <p class="font-semibold">${generationDate}</p>
            </div>
          </div>
          <div>${tableHtml}</div>
          <div class="text-center text-xs text-gray-400 mt-12 pt-4 border-t">
            <p>Generated by Market Pulse</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const response = await fetch("/api/export-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        htmlContent,
        reportTitle: reportTitleText,
        landscape: isLandscape,
      }),
    });

    if (!response.ok) {
      throw new Error(`Server responded with status: ${response.status}.`);
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = url;
    const safeTitle = reportTitleText.replace(/[^a-z0-9]/gi, "-").toLowerCase();
    a.download = `${safeTitle}-report.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  } catch (error) {
    console.error("PDF Export Failed:", error);
    alert("PDF Export Failed. Please check the console for details.");
  } finally {
    toggleBtn.disabled = false;
    toggleBtn.innerHTML = originalButtonContent;
  }
}

// ==================================================================
// SCHEDULER & MANAGER FUNCTIONS
// ==================================================================

function handleFrequencyChange() {
  const frequency = document.getElementById("schedule-frequency").value;
  const timeSelect = document.getElementById("schedule-time");

  document
    .getElementById("schedule-weekly-day-container")
    .classList.toggle("hidden", frequency !== "Weekly");
  document
    .getElementById("schedule-monthly-day-container")
    .classList.toggle("hidden", frequency !== "Monthly");

  timeSelect.innerHTML = "";
  const timeOptions = ["8:00 AM", "4:00 PM"];
  timeOptions.forEach((time) => {
    const option = document.createElement("option");
    option.value = time;
    option.textContent = time;
    timeSelect.appendChild(option);
  });
}

function openScheduleModal() {
  const modal = document.getElementById("schedule-modal");
  const modalBackdrop = document.getElementById("schedule-modal-backdrop");
  const activePresetButton = document.querySelector(
    ".control-btn.active[data-preset]"
  );
  const presetValue = activePresetButton
    ? activePresetButton.dataset.preset
    : "custom";
  const modalRadio = document.querySelector(
    `#modal-preset-group input[value="${presetValue}"]`
  );
  if (modalRadio) {
    modalRadio.checked = true;
  } else {
    document.querySelector(
      `#modal-preset-group input[value="custom"]`
    ).checked = true;
  }
  document.getElementById("schedule-name").value = "";
  document.getElementById("schedule-frequency").value = "Weekly";
  handleFrequencyChange();
  if (modal && modalBackdrop) {
    modal.classList.remove("hidden");
    modal.classList.add("flex");
    modalBackdrop.classList.remove("hidden");
  }
}

function closeScheduleModal() {
  const modal = document.getElementById("schedule-modal");
  const modalBackdrop = document.getElementById("schedule-modal-backdrop");
  if (modal && modalBackdrop) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
    modalBackdrop.classList.add("hidden");
  }
}

function openManageModal() {
  const modal = document.getElementById("manage-schedules-modal");
  const modalBackdrop = document.getElementById(
    "manage-schedules-modal-backdrop"
  );
  if (modal && modalBackdrop) {
    modal.classList.remove("hidden");
    modal.classList.add("flex");
    modalBackdrop.classList.remove("hidden");
  }
}

function closeManageModal() {
  const modal = document.getElementById("manage-schedules-modal");
  const modalBackdrop = document.getElementById(
    "manage-schedules-modal-backdrop"
  );
  if (modal && modalBackdrop) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
    modalBackdrop.classList.add("hidden");
  }
}

function updateScheduleCount() {
  const tbody = document.getElementById("scheduled-reports-tbody");
  if (!tbody) return;
  const badge = document.getElementById("schedule-count-badge");
  const noSchedulesRow = document.getElementById("no-schedules-row");
  const count = tbody.querySelectorAll("tr:not(#no-schedules-row)").length;
  if (badge) {
    if (count > 0) {
      badge.textContent = count;
      badge.classList.remove("hidden");
    } else {
      badge.classList.add("hidden");
    }
  }
  if (noSchedulesRow) {
    noSchedulesRow.classList.toggle("hidden", count > 0);
  }
}

function saveSchedule() {
  const name =
    document.getElementById("schedule-name").value || "Untitled Report";
  const frequency = document.getElementById("schedule-frequency").value;
  const time = document.getElementById("schedule-time").value;
  const recipients = document.getElementById("schedule-recipients").value;
  const selectedPresetInput = document.querySelector(
    '#modal-preset-group input[name="modal-preset"]:checked'
  );
  const datePreset = selectedPresetInput ? selectedPresetInput.value : "custom";
  const presetText = datePreset
    .replace(/-/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
  const tbody = document.getElementById("scheduled-reports-tbody");
  const newRow = document.createElement("tr");
  newRow.innerHTML = `
        <td class="px-6 py-4 whitespace-nowrap">
            <div class="text-sm font-semibold text-gray-900">${name}</div>
            <div class="text-xs text-gray-500">Recipients: ${
              recipients || "None"
            }</div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
            <div>${frequency} at ${time}</div>
            <div class="text-xs text-gray-500">For the: <strong>${presetText}</strong></div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
            <a href="#" class="text-red-600 hover:text-red-900 delete-schedule-btn">Delete</a>
        </td>
    `;
  tbody.appendChild(newRow);
  newRow
    .querySelector(".delete-schedule-btn")
    .addEventListener("click", function (e) {
      e.preventDefault();
      this.closest("tr").remove();
      updateScheduleCount();
    });
  updateScheduleCount();
  closeScheduleModal();
}
// ==================================================================
// REPORT GENERATION & RENDERING FUNCTIONS
// ==================================================================
function handleGenerateReport() {
  const reportContainer = document.getElementById("report-results-container");
  const selectedColumns = getSelectedColumns();
  const allSelected = [...selectedColumns.hotel, ...selectedColumns.market];

  if (allSelected.length === 0) {
    reportContainer.innerHTML =
      '<div class="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">Please select at least one metric to generate a report.</div>';
    return;
  }

  const startDate = parseDateFromInput(
    document.getElementById("start-date").value
  );
  const endDate = parseDateFromInput(document.getElementById("end-date").value);
  const shouldDisplayTotals = document.getElementById(
    "display-totals-checkbox"
  )?.checked;
  const granularity = document.querySelector("#granularity-group .active")
    ?.dataset.granularity;

  const addComparisons = document.getElementById(
    "add-comparisons-toggle"
  )?.checked;
  const displayOrder = document.querySelector(
    'input[name="comparison-order"]:checked'
  )?.value;

  if (!granularity || !displayOrder) return;

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

function generateReportTitle(selected) {
  const hotelName = "Rockenue Partner Account";
  let title = `${hotelName} Report`;
  if (selected.market.length > 0) {
    title += " vs The Market";
  }
  return title;
}

function getSelectedColumns() {
  const selected = { hotel: [], market: [] };
  const masterOrder = [
    "Rooms Sold",
    "Rooms Unsold",
    "Occupancy",
    "ADR",
    "RevPAR",
    "Total Revenue",
  ];
  const marketOrder = masterOrder.map((m) => `Market ${m}`);
  const allOrder = [...masterOrder, ...marketOrder];

  const selectedLabels = new Set();
  document
    .querySelectorAll(
      '#report-options-container input[type="checkbox"]:checked'
    )
    .forEach((checkbox) => {
      if (
        checkbox.nextElementSibling &&
        !checkbox.id.includes("display-totals") &&
        !checkbox.id.includes("include-taxes") &&
        !checkbox.id.includes("add-comparisons")
      ) {
        selectedLabels.add(checkbox.nextElementSibling.textContent);
      }
    });

  allOrder.forEach((label) => {
    if (selectedLabels.has(label)) {
      if (label.toLowerCase().includes("market")) {
        selected.market.push(label);
      } else {
        selected.hotel.push(label);
      }
    }
  });
  return selected;
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
      '<div class="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">No data available for the selected period.</div>';
    return;
  }

  const headers = buildTableHeaders(selected, addComparisons, displayOrder);
  let bodyRows = buildTableBody(data, headers);

  if (shouldDisplayTotals) {
    const totalsRowHtml = buildTableTotalsRow(data, headers);
    bodyRows += totalsRowHtml;
  }

  const dynamicTitle = generateReportTitle(selected);

  const tableHTML = `
    <div class="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table class="min-w-full">
            <caption class="text-left p-4 bg-white">
                <h3 class="text-lg font-semibold text-gray-800">${dynamicTitle}</h3>
                <p class="text-sm text-gray-500 mt-1">
                  Displaying <strong>${
                    granularity.charAt(0).toUpperCase() + granularity.slice(1)
                  }</strong> data from <strong>${formatDateForDisplay(
    data[0].date
  )}</strong> to <strong>${formatDateForDisplay(
    data[data.length - 1].date
  )}</strong>
                </p>
            </caption>
            <thead class="bg-white">
                <tr class="border-y border-gray-200">
                    ${headers
                      .map(
                        (h) =>
                          `<th class="px-4 py-2.5 text-left font-semibold text-gray-500 text-xs uppercase tracking-wider ${
                            h.separator ? "border-r border-slate-200" : ""
                          } ${h.align === "right" ? "text-right" : ""}">${
                            h.label
                          }</th>`
                      )
                      .join("")}
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">${bodyRows}</tbody>
        </table>
    </div>`;
  container.innerHTML = tableHTML;
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

  if (addComparisons) {
    masterOrder.forEach((metric) => {
      const hotelMetricLabel = metric;
      const marketMetricLabel = `Market ${metric}`;
      let lastAddedHeader = null; // Keep track of the last item in the group

      if (hotelMetricsSet.has(hotelMetricLabel)) {
        const header = {
          label: `YOUR ${metric.toUpperCase()}`,
          key: hotelMetricLabel,
        };
        headers.push(header);
        lastAddedHeader = header;
      }

      if (marketMetricsSet.has(marketMetricLabel)) {
        const header = {
          label: `MKT ${metric.toUpperCase()}`,
          key: marketMetricLabel,
        };
        headers.push(header);
        lastAddedHeader = header; // This is now the last column in the group

        if (hotelMetricsSet.has(hotelMetricLabel)) {
          const deltaHeader = { label: "DELTA", key: `${metric}_delta` };
          headers.push(deltaHeader);
          lastAddedHeader = deltaHeader; // The Delta is now the very last
        }
      }

      // After processing the entire metric group, mark the last column with a separator
      if (lastAddedHeader) {
        lastAddedHeader.separator = true;
      }
    });
  } else {
    // Fallback for when comparisons are off
    [...hotelMetrics, ...marketMetrics].forEach((metric) =>
      headers.push({
        label: metric.toUpperCase(),
        key: metric,
        separator: true,
      })
    );
  }

  // Clean up the trailing separator from the very last column in the table
  if (headers.length > 1 && headers[headers.length - 1].separator) {
    headers[headers.length - 1].separator = false;
  }

  // Ensure all data columns are right-aligned
  return headers.map((h) => ({ align: "right", ...h }));
}

function buildTableBody(data, headers) {
  return data
    .map((row, index) => {
      const cells = headers.map((header) => {
        let content;
        if (header.key === "date") {
          content = formatDateForDisplay(row.date);
        } else if (header.key.endsWith("_delta")) {
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
    if (!key.endsWith("_delta")) {
      totals[key] = data.reduce((sum, row) => sum + (row[key] || 0), 0);
    }
  });

  const avgMetrics = ["Occupancy", "ADR", "RevPAR"];
  allKeys.forEach((key) => {
    const baseMetric = key.replace("Market ", "");
    if (avgMetrics.includes(baseMetric)) {
      totals[key] /= data.length;
    }
  });

  const cells = headers.map((header) => {
    let content = "";
    if (header.key === "date") {
      content = "Totals / Averages";
    } else if (header.key.endsWith("_delta")) {
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
      weekStart.setDate(rowDate.getDate() - rowDate.getDay());
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
    const baseValue = generateMockValue(baseMetricName, baseData);
    return baseValue * marketFactor;
  }

  return 0;
}

function handlePresetChange(clickedButton) {
  document
    .querySelectorAll("[data-preset]")
    .forEach((btn) => btn.classList.remove("active"));
  clickedButton.classList.add("active");

  const preset = clickedButton.dataset.preset;
  const today = new Date();
  let startDate, endDate;

  const dayOfWeek = today.getDay() === 0 ? 6 : today.getDay() - 1;

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
  } else {
    startDate = new Date(today.getFullYear(), 0, 1);
    endDate = new Date(today.getFullYear(), 11, 31);
  }

  document.getElementById("start-date").value = formatDateForInput(startDate);
  document.getElementById("end-date").value = formatDateForInput(endDate);
}

function formatDateForInput(date) {
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
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}
