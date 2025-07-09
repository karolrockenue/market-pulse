// --- GLOBAL STATE & CONFIG ---
let comparisonChart = null;
let yourHotelMetrics = [];
let marketMetrics = [];
let activeMetric = "occupancy";
let currentGranularity = "daily";
let hotelName = "Your Hotel";
let isInitialLoad = true;

const metricConfig = {
  occupancy: { label: "Occupancy", format: "percent" },
  adr: { label: "ADR", format: "currency" },
  revpar: { label: "RevPAR", format: "currency" },
};

const chartColors = { primary: "#60a5fa", secondary: "#334155" };

async function populatePropertySwitcher() {
  const switcherBtn = document.getElementById("hotel-btn");
  const currentNameEl = document.getElementById("current-property-name");
  const dropdownEl = document.getElementById("hotel-dropdown");

  try {
    const response = await fetch("/api/my-properties", {
      credentials: "include",
    });
    if (!response.ok) throw new Error("Could not fetch properties.");

    const properties = await response.json();
    dropdownEl.innerHTML = "";

    if (properties.length === 0) {
      currentNameEl.textContent = "No Properties Found";
      switcherBtn.disabled = true;
      return;
    }

    let activeProperty = properties[0];
    currentNameEl.textContent = activeProperty.property_name;
    window.currentPropertyId = activeProperty.property_id;

    properties.forEach((property) => {
      const link = document.createElement("a");
      link.href = "#";
      link.className =
        "block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100";
      link.textContent = property.property_name;
      link.dataset.propertyId = property.property_id;

      link.addEventListener("click", (e) => {
        e.preventDefault();
        window.currentPropertyId = property.property_id;
        currentNameEl.textContent = property.property_name;
        dropdownEl.classList.remove("show");

        const startDate = document.getElementById("start-date").value;
        const endDate = document.getElementById("end-date").value;
        loadDataFromAPI(startDate, endDate, currentGranularity);
      });
      dropdownEl.appendChild(link);
    });
  } catch (error) {
    console.error("Failed to populate property switcher:", error);
    currentNameEl.textContent = "Error";
    switcherBtn.disabled = true;
  }
}

// --- Error Handling UI Functions ---
function showError(message) {
  const errorNotification = document.getElementById("error-notification");
  const errorMessage = document.getElementById("error-message");
  if (errorNotification && errorMessage) {
    errorMessage.textContent = message;
    errorNotification.classList.remove("hidden", "translate-x-full");
  }
}

function hideError() {
  const errorNotification = document.getElementById("error-notification");
  if (errorNotification) {
    errorNotification.classList.add("translate-x-full");
    setTimeout(() => errorNotification.classList.add("hidden"), 300);
  }
}

// --- DATA PROCESSING ---
function processAndMergeData(yourData, marketData) {
  const dataMap = new Map();

  yourData.forEach((row) => {
    const date = (row.stay_date || row.period).substring(0, 10);
    if (!dataMap.has(date)) {
      dataMap.set(date, { date: date, your: {}, market: {} });
    }
    const entry = dataMap.get(date);
    entry.your = {
      occupancy: parseFloat(row.occupancy_direct) || 0,
      adr: parseFloat(row.adr) || 0,
      revpar: parseFloat(row.revpar) || 0,
    };
  });

  marketData.forEach((row) => {
    const date = (row.stay_date || row.period).substring(0, 10);
    if (!dataMap.has(date)) {
      dataMap.set(date, { date: date, your: {}, market: {} });
    }
    const entry = dataMap.get(date);
    entry.market = {
      occupancy: parseFloat(row.market_occupancy) || 0,
      adr: parseFloat(row.market_adr) || 0,
      revpar: parseFloat(row.market_revpar) || 0,
    };
  });

  const mergedData = Array.from(dataMap.values());

  mergedData.forEach((entry) => {
    if (Object.keys(entry.your).length === 0) {
      entry.your = { occupancy: 0, adr: 0, revpar: 0 };
    }
    if (Object.keys(entry.market).length === 0) {
      entry.market = { occupancy: 0, adr: 0, revpar: 0 };
    }
  });

  return mergedData.sort((a, b) => new Date(a.date) - new Date(b.date));
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
  renderTables();
  renderChart();
}

