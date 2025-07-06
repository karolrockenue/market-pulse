// --- GLOBAL STATE & CONFIG ---
let comparisonChart = null;
let yourHotelMetrics = [];
let marketMetrics = [];
let activeMetric = "occupancy";
let currentGranularity = "daily";

const metricConfig = {
  occupancy: { label: "Occupancy", format: "percent" },
  adr: { label: "ADR", format: "currency" },
  revpar: { label: "RevPAR", format: "currency" },
};

const chartColors = { primary: "#FAC35F", secondary: "#3C455B" };

// --- FAKE DATA GENERATION (To be replaced) ---
function generateFakeData(granularity, period) {
  let data = [];
  const today = new Date("2025-07-03");
  if (granularity === "daily") {
    for (let i = 0; i < period; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const yourOcc = 0.75 + Math.random() * 0.2;
      const yourAdr = 180 + Math.random() * 40;
      const marketOcc = 0.7 + Math.random() * 0.15;
      const marketAdr = 170 + Math.random() * 30;
      data.push({
        date: date.toISOString().split("T")[0],
        your: {
          occupancy: yourOcc,
          adr: yourAdr,
          revpar: yourOcc * yourAdr,
        },
        market: {
          occupancy: marketOcc,
          adr: marketAdr,
          revpar: marketOcc * marketAdr,
        },
      });
    }
  } else {
    // monthly
    for (let i = 0; i < period; i++) {
      const date = new Date(today);
      date.setMonth(today.getMonth() + i);
      const yourOcc = 0.6 + Math.random() * 0.3;
      const yourAdr = 150 + Math.random() * 60;
      const marketOcc = 0.55 + Math.random() * 0.25;
      const marketAdr = 140 + Math.random() * 50;
      data.push({
        date: date.toISOString().substring(0, 7),
        your: {
          occupancy: yourOcc,
          adr: yourAdr,
          revpar: yourOcc * yourAdr,
        },
        market: {
          occupancy: marketOcc,
          adr: marketAdr,
          revpar: marketOcc * marketAdr,
        },
      });
    }
  }
  return data;
}

// --- DYNAMIC RENDERING LOGIC ---
function setActiveMetric(metric) {
  activeMetric = metric;
  document
    .querySelectorAll(".kpi-card")
    .forEach((card) => card.classList.remove("active"));
  document
    .querySelector(`.kpi-card[data-metric="${metric}"]`)
    .classList.add("active");
  renderDashboard();
}

function formatValue(value, type) {
  if (value === null || value === undefined) return "-";
  const num = parseFloat(value);
  if (isNaN(num)) return "-";

  if (type === "currency") return `$${num.toFixed(2)}`;
  if (type === "percent") return `${(num * 100).toFixed(1)}%`;
  return num.toFixed(0);
}

