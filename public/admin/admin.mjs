// --- MAIN INITIALIZATION ---
document.addEventListener("DOMContentLoaded", () => {
  checkAdminSessionAndInitialize();
});

async function checkAdminSessionAndInitialize() {
  const loginForm = document.getElementById("login-form");
  const adminContent = document.getElementById("admin-content");
  const loadingSpinner = document.getElementById("loading-spinner");
  const adminWrapper = document.getElementById("admin-wrapper");

  try {
    const response = await fetch("/api/auth/session-info");
    if (!response.ok) throw new Error("Session check failed");
    const sessionInfo = await response.json();

    // --- FIX: Check for the new 'super_admin' role instead of the old 'isAdmin' flag ---
    if (sessionInfo.role === "super_admin") {
      // If the user has the correct role, show the main admin content.
      showAdminContent();
    } else {
      // If the user is not a super_admin, show the login form.
      // This is correct behavior for non-admin users trying to access this page.
      loginForm.classList.remove("hidden");
    }
  } catch (error) {
    console.error("Could not verify admin session", error);
    loginForm.classList.remove("hidden");
  } finally {
    loadingSpinner.classList.add("hidden");
    adminWrapper.classList.remove("hidden");
  }
}

function showAdminContent() {
  document.getElementById("login-form").classList.add("hidden");
  document.getElementById("admin-content").classList.remove("hidden");
  initializeAdminPanel();
}

// --- ALL HELPER FUNCTIONS DEFINED GLOBALLY ---

const createHotelElement = (hotel, checked) => {
  const label = document.createElement("label");
  label.className =
    "flex items-center space-x-3 p-2 rounded-md hover:bg-slate-50 cursor-pointer";
  label.innerHTML = `
    <input type="checkbox" data-hotel-id="${
      hotel.hotel_id
    }" class="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" ${
    checked ? "checked" : ""
  }>
    <span class="text-sm text-slate-700">${
      hotel.property_name
    } <span class="text-xs text-slate-400 ml-1">(${hotel.city})</span></span>`;
  return label;
};

const updateCompetitorCount = (ui) => {
  ui.currentCompetitorsCount.textContent =
    ui.currentCompetitorsList.querySelectorAll('input[type="checkbox"]').length;
};

const handleCheckboxChange = (event, ui) => {
  const checkbox = event.target;
  const hotelElement = checkbox.closest("label");
  if (checkbox.checked) {
    if (ui.availableHotelsList.contains(hotelElement))
      ui.availableHotelsList.removeChild(hotelElement);
    ui.currentCompetitorsList.appendChild(hotelElement);
  } else {
    if (ui.currentCompetitorsList.contains(hotelElement))
      ui.currentCompetitorsList.removeChild(hotelElement);
    ui.availableHotelsList.appendChild(hotelElement);
  }
  updateCompetitorCount(ui);
};

const openCompSetManager = async (hotelId, hotelName, ui, state) => {
  state.currentEditingHotelId = hotelId;
  ui.compsetHotelName.textContent = hotelName;
  ui.comsetStatus.textContent = "";
  // Corrected the typo from 'comsetSaveBtn' to 'compsetSaveBtn'
  ui.compsetSaveBtn.disabled = false;
  ui.currentCompetitorsList.innerHTML = `<p class="text-sm text-slate-400">Loading...</p>`;
  ui.availableHotelsList.innerHTML = `<p class="text-sm text-slate-400">Loading...</p>`;
  ui.compsetModal.classList.remove("hidden");
  updateCompetitorCount(ui);
  try {
    const [compSetRes, allHotelsRes] = await Promise.all([
      fetch(`/api/admin/hotel/${hotelId}/compset`),
      fetch("/api/admin/get-all-hotels"),
    ]);
    if (!compSetRes.ok || !allHotelsRes.ok)
      throw new Error("Failed to fetch hotel data.");
    const currentCompetitors = await compSetRes.json();
    const allHotels = await allHotelsRes.json();
    const currentCompetitorIds = new Set(
      currentCompetitors.map((h) => h.hotel_id)
    );
    ui.currentCompetitorsList.innerHTML = "";
    ui.availableHotelsList.innerHTML = "";
    allHotels
      .filter((h) => h.hotel_id !== parseInt(hotelId))
      .forEach((hotel) => {
        const isCompetitor = currentCompetitorIds.has(hotel.hotel_id);
        const element = createHotelElement(hotel, isCompetitor);
        if (isCompetitor) ui.currentCompetitorsList.appendChild(element);
        else ui.availableHotelsList.appendChild(element);
      });
    updateCompetitorCount(ui);
  } catch (error) {
    ui.currentCompetitorsList.innerHTML = `<p class="text-sm text-red-500">Error: ${error.message}</p>`;
  }
};

