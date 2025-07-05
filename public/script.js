// script.js (Updated to use master date controls)

// A complete map of all fields available in Dataset 7, based on our discovery.
const DATASET_7_MAP = {
  // Booking Category
  adr: { name: "ADR", category: "Booking", type: "currency" },
  revpar: { name: "RevPAR", category: "Booking", type: "currency" },
  adults_count: { name: "Adults", category: "Booking", type: "number" },
  children_count: { name: "Children", category: "Booking", type: "number" },
  room_guest_count: {
    name: "Room Guest Count",
    category: "Booking",
    type: "number",
  },
  // Finance Category
  total_revenue: {
    name: "Total Revenue",
    category: "Finance",
    type: "currency",
  },
  room_revenue: {
    name: "Total Room Revenue",
    category: "Finance",
    type: "currency",
  },
  room_rate: { name: "Room Rate", category: "Finance", type: "currency" },
  misc_income: { name: "Misc. Income", category: "Finance", type: "currency" },
  room_taxes: { name: "Total Taxes", category: "Finance", type: "currency" },
  room_fees: { name: "Total Fees", category: "Finance", type: "currency" },
  additional_room_revenue: {
    name: "Other Room Revenue",
    category: "Finance",
    type: "currency",
  },
  non_room_revenue: {
    name: "Total Other Revenue",
    category: "Finance",
    type: "currency",
  },
  // Occupancy Category
  occupancy: {
    name: "Occupancy (Direct)",
    category: "Occupancy",
    type: "percent",
  },
  mfd_occupancy: {
    name: "Adjusted Occupancy",
    category: "Occupancy",
    type: "percent",
  },
  rooms_sold: { name: "Rooms Sold", category: "Occupancy", type: "number" },
  capacity_count: { name: "Capacity", category: "Occupancy", type: "number" },
  blocked_room_count: {
    name: "Blocked Rooms",
    category: "Occupancy",
    type: "number",
  },
  out_of_service_count: {
    name: "Out of Service Rooms",
    category: "Occupancy",
    type: "number",
  },
};

// Runs when the page loads to get the hotel's details.
document.addEventListener("DOMContentLoaded", () => {
  fetchHotelDetails();
});

// Fetches and displays the hotel's static information
async function fetchHotelDetails() {
  const detailsContainer = document.getElementById("hotel-details-card");
  if (!detailsContainer) return;
  detailsContainer.innerHTML = "<h2>Loading Hotel Details...</h2>";
  try {
    const response = await fetch("/api/hotel-details");
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message || "Failed to fetch hotel details");
    }
    const hotelData = result.data;
    const detailsMap = [
      { label: "Property Name", getValue: (d) => d.propertyName },
      { label: "Property Type", getValue: (d) => d.propertyType },
      {
        label: "Currency Code",
        getValue: (d) => d.propertyCurrency?.currencyCode,
      },
      {
        label: "Currency Symbol",
        getValue: (d) => d.propertyCurrency?.currencySymbol,
      },
      { label: "Primary Language", getValue: (d) => d.propertyPrimaryLanguage },
      {
        label: "Address 1",
        getValue: (d) => d.propertyAddress?.propertyAddress1,
      },
      {
        label: "Address 2",
        getValue: (d) => d.propertyAddress?.propertyAddress2,
      },
      { label: "City", getValue: (d) => d.propertyAddress?.propertyCity },
      { label: "State", getValue: (d) => d.propertyAddress?.propertyState },
      {
        label: "Zip/Postal Code",
        getValue: (d) => d.propertyAddress?.propertyZip,
      },
      { label: "Country", getValue: (d) => d.propertyAddress?.propertyCountry },
      {
        label: "Latitude",
        getValue: (d) => d.propertyAddress?.propertyLatitude,
      },
      {
        label: "Longitude",
        getValue: (d) => d.propertyAddress?.propertyLongitude,
      },
    ];
    let tableRows = "";
    detailsMap.forEach((item) => {
      const value = item.getValue(hotelData);
      if (value) {
        tableRows += `<tr><td style="font-weight: 500;">${item.label}</td><td>${value}</td></tr>`;
      }
    });
    detailsContainer.innerHTML = `
      <div style="background-color: #f8f9fa; padding: 12px 16px; font-weight: 600; border-bottom: 1px solid #e2e8f0;">Property Information</div>
      <table><tbody>${tableRows}</tbody></table>
    `;
  } catch (error) {
    console.error("Error fetching hotel details:", error);
    detailsContainer.innerHTML = `<h2>Error Loading Hotel Details</h2><p>${error.message}</p>`;
  }
}

