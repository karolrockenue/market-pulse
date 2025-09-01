// /public/app/_shared/design_sidebar.mjs
// This is the new, consolidated component with all logic from the old header and sidebar.
export default function sidebar() {
  return {
    // --- STATE ---
    // Combined state from old header.mjs and sidebar.mjs
    isAdmin: false,
    userDropdownOpen: false,
    propertyDropdownOpen: false,
    isSupportModalOpen: false,
    supportArticleContent: "",
    isSupportArticleLoading: false,
    user: { name: "Loading...", initials: "U", role: "User" },
    lastRefreshText: { line1: "Loading...", line2: "" },
    properties: [],
    currentPropertyId: null,
    currentPropertyName: "Loading...",

    // /public/app/dashboard.mjs
    init() {
      // Set up the listener first, so it's ready for any event.
      window.addEventListener("property-changed", (event) =>
        this.handlePropertyChange(event.detail)
      );

      const urlParams = new URLSearchParams(window.location.search);
      const newPropertyId = urlParams.get("propertyId");
      const isNewConnection = urlParams.get("newConnection") === "true";

      // This is the authoritative logic for a new connection.
      if (isNewConnection && newPropertyId) {
        // 1. Set the correct ID in storage.
        localStorage.setItem("currentPropertyId", newPropertyId);

        // 2. Reliably trigger the initial sync from the frontend.
        fetch("/api/initial-sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ propertyId: newPropertyId }),
        }).catch((err) =>
          console.error("Failed to trigger initial sync from frontend:", err)
        );

        // 3. Start polling for sync completion and show the spinner.
        this.isSyncing = true;
        this.syncStatusInterval = setInterval(
          () => this.checkSyncStatus(newPropertyId),
          15000
        );
        this.checkSyncStatus(newPropertyId);

        // 4. Dispatch the ONE authoritative event to tell all components which property to load.
        // We use a small timeout to ensure the sidebar has had time to initialize its own listeners.
        setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("property-changed", {
              detail: {
                property_id: newPropertyId,
                property_name: "Syncing New Property...",
              },
            })
          );
        }, 100);
      }

      this.initializeDashboard();

      this.$watch("market", () => {
        this.$nextTick(() => this.renderBreakdownCharts());
      });
    },

    // --- METHODS ---
    // All of the following methods are taken from the original, working header.mjs and sidebar.mjs
    async fetchSessionInfo() {
      try {
        const response = await fetch("/api/auth/session-info");

        // If the server responds with an unauthorized status, the session is invalid. Redirect.
        if (!response.ok) {
          window.location.href = "/signin";
          return; // Stop execution
        }

        const session = await response.json();

        // If the session data explicitly says the user is not logged in, redirect.
        if (!session.isLoggedIn) {
          window.location.href = "/signin";
          return; // Stop execution
        }

        // If we've made it this far, the user is authenticated. Proceed to populate data.
        this.user.name =
          `${session.firstName || ""} ${session.lastName || ""}`.trim() ||
          "User";
        this.user.initials = (session.firstName || "U").charAt(0);
        switch (session.role) {
          case "super_admin":
            this.user.role = "Super Admin";
            break;
          case "owner":
            this.user.role = "Owner";
            break;
          default:
            this.user.role = "User";
            break;
        }
        // Correctly determine admin status for showing/hiding links
        this.isAdmin = session.role === "super_admin";
      } catch (error) {
        // If any other error occurs (e.g., network failure), assume auth has failed and redirect.
        console.error("Critical error fetching session info:", error);
        window.location.href = "/signin";
      }
    },

    // /public/app/_shared/sidebar.mjs
    // /public/app/_shared/sidebar.mjs

    async fetchProperties() {
      try {
        const response = await fetch("/api/my-properties");
        if (!response.ok) throw new Error("Could not fetch properties");
        this.properties = await response.json();

        const isNewConnection = new URLSearchParams(window.location.search).has(
          "newConnection"
        );

        if (this.properties.length > 0) {
          // If it's NOT a new connection, behave as normal (load saved or first property).
          // If it IS a new connection, do nothing and wait for the dashboard to dispatch the event.
          if (!isNewConnection) {
            const savedPropertyId = localStorage.getItem("currentPropertyId");
            const isValidSavedProperty =
              savedPropertyId &&
              this.properties.some((p) => p.property_id == savedPropertyId);
            this.currentPropertyId = isValidSavedProperty
              ? savedPropertyId
              : this.properties[0].property_id;
            this.updateCurrentPropertyName();
            this.dispatchPropertyChangeEvent();
          }
        } else {
          this.currentPropertyName = "No properties found";
        }
      } catch (error) {
        console.error("Error fetching properties:", error);
        this.properties = [];
        this.currentPropertyName = "Error loading properties";
      }
    },
    async fetchLastRefreshTime() {
      try {
        const response = await fetch("/api/last-refresh-time");
        if (!response.ok) throw new Error("Could not fetch refresh time.");
        const data = await response.json();
        const lastRefreshDate = new Date(data.last_successful_run);
        const datePart = lastRefreshDate.toLocaleString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
        const timePart = lastRefreshDate.toLocaleString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });
        const now = new Date();
        const diffMs = now - lastRefreshDate;
        const diffHours = Math.floor(diffMs / 3600000);
        let relativeTime =
          diffHours < 1
            ? `(${Math.floor(diffMs / 60000)}m ago)`
            : `(${diffHours}h ago)`;
        this.lastRefreshText = {
          line1: `Data updated ${datePart}`,
          line2: `@ ${timePart} ${relativeTime}`,
        };
      } catch (error) {
        this.lastRefreshText = { line1: "Live Data", line2: "" };
      }
    },

    updateCurrentPropertyName() {
      const currentProp = this.properties.find(
        (p) => p.property_id == this.currentPropertyId
      );
      if (currentProp) this.currentPropertyName = currentProp.property_name;
    },

    switchProperty(propertyId) {
      this.currentPropertyId = propertyId;
      localStorage.setItem("currentPropertyId", propertyId);
      this.updateCurrentPropertyName();
      this.propertyDropdownOpen = false; // Close dropdown on selection
      this.dispatchPropertyChangeEvent();
    },

    // /public/app/_shared/sidebar.mjs
    dispatchPropertyChangeEvent() {
      const currentProperty = this.properties.find(
        (p) => p.property_id == this.currentPropertyId
      );
      if (!currentProperty) return;
      console.log(
        `%c[SIDEBAR] 5. Dispatching 'property-changed' event with ID: ${currentProperty.property_id} and Name: ${currentProperty.property_name}`,
        "color: #f59e0b"
      );
      window.dispatchEvent(
        new CustomEvent("property-changed", {
          detail: currentProperty,
        })
      );
    },

    async openSupportModal() {
      this.isSupportModalOpen = true;
      if (this.supportArticleContent || this.isSupportArticleLoading) return;
      this.isSupportArticleLoading = true;
      try {
        const response = await fetch("/support.html");
        if (!response.ok) throw new Error("Could not load support content.");
        const htmlString = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlString, "text/html");
        const contentElement = doc.querySelector(".prose");
        if (contentElement) {
          // This logic adapts the dark-theme support page for a light-theme modal
          contentElement
            .querySelectorAll("h3")
            .forEach((el) =>
              el.classList.remove("!border-t", "border-gray-700")
            );
          contentElement.querySelectorAll(".bg-gray-800\\/50").forEach((el) => {
            el.classList.remove("bg-gray-800/50", "border-gray-700");
            el.classList.add("bg-slate-50", "border-slate-200");
            el.querySelectorAll(".text-gray-300").forEach((text) => {
              text.classList.remove("text-gray-300");
              text.classList.add("text-slate-700", "font-semibold");
            });
            el.querySelectorAll(".text-gray-400").forEach((text) => {
              text.classList.remove("text-gray-400");
              text.classList.add("text-slate-600");
            });
          });
          const colorReplacements = {
            "text-white": "text-slate-800",
            "text-gray-300": "text-slate-700",
            "text-gray-400": "text-slate-600",
            "text-blue-400": "text-blue-600",
            "group-open\\:text-blue-400": "group-open:text-blue-600",
          };
          for (const [darkClass, lightClass] of Object.entries(
            colorReplacements
          )) {
            contentElement.querySelectorAll(`.${darkClass}`).forEach((el) => {
              el.classList.remove(darkClass);
              el.classList.add(lightClass);
            });
          }
          this.supportArticleContent = contentElement.innerHTML;
        } else {
          throw new Error("Content container not found in support.html.");
        }
      } catch (error) {
        console.error("Error fetching support article:", error);
        this.supportArticleContent = "<p>Could not load support article.</p>";
      } finally {
        this.isSupportArticleLoading = false;
      }
    },

    async logout() {
      try {
        await fetch("/api/auth/logout", { method: "POST" });
        window.location.href = "/signin";
      } catch (error) {
        console.error("Logout failed:", error);
      }
    },
  };
}