function renderKpiCards(kpiData) {
  if (!kpiData || !kpiData.yourHotel || !kpiData.market) {
    ["occupancy", "adr", "revpar"].forEach((metric) => {
      document.getElementById(`kpi-${metric}-your`).textContent = "-";
      document.getElementById(`kpi-${metric}-market`).textContent = "-";
      document.getElementById(`kpi-${metric}-delta`).textContent = "";
    });
    return;
  }

  const { yourHotel, market } = kpiData;

  ["occupancy", "adr", "revpar"].forEach((metric) => {
    const yourValue = yourHotel[metric];
    const marketValue = market[metric];
    const delta = yourValue - marketValue;

    document.getElementById(`kpi-${metric}-your`).textContent = formatValue(
      yourValue,
      metricConfig[metric].format
    );
    document.getElementById(`kpi-${metric}-market`).textContent = formatValue(
      marketValue,
      metricConfig[metric].format
    );

    const deltaEl = document.getElementById(`kpi-${metric}-delta`);
    if (isNaN(delta)) {
      deltaEl.textContent = "";
      return;
    }

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
  return date.toLocaleDateString("en-GB", { timeZone: "UTC" });
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
    const placeholderRow = `<tr><td colspan="5" class="text-center p-8 text-gray-500">No data to display for this period</td></tr>`;
    yourTable.innerHTML = placeholderRow;
    marketTable.innerHTML = placeholderRow;
    return;
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

Chart.defaults.color = "#64748b";
Chart.defaults.borderColor = "#e2e8f0";

function getYAxisOptions(metric, dataMin, dataMax) {
  const baseOptions = {
    grid: { color: "#e2e8f0" },
    beginAtZero: true, // Ensure axis always starts at 0
  };

  if (metric === "occupancy") {
    let suggestedMax = Math.ceil((dataMax + 20) / 10) * 10;
    suggestedMax = Math.min(100, suggestedMax);
    return {
      ...baseOptions,
      min: 0, // Explicitly set min to 0
      max: suggestedMax,
      ticks: { stepSize: 10, callback: (value) => value + "%" },
    };
  }

  const range = dataMax - dataMin;
  const padding = range > 0 ? range * 0.2 : dataMax * 0.2;
  const suggestedMax = Math.ceil((dataMax + padding) / 10) * 10;
  return {
    ...baseOptions,
    min: 0, // Explicitly set min to 0 for all other metrics
    max: suggestedMax,
    ticks: { callback: (value) => "$" + value },
  };
}

function renderChart() {
  const chartContainer = document.getElementById("chart-container");
  const noDataOverlay = document.getElementById("no-data-overlay");

  if (comparisonChart) {
    comparisonChart.destroy();
    comparisonChart = null;
  }

  if (yourHotelMetrics.length === 0) {
    chartContainer.classList.add("hidden");
    noDataOverlay.classList.remove("hidden");
    return;
  } else {
    chartContainer.classList.remove("hidden");
    noDataOverlay.classList.add("hidden");
  }

  const ctx = document.getElementById("comparisonChart").getContext("2d");

  const isSingleDataPoint = yourHotelMetrics.length === 1;
  const chartType = isSingleDataPoint
    ? "bar"
    : currentGranularity === "daily"
    ? "line"
    : "bar";
  const isLineChart = chartType === "line";

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
  ).textContent = `${metricConfig[activeMetric].label} for ${hotelName} vs The Market`;

  const config = {
    type: chartType,
    data: {
      labels: labels,
      datasets: [
        {
          label: `Your Hotel`,
          data: yourData,
          backgroundColor: isLineChart ? "transparent" : chartColors.primary,
          borderColor: chartColors.primary,
          borderWidth: isLineChart ? 2.5 : 1,
          pointRadius: 0,
          tension: 0.3,
          clip: false,
          fill: isLineChart
            ? {
                target: 1,
                above: "rgba(96, 165, 250, 0.1)",
                below: "rgba(51, 65, 85, 0.1)",
              }
            : false,
        },
        {
          label: `The Market`,
          data: marketData,
          backgroundColor: isLineChart ? "transparent" : chartColors.secondary,
          borderColor: chartColors.secondary,
          borderWidth: isLineChart ? 2 : 1,
          borderDash: isLineChart ? [5, 5] : [],
          pointRadius: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      onHover: syncChartAndTables,
      scales: {
        x: { grid: { display: false } },
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
          callbacks: {
            label: function (context) {
              let label = context.dataset.label || "";
              if (label) {
                label += ": ";
              }
              if (context.parsed.y !== null) {
                const value = context.parsed.y;
                if (activeMetric === "occupancy") {
                  label += value.toFixed(1) + "%";
                } else {
                  label += "$" + value.toFixed(2);
                }
              }
              return label;
            },
          },
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

// --- DATA LOADING ---
async function loadDataFromAPI(startDate, endDate, granularity) {
  const dataDisplayWrapper = document.getElementById("data-display-wrapper");
  const loadingOverlay = document.getElementById("loading-overlay");
  const contentWrapper = document.getElementById("dashboard-content-wrapper");

  hideError();
  if (!isInitialLoad) {
    dataDisplayWrapper.classList.add("loading");
  }

  try {
    const yourHotelUrl = `/api/metrics-from-db?startDate=${startDate}&endDate=${endDate}&granularity=${granularity}&propertyId=${window.currentPropertyId}`;
    const marketUrl = `/api/competitor-metrics?startDate=${startDate}&endDate=${endDate}&granularity=${granularity}&propertyId=${window.currentPropertyId}`;
    const kpiUrl = `/api/kpi-summary?startDate=${startDate}&endDate=${endDate}&propertyId=${window.currentPropertyId}`;

    const [yourHotelResponse, marketResponse, kpiResponse] = await Promise.all([
      fetch(yourHotelUrl, { credentials: "include" }),
      fetch(marketUrl, { credentials: "include" }),
      fetch(kpiUrl, { credentials: "include" }),
    ]);

    if (!yourHotelResponse.ok || !marketResponse.ok || !kpiResponse.ok) {
      throw new Error("Failed to fetch data from one or more API endpoints.");
    }

    const yourHotelData = await yourHotelResponse.json();
    const marketData = await marketResponse.json();
    const kpiData = await kpiResponse.json();

    await fetchAndSetDisplayNames();

    renderKpiCards(kpiData);
    const processedData = processAndMergeData(
      yourHotelData.metrics,
      marketData.metrics
    );
    yourHotelMetrics = processedData;
    marketMetrics = processedData;

    const marketSubtitleEl = document.getElementById("market-subtitle");
    if (marketData.competitorCount > 0) {
      marketSubtitleEl.textContent = `Based on a competitive set of ${marketData.competitorCount} hotels of a similar standard.`;
    } else {
      marketSubtitleEl.textContent =
        "No competitor data available for this period or standard.";
    }

    renderTables();
    renderChart();
  } catch (error) {
    console.error("Error loading data:", error);
    showError(`Could not load dashboard data. ${error.message}`);
  } finally {
    if (isInitialLoad) {
      loadingOverlay.style.opacity = "0";
      contentWrapper.style.opacity = "1";
      setTimeout(() => {
        loadingOverlay.classList.add("hidden");
      }, 500);
      isInitialLoad = false;
    } else {
      dataDisplayWrapper.classList.remove("loading");
    }
  }
}

async function fetchAndSetDisplayNames() {
  try {
    const response = await fetch(
      `/api/get-hotel-name?propertyId=${window.currentPropertyId}`,
      { credentials: "include" }
    );
    if (!response.ok) throw new Error("Failed to fetch hotel details");
    const hotelData = await response.json();
    hotelName = hotelData.hotelName || "Your Hotel";
    document.getElementById("your-hotel-table-title").textContent = hotelName;
  } catch (error) {
    console.error("Could not set dynamic hotel name:", error);
    document.getElementById("your-hotel-table-title").textContent =
      "Your Hotel";
  }
}

async function fetchAndDisplayLastRefreshTime() {
  const timestampEl = document.getElementById("data-timestamp");
  try {
    const response = await fetch("/api/last-refresh-time", {
      credentials: "include",
    });
    if (!response.ok) {
      throw new Error("Could not fetch refresh time.");
    }
    const data = await response.json();
    const lastRefreshDate = new Date(data.last_successful_run);
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

function formatDateForInput(date) {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// --- INITIALIZE ---
document.addEventListener("DOMContentLoaded", async () => {
  const startDateInput = document.getElementById("start-date");
  const endDateInput = document.getElementById("end-date");
  const runBtn = document.getElementById("run-btn");
  const loadingOverlay = document.getElementById("loading-overlay");
  const closeErrorBtn = document.getElementById("close-error-btn");

  if (closeErrorBtn) {
    closeErrorBtn.addEventListener("click", hideError);
  }

  await populatePropertySwitcher();

  if (!window.currentPropertyId) {
    showError("Could not load properties. Dashboard cannot be initialized.");
    loadingOverlay.style.opacity = "0";
    setTimeout(() => {
      loadingOverlay.classList.add("hidden");
    }, 500);
    return;
  }

  await fetchAndDisplayLastRefreshTime();

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

  function setupLogout() {
    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", async () => {
        try {
          const response = await fetch("/api/auth/logout", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
          });

          if (response.ok) {
            window.location.href = "/signin";
          } else {
            showError("Logout failed. Please try again.");
          }
        } catch (error) {
          console.error("Logout error:", error);
          showError("An error occurred during logout.");
        }
      });
    }
  }
  setupLogout();

  // --- NEW: Modal Handling Script ---
  function setupModals() {
    document.querySelectorAll("[data-modal-target]").forEach((button) => {
      button.addEventListener("click", () => {
        const modal = document.getElementById(button.dataset.modalTarget);
        if (modal) {
          modal.classList.remove("hidden");
          modal.classList.add("flex");
        }
      });
    });
    document.querySelectorAll("[data-modal-close]").forEach((button) => {
      button.addEventListener("click", () => {
        const modal = document.getElementById(button.dataset.modalClose);
        if (modal) {
          modal.classList.add("hidden");
          modal.classList.remove("flex");
        }
      });
    });
    window.addEventListener("click", (event) => {
      if (event.target.matches('[id$="-modal"]')) {
        event.target.classList.add("hidden");
        event.target.classList.remove("flex");
      }
    });
  }
  setupModals();

  document.querySelectorAll("[data-preset]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const preset = btn.dataset.preset;
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

      startDateInput.value = formatDateForInput(startDate);
      endDateInput.value = formatDateForInput(endDate);

      document
        .querySelectorAll("[data-preset]")
        .forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");

      if (preset === "this-year") {
        currentGranularity = "monthly";
      } else {
        currentGranularity = "daily";
      }
      document
        .querySelectorAll("[data-granularity-toggle]")
        .forEach((g) => g.classList.remove("active"));
      document
        .querySelector(`[data-granularity-toggle="${currentGranularity}"]`)
        .classList.add("active");

      loadDataFromAPI(
        startDateInput.value,
        endDateInput.value,
        currentGranularity
      );
    });
  });

  document.querySelectorAll("[data-granularity-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.classList.contains("active")) return;
      document
        .querySelectorAll("[data-granularity-toggle]")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentGranularity = btn.dataset.granularityToggle;
      loadDataFromAPI(
        startDateInput.value,
        endDateInput.value,
        currentGranularity
      );
    });
  });

  runBtn.addEventListener("click", () => {
    loadDataFromAPI(
      startDateInput.value,
      endDateInput.value,
      currentGranularity
    );
  });

  [startDateInput, endDateInput].forEach((input) => {
    input.addEventListener("change", () => {
      document
        .querySelectorAll("[data-preset]")
        .forEach((p) => p.classList.remove("active"));
    });
  });

  document.querySelectorAll(".kpi-card").forEach((card) => {
    card.addEventListener("click", () => setActiveMetric(card.dataset.metric));
  });

  document.querySelector('[data-preset="current-month"]').click();
  setActiveMetric("occupancy");
});
