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
  non_room_revenue: {
    name: "Total Other Revenue",
    category: "Finance",
    type: "currency",
  },
  additional_room_revenue: {
    name: "Other Room Revenue",
    category: "Finance",
    type: "currency",
  },
  room_rate: { name: "Room Rate", category: "Finance", type: "currency" },
  misc_income: { name: "Misc. Income", category: "Finance", type: "currency" },
  room_fees: { name: "Total Fees", category: "Finance", type: "currency" },
  room_taxes: { name: "Total Taxes", category: "Finance", type: "currency" },

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

async function loadAllMetrics() {
  const statusEl = document.getElementById("status");
  const resultsContainer = document.getElementById("results-container");

  statusEl.textContent = "Loading 7-day forecast...";
  resultsContainer.innerHTML = "";

  try {
    const startDate = "2025-07-03";
    const endDate = "2025-07-09";

    const columnsToRequest = Object.keys(DATASET_7_MAP)
      .filter((column) => {
        const type = DATASET_7_MAP[column].type;
        return (
          type === "currency" ||
          type === "number" ||
          type === "percent" ||
          type === "DynamicCurrency" ||
          type === "DynamicPercentage"
        );
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
      statusEl.textContent = `Request successful, but no data was returned for the period ${startDate} to ${endDate}.`;
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

  // Aggregate the raw data by date
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

  // Perform final calculations on the aggregated data
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
  card.className = "category-card";

  const metricColumns = Object.keys(DATASET_7_MAP)
    .filter((key) => {
      const type = DATASET_7_MAP[key].type;
      return type !== "string" && type !== "date";
    })
    .sort((a, b) => DATASET_7_MAP[a].name.localeCompare(DATASET_7_MAP[b].name));

  // Create table headers
  let tableHeader = "<tr><th>Date</th>";
  metricColumns.forEach((key) => {
    tableHeader += `<th>${DATASET_7_MAP[key].name}</th>`;
  });
  tableHeader += "</tr>";

  // Create table rows
  let tableRows = "";
  const sortedDates = Object.keys(processedData).sort();

  sortedDates.forEach((date) => {
    tableRows += `<tr><td>${date}</td>`;
    const dayData = processedData[date];
    metricColumns.forEach((key) => {
      const metricInfo = DATASET_7_MAP[key];
      tableRows += `<td>${formatValue(dayData[key], metricInfo.type)}</td>`;
    });
    tableRows += "</tr>";
  });

  card.innerHTML = `
        <div class="category-header">7-Day Performance Metrics</div>
        <div style="overflow-x: auto;">
             <table>
                <thead>${tableHeader}</thead>
                <tbody>${tableRows}</tbody>
            </table>
        </div>
    `;
  resultsContainer.appendChild(card);
}

function formatValue(value, type) {
  if (value === null || value === undefined) return "-";
  const num = parseFloat(value);
  if (isNaN(num)) return value;

  switch (type) {
    case "currency":
    case "DynamicCurrency":
      return `$${num.toFixed(2)}`;
    case "percent":
    case "DynamicPercentage":
      return `${(num * 100).toFixed(1)}%`;
    case "number":
      return num.toFixed(0);
    default:
      return value;
  }
}
