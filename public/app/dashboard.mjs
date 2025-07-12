// dashboard.mjs

// ACTION: All component logic is defined here and exported as a single default object.
// REASON: This creates a self-contained, maintainable module for the dashboard's functionality.
//         The index.html file will be clean and only responsible for initializing this module.
export default {
  // --- STATE PROPERTIES ---
  isInitialLoading: true,
  isLoadingData: false,
  hasProperties: false,
  isLegalModalOpen: false,
  propertyDropdownOpen: false,
  userDropdownOpen: false,
  error: { show: false, message: "" },
  activeMetric: "occupancy",
  granularity: "daily",
  activePreset: "",
  dates: { start: "", end: "" },
  properties: [],
  currentPropertyId: null,
  currentPropertyName: "Loading...",
  lastRefreshText: "Loading...",
  kpi: {
    occupancy: { your: "-", market: "-", delta: "" },
    adr: { your: "-", market: "-", delta: "" },
    revpar: { your: "-", market: "-", delta: "" },
  },
  chartTitle: "",
  isChartEmpty: true,
  marketSubtitle: "",
  allMetrics: [],
  chartInstance: null,

  // --- INITIALIZATION ---
  init() {
    this.initializeDashboard();
    // Use this.$watch, which is the correct Alpine syntax inside a component object
    this.$watch("allMetrics", () => this.updateChart());
    this.$watch("activeMetric", () => this.updateChart());
    this.$watch("granularity", () => this.updateChart()); // Re-render chart on granularity change
  },

  // --- STARTUP LOGIC ---
  async initializeDashboard() {
    await this.checkUserRoleAndSetupNav();
    await this.fetchAndDisplayLastRefreshTime();
    await this.populatePropertySwitcher();
  },

  async checkUserRoleAndSetupNav() {
    try {
      const response = await fetch("/api/auth/session-info");
      const sessionInfo = await response.json();
      if (sessionInfo.isAdmin) {
        // Use this.$refs for robust element access
        this.$refs.adminNavLink.style.display = "flex";
      }
    } catch (error) {
      console.error("Could not check user role:", error);
    }
  },

  async populatePropertySwitcher() {
    try {
      const response = await fetch("/api/my-properties");
      if (!response.ok) throw new Error("Could not fetch properties.");
      const properties = await response.json();

      if (properties.length === 0) {
        this.hasProperties = false;
        this.currentPropertyName = "No Properties Found";
        this.isInitialLoading = false;
        return;
      }

      this.hasProperties = true;
      this.properties = properties;

      const firstProperty = properties[0];
      this.currentPropertyId = firstProperty.property_id;
      this.currentPropertyName = firstProperty.property_name;

      this.setPreset("current-month");
    } catch (error) {
      this.showError(error.message);
      this.isInitialLoading = false;
    }
  },

  async fetchAndDisplayLastRefreshTime() {
    try {
      const response = await fetch("/api/last-refresh-time");
      if (!response.ok) throw new Error("Could not fetch refresh time.");
      const data = await response.json();
      const lastRefreshDate = new Date(data.last_successful_run);
      this.lastRefreshText = `Data updated on ${lastRefreshDate.toLocaleString(
        "en-GB",
        { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Warsaw" }
      )}`;
    } catch (error) {
      this.lastRefreshText = "Displaying real-time view";
    }
  },

  // --- CORE DATA LOGIC ---
  async loadDataFromAPI(startDate, endDate, granularity) {
    if (!this.currentPropertyId) return;

    this.isLoadingData = true;
    this.error.show = false;

    try {
      const propertyId = this.currentPropertyId;
      const urls = [
        `/api/metrics-from-db?startDate=${startDate}&endDate=${endDate}&granularity=${granularity}&propertyId=${propertyId}`,
        `/api/competitor-metrics?startDate=${startDate}&endDate=${endDate}&granularity=${granularity}&propertyId=${propertyId}`,
        `/api/kpi-summary?startDate=${startDate}&endDate=${endDate}&propertyId=${propertyId}`,
      ];
      const responses = await Promise.all(urls.map((url) => fetch(url)));

      for (const response of responses) {
        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || `Failed with status ${response.status}`);
        }
      }
      const [yourHotelData, marketData, kpiData] = await Promise.all(
        responses.map((res) => res.json())
      );

      this.allMetrics = this.processAndMergeData(
        yourHotelData.metrics,
        marketData.metrics
      );
      this.marketSubtitle =
        marketData.competitorCount > 0
          ? `Based on a competitive set of ${marketData.competitorCount} hotels.`
          : "No competitor data available for this standard.";
      this.renderKpiCards(kpiData);
    } catch (error) {
      this.showError(`Could not load dashboard data: ${error.message}`);
      this.allMetrics = [];
    } finally {
      this.isLoadingData = false;
      if (this.isInitialLoading) {
        this.isInitialLoading = false;
      }
    }
  },

  processAndMergeData(yourData, marketData) {
    const dataMap = new Map();
    const processRow = (row, source) => {
      const date = (row.stay_date || row.period).substring(0, 10);
      if (!dataMap.has(date)) {
        dataMap.set(date, { date, your: {}, market: {} });
      }
      const entry = dataMap.get(date);
      const dataObject =
        source === "your"
          ? {
              occupancy: parseFloat(row.occupancy_direct) || 0,
              adr: parseFloat(row.adr) || 0,
              revpar: parseFloat(row.revpar) || 0,
            }
          : {
              occupancy: parseFloat(row.market_occupancy) || 0,
              adr: parseFloat(row.market_adr) || 0,
              revpar: parseFloat(row.market_revpar) || 0,
            };
      entry[source] = dataObject;
    };
    yourData.forEach((row) => processRow(row, "your"));
    marketData.forEach((row) => processRow(row, "market"));
    const mergedData = Array.from(dataMap.values());
    mergedData.forEach((entry) => {
      if (Object.keys(entry.your).length === 0)
        entry.your = { occupancy: 0, adr: 0, revpar: 0 };
      if (Object.keys(entry.market).length === 0)
        entry.market = { occupancy: 0, adr: 0, revpar: 0 };
    });
    return mergedData.sort((a, b) => new Date(a.date) - new Date(b.date));
  },

  renderKpiCards(kpiData) {
    if (!kpiData || !kpiData.yourHotel || !kpiData.market) {
      this.kpi = { occupancy: {}, adr: {}, revpar: {} };
      return;
    }
    for (const metric of ["occupancy", "adr", "revpar"]) {
      const yourValue = kpiData.yourHotel[metric];
      const marketValue = kpiData.market[metric];
      const delta = yourValue - marketValue;
      let formattedDelta;
      if (metric === "occupancy") {
        formattedDelta = isNaN(delta)
          ? ""
          : `${delta >= 0 ? "+" : ""}${(Math.abs(delta) * 100).toFixed(1)}pts`;
      } else {
        formattedDelta = isNaN(delta)
          ? ""
          : `${delta >= 0 ? "+" : ""}${this.formatValue(
              Math.abs(delta),
              "currency"
            )}`;
      }
      this.kpi[metric] = {
        your: this.formatValue(yourValue, metric),
        market: this.formatValue(marketValue, metric),
        delta: formattedDelta,
        deltaClass: isNaN(delta)
          ? ""
          : delta >= 0
          ? "text-green-600"
          : "text-red-600",
      };
    }
  },

  // --- UI CONTROL METHODS ---
  runReport() {
    if (!this.dates.start || !this.dates.end || !this.granularity) return;
    this.loadDataFromAPI(this.dates.start, this.dates.end, this.granularity);
  },

  setGranularity(newGranularity) {
    this.granularity = newGranularity;
    this.runReport();
  },

  setPreset(preset) {
    this.activePreset = preset;
    const today = new Date();
    const yearUTC = today.getUTCFullYear();
    const monthUTC = today.getUTCMonth();
    let startDate, endDate;
    if (preset === "current-month") {
      startDate = new Date(Date.UTC(yearUTC, monthUTC, 1));
      endDate = new Date(Date.UTC(yearUTC, monthUTC + 1, 0));
    } else if (preset === "next-month") {
      startDate = new Date(Date.UTC(yearUTC, monthUTC + 1, 1));
      endDate = new Date(Date.UTC(yearUTC, monthUTC + 2, 0));
    } else if (preset === "this-year") {
      startDate = new Date(Date.UTC(yearUTC, 0, 1));
      endDate = new Date(Date.UTC(yearUTC, 11, 31));
    }
    const formatDate = (date) => date.toISOString().split("T")[0];
    this.dates.start = formatDate(startDate);
    this.dates.end = formatDate(endDate);
    this.granularity = preset === "this-year" ? "monthly" : "daily";
    this.runReport();
  },

  switchProperty(propertyId) {
    if (this.currentPropertyId === propertyId) return;
    const property = this.properties.find((p) => p.property_id === propertyId);
    if (property) {
      this.currentPropertyId = property.property_id;
      this.currentPropertyName = property.property_name;
      this.runReport();
    }
  },

  setActiveMetric(metric) {
    this.activeMetric = metric;
  },

  logout() {
    fetch("/api/auth/logout", { method: "POST" })
      .then((res) => {
        if (res.ok) window.location.href = "/signin";
        else this.showError("Logout failed. Please try again.");
      })
      .catch(() => this.showError("An error occurred during logout."));
  },

  showError(message) {
    this.error.message = message;
    this.error.show = true;
  },

  // --- HELPER & FORMATTING METHODS ---
  getDelta(day) {
    if (
      !day.your ||
      !day.market ||
      day.your[this.activeMetric] === undefined ||
      day.market[this.activeMetric] === undefined
    ) {
      return { formattedDelta: "-", deltaClass: "" };
    }
    const delta = day.your[this.activeMetric] - day.market[this.activeMetric];
    if (isNaN(delta)) return { formattedDelta: "-", deltaClass: "" };
    const deltaSign = delta >= 0 ? "+" : "";
    let formattedDelta;
    if (this.activeMetric === "occupancy") {
      formattedDelta = `${deltaSign}${(Math.abs(delta) * 100).toFixed(1)}pts`;
    } else {
      formattedDelta = `${deltaSign}${this.formatValue(
        Math.abs(delta),
        "currency"
      )}`;
    }
    return {
      formattedDelta: formattedDelta,
      deltaClass: delta >= 0 ? "text-green-600" : "text-red-600",
    };
  },

  formatValue(value, type) {
    const num = parseFloat(value);
    if (isNaN(num)) return "-";
    if (type === "percent" || type === "occupancy") {
      return new Intl.NumberFormat("en-GB", {
        style: "percent",
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }).format(num);
    }
    if (type === "currency" || type === "adr" || type === "revpar") {
      return new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: "GBP",
      }).format(num);
    }
    return num.toFixed(2);
  },

  formatDateLabel(dateString, granularity) {
    if (!dateString) return "";
    const date = new Date(dateString);
    if (granularity === "monthly") {
      return date.toLocaleString("en-US", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      });
    }
    if (granularity === "weekly") {
      return `Wk of ${date.toLocaleDateString("en-GB", { timeZone: "UTC" })}`;
    }
    return date.toLocaleDateString("en-GB", { timeZone: "UTC" });
  },

  // --- REACTIVE CHART METHOD ---
  updateChart() {
    if (this.chartInstance) {
      this.chartInstance.destroy();
    }
    this.isChartEmpty = this.allMetrics.length === 0;
    if (this.isChartEmpty) return;

    const ctx = this.$refs.chartCanvas.getContext("2d");
    const metricConfig = {
      occupancy: { label: "Occupancy", format: "percent" },
      adr: { label: "ADR", format: "currency" },
      revpar: { label: "RevPAR", format: "currency" },
    };
    const chartColors = { primary: "#60a5fa", secondary: "#334155" };
    this.chartTitle = `${metricConfig[this.activeMetric].label} for ${
      this.currentPropertyName
    } vs The Market`;
    const labels = this.allMetrics.map((d) =>
      this.formatDateLabel(d.date, this.granularity)
    );
    const yourData = this.allMetrics.map((d) => d.your[this.activeMetric]);
    const marketData = this.allMetrics.map((d) => d.market[this.activeMetric]);

    // --- DYNAMIC CHART CONFIGURATION ---
    const isLineChart = this.granularity === "daily";
    const chartType = isLineChart ? "line" : "bar";

    const datasets = [
      {
        label: `Your Hotel`,
        data: yourData,
        // Line chart specific styles
        borderColor: chartColors.primary,
        backgroundColor: isLineChart ? "transparent" : chartColors.primary,
        tension: 0.3,
        pointRadius: isLineChart ? 3 : 0,
        pointBackgroundColor: chartColors.primary,
        fill: false,
      },
      {
        label: `The Market`,
        data: marketData,
        // Line chart specific styles
        borderColor: chartColors.secondary,
        backgroundColor: isLineChart ? "transparent" : chartColors.secondary,
        tension: 0.3,
        pointRadius: isLineChart ? 3 : 0,
        pointBackgroundColor: chartColors.secondary,
        fill: false,
      },
    ];

    this.chartInstance = new Chart(ctx, {
      type: chartType, // Use the dynamic chart type
      data: {
        labels: labels,
        datasets: datasets, // Use the dynamically styled datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            grid: { display: false },
            type: "time",
            time: {
              unit: this.granularity === "monthly" ? "month" : "day",
              tooltipFormat: "dd MMM yyyy",
            },
          },
          y: {
            min: 0,
            ticks: {
              callback: (value) =>
                this.formatValue(value, metricConfig[this.activeMetric].format),
            },
          },
        },
        plugins: {
          legend: {
            position: "top",
            align: "end",
            labels: { usePointStyle: true, boxWidth: 8, padding: 20 },
          },
          tooltip: {
            mode: "index",
            intersect: false,
            callbacks: {
              label: (context) =>
                `${context.dataset.label}: ${this.formatValue(
                  context.parsed.y,
                  metricConfig[this.activeMetric].format
                )}`,
            },
          },
        },
      },
    });
  },
};
