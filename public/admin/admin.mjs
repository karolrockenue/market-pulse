import { DATASET_7_MAP } from "../constants.mjs";

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("login-form");
  const adminContent = document.getElementById("admin-content");
  const passwordInput = document.getElementById("password");
  const loginBtn = document.getElementById("login-btn");
  const loginError = document.getElementById("login-error");

  // Check if user is already logged in from a previous session
  if (sessionStorage.getItem("isAdminAuthenticated") === "true") {
    showAdminContent();
  }

  loginBtn.addEventListener("click", async () => {
    const password = passwordInput.value;
    loginError.textContent = "";

    try {
      const response = await fetch("/api/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        sessionStorage.setItem("isAdminAuthenticated", "true");
        showAdminContent();
      } else {
        const data = await response.json();
        loginError.textContent = data.error || "Invalid password.";
      }
    } catch (error) {
      loginError.textContent = "An error occurred. Please try again.";
    }
  });

  function showAdminContent() {
    loginForm.classList.add("hidden");
    adminContent.classList.remove("hidden");
    initializeAdminPanel();
  }

  function initializeAdminPanel() {
    const lastRefreshTimeEl = document.getElementById("last-refresh-time");
    const testCloudbedsBtn = document.getElementById("test-cloudbeds-btn");
    const cloudbedsStatusEl = document.getElementById("cloudbeds-status");
    const testDbBtn = document.getElementById("test-db-btn");
    const dbStatusEl = document.getElementById("db-status");
    const runDailyRefreshBtn = document.getElementById("run-daily-refresh-btn");
    const runInitialSyncBtn = document.getElementById("run-initial-sync-btn");
    const runEndpointTestsBtn = document.getElementById(
      "run-endpoint-tests-btn"
    );
    const endpointTestResultsEl = document.getElementById(
      "endpoint-test-results"
    );
    const hotelsTableBody = document.getElementById("hotels-table-body");
    const runApiDiscoveryBtn = document.getElementById("run-api-discovery");

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

        hotelsTableBody.innerHTML = ""; // Clear existing rows
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
      btn.disabled = true;
      btn.textContent = "Running...";
      try {
        const response = await fetch(url);
        if (response.ok) {
          alert("Job completed successfully!");
          fetchLastRefreshTime(); // Refresh the timestamp
        } else {
          const data = await response.json();
          alert(`Job failed: ${data.error || "Unknown error"}`);
        }
      } catch (error) {
        alert(`Job failed to start: ${error.message}`);
      } finally {
        btn.disabled = false;
        btn.textContent = originalText;
      }
    };

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
            <thead>
                <tr class="border-b">
                    <th class="px-4 py-3 text-left font-semibold text-gray-600">Endpoint Name</th>
                    <th class="px-4 py-3 text-left font-semibold text-gray-600">Status</th>
                    <th class="px-4 py-3 text-left font-semibold text-gray-600">Details</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
      `;
      results.forEach((result) => {
        const statusClass = result.ok
          ? "bg-green-100 text-green-800"
          : "bg-red-100 text-red-800";
        const statusIcon = result.ok ? "✅" : "❌";
        const statusText = result.ok ? "OK" : "FAIL";
        tableHTML += `
            <tr>
                <td class="px-4 py-3 font-medium text-gray-700">${result.name}</td>
                <td class="px-4 py-3">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${statusClass}">
                        ${statusIcon} ${statusText}
                    </span>
                </td>
                <td class="px-4 py-3 text-gray-600 font-mono">${result.status} - ${result.statusText}</td>
            </tr>
        `;
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

    // --- NEW: FULL API DISCOVERY LOGIC ---
    const runFullApiDiscovery = async () => {
      const discoveryStatusEl = document.getElementById("discovery-status");
      const discoveryResultsEl = document.getElementById("discovery-results");

      runApiDiscoveryBtn.disabled = true;
      runApiDiscoveryBtn.textContent = "Discovering...";
      discoveryStatusEl.textContent = "Fetching master list of datasets...";
      discoveryResultsEl.innerHTML = "";

      try {
        // 1. Get all datasets
        const datasetsResponse = await fetch("/api/admin/datasets");
        if (!datasetsResponse.ok)
          throw new Error("Could not fetch master dataset list from server.");
        const datasets = await datasetsResponse.json();
        discoveryStatusEl.textContent = `Found ${datasets.length} datasets. Now fetching fields for each...`;

        for (const dataset of datasets) {
          const datasetContainer = document.createElement("div");
          datasetContainer.className = "p-4 mb-4 border rounded-lg bg-gray-50";

          const title = document.createElement("h3");
          title.className = "text-lg font-bold text-gray-800";
          title.textContent = `Dataset ${dataset.id}: ${dataset.name}`;
          datasetContainer.appendChild(title);

          const content = document.createElement("pre");
          content.className =
            "mt-2 text-xs bg-white p-3 rounded overflow-x-auto";
          content.textContent = "Loading fields...";
          datasetContainer.appendChild(content);

          discoveryResultsEl.appendChild(datasetContainer);

          // This try...catch ensures one failed dataset doesn't stop the whole process
          try {
            // 2. Check for multi-levels
            const mlResponse = await fetch(
              `/api/admin/datasets/${dataset.id}/multi-levels`
            );
            if (!mlResponse.ok)
              throw new Error("Could not fetch multi-levels.");
            const multiLevels = await mlResponse.json();

            let allFields = {};

            if (multiLevels && multiLevels.length > 0) {
              // Logic for NESTED datasets
              for (const ml of multiLevels) {
                const fieldsResponse = await fetch(
                  `/api/admin/datasets/${dataset.id}/fields?ml_id=${ml.id}`
                );
                if (!fieldsResponse.ok)
                  throw new Error(
                    `Could not fetch fields for multi-level: ${ml.name}`
                  );
                allFields[ml.name] = await fieldsResponse.json();
              }
            } else {
              // Logic for FLAT datasets
              const fieldsResponse = await fetch(
                `/api/admin/datasets/${dataset.id}/fields`
              );
              if (!fieldsResponse.ok)
                throw new Error("Could not fetch fields.");
              allFields = await fieldsResponse.json();
            }
            content.textContent = JSON.stringify(allFields, null, 2);
          } catch (error) {
            content.textContent = `Error loading details for this dataset: ${error.message}`;
            content.classList.add("text-red-600");
          }
        }
        discoveryStatusEl.textContent = "✅ Discovery Complete!";
      } catch (error) {
        discoveryStatusEl.textContent = `❌ A critical error occurred: ${error.message}`;
      } finally {
        runApiDiscoveryBtn.disabled = false;
        runApiDiscoveryBtn.textContent = "Discover API Endpoints";
      }
    };

    runApiDiscoveryBtn.addEventListener("click", runFullApiDiscovery);

    // Initial data loads
    fetchLastRefreshTime();
    fetchAndRenderHotels();
  }
});