function formatDateLabel(dateString, granularity) {
  const date = new Date(dateString);
  if (granularity === "monthly") {
    return date.toLocaleString("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  }
  if (granularity === "weekly") {
    return `Week of ${date.toLocaleDateString("en-GB", { timeZone: "UTC" })}`;
  }
  // Daily
  return date.toLocaleDateString("en-GB", { timeZone: "UTC" });
}

function renderKpiCards() {
  ["occupancy", "adr", "revpar"].forEach((metric) => {
    if (yourHotelMetrics.length === 0) {
      document.getElementById(`kpi-${metric}-your`).textContent = "-";
      document.getElementById(`kpi-${metric}-market`).textContent = "-";
      document.getElementById(`kpi-${metric}-delta`).textContent = "";
      return;
    }

    const yourAvg =
      yourHotelMetrics.reduce((sum, item) => sum + item.your[metric], 0) /
      yourHotelMetrics.length;
    const marketAvg =
      marketMetrics.reduce((sum, item) => sum + item.market[metric], 0) /
      marketMetrics.length;
    const delta = yourAvg - marketAvg;

    document.getElementById(`kpi-${metric}-your`).textContent = formatValue(
      yourAvg,
      metricConfig[metric].format
    );
    document.getElementById(`kpi-${metric}-market`).textContent = formatValue(
      marketAvg,
      metricConfig[metric].format
    );

    const deltaEl = document.getElementById(`kpi-${metric}-delta`);
    const deltaSign = delta >= 0 ? "+" : "";
    let formattedDelta;
    if (metricConfig[metric].format === "percent") {
      formattedDelta = `${deltaSign}${(Math.abs(delta) * 100).toFixed(1)}pts`;
    } else {
      formattedDelta = `${deltaSign}${formatValue(
        Math.abs(delta),
        "currency"
      )}`;
    }
    deltaEl.textContent = formattedDelta;
    deltaEl.className = `text-sm font-bold font-data ${
      delta >= 0 ? "text-green-600" : "text-red-600"
    }`;
  });
}

function renderTables() {
  const yourTable = document.getElementById("yourHotelTableBody");
  const marketTable = document.getElementById("marketTableBody");
  const yourHeader = document.getElementById("your-hotel-table-header");
  const marketHeader = document.getElementById("market-table-header");
  yourTable.innerHTML = "";
  marketTable.innerHTML = "";

  const dateHeaderLabel =
    currentGranularity.charAt(0).toUpperCase() + currentGranularity.slice(1);
  yourHeader.innerHTML = `
      <th class="px-4 py-2 font-semibold">${dateHeaderLabel}</th>
      <th class="px-4 py-2 font-semibold">ADR</th>
      <th class="px-4 py-2 font-semibold">Occupancy</th>
      <th class="px-4 py-2 font-semibold">RevPAR</th>
  `;
  marketHeader.innerHTML = `
      <th class="px-4 py-2 font-semibold">${dateHeaderLabel}</th>
      <th class="px-4 py-2 font-semibold">Market ADR</th>
      <th class="px-4 py-2 font-semibold">Market Occ.</th>
      <th class="px-4 py-2 font-semibold">Market RevPAR</th>
      <th class="px-4 py-2 font-semibold">${metricConfig[activeMetric].label} Delta</th>
  `;

  if (yourHotelMetrics.length === 0) {
    return; // Don't render rows if there's no data
  }

  yourHotelMetrics.forEach((day, index) => {
    const marketDay = marketMetrics[index];
    const displayDate = formatDateLabel(day.date, currentGranularity);
    const yourRow = document.createElement("tr");
    yourRow.dataset.date = day.date;
    yourRow.innerHTML = `
          <td class="px-4 py-3 whitespace-nowrap font-data">${displayDate}</td>
          <td class="px-4 py-3 font-data">${formatValue(
            day.your.adr,
            "currency"
          )}</td>
          <td class="px-4 py-3 font-data">${formatValue(
            day.your.occupancy,
            "percent"
          )}</td>
          <td class="px-4 py-3 font-data">${formatValue(
            day.your.revpar,
            "currency"
          )}</td>
      `;
    yourTable.appendChild(yourRow);

    const marketRow = document.createElement("tr");
    marketRow.dataset.date = marketDay.date;
    const delta = day.your[activeMetric] - marketDay.market[activeMetric];
    const deltaColor = delta >= 0 ? "text-green-600" : "text-red-600";
    const deltaSign = delta >= 0 ? "+" : "";
    let formattedDelta;
    if (metricConfig[activeMetric].format === "currency") {
      formattedDelta = `${deltaSign}$${Math.abs(delta).toFixed(2)}`;
    } else {
      formattedDelta = `${deltaSign}${(Math.abs(delta) * 100).toFixed(1)}pts`;
    }
    const deltaCell = `<td class="px-4 py-3 font-semibold font-data ${deltaColor}">${formattedDelta}</td>`;

    marketRow.innerHTML = `
          <td class="px-4 py-3 whitespace-nowrap font-data">${displayDate}</td>
          <td class="px-4 py-3 font-data">${formatValue(
            marketDay.market.adr,
            "currency"
          )}</td>
          <td class="px-4 py-3 font-data">${formatValue(
            marketDay.market.occupancy,
            "percent"
          )}</td>
          <td class="px-4 py-3 font-data">${formatValue(
            marketDay.market.revpar,
            "currency"
          )}</td>
          ${deltaCell}
      `;
    marketTable.appendChild(marketRow);
  });
  addTableSyncEventListeners();
}

// --- Enhanced Sync Logic ---
function handleRowMouseover(event) {
  const date = event.currentTarget.dataset.date;
  if (!date || !comparisonChart) return;
  document
    .querySelectorAll(`tr[data-date="${date}"]`)
    .forEach((r) => r.classList.add("highlight"));
  const dataIndex = comparisonChart.data.labels.findIndex((label) =>
    label.startsWith(date)
  );
  if (dataIndex !== -1) {
    comparisonChart.tooltip.setActiveElements([
      { datasetIndex: 0, index: dataIndex },
      { datasetIndex: 1, index: dataIndex },
    ]);
    comparisonChart.update();
  }
}

function handleRowMouseout() {
  document
    .querySelectorAll("tr.highlight")
    .forEach((r) => r.classList.remove("highlight"));
  if (comparisonChart) {
    comparisonChart.tooltip.setActiveElements([], { x: 0, y: 0 });
    comparisonChart.update();
  }
}

function addTableSyncEventListeners() {
  const rows = document.querySelectorAll(
    "#yourHotelTableBody tr, #marketTableBody tr"
  );
  rows.forEach((row) => {
    row.addEventListener("mouseover", handleRowMouseover);
    row.addEventListener("mouseout", handleRowMouseout);
  });
}

function syncChartAndTables(event, activeElements, chart) {
  document
    .querySelectorAll("tr.highlight")
    .forEach((row) => row.classList.remove("highlight"));
  if (activeElements.length > 0) {
    const dataIndex = activeElements[0].index;
    const date = chart.data.labels[dataIndex];
    if (date) {
      const rawDate = yourHotelMetrics[dataIndex].date;
      document
        .querySelectorAll(`tr[data-date="${rawDate}"]`)
        .forEach((row) => row.classList.add("highlight"));
    }
  }
}

// --- RENDER CHARTS ---
Chart.defaults.color = "#64748b";
Chart.defaults.borderColor = "#e2e8f0";

function getYAxisOptions(metric, dataMin, dataMax) {
  const baseOptions = { grid: { color: "#e2e8f0" } };

  if (metric === "occupancy") {
    const padding = 20;
    let suggestedMin = Math.floor((dataMin - padding) / 10) * 10;
    let suggestedMax = Math.ceil((dataMax + padding) / 10) * 10;
    suggestedMin = Math.max(0, suggestedMin);
    suggestedMax = Math.min(100, suggestedMax);
    return {
      ...baseOptions,
      min: suggestedMin,
      max: suggestedMax,
      ticks: {
        stepSize: 10,
        callback: (value) => value + "%",
      },
    };
  }

  const range = dataMax - dataMin;
  const padding = range > 0 ? range * 0.2 : dataMax * 0.2;
  const suggestedMin = Math.floor((dataMin - padding) / 10) * 10;
  const suggestedMax = Math.ceil((dataMax + padding) / 10) * 10;
  return {
    ...baseOptions,
    min: Math.max(0, suggestedMin),
    max: suggestedMax,
    ticks: { callback: (value) => "$" + value },
  };
}

function renderChart() {
  if (comparisonChart) {
    comparisonChart.destroy();
  }
  const ctx = document.getElementById("comparisonChart").getContext("2d");
  const isDaily = currentGranularity === "daily";

  const labels = yourHotelMetrics.map((d) =>
    formatDateLabel(d.date, currentGranularity)
  );
  const yourData = yourHotelMetrics.map((d) =>
    activeMetric === "occupancy"
      ? d.your[activeMetric] * 100
      : d.your[activeMetric]
  );
  const marketData = marketMetrics.map((d) =>
    activeMetric === "occupancy"
      ? d.market[activeMetric] * 100
      : d.market[activeMetric]
  );

  const allData = [...yourData, ...marketData];
  const dataMin = allData.length > 0 ? Math.min(...allData) : 0;
  const dataMax = allData.length > 0 ? Math.max(...allData) : 100;

  document.getElementById(
    "comparison-chart-title"
  ).textContent = `${metricConfig[activeMetric].label} Trend`;

  const config = {
    type: isDaily ? "line" : "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: `Your Hotel`,
          data: yourData,
          backgroundColor: isDaily ? "transparent" : chartColors.primary,
          borderColor: chartColors.primary,
          borderWidth: isDaily ? 2.5 : 1,
          pointRadius: 0,
          tension: 0.3,
          fill: isDaily
            ? {
                target: 1,
                above: "rgba(74, 222, 128, 0.05)",
                below: "rgba(248, 113, 113, 0.05)",
              }
            : false,
        },
        {
          label: `The Market`,
          data: marketData,
          backgroundColor: isDaily ? "transparent" : chartColors.secondary,
          borderColor: chartColors.secondary,
          borderWidth: isDaily ? 2 : 1,
          borderDash: isDaily ? [5, 5] : [],
          pointRadius: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      onHover: syncChartAndTables,
      scales: {
        x: {
          grid: { display: false },
        },
        y: getYAxisOptions(activeMetric, dataMin, dataMax),
      },
      plugins: {
        legend: {
          display: true,
          position: "top",
          align: "end",
          labels: { usePointStyle: true, boxWidth: 8, padding: 20 },
        },
        tooltip: {
          backgroundColor: "#1e293b",
          titleColor: "#f7f8fc",
          bodyColor: "#e2e8f0",
          borderColor: "#334155",
          borderWidth: 1,
          padding: 10,
          displayColors: false,
        },
      },
      interaction: { intersect: false, mode: "index" },
    },
  };
  comparisonChart = new Chart(ctx, config);
  comparisonChart.canvas.addEventListener("mouseleave", () => {
    document
      .querySelectorAll("tr.highlight")
      .forEach((row) => row.classList.remove("highlight"));
  });
}

function renderDashboard() {
  renderKpiCards();
  renderTables();
  renderChart();
}

// --- DATA LOADING ---
function loadAndRenderFakeData(granularity, period) {
  currentGranularity = granularity;
  const data = generateFakeData(granularity, period);
  yourHotelMetrics = data;
  marketMetrics = data;

  document
    .querySelectorAll("#test-buttons .control-btn[data-period]")
    .forEach((btn) => btn.classList.remove("active"));
  const activeButton = document.querySelector(
    `#test-buttons .control-btn[data-granularity="${granularity}"][data-period="${period}"]`
  );
  if (activeButton) {
    activeButton.classList.add("active");
  }

  renderDashboard();
}

async function loadDataFromAPI(startDate, endDate, granularity) {
  console.log("Fetching data with parameters:", {
    startDate,
    endDate,
    granularity,
  });
  alert("API connection not implemented yet. Using fake data for now.");
  loadAndRenderFakeData(granularity, 30);
}

// --- NEW: Function to fetch and display the last refresh time ---
async function fetchAndDisplayLastRefreshTime() {
  const timestampEl = document.getElementById("data-timestamp");
  try {
    const response = await fetch("/api/last-refresh-time");
    if (!response.ok) {
      // If the endpoint fails (e.g., 404), just use the current time as a fallback
      throw new Error("Could not fetch refresh time.");
    }
    const data = await response.json();
    const lastRefreshDate = new Date(data.last_successful_run);

    // Format for Poland's timezone
    const formattedDate = lastRefreshDate.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Europe/Warsaw",
    });
    const formattedTime = lastRefreshDate.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Europe/Warsaw",
    });

    timestampEl.textContent = `Data updated on ${formattedDate} at ${formattedTime}`;
  } catch (error) {
    console.error("Failed to display last refresh time:", error);
    // Fallback to current time if there's an error
    const now = new Date();
    const formattedDate = now.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const formattedTime = now.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    timestampEl.textContent = `Displaying real-time view as of ${formattedDate} at ${formattedTime}`;
  }
}