// --- MODIFIED to read from master controls ---
async function loadAllMetrics() {
  const statusEl = document.getElementById("status");
  const resultsContainer = document.getElementById("results-container");
  statusEl.textContent = "Loading from Live API...";
  resultsContainer.innerHTML = "";
  try {
    const startDate =
      document.getElementById("master-start-date").value ||
      new Date().toISOString().split("T")[0];
    const numDays =
      parseInt(document.getElementById("master-num-days").value, 10) || 7;
    const startDateObjUTC = new Date(startDate + "T00:00:00Z");
    const endDateObjUTC = new Date(startDateObjUTC);
    endDateObjUTC.setDate(startDateObjUTC.getDate() + (numDays - 1));
    const endDate = endDateObjUTC.toISOString().split("T")[0];

    const columnsToRequest = Object.keys(DATASET_7_MAP)
      .filter((key) =>
        ["currency", "number", "percent"].includes(DATASET_7_MAP[key].type)
      )
      .map((column) => ({ cdf: { column }, metrics: ["sum", "mean"] }));

    const insightsPayload = {
      dataset_id: 7,
      filters: {
        and: [
          {
            cdf: { column: "stay_date" },
            operator: "greater_than_or_equal",
            value: `${startDate}T00:00:00.000Z`,
          },
          {
            cdf: { column: "stay_date" },
            operator: "less_than_or_equal",
            value: `${endDate}T00:00:00.000Z`,
          },
        ],
      },
      columns: columnsToRequest,
      group_rows: [{ cdf: { column: "stay_date" }, modifier: "day" }],
      settings: { details: true, totals: false },
    };
    const response = await fetch("/api/explore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(insightsPayload),
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.message || "An unknown error occurred.");
    if (!data.records || !data.index || data.index.length === 0) {
      statusEl.textContent = `Request successful, but no data was returned for the period ${startDate} to ${endDate}.`;
      return;
    }
    const processedData = processApiDataForTable(data);
    render7DayTable(processedData);
    statusEl.textContent = `Displaying ${numDays}-day forecast from ${startDate} to ${endDate}.`;
  } catch (error) {
    statusEl.textContent = `Error: ${error.message}`;
    console.error("Failed to load metrics:", error);
  }
}

function processApiDataForTable(data) {
  const aggregatedData = {};
  for (let i = 0; i < data.index.length; i++) {
    const date = data.index[i][0];
    if (!aggregatedData[date]) {
      aggregatedData[date] = { totalRevenueForADR: 0 };
      Object.keys(DATASET_7_MAP).forEach((key) => {
        if (
          ["currency", "number", "percent"].includes(DATASET_7_MAP[key].type)
        ) {
          aggregatedData[date][key] = 0;
        }
      });
    }
    for (const metric in data.records) {
      if (aggregatedData[date].hasOwnProperty(metric)) {
        aggregatedData[date][metric] +=
          parseFloat(data.records[metric][i]) || 0;
      }
    }
    const adr = parseFloat(data.records.adr[i]) || 0;
    const roomsSold = parseInt(data.records.rooms_sold[i]) || 0;
    aggregatedData[date].totalRevenueForADR += adr * roomsSold;
  }
  for (const date in aggregatedData) {
    const dayData = aggregatedData[date];
    if (dayData.rooms_sold > 0)
      dayData.adr = dayData.totalRevenueForADR / dayData.rooms_sold;
    if (dayData.capacity_count > 0)
      dayData.occupancy = dayData.rooms_sold / dayData.capacity_count;
  }
  return aggregatedData;
}

function render7DayTable(processedData) {
  const resultsContainer = document.getElementById("results-container");
  resultsContainer.innerHTML = "";
  const card = document.createElement("div");
  card.className = "table-wrapper";
  const metricColumns = [
    "adr",
    "occupancy",
    "revpar",
    "rooms_sold",
    "capacity_count",
    "total_revenue",
  ];
  let tableHeader = "<tr><th>Date</th>";
  metricColumns.forEach((key) => {
    if (DATASET_7_MAP[key])
      tableHeader += `<th>${DATASET_7_MAP[key].name}</th>`;
  });
  tableHeader += "</tr>";
  let tableRows = "";
  Object.keys(processedData)
    .sort()
    .forEach((date) => {
      tableRows += `<tr><td>${date}</td>`;
      const dayData = processedData[date];
      metricColumns.forEach((key) => {
        if (DATASET_7_MAP[key]) {
          tableRows += `<td>${formatValue(
            dayData[key],
            DATASET_7_MAP[key].type
          )}</td>`;
        }
      });
      tableRows += "</tr>";
    });
  card.innerHTML = `<table><thead>${tableHeader}</thead><tbody>${tableRows}</tbody></table>`;
  resultsContainer.appendChild(card);
}

// --- MODIFIED to read from master controls ---
async function loadMetricsFromDB() {
  const statusEl = document.getElementById("db-status");
  const resultsContainer = document.getElementById("db-results-container");
  statusEl.textContent = "Loading your hotel's data from database...";
  resultsContainer.innerHTML = "";
  try {
    const startDate =
      document.getElementById("master-start-date").value ||
      new Date().toISOString().split("T")[0];
    const numDays =
      parseInt(document.getElementById("master-num-days").value, 10) || 7;
    const apiUrl = `/api/metrics-from-db?startDate=${startDate}&days=${numDays}`;
    const response = await fetch(apiUrl);
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.message || "An unknown error occurred.");
    if (!data || data.length === 0) {
      statusEl.textContent =
        "Request successful, but no data was returned from the database for the selected range.";
      return;
    }
    renderDBMetricsTable(data);
    statusEl.textContent = `Displaying ${numDays}-day forecast for your hotel, starting ${startDate}.`;
  } catch (error) {
    statusEl.textContent = `Error: ${error.message}`;
    console.error("Failed to load metrics from DB:", error);
  }
}

