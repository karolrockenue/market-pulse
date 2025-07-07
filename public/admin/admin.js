document.addEventListener("DOMContentLoaded", () => {
  const loginContainer = document.getElementById("login-container");
  const mainContent = document.getElementById("main-content");
  const loginForm = document.getElementById("login-form");
  const passwordInput = document.getElementById("password-input");
  const loginError = document.getElementById("login-error");

  // Handle the login form submission
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginError.style.display = "none";
    const password = passwordInput.value;

    try {
      const response = await fetch("/api/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        loginContainer.style.display = "none";
        mainContent.style.display = "block";
        initializeAdminPanel();
      } else {
        loginError.style.display = "block";
        passwordInput.value = "";
        passwordInput.focus();
      }
    } catch (error) {
      loginError.textContent = "An error occurred. Please try again.";
      loginError.style.display = "block";
    }
  });

  // This function contains all the code to set up the admin panel after login
  function initializeAdminPanel() {
    // --- Element Selectors ---
    const lastRefreshDot = document.getElementById("last-refresh-dot");
    const lastRefreshStatus = document.getElementById("last-refresh-status");
    const cloudbedsApiDot = document.getElementById("cloudbeds-api-dot");
    const cloudbedsApiStatus = document.getElementById("cloudbeds-api-status");
    const databaseDot = document.getElementById("database-dot");
    const databaseStatus = document.getElementById("database-status");
    const btnTestCloudbeds = document.getElementById("btn-test-cloudbeds");
    const btnTestDatabase = document.getElementById("btn-test-database");
    const btnRunDailyRefresh = document.getElementById("btn-run-daily-refresh");
    const dailyRefreshStatus = document.getElementById("daily-refresh-status");
    const btnRunInitialSync = document.getElementById("btn-run-initial-sync");
    const initialSyncStatus = document.getElementById("initial-sync-status");

    // --- Helper function to update status UI ---
    const updateStatus = (dotEl, statusEl, success, message) => {
      dotEl.className = `status-dot ${success ? "green" : "red"}`;
      statusEl.textContent = message;
    };

    // --- Health Check Functions ---
    async function checkLastRefresh() {
      try {
        const response = await fetch("/api/last-refresh-time");
        if (!response.ok) throw new Error("Could not fetch refresh time.");
        const data = await response.json();
        const lastRefreshDate = new Date(data.last_successful_run);
        const now = new Date();
        const diffHours = (now - lastRefreshDate) / (1000 * 60 * 60);

        const formattedTime = lastRefreshDate.toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Europe/Warsaw",
        });
        const formattedDate = lastRefreshDate.toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          timeZone: "Europe/Warsaw",
        });

        updateStatus(
          lastRefreshDot,
          lastRefreshStatus,
          diffHours <= 26,
          `Last run: ${formattedDate} at ${formattedTime}`
        );
      } catch (error) {
        updateStatus(
          lastRefreshDot,
          lastRefreshStatus,
          false,
          "Never or failed"
        );
      }
    }

    async function testCloudbeds() {
      updateStatus(cloudbedsApiDot, cloudbedsApiStatus, null, "Testing...");
      btnTestCloudbeds.disabled = true;
      try {
        const response = await fetch("/api/test-cloudbeds");
        if (!response.ok) throw new Error("API test failed");
        updateStatus(
          cloudbedsApiDot,
          cloudbedsApiStatus,
          true,
          "Connection OK"
        );
      } catch (error) {
        updateStatus(
          cloudbedsApiDot,
          cloudbedsApiStatus,
          false,
          "Connection Failed"
        );
      } finally {
        btnTestCloudbeds.disabled = false;
      }
    }

    async function testDatabase() {
      updateStatus(databaseDot, databaseStatus, null, "Testing...");
      btnTestDatabase.disabled = true;
      try {
        const response = await fetch("/api/test-database");
        if (!response.ok) throw new Error("DB test failed");
        updateStatus(databaseDot, databaseStatus, true, "Connection OK");
      } catch (error) {
        updateStatus(databaseDot, databaseStatus, false, "Connection Failed");
      } finally {
        btnTestDatabase.disabled = false;
      }
    }

    // --- Manual Action Functions ---
    async function runDailyRefresh() {
      btnRunDailyRefresh.disabled = true;
      btnRunDailyRefresh.textContent = "Running...";
      dailyRefreshStatus.textContent = "Job started...";
      dailyRefreshStatus.className =
        "text-sm italic text-slate-500 w-48 text-right";

      try {
        const response = await fetch("/api/daily-refresh");
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Unknown error");
        dailyRefreshStatus.textContent = `Success: ${
          result.recordsUpdated || 0
        } records updated.`;
        dailyRefreshStatus.classList.add("text-green-600");
        checkLastRefresh(); // Re-check the status after a successful run
      } catch (error) {
        dailyRefreshStatus.textContent = `Error: ${error.message}`;
        dailyRefreshStatus.classList.add("text-red-600");
      } finally {
        btnRunDailyRefresh.disabled = false;
        btnRunDailyRefresh.textContent = "Run Job";
      }
    }

    async function runInitialSync() {
      if (
        !confirm(
          "WARNING: This is a destructive action that will re-fetch and overwrite two years of data. Are you sure you want to continue?"
        )
      ) {
        return;
      }
      btnRunInitialSync.disabled = true;
      btnRunInitialSync.textContent = "Syncing...";
      initialSyncStatus.textContent =
        "Sync started. This will take several minutes...";
      initialSyncStatus.className =
        "text-sm italic text-slate-500 w-48 text-right";

      try {
        const response = await fetch("/api/initial-sync");
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Unknown error");
        initialSyncStatus.textContent = `Success: ${
          result.recordsUpdated || 0
        } records synced.`;
        initialSyncStatus.classList.add("text-green-600");
      } catch (error) {
        initialSyncStatus.textContent = `Error: ${error.message}`;
        initialSyncStatus.classList.add("text-red-600");
      } finally {
        btnRunInitialSync.disabled = false;
        btnRunInitialSync.textContent = "Run Full Sync";
      }
    }

    // --- Attach Event Listeners ---
    btnTestCloudbeds.addEventListener("click", testCloudbeds);
    btnTestDatabase.addEventListener("click", testDatabase);
    btnRunDailyRefresh.addEventListener("click", runDailyRefresh);
    btnRunInitialSync.addEventListener("click", runInitialSync);

    // --- Initial Load ---
    checkLastRefresh();
  }
});
