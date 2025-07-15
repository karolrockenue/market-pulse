// --- Standalone Helper Function ---
// This function is now independent and can be used by both the Alpine component and the chart manager.
function formatValue(value, type) {
  if (value === null || typeof value === "undefined") {
    return "-";
  }
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
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  }
  return num.toFixed(2);
}

// --- NEW: The Standalone Chart Manager ---
// This object handles all ECharts logic, completely separate from Alpine.js.
const chartManager = {
  chartInstance: null,
  activeMetric: "occupancy", // The chart needs to know the metric type for formatting

  // The init function now accepts the container element as an argument.
  // replace with this
  init(containerElement) {
    // Use the default Canvas renderer for stability.
    this.chartInstance = echarts.init(containerElement, "light");

    const baselineOptions = {
      title: {
        text: "",
        left: "left",
        textStyle: {
          color: "#1e293b",
          fontFamily: "Inter, sans-serif",
          fontSize: 20,
          fontWeight: 600,
        },
      },
      legend: {
        data: ["Your Hotel", "The Market"],
        right: 10,
        top: 5,
        icon: "circle",
        itemStyle: { borderColor: "#60a5fa" },
      },
      grid: { left: "3%", right: "4%", bottom: "3%", containLabel: true },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "cross", label: { backgroundColor: "#6a7985" } },
        valueFormatter: (value) => formatValue(value, this.activeMetric),
      },
      xAxis: {
        type: "time",
        // --- NEW: X-Axis Pointer Configuration ---
        axisPointer: {
          label: {
            // This formats the date in the small black box on the x-axis.
            formatter: (params) => {
              const date = new Date(params.value);
              return date.toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              });
            },
          },
        },
      },
      yAxis: {
        type: "value",
        min: 0,
        axisLabel: {
          formatter: (value) => formatValue(value, this.activeMetric),
        },
        // --- NEW: Y-Axis Pointer Configuration ---
        axisPointer: {
          label: {
            // This formats the number in the small black box on the y-axis.
            formatter: (params) => {
              return formatValue(params.value, this.activeMetric);
            },
          },
        },
      },
      series: [],
      animationEasing: "easeinout",
      animationDuration: 1000,
    };
    this.chartInstance.setOption(baselineOptions);
  },
  // The update function now accepts all the data it needs as arguments.
  update(chartData) {
    if (!this.chartInstance) return;

    // Update the active metric so the formatters work correctly.
    this.activeMetric = chartData.activeMetric;

    this.chartInstance.hideLoading();

    const metricConfig = {
      occupancy: { label: "Occupancy" },
      adr: { label: "ADR" },
      revpar: { label: "RevPAR" },
    };
    const newChartType = chartData.granularity === "monthly" ? "bar" : "line";

    const yourHotelSeries = {
      name: "Your Hotel",
      type: newChartType,
      smooth: true,
      symbol: "none",
      sampling: "lttb",
      emphasis: { focus: "series" },
      lineStyle: { width: 3 },
      color: "#FBBF24",
      itemStyle: newChartType === "bar" ? { borderRadius: [4, 4, 0, 0] } : null,
      data: chartData.metrics.map((d) => [
        d.date,
        d.your[chartData.activeMetric],
      ]),
    };
    const marketSeries = {
      name: "The Market",
      type: newChartType,
      smooth: true,
      symbol: "none",
      sampling: "lttb",
      emphasis: { focus: "series" },
      lineStyle: { width: 2 },
      color: "#60a5fa",
      itemStyle: newChartType === "bar" ? { borderRadius: [4, 4, 0, 0] } : null,
      data: chartData.metrics.map((d) => [
        d.date,
        d.market[chartData.activeMetric],
      ]),
    };

    this.chartInstance.setOption(
      {
        title: {
          text: `${metricConfig[chartData.activeMetric].label} for ${
            chartData.propertyName
          } vs The Market`,
        },
        yAxis: {
          axisLabel: {
            formatter: (value) => formatValue(value, chartData.activeMetric),
          },
        },
        series: [yourHotelSeries, marketSeries],
      },
      { replaceMerge: ["series"] }
    );
  },

  // Add helper methods for loading and resizing.
  showLoading() {
    this.chartInstance?.showLoading();
  },

  resize() {
    this.chartInstance?.resize();
  },
};

