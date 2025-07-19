// public/admin/admin.mjs

// --- MAIN INITIALIZATION ---
document.addEventListener("DOMContentLoaded", () => {
  checkAdminSessionAndInitialize();
});

// --- NEW SESSION CHECKING LOGIC ---
async function checkAdminSessionAndInitialize() {
  const loginForm = document.getElementById("login-form");
  const adminContent = document.getElementById("admin-content");
  const loginError = document.getElementById("login-error");

  try {
    const response = await fetch("/api/auth/session-info");
    const sessionInfo = await response.json();

    if (sessionInfo.isAdmin) {
      showAdminContent();
    } else {
      loginForm.classList.remove("hidden");
      adminContent.classList.add("hidden");
      loginError.textContent =
        "Access Denied: You must be an administrator to view this page.";
      document.getElementById("password").disabled = true;
      document.getElementById("login-btn").disabled = true;
    }
  } catch (error) {
    console.error("Could not verify admin session", error);
    loginError.textContent =
      "Could not verify session. Please try again later.";
  } finally {
    document.getElementById("loading-spinner").classList.add("hidden");
    document.getElementById("admin-wrapper").classList.remove("hidden");
  }
}

function showAdminContent() {
  document.getElementById("login-form").classList.add("hidden");
  document.getElementById("admin-content").classList.remove("hidden");
  initializeAdminPanel();
}

