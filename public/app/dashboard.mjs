// --- Standalone Helper Function ---

// This function is now independent and can be used by both the Alpine component and the chart manager.
function formatValue(value, type, currencyCode = "USD") {
  // Add a default currency
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
    // This now uses the dynamic currencyCode passed into the function
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  }
  return num.toFixed(2);
}
// --- NEW: Specialized Chart Managers ---

// Manager for the main ECharts instance on the dashboard.
const mainChartManager = {
  chartInstance: null, // Holds the ECharts instance.

  // Initializes the chart with baseline options.
  init(containerElement) {
    if (!containerElement) return;
    this.chartInstance =
      echarts.getInstanceByDom(containerElement) ||
      echarts.init(containerElement);
    this.chartInstance.setOption({
      grid: {
        top: "5%",
        right: "3%",
        bottom: "12%",
        left: "2%",
        containLabel: true,
      },
      xAxis: {
        type: "category",
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: "#64748b", padding: [10, 0, 0, 0] },
      },
      yAxis: {
        type: "value",
        splitNumber: 5,
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { type: "dotted", color: "#e2e8f0" } },
        axisLabel: { color: "#64748b" },
      },
      series: [],
      legend: { show: false },
      tooltip: { show: true, trigger: "axis" },
    });
  },

  // Updates the chart with new data and configuration.
  update(data) {
    if (!this.chartInstance) return;
    this.chartInstance.hideLoading();
    const formatChartValue = (value) =>
      data.activeMetric === "occupancy"
        ? `${(value * 100).toFixed(1)}%`
        : formatValue(value, "currency", data.currencyCode);
    const chartType = data.granularity === "monthly" ? "bar" : "line";
    const axisLabels = data.metrics.map((day) =>
      data.granularity === "weekly"
        ? "Wk " + window.getWeekNumber(new Date(day.date))
        : data.formatDateLabel(day.date, data.granularity)
    );
    this.chartInstance.setOption(
      {
        xAxis: { data: axisLabels, boundaryGap: chartType === "bar" },
        yAxis: {
          min: data.activeMetric === "occupancy" ? 0 : null,
          max: data.activeMetric === "occupancy" ? 1 : null,
          axisLabel: {
            formatter: (value) =>
              data.activeMetric === "occupancy"
                ? `${value * 100}%`
                : formatValue(value, "currency", data.currencyCode),
          },
        },
        tooltip: {
          formatter: (params) => {
            const title = data.formatDateLabel(
              data.metrics[params[0].dataIndex].date,
              data.granularity
            );
            let tooltipHtml = `<div style="font-family: Inter, sans-serif; font-size: 13px;"><strong style="margin-bottom: 8px; display: block;">${title}</strong>`;
            params.forEach((param) => {
              const value = formatChartValue(param.value);
              tooltipHtml += `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;"><div style="display: flex; align-items: center;">${param.marker}<span style="margin-left: 8px;">${param.seriesName}</span></div><strong style="margin-left: 20px;">${value}</strong></div>`;
            });
            tooltipHtml += `</div>`;
            return tooltipHtml;
          },
        },
        series: [
          {
            name: "You",
            type: chartType,
            smooth: true,
            symbol: "none",
            lineStyle: { color: "#71C0BB", width: 2 },
            itemStyle: { color: "#71C0BB", borderRadius: [4, 4, 0, 0] },
            barWidth: "25%",
            data: data.metrics.map((d) => d.your[data.activeMetric]),
          },
          {
            name: "The Market",
            type: chartType,
            smooth: true,
            symbol: "none",
            lineStyle: { color: "#d1d5db", width: 2 },
            itemStyle: { color: "#d1d5db", borderRadius: [4, 4, 0, 0] },
            barWidth: "25%",
            data: data.metrics.map((d) => d.market[data.activeMetric]),
          },
        ],
      },
      { replaceMerge: ["series"] }
    );
  },

  resize() {
    this.chartInstance?.resize();
  },
  showLoading() {
    this.chartInstance?.showLoading();
  },
};