function renderDBMetricsTable(dbData) {
  const resultsContainer = document.getElementById("db-results-container");
  resultsContainer.innerHTML = "";
  const card = document.createElement("div");
  card.className = "table-wrapper";
  const dbColumns = [
    "adr",
    "occupancy_direct",
    "revpar",
    "rooms_sold",
    "capacity_count",
    "total_revenue",
  ];
  const columnToMapKey = { occupancy_direct: "occupancy" };
  let tableHeader = "<tr><th>Date</th>";
  dbColumns.forEach((colName) => {
    const mapKey = columnToMapKey[colName] || colName;
    const metricInfo = DATASET_7_MAP[mapKey];
    tableHeader += `<th>${
      metricInfo ? metricInfo.name : colName.replace(/_/g, " ")
    }</th>`;
  });
  tableHeader += "</tr>";
  let tableRows = "";
  dbData.forEach((row) => {
    const stayDate = row.stay_date.substring(0, 10);
    tableRows += `<tr><td>${stayDate}</td>`;
    dbColumns.forEach((colName) => {
      const mapKey = columnToMapKey[colName] || colName;
      const metricInfo = DATASET_7_MAP[mapKey] || { type: "number" };
      tableRows += `<td>${formatValue(row[colName], metricInfo.type)}</td>`;
    });
    tableRows += "</tr>";
  });
  card.innerHTML = `<table><thead>${tableHeader}</thead><tbody>${tableRows}</tbody></table>`;
  resultsContainer.appendChild(card);
}

// --- MODIFIED to read from master controls ---
async function loadCompetitorMetrics() {
  const statusEl = document.getElementById("competitor-status");
  const resultsContainer = document.getElementById(
    "competitor-results-container"
  );
  statusEl.textContent = "Loading competitor data from database...";
  resultsContainer.innerHTML = "";
  try {
    const startDate =
      document.getElementById("master-start-date").value ||
      new Date().toISOString().split("T")[0];
    const numDays =
      parseInt(document.getElementById("master-num-days").value, 10) || 7;
    const apiUrl = `/api/competitor-metrics?startDate=${startDate}&days=${numDays}`;
    const response = await fetch(apiUrl);
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.message || "An unknown error occurred.");
    if (!data || data.length === 0) {
      statusEl.textContent =
        "Request successful, but no competitor data was returned for the selected range.";
      return;
    }
    renderCompetitorMetricsTable(data);
    statusEl.textContent = `Displaying ${numDays}-day forecast for the competitor market, starting ${startDate}.`;
  } catch (error) {
    statusEl.textContent = `Error: ${error.message}`;
    console.error("Failed to load competitor metrics from DB:", error);
  }
}

function renderCompetitorMetricsTable(dbData) {
  const resultsContainer = document.getElementById(
    "competitor-results-container"
  );
  resultsContainer.innerHTML = "";
  const card = document.createElement("div");
  card.className = "table-wrapper";
  const dbColumns = [
    "hotel_id",
    "adr",
    "occupancy_direct",
    "revpar",
    "rooms_sold",
    "capacity_count",
  ];
  const columnToMapKey = { occupancy_direct: "occupancy" };
  let tableHeader = "<tr><th>Date</th><th>Hotel ID</th>";
  dbColumns.slice(1).forEach((colName) => {
    const mapKey = columnToMapKey[colName] || colName;
    const metricInfo = DATASET_7_MAP[mapKey];
    tableHeader += `<th>${
      metricInfo ? metricInfo.name : colName.replace(/_/g, " ")
    }</th>`;
  });
  tableHeader += "</tr>";

  let tableRows = "";
  dbData.forEach((row) => {
    const stayDate = row.stay_date.substring(0, 10);
    tableRows += `<tr><td>${stayDate}</td><td>${row.hotel_id}</td>`;
    dbColumns.slice(1).forEach((colName) => {
      const mapKey = columnToMapKey[colName] || colName;
      const metricInfo = DATASET_7_MAP[mapKey] || { type: "number" };
      tableRows += `<td>${formatValue(row[colName], metricInfo.type)}</td>`;
    });
    tableRows += "</tr>";
  });

  card.innerHTML = `<table class="competitor-table"><thead>${tableHeader}</thead><tbody>${tableRows}</tbody></table>`;
  resultsContainer.appendChild(card);
}

// Helper function for formatting values
function formatValue(value, type) {
  if (value === null || value === undefined || value === "") return "-";
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  switch (type) {
    case "currency":
      return `$${num.toFixed(2)}`;
    case "percent":
      return `${(num * 100).toFixed(1)}%`;
    case "number":
      return num.toFixed(0);
    default:
      return value;
  }
}
