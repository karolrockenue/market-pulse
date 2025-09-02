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

// The export is now a function that returns the component object.
export default function () {
  return {
    // --- STATE PROPERTIES ---
    currentPropertyId: null,
    // --- NEW: State for the combined onboarding modal (Category & Tax) ---
    showCategoryModal: false,
    categorizationPropertyId: null,
    selectedCategory: "Midscale",
    isTaxInfoMissing: false, // This flag will determine if the tax section is shown.
    taxData: {
      // This will hold the user's input from the modal.
      rate: 0.2,
      type: "inclusive",
      name: "VAT",
    },
    // --- END NEW ---
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
    // This will hold all the data for our new Market Composition card.
    market: {
      competitorCount: 0,
      totalRooms: 0,
      breakdown: { categories: {}, neighborhoods: {} },
      source: "",
    },
    kpi: {
      occupancy: { your: "-", market: "-", your_raw: 0, market_raw: 0 },
      adr: { your: "-", market: "-", your_raw: 0, market_raw: 0 },
      revpar: { your: "-", market: "-", your_raw: 0, market_raw: 0 },
    },
    allMetrics: [],
    summaryText: "Generating summary...",

    // This new flag tracks the very first time the dashboard loads.
    isInitialLoad: true,
    ranking: null,

    // /public/app/dashboard.mjs
    init() {
      console.log("%c[DASHBOARD] 1. Initializing component.", "color: #3b82f6");
      const urlParams = new URLSearchParams(window.location.search);
      const newPropertyId = urlParams.get("propertyId");
      const isNewConnection = urlParams.get("newConnection") === "true";

      window.addEventListener("property-changed", (event) => {
        const propertyId = event.detail?.property_id;
        console.log(
          `%c[DASHBOARD] Received 'property-changed' event for ID: ${propertyId}`,
          "color: #3b82f6"
        );
        this.handlePropertyChange(event.detail);
      });

      if (isNewConnection && newPropertyId) {
        console.log(
          `%c[DASHBOARD] 2a. New connection flow started for property ID: ${newPropertyId}`,
          "color: #3b82f6"
        );
        localStorage.setItem("currentPropertyId", newPropertyId);
        console.log(
          `%c[DASHBOARD] 2b. Set 'currentPropertyId' in localStorage to: ${newPropertyId}`,
          "color: #3b82f6"
        );

        fetch("/api/initial-sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ propertyId: newPropertyId }),
        })
          .then((res) => {
            console.log(
              `%c[DASHBOARD] 2c. Triggered initial sync. Server responded with status: ${res.status}`,
              "color: #3b82f6"
            );
          })
          .catch((err) =>
            console.error("Failed to trigger initial sync from frontend:", err)
          );

        this.isSyncing = true;
        this.syncStatusInterval = setInterval(
          () => this.checkSyncStatus(newPropertyId),
          15000
        );
        this.checkSyncStatus(newPropertyId);

        this.$nextTick(() => {
          console.log(
            `%c[DASHBOARD] 2d. Dispatching authoritative 'property-changed' event for new property ID: ${newPropertyId}`,
            "color: #3b82f6"
          );
          window.dispatchEvent(
            new CustomEvent("property-changed", {
              detail: {
                property_id: newPropertyId,
                property_name: "Syncing New Property...",
              },
            })
          );
        });
      }

      this.initializeDashboard();
    },
    // This function now only initializes the main chart.
    initializeDashboard() {
      this.$nextTick(() => {
        const mainChartContainer = this.$refs.mainChartContainer;
        // The RevPAR chart initialization has been removed.
        mainChartManager.init(mainChartContainer);
        const resizeObserver = new ResizeObserver(() =>
          mainChartManager.resize()
        );
        if (mainChartContainer) {
          resizeObserver.observe(mainChartContainer);
        }
        window.addEventListener("resize", () => mainChartManager.resize());
      });
    },

    // --- NEW: Renders the visual breakdown bars ---
    // --- Renders the visual breakdown bars and their legends ---
    renderBreakdownCharts() {
      // A color palette for our charts.
      const colors = ["#4E6688", "#71C0BB", "#A3A5A7", "#2D3D57", "#E3EEB2"];

      const render = (barContainer, legendContainer, data) => {
        // Clear any previous content.
        barContainer.innerHTML = "";
        legendContainer.innerHTML = "";

        const entries = Object.entries(data);
        const total = entries.reduce((sum, [, count]) => sum + count, 0);

        if (total === 0) {
          barContainer.innerHTML = `<div class="text-xs text-center text-gray-400 w-full">N/A</div>`;
          return;
        }

        let colorIndex = 0;
        for (const [name, count] of entries) {
          const color = colors[colorIndex % colors.length];

          // --- Part 1: Draw the colored bar segment ---
          const segment = document.createElement("div");
          segment.style.width = `${(count / total) * 100}%`;
          segment.style.backgroundColor = color;
          segment.title = `${name}: ${count} hotel(s)`;
          barContainer.appendChild(segment);

          // --- Part 2: Create the corresponding legend item ---
          const legendItem = document.createElement("div");
          legendItem.className = "flex items-center";
          // The legend contains a colored dot, the name, and the count.
          legendItem.innerHTML = `
                    <span class="w-2 h-2 rounded-full mr-2" style="background-color: ${color};"></span>
                    <span class="text-xs text-gray-600">${name} (${count})</span>
                `;
          legendContainer.appendChild(legendItem);

          colorIndex++;
        }
      };

      // Render both charts, now passing the new legend containers.
      if (this.$refs.categoryBreakdown && this.$refs.neighborhoodBreakdown) {
        render(
          this.$refs.categoryBreakdown,
          this.$refs.categoryLegend,
          this.market.breakdown.categories
        );
        render(
          this.$refs.neighborhoodBreakdown,
          this.$refs.neighborhoodLegend,
          this.market.breakdown.neighborhoods
        );
      }
    },
    async checkSyncStatus(propertyId) {
      if (!propertyId) {
        this.isSyncing = false;
        if (this.syncStatusInterval) clearInterval(this.syncStatusInterval);
        return;
      }
      try {
        const statusRes = await fetch(
          `/api/sync-status/${propertyId}?t=${Date.now()}`
        );
        const status = await statusRes.json();

        const considerDone = async () => {
          console.log(`Sync for property ${propertyId} is complete.`);
          if (this.syncStatusInterval) clearInterval(this.syncStatusInterval);

          history.pushState({}, "", window.location.pathname);
          // --- THIS IS THE KEY CHANGE ---
          // We NO LONGER set isSyncing to false here. We want the loading overlay to stay visible.

          console.log("Checking for missing tax information...");
          const detailsRes = await fetch(`/api/hotel-details/${propertyId}`);
          const details = await detailsRes.json();

          this.isTaxInfoMissing = details.tax_rate === null;
          if (this.isTaxInfoMissing) {
            console.log("Tax info is missing. Modal will ask for user input.");
          }

          // Show the category modal ON TOP of the loading overlay.
          this.categorizationPropertyId = propertyId;
          this.showCategoryModal = true;
        };

        if (status?.isSyncComplete) {
          await considerDone();
          return;
        }

        // ... (rest of the function is the same, no changes needed there)
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
      } catch (err) {
        console.error("Error checking sync status (with fallback):", err);
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
        // NEW: Populate our new market object with the data from the API response.
        this.market = {
          competitorCount: marketData.competitorCount,
          totalRooms: marketData.totalRooms,
          breakdown: marketData.breakdown,
          source: marketData.source,
        };

        // THE FIX: Call the function responsible for drawing the breakdown charts.
        // This was missing, which is why the UI was not updating.
        this.renderBreakdownCharts();

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

        // --- THE FIX ---
        // This logic now correctly checks for the 'your_...' prefixed aliases
        // when processing data from the 'your' source (yourData).
        if (source === "your") {
          entry[source] = {
            occupancy: parseFloat(row.your_occupancy_direct) || 0,
            adr: parseFloat(row.your_adr) || 0,
            revpar: parseFloat(row.your_revpar) || 0,
          };
        } else {
          // source === 'market'
          // This now correctly reads the new 'gross' metric fields from the API response.
          entry[source] = {
            occupancy: parseFloat(row.market_occupancy) || 0,
            adr: parseFloat(row.market_gross_adr) || 0,
            revpar: parseFloat(row.market_gross_revpar) || 0,
          };
        }
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
        // --- FIX: Use parseFloat to convert string-based numbers from the API ---
        // This ensures that all comparisons are numerical, not text-based.
        const yourValue = parseFloat(kpiData.yourHotel[metric]) || 0;
        const marketValue = parseFloat(kpiData.market[metric]) || 0;

        this.kpi[metric] = {
          // The formatted values are for display only.
          your: formatValue(yourValue, metric, this.currencyCode),
          market: formatValue(marketValue, metric, this.currencyCode),
          // The raw values (now guaranteed to be numbers) are used for all logic and comparisons.
          your_raw: yourValue,
          market_raw: marketValue,
        };
      }
    },

    // --- NEW: Function to load ranking data from our new API endpoint ---
    async loadRankingData(startDate, endDate) {
      // Don't try to fetch if we don't have a property ID.
      if (!this.currentPropertyId) return;

      try {
        const url = `/api/market-ranking?startDate=${startDate}&endDate=${endDate}&propertyId=${this.currentPropertyId}`;
        const response = await fetch(url);
        if (!response.ok) {
          // If the API fails, set ranking to null so the component hides.
          this.ranking = null;
          throw new Error("Could not load ranking data.");
        }
        const rankingData = await response.json();
        // Store the successfully fetched data in our new state property.
        this.ranking = rankingData;
      } catch (error) {
        console.error("Error fetching ranking data:", error);
        this.ranking = null;
      }
    },

    // /public/app/dashboard.mjs
    // /public/app/dashboard.mjs

    // This new function handles saving both tax (if needed) and category from the modal.
    async saveOnboardingData() {
      if (!this.categorizationPropertyId) return;

      try {
        // Step 1: Save tax info (if needed).
        if (this.isTaxInfoMissing) {
          console.log("Saving user-submitted tax info...");
          const taxResponse = await fetch(
            `/api/my-properties/${this.categorizationPropertyId}/tax-info`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(this.taxData),
            }
          );
          if (!taxResponse.ok)
            throw new Error("Failed to save tax information.");
        }

        // Step 2: Save the selected category.
        console.log("Saving selected category...");
        const categoryResponse = await fetch(
          `/api/my-properties/${this.categorizationPropertyId}/category`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ category: this.selectedCategory }),
          }
        );
        if (!categoryResponse.ok) throw new Error("Failed to save category.");

        // --- THIS IS THE KEY CHANGE ---
        // Step 3: Hide the modal and run the report to load all dashboard data.
        // The main loading overlay is still visible during this.
        this.showCategoryModal = false;
        await this.runReport();

        // Step 4: FINALLY, hide the loading overlay to reveal the fully populated dashboard.
        this.isSyncing = false;
      } catch (error) {
        console.error("Failed to save onboarding data:", error);
        this.showError(
          `Could not save your selection. Error: ${error.message}`
        );
        // If something fails, hide the loading screens so the user isn't stuck.
        this.isSyncing = false;
        this.showCategoryModal = false;
      }
    },

    // --- NEW: Helper functions for display logic ---
    getOrdinal(n) {
      if (n === null || typeof n === "undefined") return "";
      const s = ["th", "st", "nd", "rd"];
      const v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]);
    },

    getRankColor(rank, total) {
      if (rank === 1) return "#10B981"; // Brand Green for 1st place
      if (rank / total > 0.75) return "#C24435"; // Custom Red for bottom 25%
      return "#4E6688"; // Accent Blue for everything else
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
      // Reset ranking to null to show a loading state
      this.ranking = null;

      // The new function is now called in parallel with the others.
      await Promise.all([
        this.loadKpis(this.dates.start, this.dates.end),
        this.loadChartAndTables(
          this.dates.start,
          this.dates.end,
          this.granularity
        ),
        // --- NEW: Add this call to the array ---
        this.loadRankingData(this.dates.start, this.dates.end),
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
      } else if (preset === "previous-month") {
        // --- NEW: Logic for the previous full month. ---
        startDate = new Date(Date.UTC(yearUTC, monthUTC - 1, 1));
        endDate = new Date(Date.UTC(yearUTC, monthUTC, 0));
      } else if (preset === "year-to-date") {
        // --- NEW: Logic for Year-to-Date. ---
        startDate = new Date(Date.UTC(yearUTC, 0, 1));
        endDate = today; // Uses today's date as the end date.
      }

      const formatDate = (date) => date.toISOString().split("T")[0];
      this.dates.start = formatDate(startDate);
      this.dates.end = formatDate(endDate);
      this.granularity =
        preset === "this-year" || preset === "year-to-date"
          ? "monthly"
          : "daily";

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
      const { property_id: propertyId, property_name: propertyName } =
        eventDetail;
      if (!propertyId) return;

      // --- THIS IS THE KEY CHANGE ---
      // If an initial sync is running, stop this function from doing anything.
      // The final data load will be triggered by the saveOnboardingData function later.
      if (this.isSyncing) {
        console.log(
          "handlePropertyChange: Aborting data load because a sync is in progress."
        );
        return;
      }
      // --- END CHANGE ---

      this.currentPropertyId = propertyId;
      this.currentPropertyName = propertyName;

      try {
        const response = await fetch(`/api/hotel-details/${propertyId}`);
        const details = await response.json();
        this.currencyCode = details.currency_code || "USD";

        await this.setPreset("current-month");
      } catch (error) {
        console.error("Error during initial data load:", error);
        this.showError("Failed to load initial dashboard data.");
      } finally {
        if (this.isInitialLoad) {
          const loader = document.getElementById("main-loader");
          const wrapper = document.getElementById("dashboard-wrapper");
          if (loader && wrapper) {
            loader.style.opacity = "0";
            wrapper.style.opacity = "1";
            setTimeout(() => {
              loader.style.display = "none";
            }, 500);
          }
          this.isInitialLoad = false;
        }
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
