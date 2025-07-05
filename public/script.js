import { DATASET_7_MAP } from "./constants.js";

let currentGranularity = "daily";
let hotelCurrencySymbol = "$"; // Default value

// Runs when the page loads
document.addEventListener("DOMContentLoaded", () => {
  // Set default dates
  const startDateInput = document.getElementById("master-start-date");
  const endDateInput = document.getElementById("master-end-date");
  if (startDateInput && endDateInput) {
    const today = new Date();
    const nextMonth = new Date();
    nextMonth.setMonth(today.getMonth() + 1);
    const formatDate = (date) => {
      const d = new Date(date);
      let month = "" + (d.getMonth() + 1);
      let day = "" + d.getDate();
      const year = d.getFullYear();
      if (month.length < 2) month = "0" + month;
      if (day.length < 2) day = "0" + day;
      return [year, month, day].join("-");
    };
    startDateInput.value = formatDate(today);
    endDateInput.value = formatDate(nextMonth);
  }

  // Attach Event Listeners
  document
    .getElementById("btn-fetch-details")
    ?.addEventListener("click", fetchHotelDetails);
  document
    .getElementById("btn-load-live")
    ?.addEventListener("click", loadAllMetrics);
  document
    .getElementById("btn-load-db")
    ?.addEventListener("click", loadAllDbData);
  document
    .getElementById("view-daily")
    ?.addEventListener("click", () => setGranularity("daily"));
  document
    .getElementById("view-weekly")
    ?.addEventListener("click", () => setGranularity("weekly"));
  document
    .getElementById("view-monthly")
    ?.addEventListener("click", () => setGranularity("monthly"));
});

function setGranularity(granularity) {
  currentGranularity = granularity;
  document.getElementById("view-daily").classList.remove("active");
  document.getElementById("view-weekly").classList.remove("active");
  document.getElementById("view-monthly").classList.remove("active");
  document.getElementById(`view-${granularity}`).classList.add("active");
}

async function fetchHotelDetails() {
  const detailsCard = document.getElementById("hotel-details-card");
  if (!detailsCard) return;
  detailsCard.innerHTML = "<p>Loading Hotel Details...</p>";
  try {
    const response = await fetch("/api/hotel-details");
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message || "Failed to fetch hotel details");
    }
    const hotelData = result.data;
    // RESTORED: Full list of hotel details
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
        tableRows += `<tr><td style="font-weight: 500; padding: 8px 16px;">${item.label}</td><td style="padding: 8px 16px;">${value}</td></tr>`;
      }
    });
    detailsCard.innerHTML = `
      <div style="background-color: var(--slate-50); padding: 12px 16px; font-weight: 600; text-transform: uppercase; font-size: 12px; color: var(--slate-500); border-bottom: 1px solid var(--slate-200);">Property Information</div>
      <table style="width: 100%;"><tbody>${tableRows}</tbody></table>
    `;
  } catch (error) {
    console.error("Error fetching hotel details:", error);
    detailsCard.innerHTML = `<p style="color: red; padding: 16px;">Error Loading Hotel Details: ${error.message}</p>`;
  }
}

