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
  const lastRefreshTimeEl = document.getElementById("last-refresh-time");
  const testCloudbedsBtn = document.getElementById("test-cloudbeds-btn");
  const cloudbedsStatusEl = document.getElementById("cloudbeds-status");
  const testDbBtn = document.getElementById("test-db-btn");
  const dbStatusEl = document.getElementById("db-status");
  const runDailyRefreshBtn = document.getElementById("run-daily-refresh-btn");
  const runInitialSyncBtn = document.getElementById("run-initial-sync-btn");
  const runEndpointTestsBtn = document.getElementById("run-endpoint-tests-btn");
  const endpointTestResultsEl = document.getElementById(
    "endpoint-test-results"
  );
  const hotelsTableBody = document.getElementById("hotels-table-body");

  const fetchLastRefreshTime = async () => {
    try {
      const response = await fetch("/api/last-refresh-time");
      if (!response.ok) throw new Error("Not found");
      const data = await response.json();
      const date = new Date(data.last_successful_run);
      lastRefreshTimeEl.textContent = date.toLocaleString("en-GB", {
        timeZone: "Europe/Warsaw",
      });
    } catch (error) {
      lastRefreshTimeEl.textContent = "Never";
      lastRefreshTimeEl.classList.add("text-yellow-600");
    }
  };

  const fetchAndRenderHotels = async () => {
    try {
      const response = await fetch("/api/get-all-hotels");
      if (!response.ok) throw new Error("Failed to fetch hotels.");
      const hotels = await response.json();
      hotelsTableBody.innerHTML = "";
      if (hotels.length === 0) {
        hotelsTableBody.innerHTML = `<tr><td colspan="4" class="text-center p-4 text-gray-500">No hotels found in the database.</td></tr>`;
        return;
      }
      hotels.forEach((hotel) => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td class="px-4 py-3 font-mono text-gray-600">${hotel.hotel_id}</td>
          <td class="px-4 py-3 font-medium text-gray-800">${hotel.property_name}</td>
          <td class="px-4 py-3 text-gray-600">${hotel.property_type}</td>
          <td class="px-4 py-3 text-gray-600">${hotel.city}</td>
        `;
        hotelsTableBody.appendChild(row);
      });
    } catch (error) {
      hotelsTableBody.innerHTML = `<tr><td colspan="4" class="text-center p-4 text-red-600">${error.message}</td></tr>`;
    }
  };

  const testConnection = async (url, statusEl) => {
    statusEl.textContent = "Testing...";
    statusEl.className = "ml-4 text-sm font-semibold text-gray-500";
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

  const runJob = async (url, btn) => {
    const originalText = btn.textContent;
    const statusEl = document.getElementById("job-status-message");
    btn.disabled = true;
    btn.textContent = "Running...";
    statusEl.textContent = "Job started, please wait...";
    statusEl.className = "mt-4 text-sm font-medium text-gray-500";
    try {
      const response = await fetch(url);
      if (response.ok) {
        statusEl.textContent = "✅ Job completed successfully!";
        statusEl.className = "mt-4 text-sm font-medium text-green-600";
        fetchLastRefreshTime();
      } else {
        const data = await response.json();
        statusEl.textContent = `❌ Job failed: ${
          data.error || "Unknown error"
        }`;
        statusEl.className = "mt-4 text-sm font-medium text-red-600";
      }
    } catch (error) {
      statusEl.textContent = `❌ Job failed to start: ${error.message}`;
      statusEl.className = "mt-4 text-sm font-medium text-red-600";
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
      setTimeout(() => {
        statusEl.textContent = "";
      }, 5000);
    }
  };

  // --- START: TABLE RENDERING FUNCTIONS ---
  function renderDatasetsTable(datasets, container) {
    if (!datasets || datasets.length === 0) {
      container.innerHTML = `<div class="p-4 bg-yellow-50 text-yellow-700 rounded-lg text-sm">No datasets found.</div>`;
      return;
    }
    let tableHTML = `
      <div class="overflow-x-auto border border-gray-200 rounded-lg">
        <table class="w-full text-sm">
          <thead class="bg-gray-50">
            <tr class="text-left">
              <th class="px-4 py-3 font-semibold text-gray-600">ID</th>
              <th class="px-4 py-3 font-semibold text-gray-600">Name</th>
              <th class="px-4 py-3 font-semibold text-gray-600">Read Only</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">`;
    for (const dataset of datasets) {
      tableHTML += `
        <tr>
          <td class="px-4 py-3 font-mono text-gray-600">${dataset.id}</td>
          <td class="px-4 py-3 font-medium text-gray-800">${dataset.name}</td>
          <td class="px-4 py-3 font-mono text-gray-600">${dataset.read_only}</td>
        </tr>`;
    }
    tableHTML += `</tbody></table></div>`;
    container.innerHTML = tableHTML;
  }

  function renderFieldsTable(fields, container) {
    if (!fields || fields.length === 0) {
      container.innerHTML = `<div class="p-4 bg-yellow-50 text-yellow-700 rounded-lg text-sm">No fields or structure found for this dataset. The API returned an empty array.</div>`;
      return;
    }
    let tableHTML = `
      <div class="overflow-x-auto border border-gray-200 rounded-lg">
        <table class="w-full text-sm">
          <thead class="bg-gray-50">
            <tr class="text-left">
              <th class="px-4 py-3 font-semibold text-gray-600">Column (API Name)</th>
              <th class="px-4 py-3 font-semibold text-gray-600">Friendly Name</th>
              <th class="px-4 py-3 font-semibold text-gray-600">Description</th>
              <th class="px-4 py-3 font-semibold text-gray-600">Data Type</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">`;
    for (const field of fields) {
      tableHTML += `
        <tr>
          <td class="px-4 py-3 font-mono text-blue-600">${
            field.column || "N/A"
          }</td>
          <td class="px-4 py-3 font-medium text-gray-800">${
            field.name || "N/A"
          }</td>
          <td class="px-4 py-3 text-gray-600">${field.description || "N/A"}</td>
          <td class="px-4 py-3 font-mono text-gray-600">${
            field.kind || "N/A"
          }</td>
        </tr>`;
    }
    tableHTML += `</tbody></table></div>`;
    container.innerHTML = tableHTML;
  }
  // --- END: TABLE RENDERING FUNCTIONS ---

  runEndpointTestsBtn.addEventListener("click", async () => {
    runEndpointTestsBtn.disabled = true;
    runEndpointTestsBtn.textContent = "Testing...";
    endpointTestResultsEl.innerHTML = `<div class="text-center p-4 text-gray-500">Running tests, please wait...</div>`;
    try {
      const response = await fetch("/api/run-endpoint-tests");
      const results = await response.json();
      renderTestResults(results);
    } catch (error) {
      endpointTestResultsEl.innerHTML = `<div class="p-4 bg-red-50 text-red-700 rounded-lg"><strong>Error:</strong> Could not run the test suite. ${error.message}</div>`;
    } finally {
      runEndpointTestsBtn.disabled = false;
      runEndpointTestsBtn.textContent = "Run Endpoint Tests";
    }
  });

  function renderTestResults(results) {
    let tableHTML = `
      <table class="w-full text-sm border-collapse">
        <thead><tr class="border-b"><th class="px-4 py-3 text-left font-semibold text-gray-600">Endpoint Name</th><th class="px-4 py-3 text-left font-semibold text-gray-600">Status</th><th class="px-4 py-3 text-left font-semibold text-gray-600">Details</th></tr></thead>
        <tbody class="divide-y divide-gray-200">`;
    results.forEach((result) => {
      const statusClass = result.ok
        ? "bg-green-100 text-green-800"
        : "bg-red-100 text-red-800";
      const statusIcon = result.ok ? "✅" : "❌";
      const statusText = result.ok ? "OK" : "FAIL";
      tableHTML += `<tr><td class="px-4 py-3 font-medium text-gray-700">${result.name}</td><td class="px-4 py-3"><span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${statusClass}">${statusIcon} ${statusText}</span></td><td class="px-4 py-3 text-gray-600 font-mono">${result.status} - ${result.statusText}</td></tr>`;
    });
    tableHTML += `</tbody></table>`;
    endpointTestResultsEl.innerHTML = tableHTML;
  }

  testCloudbedsBtn.addEventListener("click", () =>
    testConnection("/api/test-cloudbeds", cloudbedsStatusEl)
  );
  testDbBtn.addEventListener("click", () =>
    testConnection("/api/test-database", dbStatusEl)
  );
  runDailyRefreshBtn.addEventListener("click", () =>
    runJob("/api/daily-refresh", runDailyRefreshBtn)
  );
  runInitialSyncBtn.addEventListener("click", () => {
    if (
      confirm(
        "Are you sure you want to run a full data sync? This can take several minutes and will overwrite existing data."
      )
    ) {
      runJob("/api/initial-sync", runInitialSyncBtn);
    }
  });

  fetchLastRefreshTime();
  fetchAndRenderHotels();

  // --- API EXPLORER LOGIC ---
  const fetchDatasetsBtn = document.getElementById("fetch-datasets-btn");
  const apiResultsContainer = document.getElementById("api-results-container");

  fetchDatasetsBtn.addEventListener("click", async () => {
    apiResultsContainer.innerHTML = `<div class="text-center p-4">Fetching from Cloudbeds API...</div>`;
    fetchDatasetsBtn.disabled = true;

    try {
      const response = await fetch("/api/explore/datasets");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "An unknown server error occurred.");
      }
      renderDatasetsTable(data, apiResultsContainer);
    } catch (error) {
      console.error("API Explorer Fetch Error:", error);
      apiResultsContainer.innerHTML = `<div class="p-4 bg-red-50 text-red-700 rounded-lg"><strong>Error:</strong> ${error.message}</div>`;
    } finally {
      fetchDatasetsBtn.disabled = false;
    }
  });

  // This is the block we are focused on
  const fetchStructureBtn = document.getElementById("fetch-structure-btn");
  const datasetIdInput = document.getElementById("dataset-id-input");

  fetchStructureBtn.addEventListener("click", async () => {
    const datasetId = datasetIdInput.value;
    if (!datasetId) {
      apiResultsContainer.innerHTML = `<div class="p-4 bg-yellow-50 text-yellow-700 rounded-lg text-sm">Please enter a Dataset ID.</div>`;
      return;
    }

    apiResultsContainer.innerHTML = `<div class="text-center p-4">Fetching raw structure for Dataset ${datasetId}...</div>`;
    fetchStructureBtn.disabled = true;

    try {
      const response = await fetch(
        `/api/explore/dataset-structure?id=${datasetId}`
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "An unknown server error occurred.");
      }

      // Temporarily display raw JSON to debug
      const resultsContainer = document.getElementById("api-results-container");
      resultsContainer.innerHTML = `<pre class="whitespace-pre-wrap break-all text-xs">${JSON.stringify(
        data,
        null,
        2
      )}</pre>`;
    } catch (error) {
      console.error("API Explorer Fetch Error:", error);
      const resultsContainer = document.getElementById("api-results-container");
      resultsContainer.innerHTML = `<div class="p-4 bg-red-50 text-red-700 rounded-lg"><strong>Error:</strong> ${error.message}</div>`;
    } finally {
      fetchStructureBtn.disabled = false;
    }
  });
}