const closeCompSetManager = (ui, state) => {
  ui.compsetModal.classList.add("hidden");
  state.currentEditingHotelId = null;
  ui.compsetSearchInput.value = "";
  ui.currentCompetitorsList.innerHTML = "";
  ui.availableHotelsList.innerHTML = "";
};

const saveCompSet = async (ui, state) => {
  // Ensure we have a hotel to work with
  if (!state.currentEditingHotelId) return;

  // Disable the button to prevent double-clicks and show a saving message
  // FIX: Corrected typo from 'comsetSaveBtn' to 'compsetSaveBtn'
  ui.compsetSaveBtn.disabled = true;
  ui.comsetStatus.textContent = "Saving...";

  // Collect all competitor IDs from the "Current Competitors" list
  const competitorIds = Array.from(
    ui.currentCompetitorsList.querySelectorAll('input[type="checkbox"]')
  ).map((cb) => cb.dataset.hotelId);

  try {
    // Send the list of IDs to the backend API
    const response = await fetch(
      `/api/admin/hotel/${state.currentEditingHotelId}/compset`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competitorIds }),
      }
    );
    // If the server responds with an error, throw an exception
    if (!response.ok) {
      throw new Error((await response.json()).error || "Failed to save.");
    }
    // On success, show a success message
    ui.comsetStatus.textContent = "✅ Saved successfully!";
    // Close the modal after a 1-second delay
    setTimeout(() => closeCompSetManager(ui, state), 1000);
  } catch (error) {
    // If anything goes wrong, display the error message
    ui.comsetStatus.textContent = `❌ Error: ${error.message}`;
    // Re-enable the save button so the user can try again
    // FIX: Corrected typo from 'comsetSaveBtn' to 'compsetSaveBtn'
    ui.compsetSaveBtn.disabled = false;
  }
};
const filterAvailableHotels = (ui) => {
  const searchTerm = ui.compsetSearchInput.value.toLowerCase();
  ui.availableHotelsList.querySelectorAll("label").forEach((el) => {
    el.style.display = el.textContent.toLowerCase().includes(searchTerm)
      ? "flex"
      : "none";
  });
};

const fetchAndRenderHotels = async (ui) => {
  try {
    const response = await fetch("/api/admin/get-all-hotels");
    if (!response.ok) throw new Error("Failed to fetch hotels.");
    const hotels = await response.json();
    ui.hotelsTableBody.innerHTML =
      hotels.length === 0
        ? `<tr><td colspan="7" class="p-4 text-center text-slate-500">No hotels found.</td></tr>`
        : "";
    const categories = ["Budget", "Midscale", "Upper Midscale", "Luxury"];
    hotels.forEach((hotel) => {
      const row = ui.hotelsTableBody.insertRow();
      const selectOptions = categories
        .map(
          (cat) =>
            `<option value="${cat}" ${
              hotel.category === cat ? "selected" : ""
            }>${cat}</option>`
        )
        .join("");
      row.innerHTML = `
        <td class="p-3 font-mono text-slate-600">${hotel.hotel_id}</td>
        <td class="p-3 font-medium text-slate-800">${hotel.property_name}</td>
        <td class="p-3 text-slate-600">${hotel.property_type}</td>
        <td class="p-3 text-slate-600">${hotel.city}</td>
        <td class="p-3 text-slate-500">${hotel.neighborhood || "N/A"}</td>
        <td class="p-3"><select data-hotel-id="${
          hotel.hotel_id
        }" class="category-select bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2">${selectOptions}</select></td>
        <td class="p-3 text-right space-x-2 whitespace-nowrap">
          <button data-hotel-id="${
            hotel.hotel_id
          }" data-action="manage-compset" class="control-btn text-xs bg-green-100 text-green-800 hover:bg-green-200">Manage Comp Set</button>
          <button data-hotel-id="${
            hotel.hotel_id
          }" data-action="sync-hotel-info" class="control-btn text-xs bg-slate-100 text-slate-800 hover:bg-slate-200">Sync Hotel Info</button>
          <button data-hotel-id="${
            hotel.hotel_id
          }" data-action="initial-sync" class="control-btn text-xs bg-blue-100 text-blue-800 hover:bg-blue-200">Full Data Sync</button>
        </td>`;
    });
  } catch (error) {
    ui.hotelsTableBody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-red-500">${error.message}</td></tr>`;
  }
};