// --- ADMIN PANEL FUNCTIONALITY ---
function initializeAdminPanel() {
  // Get all admin elements once
  const lastRefreshTimeEl = document.getElementById("last-refresh-time");
  const testCloudbedsBtn = document.getElementById("test-cloudbeds-btn");
  const cloudbedsStatusEl = document.getElementById("cloudbeds-status");
  const testDbBtn = document.getElementById("test-db-btn");
  const dbStatusEl = document.getElementById("db-status");
  const runDailyRefreshBtn = document.getElementById("run-daily-refresh-btn");
  const hotelsTableBody = document.getElementById("hotels-table-body");
  const pilotTableBody = document.getElementById("pilot-hotels-table-body");
  const apiResultsContainer = document.getElementById("api-results-container");

  // public/admin/admin.mjs

  // A single listener on the table body now handles all button clicks inside it.
  hotelsTableBody.addEventListener("click", async (event) => {
    // Find the button that was clicked, if any
    const button = event.target.closest("button");
    if (!button) return;

    const hotelId = button.dataset.hotelId;
    const action = button.dataset.action;

    // Handle the NEW "Sync Hotel Info" action
    if (action === "sync-hotel-info") {
      // Use the generic 'runJob' helper for a consistent UI.
      // This provides immediate feedback to the admin.
      runJob(
        "/api/sync-hotel-info", // Call our new consolidated endpoint
        button,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ propertyId: hotelId }),
        }
      );
    }

    // Handle the "Full Data Sync" action (previously "Initial Sync")
    if (action === "initial-sync") {
      if (
        !confirm(
          `Are you sure you want to run a full 15-year data sync for property ${hotelId}? This can take several minutes.`
        )
      ) {
        return;
      }
      runJob("/api/initial-sync", button, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId: hotelId }),
      });
    }
  });

  // Event listener for the pilot hotel connection table.
  pilotTableBody.addEventListener("click", async (event) => {
    const button = event.target;
    if (button.classList.contains("connect-btn")) {
      button.disabled = true;
      button.textContent = "Activating...";
      const propertyId = button.dataset.propertyId;
      const userId = button.dataset.userId;
      try {
        const response = await fetch("/api/activate-pilot-property", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ propertyId, userId }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);
        fetchAndRenderPilotStatus();
      } catch (error) {
        alert(`Activation failed: ${error.message}`);
        button.disabled = false;
        button.textContent = "Activate";
      }
    }

    if (button.classList.contains("enable-btn")) {
      button.disabled = true;
      button.textContent = "Enabling...";
      const propertyId = button.dataset.propertyId;
      await enablePilotApp(propertyId);
    }
  });

  // --- MODIFIED: fetchAndRenderHotels now adds the action buttons ---
  const fetchAndRenderHotels = async () => {
    try {
      const response = await fetch("/api/get-all-hotels");
      if (!response.ok) throw new Error("Failed to fetch hotels.");
      const hotels = await response.json();
      hotelsTableBody.innerHTML = "";
      if (hotels.length === 0) {
        hotelsTableBody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-500">No hotels found.</td></tr>`;
        return;
      }

      const categories = ["Budget", "Midscale", "Upper Midscale", "Luxury"];

      hotels.forEach((hotel) => {
        const row = document.createElement("tr");
        let selectOptions = categories
          .map(
            (cat) =>
              `<option value="${cat}" ${
                hotel.category === cat ? "selected" : ""
              }>${cat}</option>`
          )
          .join("");

        // NEW: Row HTML now includes a cell for the Actions buttons.
        // public/admin/admin.mjs

        // The row HTML now includes separate buttons for syncing info and the full data pull.
        row.innerHTML = `
          <td class="p-3 font-mono text-slate-600">${hotel.hotel_id}</td>
          <td class="p-3 font-medium text-slate-800">${hotel.property_name}</td>
          <td class="p-3 text-slate-600">${hotel.property_type}</td>
          <td class="p-3 text-slate-600">${hotel.city}</td>
          <td class="p-3 text-slate-500">${hotel.neighborhood || "N/A"}</td>
          <td class="p-3">
            <select data-hotel-id="${
              hotel.hotel_id
            }" class="category-select bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2">
              ${selectOptions}
            </select>
          </td>
          <td class="p-3 text-right space-x-2">
            <button data-hotel-id="${
              hotel.hotel_id
            }" data-action="sync-hotel-info" class="control-btn text-xs bg-slate-100 text-slate-800 hover:bg-slate-200" title="Sync latest hotel details like name, address, and tax info.">
              Sync Hotel Info
            </button>
            <button data-hotel-id="${
              hotel.hotel_id
            }" data-action="initial-sync" class="control-btn text-xs bg-blue-100 text-blue-800 hover:bg-blue-200" title="Warning: This pulls up to 15 years of historical data and can take several minutes.">
              Full Data Sync
            </button>
          </td>
        `;
        hotelsTableBody.appendChild(row);
      });
    } catch (error) {
      hotelsTableBody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-red-500">${error.message}</td></tr>`;
    }
  };

  // NEW: Add a single event listener to the table to handle all dropdown changes
  hotelsTableBody.addEventListener("change", (event) => {
    if (event.target.classList.contains("category-select")) {
      const hotelId = event.target.dataset.hotelId;
      const newCategory = event.target.value;
      updateHotelCategory(hotelId, newCategory, event.target);
    }
  });

  // --- Helper Functions (no major changes to the logic of these) ---
  const fetchLastRefreshTime = async () => {
    try {
      const response = await fetch("/api/last-refresh-time");
      if (!response.ok) throw new Error("Not found");
      const data = await response.json();
      const date = new Date(data.last_successful_run);
      lastRefreshTimeEl.textContent = date.toLocaleString("en-GB", {
        dateStyle: "long",
        timeStyle: "short",
      });
    } catch (error) {
      lastRefreshTimeEl.textContent = "Never";
      lastRefreshTimeEl.classList.add("text-yellow-600");
    }
  };

  const fetchAndRenderPilotStatus = async () => {
    try {
      const response = await fetch("/api/pilot-properties");
      if (!response.ok) throw new Error("Failed to fetch pilot properties.");
      const properties = await response.json();

      pilotTableBody.innerHTML = "";
      if (properties.length === 0) {
        pilotTableBody.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-slate-500">No pilot properties provisioned.</td></tr>`;
        return;
      }

      properties.forEach((prop) => {
        const row = document.createElement("tr");
        const statusClass =
          prop.status === "connected"
            ? "bg-blue-100 text-blue-800"
            : "bg-yellow-100 text-yellow-800";
        const statusText = prop.status;

        let actionButton = `<span class="font-semibold text-slate-500">✓ Done</span>`;
        if (prop.status === "pending") {
          actionButton = `<button data-property-id="${prop.property_id}" data-user-id="${prop.user_id}" class="control-btn connect-btn text-xs">Activate</button>`;
        } else if (prop.status === "connected") {
          actionButton = `<button data-property-id="${prop.property_id}" class="control-btn enable-btn text-xs text-green-700 bg-green-100 hover:bg-green-200">Enable App</button>`;
        }

        row.innerHTML = `
          <td class="p-3 font-medium text-slate-800">${
            prop.property_name || "(Activation Pending)"
          }</td>
          <td class="p-3">
            <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusClass}">
              ${statusText}
            </span>
          </td>
          <td class="p-3 text-right">${actionButton}</td>
        `;
        pilotTableBody.appendChild(row);
      });
    } catch (error) {
      pilotTableBody.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-red-500">${error.message}</td></tr>`;
    }
  };

  const testConnection = async (url, statusEl) => {
    statusEl.textContent = "Testing...";
    statusEl.className = "ml-4 text-sm font-semibold text-slate-500";
    try {
      const response = await fetch(url);
      if (response.ok) {
        statusEl.textContent = "✅ Connected";
        statusEl.className = "ml-4 text-sm font-semibold text-green-600";
      } else {
        statusEl.textContent = `❌ Error: ${response.status}`;
        statusEl.className = "ml-4 text-sm font-semibold text-red-600";
      }
    } catch (error) {
      statusEl.textContent = "❌ Failed";
      statusEl.className = "ml-4 text-sm font-semibold text-red-600";
    }
  };

  // public/admin/admin.mjs

  const runJob = async (url, btn, options = {}) => {
    const originalText = btn.textContent;
    const statusEl = document.getElementById("initial-sync-status"); // Use the status element above the table for all jobs

    btn.disabled = true;
    btn.textContent = "Running...";
    statusEl.textContent = "Job started, please wait...";
    statusEl.className = "mt-2 text-sm text-slate-500";

    try {
      const response = await fetch(url, options);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unknown error");
      }

      // Display a specific success message based on the job that was run
      let successMessage = data.message || "Job completed successfully!";
      if (url.includes("initial-sync")) {
        successMessage = `✅ Success! Synced ${
          data.totalRecordsUpdated
        } records for property ${JSON.parse(options.body).propertyId}.`;
      } else {
        successMessage = `✅ ${successMessage}`;
      }

      statusEl.textContent = successMessage;
      statusEl.className = "mt-2 text-sm text-green-600";

      // If the daily refresh was run, update the 'last refresh' time display
      if (url.includes("daily-refresh")) {
        fetchLastRefreshTime();
      }
    } catch (error) {
      statusEl.textContent = `❌ Job failed: ${error.message}`;
      statusEl.className = "mt-2 text-sm text-red-600";
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
      // Clear the status message after a few seconds
      setTimeout(() => {
        statusEl.textContent = "";
      }, 8000);
    }
  };
  const updateHotelCategory = async (hotelId, newCategory, selectElement) => {
    selectElement.disabled = true;
    try {
      const response = await fetch("/api/update-hotel-category", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hotelId: hotelId, category: newCategory }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update.");
      }
      selectElement.classList.add(
        "border-green-500",
        "ring-2",
        "ring-green-200"
      );
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

  const enablePilotApp = async (propertyId) => {
    const statusEl = document.getElementById("job-status-message"); // Use a consistent status element
    statusEl.textContent = `Enabling app for property ${propertyId}...`;
    statusEl.className = "mt-4 text-sm font-medium text-slate-500";
    try {
      const response = await fetch("/api/enable-pilot-app", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.message || "Failed to enable app.");
      statusEl.textContent = `✅ ${result.message}`;
      statusEl.className = "mt-4 text-sm font-medium text-green-600";
      fetchAndRenderPilotStatus();
    } catch (err) {
      statusEl.textContent = `❌ ${err.message}`;
      statusEl.className = "mt-4 text-sm font-medium text-red-600";
    } finally {
      setTimeout(() => {
        statusEl.textContent = "";
      }, 5000);
    }
  };

  // --- API Explorer Setup ---
  // This logic remains the same, so it is omitted for brevity but should be kept in your file.
  const setupApiExplorer = () => {
    const fetchDatasetsBtn = document.getElementById("fetch-datasets-btn");
    const datasetIdInput = document.getElementById("dataset-id-input");
    const fetchStructureBtn = document.getElementById("fetch-structure-btn");
    const fetchInsightsDataBtn = document.getElementById(
      "fetch-insights-data-btn"
    );
    const insightsColumnsInput = document.getElementById(
      "insights-columns-input"
    );
    const fetchSampleHotelBtn = document.getElementById(
      "fetch-sample-hotel-btn"
    );
    const fetchSampleGuestBtn = document.getElementById(
      "fetch-sample-guest-btn"
    );
    const fetchSampleReservationBtn = document.getElementById(
      "fetch-sample-reservation-btn"
    );
    const fetchSampleRoomBtn = document.getElementById("fetch-sample-room-btn");
    const fetchSampleRateBtn = document.getElementById("fetch-sample-rate-btn");
    const fetchTaxesFeesBtn = document.getElementById("fetch-taxes-fees-btn");
    const fetchUserInfoBtn = document.getElementById("fetch-user-info-btn");

    const exploreApi = async (url, btn, container) => {
      container.innerHTML = `<div class="p-4">Fetching from Cloudbeds API...</div>`;
      btn.disabled = true;
      try {
        const response = await fetch(url);
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || "An unknown server error occurred.");
        container.innerHTML = `<pre class="whitespace-pre-wrap break-all">${JSON.stringify(
          data,
          null,
          2
        )}</pre>`;
      } catch (error) {
        container.innerHTML = `<div class="p-4 bg-red-100 text-red-700 rounded-lg"><strong>Error:</strong> ${error.message}</div>`;
      } finally {
        btn.disabled = false;
      }
    };

    fetchDatasetsBtn.addEventListener("click", () =>
      exploreApi("/api/explore/datasets", fetchDatasetsBtn, apiResultsContainer)
    );
    fetchStructureBtn.addEventListener("click", () => {
      const id = datasetIdInput.value;
      if (id)
        exploreApi(
          `/api/explore/dataset-structure?id=${id}`,
          fetchStructureBtn,
          apiResultsContainer
        );
    });
    fetchInsightsDataBtn.addEventListener("click", () => {
      const id = datasetIdInput.value;
      const cols = insightsColumnsInput.value;
      if (id && cols)
        exploreApi(
          `/api/explore/insights-data?id=${id}&columns=${encodeURIComponent(
            cols
          )}`,
          fetchInsightsDataBtn,
          apiResultsContainer
        );
    });
    fetchSampleHotelBtn.addEventListener("click", () =>
      exploreApi(
        "/api/explore/sample-hotel",
        fetchSampleHotelBtn,
        apiResultsContainer
      )
    );
    fetchSampleGuestBtn.addEventListener("click", () =>
      exploreApi(
        "/api/explore/sample-guest",
        fetchSampleGuestBtn,
        apiResultsContainer
      )
    );
    fetchSampleReservationBtn.addEventListener("click", () =>
      exploreApi(
        "/api/explore/sample-reservation",
        fetchSampleReservationBtn,
        apiResultsContainer
      )
    );
    fetchSampleRoomBtn.addEventListener("click", () =>
      exploreApi(
        "/api/explore/sample-room",
        fetchSampleRoomBtn,
        apiResultsContainer
      )
    );
    fetchSampleRateBtn.addEventListener("click", () =>
      exploreApi(
        "/api/explore/sample-rate",
        fetchSampleRateBtn,
        apiResultsContainer
      )
    );
    fetchTaxesFeesBtn.addEventListener("click", () =>
      exploreApi(
        "/api/explore/taxes-fees",
        fetchTaxesFeesBtn,
        apiResultsContainer
      )
    );
    fetchUserInfoBtn.addEventListener("click", () =>
      exploreApi(
        "/api/explore/user-info",
        fetchUserInfoBtn,
        apiResultsContainer
      )
    );
  };

  // --- Form Submission Logic ---
  const credentialForm = document.getElementById("credential-form");
  credentialForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const saveBtn = document.getElementById("save-credentials-btn");
    const email = document.getElementById("user-email").value;
    const propertyId = document.getElementById("property-id-input").value;
    const clientId = document.getElementById("client-id").value;
    const clientSecret = document.getElementById("client-secret").value;
    const apiKey = document.getElementById("api-key-input").value;

    if (!confirm(`Provision property ${propertyId} for user ${email}?`)) return;

    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";

    try {
      const response = await fetch("/api/provision-pilot-hotel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          propertyId,
          clientId,
          clientSecret,
          apiKey,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      alert(`Success: ${result.message}`);
      credentialForm.reset();
      fetchAndRenderPilotStatus();
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Provision Hotel";
    }
  });

  // --- Initial Setup Calls ---
  fetchLastRefreshTime();
  fetchAndRenderHotels();
  fetchAndRenderPilotStatus();
  setupApiExplorer();

  // Attach Event Listeners for Core Tools
  testCloudbedsBtn.addEventListener("click", () =>
    testConnection("/api/test-cloudbeds", cloudbedsStatusEl)
  );
  testDbBtn.addEventListener("click", () =>
    testConnection("/api/test-database", dbStatusEl)
  );
  runDailyRefreshBtn.addEventListener("click", () =>
    runJob("/api/daily-refresh", runDailyRefreshBtn)
  );
}
