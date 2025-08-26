// /public/app/market-overview.mjs

const historicalRevparChartManager = {
  chartInstance: null,
  // NEW: Method to display the chart's built-in loading animation.
  showLoading() {
    this.chartInstance?.showLoading();
  },
  init(element) {
    if (!element) return;
    this.chartInstance =
      echarts.getInstanceByDom(element) || echarts.init(element);
    // Set the base options and add responsive media queries
    // Set the base options and add a responsive media query
    this.chartInstance.setOption({
      tooltip: { trigger: "axis" },
      // --- MODIFIED: Smaller font size for the legend ---
      legend: {
        orient: "horizontal",
        left: "center",
        bottom: 5, // Positioned at the bottom
        type: "scroll",
        itemGap: 15,
        textStyle: {
          fontSize: 12,
        },
      },
      // --- MODIFIED: New grid configuration ---
      grid: {
        top: "8%",
        left: "1%",
        // Use a larger, fixed pixel value for the right margin.
        // This creates a guaranteed "safe area" for the legend.
        // Adding 10px to create a slightly larger gap.
        right: "3%",
        bottom: "15%",
        containLabel: true,
      },
      xAxis: {
        type: "category",
        data: [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec",
        ],
      },
      yAxis: { type: "value" },
      series: [],
    });
  },
  // --- MODIFIED: Update function now accepts legendData ---
  update(seriesData, yAxisFormatter, tooltipFormatter, legendData) {
    if (!this.chartInstance) return;
    this.chartInstance.setOption(
      {
        // Pass the custom-formatted legend data to the chart
        legend: {
          data: legendData,
        },
        yAxis: { axisLabel: { formatter: yAxisFormatter } },
        tooltip: { valueFormatter: tooltipFormatter },
        series: seriesData,
      },
      // --- FIX: Removed "legend" from this array ---
      // This tells ECharts to merge the new data with the existing legend
      // configuration (like position), instead of overwriting it.
      { replaceMerge: ["series"] }
    );
  },
  resize() {
    this.chartInstance?.resize();
  },
};

const seasonalityChartManager = {
  chartInstance: null,
  init(element) {
    if (!element) return;
    this.chartInstance =
      echarts.getInstanceByDom(element) || echarts.init(element);
  },
  // The update function now takes the year and the real data from our API
  // The update function now takes the year and the real data from our API
  // The update function now takes the year and the real data from our API
  update(year, apiData) {
    if (!this.chartInstance) return;

    // Format the data for the heatmap
    const heatmapData = apiData.map((row) => [
      // The date is already in 'YYYY-MM-DD' format from the API
      row.date.split("T")[0],
      // We use parseFloat to ensure the value is a number
      parseFloat(row.value),
    ]);

    // --- NEW PERCENTILE LOGIC ---
    // 1. Get all the RevPAR values, filtering out any zeros.
    const values = heatmapData.map((item) => item[1]).filter((v) => v > 0);
    // 2. Sort the days by performance from lowest to highest.
    values.sort((a, b) => a - b);

    // 3. Find the RevPAR values at the 33rd and 66th percentile marks.
    const lowIndex = Math.floor(values.length * 0.33);
    const highIndex = Math.floor(values.length * 0.66);
    const lowThreshold = values[lowIndex];
    const highThreshold = values[highIndex];

    this.chartInstance.setOption({
      tooltip: {
        position: "top",
        formatter: (params) =>
          `${params.value[0]}: £${params.value[1].toFixed(2)}`,
      },
      visualMap: {
        type: "piecewise",
        orient: "horizontal",
        left: "center",
        bottom: "0%",
        // Define the labels and use your new high-contrast colors
        pieces: [
          { min: highThreshold, label: "High", color: "#87534D" }, // Your custom color
          {
            min: lowThreshold,
            max: highThreshold,
            label: "Medium",
            color: "#facc15",
          },
          { max: lowThreshold, label: "Low", color: "#BAD7FF" }, // Your custom color
        ],
      },

      calendar: {
        range: year.toString(),
        // --- NEW: Explicitly hide the year label on the left side ---
        yearLabel: { show: false },
        dayLabel: { nameMap: "en" },
        monthLabel: { nameMap: "en" },
        splitLine: { show: false },
        itemStyle: { borderWidth: 4, borderColor: "#fff" },
        right: 40,
        left: 40,
        bottom: 40,
      },
      series: {
        type: "heatmap",
        coordinateSystem: "calendar",
        data: heatmapData,
      },
    });
  },
  resize() {
    this.chartInstance?.resize();
  },
};