async function setupPropertySelector(ui) {
  try {
    // FIX: Use the correct admin endpoint to get all hotels
    const response = await fetch("/api/admin/get-all-hotels");
    if (!response.ok) throw new Error("Failed to fetch hotels");
    const hotels = await response.json();

    ui.propertySelector.innerHTML = ""; // Clear any existing options

    // FIX: Use the correct property names from the new endpoint ('hotel_id', 'property_name')
    hotels.forEach((hotel) => {
      const option = document.createElement("option");
      option.value = hotel.hotel_id;
      option.textContent = hotel.property_name;
      ui.propertySelector.appendChild(option);
    });

    // Set the selector to the property currently active in the main app
    const currentPropertyId = localStorage.getItem("currentPropertyId");
    if (currentPropertyId) {
      ui.propertySelector.value = currentPropertyId;
    }
  } catch (error) {
    console.error("Could not load properties for admin selector:", error);
    ui.propertySelector.innerHTML = `<option>Error loading properties</option>`;
  }
}

const fetchLastRefreshTime = async (ui) => {
  try {
    const response = await fetch("/api/last-refresh-time");
    if (!response.ok) throw new Error("Not found");
    const data = await response.json();
    const date = new Date(data.last_successful_run);
    ui.lastRefreshTimeEl.textContent = date.toLocaleString("en-GB", {
      dateStyle: "long",
      timeStyle: "short",
    });
  } catch (error) {
    ui.lastRefreshTimeEl.textContent = "Never";
    ui.lastRefreshTimeEl.classList.add("text-yellow-600");
  }
};

const testConnection = async (url, statusEl, ui, requiresProperty = false) => {
  // A helper function to manage the status display.
  const setStatus = (text, colorClass) => {
    statusEl.textContent = text;
    statusEl.className = `ml-4 text-sm font-semibold ${colorClass}`;
  };

  setStatus("Testing...", "text-slate-500");

  let finalUrl = url;
  // If this action requires a property context (like testing Cloudbeds auth),
  // get the selected property ID and append it to the URL.
  if (requiresProperty) {
    const propertyId = ui.propertySelector.value;
    if (!propertyId) {
      // If no property is selected, show an error and stop.
      setStatus("❌ Select a property first", "text-red-600");
      return;
    }
    // Append the propertyId as a query parameter.
    finalUrl = `${url}?propertyId=${propertyId}`;
  }

  try {
    const response = await fetch(finalUrl);
    if (response.ok) {
      // On success, show the connected status.
      setStatus("✅ Connected", "text-green-600");
    } else {
      // On failure, show the HTTP status code.
      setStatus(`❌ Error: ${response.status}`, "text-red-600");
    }
  } catch (error) {
    // If the fetch itself fails (e.g., network error), show a generic failed message.
    setStatus("❌ Failed", "text-red-600");
  }
};