// RESTORED: This function was previously missing
async function loadAllMetrics() {
  const statusEl = document.getElementById("status");
  const resultsContainer = document.getElementById("results-container");
  statusEl.textContent = "Loading from Live API...";
  resultsContainer.innerHTML = "";
  try {
    const startDate =
      document.getElementById("master-start-date").value ||
      new Date().toISOString().split("T")[0];
    const numDays = 7;
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

async function loadAllDbData() {
  const startDate = document.getElementById("master-start-date").value;
  const endDate = document.getElementById("master-end-date").value;
  if (!startDate || !endDate) {
    alert("Please select both a Start Date and an End Date.");
    return;
  }
  await loadMetricsFromDB(startDate, endDate, currentGranularity);
  await loadCompetitorMetrics(startDate, endDate, currentGranularity);
}

async function loadMetricsFromDB(startDate, endDate, granularity) {
  const statusEl = document.getElementById("db-status");
  const resultsContainer = document.getElementById("db-results-container");
  statusEl.textContent = "Loading your hotel's data from database...";
  resultsContainer.innerHTML = "";
  try {
    const apiUrl = `/api/metrics-from-db?startDate=${startDate}&endDate=${endDate}&granularity=${granularity}`;
    const response = await fetch(apiUrl);
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.message || "An unknown error occurred.");
    if (!data || !data.metrics || data.metrics.length === 0) {
      statusEl.textContent =
        "Request successful, but no data was returned for the database for the selected range.";
      return;
    }
    hotelCurrencySymbol = data.currencySymbol;
    renderDBMetricsTable(data.metrics, granularity);
    statusEl.textContent = `Displaying ${granularity} data for your hotel.`;
  } catch (error) {
    statusEl.textContent = `Error: ${error.message}`;
    console.error("Failed to load metrics from DB:", error);
  }
}

async function loadCompetitorMetrics(startDate, endDate, granularity) {
  const statusEl = document.getElementById("competitor-status");
  const resultsContainer = document.getElementById(
    "competitor-results-container"
  );
  statusEl.textContent = "Loading competitor data from database...";
  resultsContainer.innerHTML = "";
  try {
    const apiUrl = `/api/competitor-metrics?startDate=${startDate}&endDate=${endDate}&granularity=${granularity}`;
    const response = await fetch(apiUrl);
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.message || "An unknown error occurred.");
    if (!data || data.length === 0) {
      statusEl.textContent =
        "Request successful, but no competitor data was returned for the selected range.";
      return;
    }
    renderCompetitorMetricsTable(data, granularity);
    statusEl.textContent = `Displaying ${granularity} data for the market.`;
  } catch (error) {
    statusEl.textContent = `Error: ${error.message}`;
    console.error("Failed to load competitor metrics from DB:", error);
  }
}

// RESTORED: This function was previously missing
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

// RESTORED: This function was previously missing
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

function renderDBMetricsTable(dbData, granularity) {
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
  let dateHeader = "Date";
  if (granularity === "weekly") dateHeader = "Week Starting";
  if (granularity === "monthly") dateHeader = "Month";
  let tableHeader = `<tr><th>${dateHeader}</th>`;
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
    const period = (row.period || row.stay_date).substring(0, 10);
    tableRows += `<tr><td>${period}</td>`;
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

function renderCompetitorMetricsTable(dbData, granularity) {
  const resultsContainer = document.getElementById(
    "competitor-results-container"
  );
  resultsContainer.innerHTML = "";
  const card = document.createElement("div");
  card.className = "table-wrapper";
  const dbColumns = [
    "market_adr",
    "market_occupancy",
    "market_revpar",
    "market_rooms_sold",
    "market_capacity",
  ];
  const headerMap = {
    market_adr: "Market ADR",
    market_occupancy: "Market Occupancy",
    market_revpar: "Market RevPAR",
    market_rooms_sold: "Market Rooms Sold",
    market_capacity: "Market Capacity",
  };
  let dateHeader = "Date";
  if (granularity === "weekly") dateHeader = "Week Starting";
  if (granularity === "monthly") dateHeader = "Month";
  let tableHeader = `<tr><th>${dateHeader}</th>`;
  dbColumns.forEach((colName) => {
    tableHeader += `<th>${headerMap[colName] || colName}</th>`;
  });
  tableHeader += "</tr>";
  let tableRows = "";
  dbData.forEach((row) => {
    const period = (row.period || row.stay_date).substring(0, 10);
    tableRows += `<tr><td>${period}</td>`;
    dbColumns.forEach((colName) => {
      let formatType = "number";
      if (colName.includes("adr") || colName.includes("revpar")) {
        formatType = "currency";
      } else if (colName.includes("occupancy")) {
        formatType = "percent";
      }
      tableRows += `<td>${formatValue(row[colName], formatType)}</td>`;
    });
    tableRows += "</tr>";
  });
  card.innerHTML = `<table><thead>${tableHeader}</thead><tbody>${tableRows}</tbody></table>`;
  resultsContainer.appendChild(card);
}

function formatValue(value, type) {
  if (value === null || value === undefined || value === "") return "-";
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  switch (type) {
    case "currency":
      return `${hotelCurrencySymbol}${num.toFixed(2)}`;
    case "percent":
      return `${(num * 100).toFixed(1)}%`;
    case "number":
      return num.toFixed(0);
    default:
      return value;
  }
}