function marketOverviewComponent() {
  return {
    marketCity: "",
    currentPropertyId: null,
    activeMetric: "revpar",
    allMetrics: ["revpar", "adr", "occupancy"],
    isEntireMarketSelected: true,
    allTiers: ["Luxury", "Upper Midscale", "Midscale", "Budget"],
    tierColors: {
      "Entire Market": "#4B5563",
      Luxury: "#8B5CF6",
      "Upper Midscale": "#F97316",
      Midscale: "#3B82F6",
      Budget: "#14B8A6",
    },
    yearLineStyles: {
      2025: "solid",
      2024: "dashed",
      2023: "dotted",
      2022: "dotted",
    },
    // NEW: Defines how much to lighten the color for older years.
    // 0 = original color, 0.3 = 30% lighter, 0.5 = 50% lighter.
    yearShadeFactors: {
      2025: 0,
      2024: 0.3,
      2023: 0.5,
      2022: 0.65,
    },
    allHistoricalYears: [2025, 2024, 2023, 2022],
    availableSeasonalityYears: [],
    activeSeasonalityYear: null,
    activeTiers: [],
    activeYears: [new Date().getFullYear()],

    // --- RENAMED: from neighborhoodData to areaData ---
    areaData: [],
    activeHeatmapMetric: "revpar",
    sortColumn: "revpar",
    sortDirection: "desc",
    marketKpis: {
      occupancy: { current: 0, prior: 0, change: 0 },
      adr: { current: 0, prior: 0, change: 0 },
      revpar: { current: 0, prior: 0, change: 0 },
    },
    isInitialLoad: true,
    get pageTitle() {
      if (this.marketCity) {
        return `${this.marketCity} Market Overview`;
      }
      return "Market Overview";
    },

    // --- RENAMED: from sortedNeighborhoods to sortedAreas ---
    get sortedAreas() {
      if (!this.areaData) return [];
      return [...this.areaData].sort((a, b) => {
        const aValue = a[this.sortColumn];
        const bValue = b[this.sortColumn];
        if (this.sortDirection === "asc") {
          return aValue > bValue ? 1 : -1;
        }
        return aValue < bValue ? 1 : -1;
      });
    },

    init() {
      this.activeYears = [new Date().getFullYear()];
      const historicalChartElement = document.getElementById(
        "historical-revpar-chart"
      );
      historicalRevparChartManager.init(historicalChartElement);
      setTimeout(() => historicalRevparChartManager.resize(), 150);
      window.addEventListener("resize", () =>
        historicalRevparChartManager.resize()
      );
      // The redundant $watch listeners have been removed from here.
      const seasonalityChartElement = document.getElementById(
        "seasonality-heatmap"
      );
      seasonalityChartManager.init(seasonalityChartElement);
      window.addEventListener("resize", () => seasonalityChartManager.resize());
      setTimeout(() => seasonalityChartManager.resize(), 150);
      window.addEventListener("property-changed", (event) => {
        this.handlePropertyChange(event.detail);
      });
    },

    async handlePropertyChange(propertyData) {
      // Stop if the property data is invalid or hasn't changed.
      if (
        !propertyData ||
        !propertyData.property_id ||
        this.currentPropertyId === propertyData.property_id
      ) {
        // If there's no valid property, we must still hide the loader on initial load.
        if (this.isInitialLoad) {
          const loader = document.getElementById("main-loader");
          const wrapper = document.getElementById("market-overview-wrapper");
          if (loader && wrapper) {
            loader.style.opacity = "0";
            wrapper.style.opacity = "1";
            setTimeout(() => {
              loader.style.display = "none";
            }, 500);
          }
          this.isInitialLoad = false;
        }
        return;
      }

      const cityChanged = this.marketCity !== propertyData.city;
      this.currentPropertyId = propertyData.property_id;
      this.marketCity = propertyData.city || "Unknown";

      try {
        // On the very first load, we must fetch the KPI data to avoid flickering.
        // On subsequent property changes, we fetch everything.
        if (this.isInitialLoad || cityChanged) {
          await Promise.all([
            this.updateHistoricalChart(),
            this.fetchKpiData(), // This fetches the data for the card color
            this.fetchAreaData(),
            this.fetchAvailableSeasonalityYears(),
          ]);
        }
      } catch (error) {
        console.error("Error loading market overview data:", error);
      } finally {
        // The logic to hide the loader now runs *after* the await Promise.all() is complete.
        if (this.isInitialLoad) {
          const loader = document.getElementById("main-loader");
          const wrapper = document.getElementById("market-overview-wrapper");

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

    async fetchAvailableSeasonalityYears() {
      if (!this.marketCity) return;
      try {
        const response = await fetch(
          `/api/market/available-seasonality-years?city=${this.marketCity}`
        );
        if (!response.ok) throw new Error("API request failed");
        const years = await response.json();
        this.availableSeasonalityYears = years;
        if (this.availableSeasonalityYears.length > 0) {
          this.setSeasonalityYear(this.availableSeasonalityYears[0]);
        }
      } catch (error) {
        console.error("Failed to fetch available years:", error);
        this.availableSeasonalityYears = [];
      }
    },

    async updateSeasonalityChart(year) {
      if (!this.marketCity || !year) return;
      try {
        const response = await fetch(
          `/api/market/seasonality?city=${this.marketCity}&year=${year}`
        );
        if (!response.ok) throw new Error("API request failed");
        const data = await response.json();
        seasonalityChartManager.update(year, data);
      } catch (error) {
        console.error(`Failed to fetch seasonality data for ${year}:`, error);
      }
    },

    // --- RENAMED: from fetchNeighborhoodData to fetchAreaData ---
    async fetchAreaData() {
      if (!this.marketCity) return;
      try {
        const response = await fetch(
          // Note: The backend API endpoint is unchanged for now
          `/api/market/neighborhoods?city=${this.marketCity}`
        );
        if (!response.ok)
          throw new Error("API request for neighborhoods failed");
        const data = await response.json();
        // --- RENAMED: Populates areaData ---
        this.areaData = data.map((item) => ({
          ...item,
          revpar: parseFloat(item.revpar),
          adr: parseFloat(item.adr),
          occupancy: parseFloat(item.occupancy),
          yoy: item.yoy ? parseFloat(item.yoy) : null,
          hotel_count: parseInt(item.hotel_count, 10),
        }));
      } catch (error) {
        console.error("Failed to fetch area data:", error);
        this.areaData = [];
      }
    },

    async fetchKpiData() {
      if (!this.marketCity) return;
      try {
        const response = await fetch(
          `/api/market/kpis?city=${this.marketCity}`
        );
        if (!response.ok) throw new Error("API request failed");
        const data = await response.json();
        const currentAdr = parseFloat(data.current_adr) || 0;
        const priorAdr = parseFloat(data.prior_adr) || 0;
        const currentRevpar = parseFloat(data.current_revpar) || 0;
        const priorRevpar = parseFloat(data.prior_revpar) || 0;
        const currentOccupancy = parseFloat(data.current_occupancy) || 0;
        const priorOccupancy = parseFloat(data.prior_occupancy) || 0;
        const adrChange = priorAdr > 0 ? (currentAdr - priorAdr) / priorAdr : 0;
        const revparChange =
          priorRevpar > 0 ? (currentRevpar - priorRevpar) / priorRevpar : 0;
        const occupancyChange = currentOccupancy - priorOccupancy;
        this.marketKpis = {
          occupancy: {
            current: currentOccupancy,
            prior: priorOccupancy,
            change: occupancyChange,
          },
          adr: { current: currentAdr, prior: priorAdr, change: adrChange },
          revpar: {
            current: currentRevpar,
            prior: priorRevpar,
            change: revparChange,
          },
        };
      } catch (error) {
        console.error("Failed to fetch market KPIs:", error);
        this.marketKpis = {
          occupancy: { current: 0, prior: 0, change: 0 },
          adr: { current: 0, prior: 0, change: 0 },
          revpar: { current: 0, prior: 0, change: 0 },
        };
      }
    },

    async fetchTrendData() {
      if (!this.marketCity || this.activeYears.length === 0) return [];
      const params = new URLSearchParams({ city: this.marketCity });
      this.activeYears.forEach((year) => params.append("years", year));
      if (!this.isEntireMarketSelected && this.activeTiers.length > 0) {
        this.activeTiers.forEach((tier) => params.append("tiers", tier));
      }
      try {
        const response = await fetch(`/api/market/trends?${params.toString()}`);
        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }
        return await response.json();
      } catch (error) {
        console.error("Failed to fetch trend data:", error);
        return [];
      }
    },

    async updateHistoricalChart() {
      // Show the loading animation inside the chart before fetching data.
      historicalRevparChartManager.showLoading();

      const trendData = await this.fetchTrendData();
      const seriesData = {};
      trendData.forEach((row) => {
        const year = new Date(row.period).getFullYear();
        const month = new Date(row.period).getMonth();
        const category = this.isEntireMarketSelected
          ? "Entire Market"
          : row.category;
        const seriesKey = `${category}-${year}`;
        // Check if we've already created this series.
        if (!seriesData[seriesKey]) {
          // Get the base color for the category (e.g., 'Luxury' -> purple).
          const baseColor = this.tierColors[category] || "#000000";
          // Get the shade factor for the year (e.g., 2024 -> 0.3).
          const shadeFactor = this.yearShadeFactors[year] || 0;
          // Calculate the final color by lightening the base color.
          const finalColor = this.adjustHexColor(baseColor, shadeFactor);

          // Create the series object with the new dynamic color.
          seriesData[seriesKey] = {
            name: `${category} - ${year}`,
            type: "line",
            smooth: true,
            // USE THE NEW COLOR: The calculated color is used here.
            color: finalColor,
            lineStyle: {
              type: this.yearLineStyles[year] || "solid",
            },
            data: Array(12).fill(null),
          };
        }
        seriesData[seriesKey].data[month] = parseFloat(row[this.activeMetric]);
      });
      const finalSeries = Object.values(seriesData);
      finalSeries.sort((a, b) => a.name.localeCompare(b.name));
      const legendWithGroups = [];
      let lastCategory = null;
      finalSeries.forEach((series) => {
        const currentCategory = series.name.split(" - ")[0];
        if (lastCategory && currentCategory !== lastCategory) {
          legendWithGroups.push("");
        }
        legendWithGroups.push(series.name);
        lastCategory = currentCategory;
      });
      const yAxisFormatter = (value) =>
        this.activeMetric === "occupancy"
          ? `${(value * 100).toFixed(0)}%`
          : `£${value.toFixed(0)}`;
      const tooltipFormatter = (value) =>
        this.activeMetric === "occupancy"
          ? `${(value * 100).toFixed(1)}%`
          : `£${value.toFixed(2)}`;
      historicalRevparChartManager.update(
        finalSeries,
        yAxisFormatter,
        tooltipFormatter,
        legendWithGroups
      );
    },

    setMetric(metric) {
      this.activeMetric = metric;
      // Explicitly call the update function.
      this.updateHistoricalChart();
    },
    toggleTier(tier) {
      if (tier === "Entire Market") {
        this.isEntireMarketSelected = true;
        this.activeTiers = [];
      } else {
        this.isEntireMarketSelected = false;
        const index = this.activeTiers.indexOf(tier);
        if (index > -1) {
          this.activeTiers.splice(index, 1);
        } else {
          this.activeTiers.push(tier);
        }
        if (this.activeTiers.length === 0) {
          this.isEntireMarketSelected = true;
        }
      }
      // Explicitly call the update function.
      this.updateHistoricalChart();
    },
    toggleYear(year) {
      if (this.activeYears.includes(year)) {
        this.activeYears = this.activeYears.filter((y) => y !== year);
      } else {
        this.activeYears.push(year);
      }
      // Explicitly call the update function.
      this.updateHistoricalChart();
    },
    setActiveHeatmapMetric(metric) {
      this.activeHeatmapMetric = metric;
      this.sortColumn = metric;
      this.sortDirection = "desc";
    },
    sortBy(column) {
      if (this.sortColumn === column) {
        this.sortDirection = this.sortDirection === "asc" ? "desc" : "asc";
      } else {
        this.sortColumn = column;
        this.sortDirection = "desc";
      }
    },

    // NEW: A helper function to lighten a HEX color by a given factor.
    adjustHexColor(hex, lightenFactor) {
      // If no valid hex is provided, return a default color.
      if (!hex || hex.length < 4) return "#000000";

      // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF").
      const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
      hex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);

      // Parse the hex string into its RGB components.
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      if (!result) return "#000000";

      let r = parseInt(result[1], 16);
      let g = parseInt(result[2], 16);
      let b = parseInt(result[3], 16);

      // Apply the lightening effect. This moves each color component towards
      // white (255) by the factor specified.
      r = Math.round(r + (255 - r) * lightenFactor);
      g = Math.round(g + (255 - g) * lightenFactor);
      b = Math.round(b + (255 - b) * lightenFactor);

      // Convert the new RGB values back to a hex string.
      return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
    },

    // --- UPDATED: Heatmap colors now use brand palette ---
    getHeatmapClass(metric, value) {
      if (metric !== this.activeHeatmapMetric) return "";
      if (
        !this.areaData ||
        !Array.isArray(this.areaData) ||
        this.areaData.length === 0
      )
        return "";
      const values = this.areaData.map((d) => d[metric]);
      const min = Math.min(...values);
      const max = Math.max(...values);
      if (max === min) return "bg-yellow-50";
      const percentile = (value - min) / (max - min);
      if (percentile > 0.8) return "bg-yellow-300/60";
      if (percentile > 0.6) return "bg-yellow-200/70";
      if (percentile > 0.4) return "bg-yellow-100/80";
      if (percentile > 0.2) return "bg-yellow-50/90";
      return "";
    },

    setSeasonalityYear(year) {
      this.activeSeasonalityYear = year;
      this.updateSeasonalityChart(year);
    },
  };
}
export default marketOverviewComponent;