const runJob = async (ui, action, hotelId, btn) => {
  const originalText = btn.textContent;
  const statusEl = ui.initialSyncStatus;
  btn.disabled = true;
  btn.textContent = "Running...";
  statusEl.textContent = "Job started...";
  statusEl.className = "text-sm font-medium text-slate-500";

  let url = `/api/admin/${action}`;
  let options = {};
  if (action !== "daily-refresh") {
    options = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propertyId: hotelId }),
    };
  }
  try {
    const response = await fetch(url, options);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unknown error");
    statusEl.textContent = `✅ ${data.message || "Job completed!"}`;
    statusEl.className = "text-sm font-medium text-green-600";
    if (action === "daily-refresh") fetchLastRefreshTime(ui);
  } catch (error) {
    statusEl.textContent = `❌ Job failed: ${error.message}`;
    statusEl.className = "text-sm font-medium text-red-600";
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
    setTimeout(() => {
      statusEl.textContent = "";
    }, 8000);
  }
};

const updateHotelCategory = async (hotelId, newCategory, selectElement) => {
  selectElement.disabled = true;
  try {
    const response = await fetch("/api/admin/update-hotel-category", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hotelId: hotelId, category: newCategory }),
    });
    if (!response.ok)
      throw new Error((await response.json()).error || "Failed to update.");
    selectElement.classList.add("border-green-500", "ring-2", "ring-green-200");
    setTimeout(() => {
      selectElement.classList.remove(
        "border-green-500",
        "ring-2",
        "ring-green-200"
      );
    }, 2000);
  } catch (error) {
    alert(`Error updating category: ${error.message}`);
  } finally {
    selectElement.disabled = false;
  }
};

const setupApiExplorer = (ui) => {
  const exploreApi = async (url, btn, action) => {
    ui.apiResultsContainer.innerHTML = `<div class="p-4">Fetching from Cloudbeds API...</div>`;
    if (btn) btn.disabled = true;

    try {
      const response = await fetch(url);
      const data = await response.json();
      if (!response.ok) throw new Error(JSON.stringify(data));

      ui.apiResultsContainer.innerHTML = `<pre class="whitespace-pre-wrap break-all">${JSON.stringify(
        data,
        null,
        2
      )}</pre>`;

      if (action === "fetchDatasets") {
        ui.insightsStep2.classList.remove("hidden");
      } else if (action === "fetchStructure") {
        const allColumns = data.cdfs.flatMap((category) => category.cdfs);
        populateSelectors(allColumns, ui);
        ui.insightsStep3.classList.remove("hidden");
      }
    } catch (error) {
      ui.apiResultsContainer.innerHTML = `<div class="p-4 bg-red-100 text-red-700 rounded-lg"><strong>Error:</strong> ${error.message}</div>`;
    } finally {
      if (btn) btn.disabled = false;
    }
  };

  const populateSelectors = (columns, ui) => {
    ui.insightsMetricsContainer.innerHTML = "";
    ui.insightsDimensionsSelect.innerHTML = "";
    if (!columns || columns.length === 0) {
      ui.insightsMetricsContainer.innerHTML =
        '<span class="text-slate-400 text-sm">No fields found.</span>';
      return;
    }
    const metricKinds = [
      "DynamicCurrency",
      "Currency",
      "DynamicPercentage",
      "Number",
    ];
    const dimensionKinds = ["String", "Date", "Identifier"];

    columns.forEach((column) => {
      if (metricKinds.includes(column.kind)) {
        const label = document.createElement("label");
        label.className = "flex items-center space-x-2 text-sm";
        label.innerHTML = `<input type="checkbox" value="${column.column}" class="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"> <span class="text-slate-700">${column.name}</span>`;
        ui.insightsMetricsContainer.appendChild(label);
      }
      if (dimensionKinds.includes(column.kind)) {
        const option = document.createElement("option");
        option.value = column.column;
        option.textContent = column.name;
        ui.insightsDimensionsSelect.appendChild(option);
      }
    });
  };

  const getExplorerUrlWithProperty = (baseUrl) => {
    const propertyId = ui.propertySelector.value;
    const separator = baseUrl.includes("?") ? "&" : "?";
    return `${baseUrl}${separator}propertyId=${propertyId}`;
  };

  ui.fetchDatasetsBtn.addEventListener("click", () =>
    exploreApi(
      getExplorerUrlWithProperty("/api/admin/explore/datasets"),
      ui.fetchDatasetsBtn,
      "fetchDatasets"
    )
  );

  ui.fetchStructureBtn.addEventListener("click", () => {
    const id = ui.datasetIdInput.value;
    if (id)
      exploreApi(
        getExplorerUrlWithProperty(
          `/api/admin/explore/dataset-structure?id=${id}`
        ),
        ui.fetchStructureBtn,
        "fetchStructure"
      );
  });

  ui.fetchInsightsDataBtn.addEventListener("click", () => {
    const id = ui.datasetIdInput.value;
    const startDate = ui.insightsStartDate.value;
    const endDate = ui.insightsEndDate.value;
    const selectedMetrics = Array.from(
      ui.insightsMetricsContainer.querySelectorAll("input:checked")
    )
      .map((cb) => cb.value)
      .join(",");
    const selectedDimensions = Array.from(
      ui.insightsDimensionsSelect.selectedOptions
    )
      .map((opt) => opt.value)
      .join(",");

    if (!id || !selectedMetrics) {
      alert("Please provide a Dataset ID and select at least one metric.");
      return;
    }

    let baseUrl = `/api/admin/explore/insights-data?id=${id}&columns=${encodeURIComponent(
      selectedMetrics
    )}`;
    if (startDate) baseUrl += `&startDate=${startDate}`;
    if (endDate) baseUrl += `&endDate=${endDate}`;
    if (selectedDimensions)
      baseUrl += `&groupBy=${encodeURIComponent(selectedDimensions)}`;

    exploreApi(
      getExplorerUrlWithProperty(baseUrl),
      ui.fetchInsightsDataBtn,
      "fetchData"
    );
  });

  ui.allGeneralApiButtons.forEach((btn) => {
    const endpoint = btn.id.replace("fetch-", "").replace("-btn", "");
    if (
      endpoint.startsWith("sample-") ||
      endpoint.startsWith("taxes-") ||
      endpoint.startsWith("user-")
    ) {
      btn.addEventListener("click", () =>
        exploreApi(
          getExplorerUrlWithProperty(`/api/admin/explore/${endpoint}`),
          btn
        )
      );
    }
  });
};
// --- NEW MEWS HELPER FUNCTION ---
/**
 * Handles the logic for connecting a new Mews property from the admin panel.
 * @param {object} ui - The object containing all UI element references.
 */