// --- INITIALIZE ---
document.addEventListener("DOMContentLoaded", () => {
  // Dropdown click handling
  function setupDropdowns() {
    document.querySelectorAll(".dropdown > button").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        const dropdownContent = button.nextElementSibling;
        document
          .querySelectorAll(".dropdown-content.show")
          .forEach((openDropdown) => {
            if (openDropdown !== dropdownContent) {
              openDropdown.classList.remove("show");
            }
          });
        dropdownContent.classList.toggle("show");
      });
    });
    window.addEventListener("click", (event) => {
      if (!event.target.closest(".dropdown")) {
        document
          .querySelectorAll(".dropdown-content.show")
          .forEach((openDropdown) => {
            openDropdown.classList.remove("show");
          });
      }
    });
  }
  setupDropdowns();

  // Set default dates
  const startDateInput = document.getElementById("start-date");
  const endDateInput = document.getElementById("end-date");
  const today = new Date();
  const nextMonth = new Date();
  nextMonth.setDate(today.getDate() + 30);
  startDateInput.value = today.toISOString().split("T")[0];
  endDateInput.value = nextMonth.toISOString().split("T")[0];

  // Preset buttons now call the fake data loader
  document
    .querySelectorAll("#test-buttons .control-btn[data-period]")
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        const granularity = btn.dataset.granularity;
        const period = parseInt(btn.dataset.period, 10);
        loadAndRenderFakeData(granularity, period);
      });
    });

  // Granularity toggles
  document.querySelectorAll("[data-granularity-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll("[data-granularity-toggle]")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentGranularity = btn.dataset.granularityToggle;
    });
  });

  // Main "Run" button
  document.getElementById("run-btn").addEventListener("click", () => {
    const startDate = startDateInput.value;
    const endDate = endDateInput.value;
    loadDataFromAPI(startDate, endDate, currentGranularity);
  });

  // KPI card clicks
  document.querySelectorAll(".kpi-card").forEach((card) => {
    card.addEventListener("click", () => setActiveMetric(card.dataset.metric));
  });

  // --- MODIFIED: Fetch last refresh time and remove static text ---
  fetchAndDisplayLastRefreshTime();

  document.getElementById("your-hotel-subtitle").textContent =
    "Displaying data for Rockenue Partner Account";
  document.getElementById("market-subtitle").textContent =
    "Based on a competitive set of 5 hotels, with a total of 450 rooms in London";

  // Initial dashboard load with fake data
  loadAndRenderFakeData("daily", 30);
  setActiveMetric("occupancy");
});