// Manager for the RevPAR Comparison Chart.js instance.
const revparChartManager = {
  chartInstance: null, // Holds the Chart.js instance.

  init(containerElement) {
    if (!containerElement) return;
    const ctx = containerElement.getContext("2d");
    this.chartInstance = new Chart(ctx, {
      type: "bar",
      data: {
        labels: ["Your Hotel", "The Market"],
        datasets: [
          {
            data: [0, 0],
            backgroundColor: ["#71C0BB", "#d1d5db"],
            borderRadius: 4,
            barThickness: 12,
          },
        ],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: {
            display: true,
            beginAtZero: true,
            grid: { drawBorder: false, color: "#e2e8f0" },
            ticks: { callback: (value) => formatValue(value, "currency") },
          },
          y: {
            grid: { display: false, drawBorder: false },
            ticks: { display: false },
          },
        },
      },
    });
  },

  update(revparData, currencyCode) {
    if (!this.chartInstance) return;
    const parseCurrency = (value) =>
      typeof value !== "string"
        ? 0
        : parseFloat(value.replace(/[^0-9.-]+/g, "")) || 0;
    this.chartInstance.data.datasets[0].data = [
      parseCurrency(revparData.your),
      parseCurrency(revparData.market),
    ];
    this.chartInstance.options.scales.x.ticks.callback = (value) =>
      formatValue(value, "currency", currencyCode);
    this.chartInstance.update();
  },
};
// --- The Refactored Alpine.js Component ---
// --- The Refactored Alpine.js Component ---
// The export is now a function that returns the component object.
export default function () {
  return {
    // --- STATE PROPERTIES ---
    currentPropertyId: null,
    currentPropertyName: "Loading...",
    properties: [],
    hasProperties: false,
    lastRefreshText: "Loading...",
    currencyCode: "USD",
    activeMetric: "occupancy",
    granularity: "daily",
    activePreset: "current-month",
    dates: { start: "", end: "" },
    error: { show: false, message: "" },
    isLoading: { kpis: true, chart: true, tables: true, properties: true },
    isSyncing: false,
    syncStatusInterval: null,
    isLoadingSummary: true,
    kpi: {
      occupancy: { your: "-", market: "-", your_raw: 0, market_raw: 0 },
      adr: { your: "-", market: "-", your_raw: 0, market_raw: 0 },
      revpar: { your: "-", market: "-", your_raw: 0, market_raw: 0 },
    },
    allMetrics: [],
    summaryText: "Generating summary...",

    // --- INITIALIZATION ---
    init() {
      const urlParams = new URLSearchParams(window.location.search);
      const newPropertyId = urlParams.get("propertyId");
      const isNewConnection = urlParams.get("newConnection") === "true";

      if (newPropertyId) {
        localStorage.setItem("currentPropertyId", newPropertyId);
      }

      if (isNewConnection && newPropertyId) {
        this.isSyncing = true;
        this.syncStatusInterval = setInterval(
          () => this.checkSyncStatus(newPropertyId),
          15000
        );
        this.checkSyncStatus(newPropertyId);
      }

      window.addEventListener("property-changed", (event) =>
        this.handlePropertyChange(event.detail)
      );
      this.initializeDashboard();
    },

    initializeDashboard() {
      this.$nextTick(() => {
        const mainChartContainer = this.$refs.mainChartContainer;
        const revparChartCanvas = this.$refs.revparChartCanvas;
        mainChartManager.init(mainChartContainer);
        revparChartManager.init(revparChartCanvas);
        const resizeObserver = new ResizeObserver(() =>
          mainChartManager.resize()
        );
        if (mainChartContainer) {
          resizeObserver.observe(mainChartContainer);
        }
        window.addEventListener("resize", () => mainChartManager.resize());
      });
    },

    // --- STUCK SPINNER HARDENING ---
    // If /api/sync-status stays 'false' but KPI endpoints already serve data,
    // we consider sync complete (backend status is lagging). We also cache-bust
    // the status call to dodge any proxy/browser staleness.
    async checkSyncStatus(propertyId) {
      if (!propertyId) {
        this.isSyncing = false;
        if (this.syncStatusInterval) clearInterval(this.syncStatusInterval);
        return;
      }
      try {
        // 1) Ask the server if it thinks sync is done
        const statusRes = await fetch(
          `/api/sync-status/${propertyId}?t=${Date.now()}`
        );
        const status = await statusRes.json();

        const considerDone = async () => {
          if (this.syncStatusInterval) clearInterval(this.syncStatusInterval);
          // Ensure we have a property selected before loading data
          if (!this.currentPropertyId) this.currentPropertyId = propertyId;
          // Clean URL (?newConnection=...&propertyId=...)
          history.pushState({}, "", window.location.pathname);
          // Load a real preset before hiding spinner
          await this.setPreset("current-month");
          this.isSyncing = false;
        };

        if (status?.isSyncComplete) {
          await considerDone();
          return;
        }

        // 2) Fallback probe: if KPI summary works, data exists -> treat as done
        // Use a very small date window to keep the call cheap.
        const today = new Date();
        const start = new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000);
        const fmt = (d) =>
          new Date(
            Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
          )
            .toISOString()
            .split("T")[0];

        const probeUrl = `/api/kpi-summary?startDate=${fmt(
          start
        )}&endDate=${fmt(today)}&propertyId=${propertyId}`;
        const probeRes = await fetch(probeUrl, {
          headers: { "x-probe": "sync-bypass" },
        });
        if (probeRes.ok) {
          const probe = await probeRes.json();
          // If we get any numeric KPI back, we know snapshots exist and queries work.
          const hasData =
            probe?.yourHotel &&
            (Number.isFinite(probe.yourHotel.occupancy) ||
              Number.isFinite(probe.yourHotel.revpar) ||
              Number.isFinite(probe.yourHotel.adr));
          if (hasData) {
            await considerDone();
            return;
          }
        }

        // 3) Otherwise keep polling
      } catch (err) {
        console.error("Error checking sync status (with fallback):", err);
        // Fail safe: stop spinner instead of trapping user forever
        this.isSyncing = false;
        if (this.syncStatusInterval) clearInterval(this.syncStatusInterval);
      }
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
      mainChartManager.showLoading();
      try {
        const propertyId = this.currentPropertyId;
        const urls = [
          `/api/metrics-from-db?startDate=${startDate}&endDate=${endDate}&granularity=${granularity}&propertyId=${propertyId}`,
          `/api/competitor-metrics?startDate=${startDate}&endDate=${endDate}&granularity=${granularity}&propertyId=${propertyId}`,
        ];
        const [yourHotelResponse, marketResponse] = await Promise.all(
          urls.map((url) => fetch(url))
        );
        if (!yourHotelResponse.ok || !marketResponse.ok)
          throw new Error("Could not load chart/table data.");
        const yourHotelData = await yourHotelResponse.json();
        const marketData = await marketResponse.json();
        this.allMetrics = this.processAndMergeData(
          yourHotelData.metrics,
          marketData.metrics
        );
        mainChartManager.update({
          metrics: this.allMetrics,
          activeMetric: this.activeMetric,
          granularity: this.granularity,
          propertyName: this.currentPropertyName,
          currencyCode: this.currencyCode,
          formatDateLabel: this.formatDateLabel,
        });
        revparChartManager.update(this.kpi.revpar, this.currencyCode);
        //   this.fetchSummary();
      } catch (error) {
        this.showError(error.message);
        this.allMetrics = [];
        mainChartManager.update({
          metrics: [],
          activeMetric: this.activeMetric,
          granularity: this.granularity,
          propertyName: this.currentPropertyName,
          currencyCode: this.currencyCode,
          formatDateLabel: this.formatDateLabel,
        });
      } finally {
        this.isLoading.chart = false;
        this.isLoading.tables = false;
      }
    },
    async fetchSummary() {
      this.isLoadingSummary = true;
      try {
        const response = await fetch("/api/generate-summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kpi: this.kpi,
            dates: this.dates,
            preset: this.activePreset,
          }),
        });
        if (!response.ok) throw new Error("Failed to fetch summary.");
        const result = await response.json();
        this.summaryText = result.summary;
      } catch (error) {
        console.error("Summary fetch error:", error);
        this.summaryText = "Could not generate summary at this time.";
      } finally {
        this.isLoadingSummary = false;
      }
    },

    processAndMergeData(yourData, marketData) {
      const dataMap = new Map();
      const processRow = (row, source) => {
        const date = (row.stay_date || row.period).substring(0, 10);
        if (!dataMap.has(date))
          dataMap.set(date, { date, your: {}, market: {} });
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
          occupancy: { your: "-", market: "-", your_raw: 0, market_raw: 0 },
          adr: { your: "-", market: "-", your_raw: 0, market_raw: 0 },
          revpar: { your: "-", market: "-", your_raw: 0, market_raw: 0 },
        };
        return;
      }
      for (const metric of ["occupancy", "adr", "revpar"]) {
        const yourValue = kpiData.yourHotel[metric] || 0;
        const marketValue = kpiData.market[metric] || 0;
        this.kpi[metric] = {
          your: formatValue(yourValue, metric, this.currencyCode),
          market: formatValue(marketValue, metric, this.currencyCode),
          your_raw: yourValue,
          market_raw: marketValue,
        };
      }
    },

    get chartTitle() {
      if (
        !this.currentPropertyName ||
        this.currentPropertyName === "Loading..."
      )
        return "Loading...";
      const metricName =
        this.activeMetric.charAt(0).toUpperCase() + this.activeMetric.slice(1);
      return `${metricName} of ${this.currentPropertyName} vs The Market`;
    },

    // --- UI CONTROL METHODS ---
    // **MODIFIED**: Make runReport async so we can await it.
    async runReport() {
      if (!this.dates.start || !this.dates.end || !this.granularity) return;
      this.error.show = false;
      // **MODIFIED**: Await both data fetches to complete.
      await Promise.all([
        this.loadKpis(this.dates.start, this.dates.end),
        this.loadChartAndTables(
          this.dates.start,
          this.dates.end,
          this.granularity
        ),
      ]);
    },

    // --- FUNCTION ADDED BACK ---
    // This function was missing. It updates the granularity and re-runs the report.
    setGranularity(newGranularity) {
      this.granularity = newGranularity;
      this.runReport();
    },

    // **MODIFIED**: Make setPreset async so we can await it.
    async setPreset(preset) {
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
      // **MODIFIED**: Await the report run to complete.
      await this.runReport();
    },
    setActiveMetric(metric) {
      this.activeMetric = metric;
      mainChartManager.update({
        metrics: this.allMetrics,
        activeMetric: this.activeMetric,
        granularity: this.granularity,
        propertyName: this.currentPropertyName,
        currencyCode: this.currencyCode,
        formatDateLabel: this.formatDateLabel,
      });
    },
    async handlePropertyChange(eventDetail) {
      const { propertyId, propertyName } = eventDetail;
      if (!propertyId || this.currentPropertyId === propertyId) return;
      this.currentPropertyId = propertyId;
      this.currentPropertyName = propertyName;
      if (!this.isSyncing && this.syncStatusInterval) {
        clearInterval(this.syncStatusInterval);
        this.syncStatusInterval = null;
      }
      try {
        const response = await fetch(`/api/hotel-details/${propertyId}`);
        const details = await response.json();
        this.currencyCode = details.currency_code || "USD";
      } catch (err) {
        console.error("Failed to fetch hotel details", err);
        this.currencyCode = "USD";
      }
      if (!this.isSyncing) {
        this.setPreset("current-month");
      }
    },

    // --- HELPER METHODS ---
    showError(message) {
      this.error.message = message;
      this.error.show = true;
    },
    formatValue: formatValue,
    formatCurrency(value) {
      return formatValue(value, "currency", this.currencyCode);
    },
    getDelta(day) {
      if (
        !day.your ||
        !day.market ||
        day.your[this.activeMetric] === undefined ||
        day.market[this.activeMetric] === undefined
      )
        return { formattedDelta: "-", deltaClass: "" };
      const delta = day.your[this.activeMetric] - day.market[this.activeMetric];
      if (isNaN(delta)) return { formattedDelta: "-", deltaClass: "" };
      const sign = delta > 0 ? "+" : "";
      let formattedDelta;
      if (this.activeMetric === "occupancy") {
        const deltaPercent = delta * 100;
        formattedDelta = `${sign}${deltaPercent.toFixed(1)}%`;
      } else {
        formattedDelta = `${sign}${formatValue(
          delta,
          "currency",
          this.currencyCode
        )}`;
      }
      return {
        formattedDelta: formattedDelta,
        deltaClass: delta >= 0 ? "text-green-600" : "text-red-600",
      };
    },
    formatDateLabel(dateString, granularity) {
      if (!dateString) return "";
      const date = new Date(dateString);
      if (granularity === "monthly")
        return date.toLocaleString("en-US", {
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        });
      if (granularity === "weekly") {
        if (!window.getWeekNumber) {
          window.getWeekNumber = function (d) {
            d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
            d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
            const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
            return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
          };
        }
        return `Wk of ${date.toLocaleDateString("en-GB", { timeZone: "UTC" })}`;
      }
      return date.toLocaleDateString("en-GB", { timeZone: "UTC" });
    },
  };
}