const connectMewsProperty = async (ui) => {
  // Get the values from the input fields.
  const accessToken = ui.mewsAccessTokenInput.value.trim();
  const ownerEmail = ui.mewsOwnerEmailInput.value.trim();

  // Simple validation to ensure fields are not empty.
  if (!accessToken || !ownerEmail) {
    ui.mewsConnectStatus.textContent = "Please fill out both fields.";
    ui.mewsConnectStatus.className = "text-sm font-medium text-yellow-600";
    return;
  }

  // Disable the button and show a status message to prevent multiple clicks.
  ui.connectMewsBtn.disabled = true;
  ui.connectMewsBtn.textContent = "Connecting...";
  ui.mewsConnectStatus.textContent = "Submitting connection request...";
  ui.mewsConnectStatus.className = "text-sm font-medium text-slate-500";

  try {
    // Call the backend endpoint we created earlier.
    const response = await fetch("/api/admin/mews/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Send the token and email in the request body.
      body: JSON.stringify({ accessToken, ownerEmail }),
    });

    const data = await response.json();

    // If the API returns an error, display it.
    if (!response.ok) {
      throw new Error(data.error || "An unknown error occurred.");
    }

    // On success, show the success message from the API.
    ui.mewsConnectStatus.textContent = `✅ ${data.message}`;
    ui.mewsConnectStatus.className = "text-sm font-medium text-green-600";

    // Clear the input fields for the next use.
    ui.mewsAccessTokenInput.value = "";
    ui.mewsOwnerEmailInput.value = "";

    // Refresh the main hotels table after a short delay to show the new property being synced.
    setTimeout(() => {
      fetchAndRenderHotels(ui);
    }, 2000); // 2-second delay
  } catch (error) {
    // On failure, display the error message.
    ui.mewsConnectStatus.textContent = `❌ Error: ${error.message}`;
    ui.mewsConnectStatus.className = "text-sm font-medium text-red-600";
  } finally {
    // Re-enable the button, whether the process succeeded or failed.
    ui.connectMewsBtn.disabled = false;
    ui.connectMewsBtn.textContent = "Connect & Sync Property";
  }
};

