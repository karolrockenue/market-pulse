document.addEventListener("DOMContentLoaded", () => {
  const generateBtn = document.getElementById("generate-report-btn");
  const granularityGroup = document.getElementById("granularity-group");
  const presetToggles = document.querySelectorAll(".preset-toggle");

  generateBtn.addEventListener("click", handleGenerateReport);

  granularityGroup.addEventListener("click", (e) => {
    if (e.target.tagName === "BUTTON") handleGranularityChange(e.target);
  });

  presetToggles.forEach((button) => {
    button.addEventListener("click", (e) => handlePresetChange(e.target));
  });

  handlePresetChange(document.querySelector('[data-preset="current-month"]'));
});

function handleGenerateReport() {
  const selectedColumns = getSelectedColumns();
  if (selectedColumns.length === 0) {
    document.getElementById("report-results-container").innerHTML = "";
    return;
  }

  const startDate = parseDateFromInput(
    document.getElementById("start-date").value
  );
  const endDate = parseDateFromInput(document.getElementById("end-date").value);
  const shouldDisplayTotals = document.getElementById(
    "display-totals-checkbox"
  ).checked;

  const mockData = [];
  let currentDate = new Date(startDate.getTime());

  const hasRoomsSold = selectedColumns.includes("Rooms Sold");
  const hasTotalRooms = selectedColumns.includes("Total Rooms");
  const hasRoomsUnsold = selectedColumns.includes("Rooms Unsold");
  const addRoomsUnsoldCalc = hasRoomsSold && hasTotalRooms && hasRoomsUnsold;

  const columnOrder = [
    "Stay Date",
    "Rooms Sold",
    "Rooms Unsold",
    "Total Rooms",
    "Occupancy",
    "ADR",
    "RevPAR",
    "Total Revenue",
    "Market Occupancy",
    "Market ADR",
    "Market RevPAR",
    "Market Revenue (Adjusted for Size)",
  ];

  while (currentDate <= endDate) {
    let rowData = {};
    selectedColumns.forEach((col) => {
      if (col !== "Rooms Unsold") {
        rowData[col] = generateMockValue(col);
      }
    });

    if (addRoomsUnsoldCalc) {
      rowData["Rooms Unsold"] = rowData["Total Rooms"] - rowData["Rooms Sold"];
    }

    let orderedRow = { "Stay Date": formatDateForInput(currentDate) };
    columnOrder.forEach((key) => {
      if (key !== "Stay Date" && rowData.hasOwnProperty(key)) {
        orderedRow[key] = rowData[key];
      }
    });

    mockData.push(orderedRow);
    currentDate.setDate(currentDate.getDate() + 1);
  }

  renderReportTable(mockData, shouldDisplayTotals);
}

function renderReportTable(data, shouldDisplayTotals) {
  const container = document.getElementById("report-results-container");
  if (!data || data.length === 0) {
    container.innerHTML =
      '<div class="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">No data to display.</div>';
    return;
  }

  const headers = Object.keys(data[0]);
  let totalsRowHTML = "";

  if (shouldDisplayTotals) {
    const totals = {};
    headers.forEach((h) => {
      if (h !== "Stay Date") totals[h] = 0;
    });

    data.forEach((row) => {
      for (const key in row) {
        if (key !== "Stay Date") totals[key] += row[key];
      }
    });

    // For metrics that should be averaged, not summed
    if (totals["Occupancy"])
      totals["Occupancy"] = totals["Occupancy"] / data.length;
    if (totals["ADR"]) totals["ADR"] = totals["ADR"] / data.length;
    if (totals["RevPAR"]) totals["RevPAR"] = totals["RevPAR"] / data.length;

    totalsRowHTML = `
        <tfoot class="bg-gray-100">
            <tr class="font-bold">
                ${headers
                  .map(
                    (h) =>
                      `<td class="px-6 py-4 whitespace-nowrap font-data">${
                        h === "Stay Date" ? "Totals" : formatValue(totals[h], h)
                      }</td>`
                  )
                  .join("")}
            </tr>
        </tfoot>
    `;
  }

  let tableHTML = `
        <div class="bg-white rounded-xl border border-gray-200">
            <h3 class="text-lg font-semibold text-gray-800 p-6">Generated Report</h3>
            <div class="overflow-x-auto">
                <table class="min-w-full text-sm">
                    <thead class="bg-gray-50">
                        <tr>
                            ${headers
                              .map(
                                (h) =>
                                  `<th class="px-6 py-3 text-left font-semibold text-gray-600">${h}</th>`
                              )
                              .join("")}
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        ${data
                          .map(
                            (row) => `
                            <tr>
                                ${headers
                                  .map(
                                    (h) =>
                                      `<td class="px-6 py-4 whitespace-nowrap font-data">${formatValue(
                                        row[h],
                                        h
                                      )}</td>`
                                  )
                                  .join("")}
                            </tr>
                        `
                          )
                          .join("")}
                    </tbody>
                    ${totalsRowHTML}
                </table>
            </div>
        </div>
    `;
  container.innerHTML = tableHTML;
}

function getSelectedColumns() {
  const columns = [];
  document
    .querySelectorAll('input[type="checkbox"]:checked')
    .forEach((checkbox) => {
      columns.push(checkbox.nextElementSibling.textContent);
    });
  return columns;
}

function generateMockValue(columnName) {
  const lowerCaseCol = columnName.toLowerCase();
  if (lowerCaseCol.includes("occupancy"))
    return Math.random() * (0.95 - 0.75) + 0.75;
  if (lowerCaseCol.includes("adr")) return Math.random() * (180 - 120) + 120;
  if (lowerCaseCol.includes("revpar")) return Math.random() * (150 - 90) + 90;
  if (lowerCaseCol.includes("revenue"))
    return Math.random() * (15000 - 9000) + 9000;
  if (lowerCaseCol.includes("total rooms")) return 13;
  if (lowerCaseCol.includes("rooms sold"))
    return Math.floor(Math.random() * (12 - 8) + 8);
  return 0;
}

function formatValue(value, columnName) {
  const lowerCaseCol = columnName.toLowerCase();
  if (typeof value !== "number") return value;

  if (
    lowerCaseCol.includes("revenue") ||
    lowerCaseCol.includes("adr") ||
    lowerCaseCol.includes("revpar")
  ) {
    return "$" + value.toFixed(2);
  }
  if (lowerCaseCol.includes("occupancy")) {
    return (value * 100).toFixed(1) + "%";
  }
  return Math.round(value);
}

function handleGranularityChange(clickedButton) {
  document
    .querySelectorAll(".control-btn[data-granularity]")
    .forEach((btn) => btn.classList.remove("active"));
  clickedButton.classList.add("active");
}

function handlePresetChange(clickedButton) {
  document
    .querySelectorAll(".control-btn[data-preset]")
    .forEach((btn) => btn.classList.remove("active"));
  clickedButton.classList.add("active");

  const preset = clickedButton.dataset.preset;
  const today = new Date();
  let startDate, endDate;

  if (preset === "current-month") {
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
  const d = new Date(date);
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateFromInput(dateString) {
  const parts = dateString.split("-");
  return new Date(parts[0], parts[1] - 1, parts[2]);
}
