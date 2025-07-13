// dashboard.mjs

export default {
  // --- STATE PROPERTIES ---
  isLoading: {
    kpis: true,
    chart: true,
    tables: true,
    properties: true,
  },
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
  // This will hold the ECharts instance.
  chart: null,
  chartUpdateTimeout: null,

  // --- INITIALIZATION ---
  init() {
    this.initializeDashboard();
  },

  async initializeDashboard() {
    this.checkUserRoleAndSetupNav();
    this.fetchAndDisplayLastRefreshTime();

    // Defer chart initialization until the DOM is fully rendered.
    // This uses Alpine's $nextTick to wait for the container div to be ready,
    // which fixes the "only appears with dev tools" bug.
    this.$nextTick(() => {
      this.initChart();
    });
    // Fetch properties, which will trigger the first data load.
    await this.populatePropertySwitcher();
    // Add a listener to resize the chart when the window is resized.
    window.addEventListener("resize", () => {
      if (this.chart) {
        this.chart.resize();
      }
    });
  },

  // --- STARTUP LOGIC ---
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
        this.chart.setOption({
          graphic: { style: { text: "Connect a property to see your data." } },
        });
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

  // --- CHART LOGIC (ECHARTS) ---
  initChart() {
    // Initialize an ECharts instance in the 'light' theme.
    this.chart = echarts.init(this.$refs.chartContainer, "light", {
      renderer: "svg",
    });

    // Define the baseline options that are common to all chart states.
    const baselineOptions = {
      // Use a title component for the main title text.
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
      // Configure the legend for our two data series.
      legend: {
        data: ["Your Hotel", "The Market"],
        right: 10,
        top: 5,
        icon: "circle",
        itemStyle: {
          borderColor: "#60a5fa", // A subtle touch
        },
      },
      // The grid component controls the positioning of the chart plot.
      grid: {
        left: "3%",
        right: "4%",
        bottom: "3%",
        containLabel: true, // Ensures axis labels don't get cut off.
      },
      // Tooltip configuration for hover interactions.
      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "cross",
          label: {
            backgroundColor: "#6a7985",
          },
        },
      },
      // X-axis configured for time-series data.
      xAxis: {
        type: "time",
      },
      // Y-axis configured for numerical values.
      yAxis: {
        type: "value",
        min: 0,
        axisLabel: {
          formatter: (value) => this.formatValue(value, this.activeMetric),
        },
      },
      // The series array will be populated dynamically.
      series: [],
      // Animation settings for smooth transitions.
      animationEasing: "easeinout",
      animationDuration: 1000,
    };

    // Set the initial options on the chart.
    this.chart.setOption(baselineOptions);
    // Show a loading message until data is fetched.
    this.chart.showLoading();
  },

  updateChart() {
    // Use the timeout pattern to ensure stability.
    clearTimeout(this.chartUpdateTimeout);
    this.chartUpdateTimeout = setTimeout(() => {
      if (!this.chart) return;

      // Hide loading animation now that we have data.
      this.chart.hideLoading();

      const metricConfig = {
        occupancy: { label: "Occupancy", format: "percent" },
        adr: { label: "ADR", format: "currency" },
        revpar: { label: "RevPAR", format: "currency" },
      };

      const newChartType = this.granularity === "monthly" ? "bar" : "line";

      // --- ECharts Series Configuration ---
      // This is where we define the visual representation of our data.
      const yourHotelSeries = {
        name: "Your Hotel",
        type: newChartType,
        smooth: true,
        symbol: "none", // No data point markers by default
        sampling: "lttb", // Downsampling for performance with large datasets
        emphasis: {
          // Style on hover
          focus: "series",
        },
        lineStyle: {
          width: 2,
        },
        // For 'line' charts, this creates the gradient area fill.
        areaStyle:
          newChartType === "line"
            ? {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                  { offset: 0, color: "rgba(96, 165, 250, 0.25)" },
                  { offset: 1, color: "rgba(96, 165, 250, 0.05)" },
                ]),
              }
            : null,
        // For 'bar' charts, this provides rounded corners.
        itemStyle:
          newChartType === "bar"
            ? {
                borderRadius: [4, 4, 0, 0],
              }
            : null,
        data: this.allMetrics.map((d) => [d.date, d.your[this.activeMetric]]),
      };

      const marketSeries = {
        name: "The Market",
        type: newChartType,
        smooth: true,
        symbol: "none",
        sampling: "lttb",
        emphasis: {
          focus: "series",
        },
        lineStyle: {
          width: 2,
        },
        itemStyle:
          newChartType === "bar"
            ? {
                borderRadius: [4, 4, 0, 0],
              }
            : null,
        data: this.allMetrics.map((d) => [d.date, d.market[this.activeMetric]]),
      };

      // The `setOption` method is declarative. ECharts intelligently merges
      // these options with the existing ones to create a smooth transition.
      this.chart.setOption(
        {
          title: {
            text: `${metricConfig[this.activeMetric].label} for ${
              this.currentPropertyName
            } vs The Market`,
          },
          // The color palette for the series.
          color: ["#60a5fa", "#334155"],
          tooltip: {
            // Custom formatter for the tooltip content.
            formatter: (params) => {
              let date = new Date(params[0].axisValue);
              let tooltipHtml = `${date.toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}<br/>`;
              params.forEach((param) => {
                tooltipHtml += `
                        <span style="display:inline-block;margin-right:4px;border-radius:10px;width:10px;height:10px;background-color:${
                          param.color
                        };"></span>
                        ${param.seriesName}: <strong>${this.formatValue(
                  param.value[1],
                  this.activeMetric
                )}</strong>
                        <br/>
                    `;
              });
              return tooltipHtml;
            },
          },
          // Update the y-axis label formatter for the current metric.
          yAxis: {
            axisLabel: {
              formatter: (value) => this.formatValue(value, this.activeMetric),
            },
          },
          // Provide the new series data. `notMerge` is false by default, allowing smooth animation.
          series: [yourHotelSeries, marketSeries],
        },
        {
          // Do not merge series arrays, replace them instead.
          replaceMerge: ["series"],
        }
      );
    }, 100);
  },

  // --- CORE DATA LOGIC ---
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
    this.chart?.showLoading();
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
      this.updateChart();
    } catch (error) {
      this.showError(error.message);
      this.allMetrics = [];
      this.updateChart();
    } finally {
      this.isLoading.chart = false;
      this.isLoading.tables = false;
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
    this.updateChart();
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