// --- MAIN PANEL INITIALIZER ---
// --- MAIN PANEL INITIALIZER ---
function initializeAdminPanel() {
  // --- ADD THESE TWO LINES FOR DEBUGGING ---
  console.log("DEBUG: Initializing admin panel...");
  console.log(
    "DEBUG: Connect Mews Button Element:",
    document.getElementById("connect-mews-btn")
  );
  // --- END OF DEBUGGING LINES ---

  const ui = {
    // Mews Connection UI
    mewsAccessTokenInput: document.getElementById("mews-access-token"),
    mewsOwnerEmailInput: document.getElementById("mews-owner-email"),
    connectMewsBtn: document.getElementById("connect-mews-btn"),
    mewsConnectStatus: document.getElementById("mews-connect-status"),

    // System Health & Data Freshness UI
    lastRefreshTimeEl: document.getElementById("last-refresh-time"),
    testCloudbedsBtn: document.getElementById("test-cloudbeds-btn"),
    cloudbedsStatusEl: document.getElementById("cloudbeds-status"),
    testDbBtn: document.getElementById("test-db-btn"),
    dbStatusEl: document.getElementById("db-status"),
    runDailyRefreshBtn: document.getElementById("run-daily-refresh-btn"),
    jobStatusMessage: document.getElementById("job-status-message"),
    reportSelectDropdown: document.getElementById("report-select-dropdown"),
    sendSingleReportBtn: document.getElementById("send-single-report-btn"),
    singleReportStatusMessage: document.getElementById(
      "single-report-status-message"
    ),

    // Hotel Management Table UI
    hotelsTableBody: document.getElementById("hotels-table-body"),
    initialSyncStatus: document.getElementById("initial-sync-status"),

    // Comp Set Modal UI
    compsetModal: document.getElementById("compset-modal"),
    compsetHotelName: document.getElementById("compset-hotel-name"),
    compsetCloseBtn: document.getElementById("compset-close-btn"),
    compsetCancelBtn: document.getElementById("compset-cancel-btn"),
    compsetSaveBtn: document.getElementById("compset-save-btn"),
    compsetSearchInput: document.getElementById("compset-search-input"),
    comsetStatus: document.getElementById("compset-status"),
    currentCompetitorsList: document.getElementById("current-competitors-list"),
    availableHotelsList: document.getElementById("available-hotels-list"),
    currentCompetitorsCount: document.getElementById(
      "current-competitors-count"
    ),

    // API Explorer UI
    propertySelector: document.getElementById("admin-property-selector"),
    apiResultsContainer: document.getElementById("api-results-container"),
    allGeneralApiButtons: document.querySelectorAll(
      '#admin-content button[id^="fetch-"]'
    ),
    fetchDatasetsBtn: document.getElementById("fetch-datasets-btn"),
    datasetIdInput: document.getElementById("dataset-id-input"),
    fetchStructureBtn: document.getElementById("fetch-structure-btn"),
    fetchInsightsDataBtn: document.getElementById("fetch-insights-data-btn"),
    insightsStartDate: document.getElementById("insights-start-date"),
    insightsEndDate: document.getElementById("insights-end-date"),
    insightsMetricsContainer: document.getElementById(
      "insights-metrics-container"
    ),
    insightsDimensionsSelect: document.getElementById(
      "insights-dimensions-select"
    ),
    insightsStep1: document.getElementById("insights-step-1"),
    insightsStep2: document.getElementById("insights-step-2"),
    insightsStep3: document.getElementById("insights-step-3"),
  };

  const state = { currentEditingHotelId: null };

  // --- Attach All Event Listeners ---
  ui.connectMewsBtn.addEventListener("click", () => connectMewsProperty(ui));
  ui.compsetCloseBtn.addEventListener("click", () =>
    closeCompSetManager(ui, state)
  );
  ui.compsetCancelBtn.addEventListener("click", () =>
    closeCompSetManager(ui, state)
  );
  ui.compsetSaveBtn.addEventListener("click", () => saveCompSet(ui, state));
  ui.compsetSearchInput.addEventListener("input", () =>
    filterAvailableHotels(ui)
  );
  ui.currentCompetitorsList.addEventListener("change", (event) =>
    handleCheckboxChange(event, ui)
  );
  ui.availableHotelsList.addEventListener("change", (event) =>
    handleCheckboxChange(event, ui)
  );
  ui.testCloudbedsBtn.addEventListener("click", () =>
    testConnection("/api/admin/test-cloudbeds", ui.cloudbedsStatusEl, ui, true)
  );
  ui.testDbBtn.addEventListener("click", () =>
    testConnection("/api/admin/test-database", ui.dbStatusEl, ui, false)
  );
  ui.runDailyRefreshBtn.addEventListener("click", () =>
    runJob(ui, "daily-refresh", null, ui.runDailyRefreshBtn)
  );
  ui.sendSingleReportBtn.addEventListener("click", async () => {
    const reportId = ui.reportSelectDropdown.value;
    const btn = ui.sendSingleReportBtn;
    const statusEl = ui.singleReportStatusMessage;
    if (!reportId) {
      statusEl.textContent = "Please select a report first.";
      statusEl.className = "text-sm font-medium text-yellow-600 h-4 block";
      return;
    }
    btn.disabled = true;
    btn.textContent = "Sending...";
    statusEl.textContent = "Sending report...";
    statusEl.className = "text-sm font-medium text-slate-500 h-4 block";
    try {
      const response = await fetch("/api/admin/run-scheduled-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unknown error.");
      statusEl.textContent = `✅ ${data.message}`;
      statusEl.className = "text-sm font-medium text-green-600 h-4 block";
    } catch (error) {
      statusEl.textContent = `❌ Error: ${error.message}`;
      statusEl.className = "text-sm font-medium text-red-600 h-4 block";
    } finally {
      btn.disabled = false;
      btn.textContent = "Send Now";
      setTimeout(() => {
        statusEl.textContent = "";
      }, 8000);
    }
  });

  ui.hotelsTableBody.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const { hotelId, action } = button.dataset;
    if (action === "manage-compset") {
      openCompSetManager(
        hotelId,
        button.closest("tr").cells[1].textContent,
        ui,
        state
      );
    } else if (action === "sync-hotel-info" || action === "initial-sync") {
      runJob(ui, action, hotelId, button);
    }
  });

  ui.hotelsTableBody.addEventListener("change", (event) => {
    if (event.target.classList.contains("category-select")) {
      updateHotelCategory(
        event.target.dataset.hotelId,
        event.target.value,
        event.target
      );
    }
  });

  const populateReportsDropdown = async () => {
    try {
      const response = await fetch("/api/admin/get-scheduled-reports");
      if (!response.ok) throw new Error("Server error fetching reports.");
      const reports = await response.json();
      ui.reportSelectDropdown.innerHTML = "";
      if (reports.length === 0) {
        ui.reportSelectDropdown.innerHTML =
          '<option value="">No reports found</option>';
        ui.sendSingleReportBtn.disabled = true;
        return;
      }
      ui.reportSelectDropdown.innerHTML =
        '<option value="">-- Select a report to send --</option>';
      reports.forEach((report) => {
        const option = document.createElement("option");
        option.value = report.report_id;
        option.textContent = `${report.property_name} - ${report.report_name}`;
        ui.reportSelectDropdown.appendChild(option);
      });
    } catch (error) {
      console.error("Failed to populate reports dropdown:", error);
      ui.reportSelectDropdown.innerHTML =
        '<option value="">Error loading reports</option>';
    }
  };

  // --- Initial Page Load Calls ---
  populateReportsDropdown();
  setupApiExplorer(ui);
  setupPropertySelector(ui);
  fetchLastRefreshTime(ui);
  fetchAndRenderHotels(ui);
}
