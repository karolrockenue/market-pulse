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

// It runs when the page loads to get the hotel's details.
document.addEventListener("DOMContentLoaded", () => {
  fetchHotelDetails();
});

// This function fetches and displays the hotel's static information
async function fetchHotelDetails() {
  const detailsContainer = document.getElementById("hotel-details-card");
  if (!detailsContainer) return; // Failsafe if element doesn't exist
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

async function loadAllMetrics() {
  const statusEl = document.getElementById("status");
  const resultsContainer = document.getElementById("results-container");

  statusEl.innerHTML = "<h2>7-Day Forecast (from Live API)</h2>Loading..."; // Title added here
  resultsContainer.innerHTML = "";

  try {
    // Use today's date for a dynamic 7-day forecast
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + 6); // +6 to get a total of 7 days

    const startDate = today.toISOString().split("T")[0];
    const endDate = futureDate.toISOString().split("T")[0];

    const columnsToRequest = Object.keys(DATASET_7_MAP)
      .filter((column) => {
        const type = DATASET_7_MAP[column].type;
        return type === "currency" || type === "number" || type === "percent";
      })
      .map((column) => ({
        cdf: { column },
        metrics: ["sum", "mean"],
      }));

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

    if (!response.ok) {
      throw new Error(data.message || "An unknown error occurred.");
    }

    if (!data.records || !data.index || data.index.length === 0) {
      statusEl.textContent += `<br/>Request successful, but no data was returned for the period ${startDate} to ${endDate}.`;
      return;
    }

    const processedData = processApiDataForTable(data);
    render7DayTable(processedData);
    statusEl.textContent = `Displaying 7-day forecast from ${startDate} to ${endDate}.`;
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
      for (const key in DATASET_7_MAP) {
        if (
          DATASET_7_MAP[key].type !== "string" &&
          DATASET_7_MAP[key].type !== "date"
        ) {
          aggregatedData[date][key] = 0;
        }
      }
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
    if (dayData.rooms_sold > 0) {
      dayData.adr = dayData.totalRevenueForADR / dayData.rooms_sold;
    }
    if (dayData.capacity_count > 0) {
      dayData.occupancy = dayData.rooms_sold / dayData.capacity_count;
    }
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
    "room_revenue",
    "non_room_revenue",
    "room_rate",
    "room_taxes",
    "room_fees",
    "misc_income",
    "adults_count",
    "children_count",
    "room_guest_count",
    "blocked_room_count",
    "out_of_service_count",
  ];

  let tableHeader = "<tr><th>Date</th>";
  metricColumns.forEach((key) => {
    if (DATASET_7_MAP[key]) {
      tableHeader += `<th>${DATASET_7_MAP[key].name}</th>`;
    }
  });
  tableHeader += "</tr>";

  let tableRows = "";
  const sortedDates = Object.keys(processedData).sort();

  sortedDates.forEach((date) => {
    tableRows += `<tr><td>${date}</td>`;
    const dayData = processedData[date];
    metricColumns.forEach((key) => {
      if (DATASET_7_MAP[key]) {
        const metricInfo = DATASET_7_MAP[key];
        tableRows += `<td>${formatValue(dayData[key], metricInfo.type)}</td>`;
      }
    });
    tableRows += "</tr>";
  });

  card.innerHTML = `<table id="metrics-table"><thead>${tableHeader}</thead><tbody>${tableRows}</tbody></table>`;
  resultsContainer.appendChild(card);
}

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

function filterTable() {
  const input = document.getElementById("search-input");
  const filter = input.value.toUpperCase();
  const table = document.getElementById("metrics-table");
  const tr = table.getElementsByTagName("tr");

  for (let i = 1; i < tr.length; i++) {
    const td = tr[i].getElementsByTagName("td")[0];
    if (td) {
      const txtValue = td.textContent || td.innerText;
      if (txtValue.toUpperCase().indexOf(filter) > -1) {
        tr[i].style.display = "";
      } else {
        tr[i].style.display = "none";
      }
    }
  }
}

// --- NEW FUNCTIONS FOR DATABASE METRICS ---

async function loadMetricsFromDB() {
  const statusEl = document.getElementById("db-status");
  const resultsContainer = document.getElementById("db-results-container");

  statusEl.textContent = "Loading 7-day forecast from database...";
  resultsContainer.innerHTML = "";

  try {
    const response = await fetch("/api/metrics-from-db");
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "An unknown error occurred.");
    }

    if (!data || data.length === 0) {
      statusEl.textContent =
        "Request successful, but no data was returned from the database for the next 7 days.";
      return;
    }

    renderDBMetricsTable(data);
    statusEl.textContent = "Displaying 7-day forecast from the database.";
  } catch (error) {
    statusEl.textContent = `Error: ${error.message}`;
    console.error("Failed to load metrics from DB:", error);
  }
}

// THIS IS THE CORRECTED, ROBUST RENDERER
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
    "total_room_revenue",
    "total_other_revenue",
    "room_rate_total",
    "taxes_total",
    "fees_total",
    "misc_income",
    "adults_count",
    "children_count",
    "room_guest_count",
    "blocked_room_count",
    "out_of_service_rooms_count",
  ];

  const columnToMapKey = {
    occupancy_direct: "occupancy",
    room_rate_total: "room_rate",
    taxes_total: "room_taxes",
    fees_total: "room_fees",
    total_other_revenue: "non_room_revenue",
  };

  let tableHeader = "<tr><th>Date</th>";
  dbColumns.forEach((colName) => {
    const mapKey = columnToMapKey[colName] || colName;
    const metricInfo = DATASET_7_MAP[mapKey];
    const displayName = metricInfo
      ? metricInfo.name
      : colName.replace(/_/g, " ");
    tableHeader += `<th>${displayName}</th>`;
  });
  tableHeader += "</tr>";

  let tableRows = "";
  dbData.forEach((row) => {
    // --- FIX #2: USE SUBSTRING TO AVOID TIMEZONE ISSUES ---
    const stayDate = row.stay_date.substring(0, 10);
    tableRows += `<tr><td>${stayDate}</td>`;

    dbColumns.forEach((colName) => {
      const mapKey = columnToMapKey[colName] || colName;
      const metricInfo = DATASET_7_MAP[mapKey] || { type: "number" };
      const value = row[colName];
      tableRows += `<td>${formatValue(value, metricInfo.type)}</td>`;
    });
    tableRows += "</tr>";
  });

  card.innerHTML = `<table id="db-metrics-table"><thead>${tableHeader}</thead><tbody>${tableRows}</tbody></table>`;
  resultsContainer.appendChild(card);
}