// --- The Refactored Alpine.js Component ---
export default {
  // --- STATE PROPERTIES (No chart properties anymore) ---
  isLoading: { kpis: true, chart: true, tables: true, properties: true },
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
  marketSubtitle: "",
  allMetrics: [],
  // chart and chartUpdateTimeout have been removed.

  // --- INITIALIZATION ---
  init() {
    this.initializeDashboard();

    // Listen for the 'property-changed' event from the shared header
    window.addEventListener("property-changed", (event) => {
      // When the event is heard, pass the entire detail object to the handler.
      this.handlePropertyChange(event.detail);
    });
  },

  initializeDashboard() {
    // The only setup task left is to initialize the chart and its resize listener.
    this.$nextTick(() => {
      chartManager.init(this.$refs.chartContainer);
      window.addEventListener("resize", () => {
        chartManager.resize();
      });
    });
  },

  // --- STARTUP LOGIC (Unchanged) ---
  async checkUserRoleAndSetupNav() {
    try {
      const response = await fetch("/api/auth/session-info");
      const sessionInfo = await response.json();
      if (sessionInfo.isAdmin) {
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
      this.isLoading.properties = false;
      if (properties.length === 0) {
        this.hasProperties = false;
        this.currentPropertyName = "No Properties Found";
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
      this.isLoading.properties = false;
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

  // --- Chart Logic has been removed from the Alpine component ---

  // --- CORE DATA LOGIC (Now calls chartManager.update) ---
  async loadKpis(startDate, endDate) {
    this.isLoading.kpis = true;
    try {
      const url = `/api/kpi-summary?startDate=${startDate}&endDate=${endDate}&propertyId=${this.currentPropertyId}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Could not load KPI data.");
      const kpiData = await response.json();
      this.renderKpiCards(kpiData);
    } catch (error) {
      this.showError(error.message);
      this.renderKpiCards(null);
    } finally {
      this.isLoading.kpis = false;
    }
  },
  async loadChartAndTables(startDate, endDate, granularity) {
    this.isLoading.chart = true;
    this.isLoading.tables = true;
    chartManager.showLoading(); // Call the chart manager's method
    try {
      const propertyId = this.currentPropertyId;
      const urls = [
        `/api/metrics-from-db?startDate=${startDate}&endDate=${endDate}&granularity=${granularity}&propertyId=${propertyId}`,
        `/api/competitor-metrics?startDate=${startDate}&endDate=${endDate}&granularity=${granularity}&propertyId=${propertyId}`,
      ];
      const [yourHotelResponse, marketResponse] = await Promise.all(
        urls.map((url) => fetch(url))
      );

      if (!yourHotelResponse.ok || !marketResponse.ok) {
        throw new Error("Could not load chart/table data.");
      }
      const yourHotelData = await yourHotelResponse.json();
      const marketData = await marketResponse.json();
      this.allMetrics = this.processAndMergeData(
        yourHotelData.metrics,
        marketData.metrics
      );
      this.marketSubtitle =
        marketData.competitorCount > 0
          ? `Based on a competitive set of ${marketData.competitorCount} hotels.`
          : "No competitor data available for this standard.";

      // Call the chart manager to update the chart, passing all necessary data.
      chartManager.update({
        metrics: this.allMetrics,
        activeMetric: this.activeMetric,
        granularity: this.granularity,
        propertyName: this.currentPropertyName,
      });
    } catch (error) {
      this.showError(error.message);
      this.allMetrics = [];
      chartManager.update({
        metrics: [],
        activeMetric: this.activeMetric,
        granularity: this.granularity,
        propertyName: this.currentPropertyName,
      });
    } finally {
      this.isLoading.chart = false;
      this.isLoading.tables = false;
    }
  },

  // --- DATA PROCESSING & RENDERING (renderKpiCards uses the new standalone helper) ---
  processAndMergeData(yourData, marketData) {
    const dataMap = new Map();
    const processRow = (row, source) => {
      const date = (row.stay_date || row.period).substring(0, 10);
      if (!dataMap.has(date)) {
        dataMap.set(date, { date, your: {}, market: {} });
      }
      const entry = dataMap.get(date);
      entry[source] = {
        occupancy:
          parseFloat(row.occupancy_direct || row.market_occupancy) || 0,
        adr: parseFloat(row.adr || row.market_adr) || 0,
        revpar: parseFloat(row.revpar || row.market_revpar) || 0,
      };
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
      this.kpi = {
        occupancy: { your: "-", market: "-", delta: "" },
        adr: { your: "-", market: "-", delta: "" },
        revpar: { your: "-", market: "-", delta: "" },
      };
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
        // Use the new standalone formatValue helper
        formattedDelta = isNaN(delta)
          ? ""
          : `${delta >= 0 ? "+" : ""}${formatValue(
              Math.abs(delta),
              "currency"
            )}`;
      }
      this.kpi[metric] = {
        your: formatValue(yourValue, metric), // Use the new standalone formatValue helper
        market: formatValue(marketValue, metric), // Use the new standalone formatValue helper
        delta: formattedDelta,
        deltaClass: isNaN(delta)
          ? ""
          : delta >= 0
          ? "text-green-600"
          : "text-red-600",
      };
    }
  },

  // --- UI CONTROL METHODS (setActiveMetric now calls chartManager.update) ---
  runReport() {
    if (!this.dates.start || !this.dates.end || !this.granularity) return;
    this.error.show = false;
    this.loadKpis(this.dates.start, this.dates.end);
    this.loadChartAndTables(this.dates.start, this.dates.end, this.granularity);
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

  setActiveMetric(metric) {
    this.activeMetric = metric;
    // Instead of calling its own updateChart, it calls the chart manager.
    chartManager.update({
      metrics: this.allMetrics,
      activeMetric: this.activeMetric,
      granularity: this.granularity,
      propertyName: this.currentPropertyName,
    });
  },
  // This function now receives both the ID and the name directly from the event.
  handlePropertyChange(eventDetail) {
    const { propertyId, propertyName } = eventDetail;

    // If there's no ID or the ID hasn't changed, do nothing.
    if (!propertyId || this.currentPropertyId === propertyId) {
      return;
    }

    // Set the dashboard's state directly from the event data.
    this.currentPropertyId = propertyId;
    this.currentPropertyName = propertyName; // No more lookups needed!
    this.isLoading.properties = false;
    this.hasProperties = true;

    // Trigger a full data refresh for the new property.
    this.setPreset("current-month");
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

  // --- HELPER METHODS (getDelta uses the standalone helper) ---
  formatValue: formatValue, // Add a reference to the standalone function so the HTML template can find it.

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
      formattedDelta = `${deltaSign}${formatValue(
        Math.abs(delta),
        "currency"
      )}`; // Use standalone helper
    }
    return {
      formattedDelta: formattedDelta,
      deltaClass: delta >= 0 ? "text-green-600" : "text-red-600",
    };
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
};
