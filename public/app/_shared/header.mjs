// /public/app/_shared/header.mjs
export default function pageHeader() {
  return {
    // --- STATE ---
    propertyDropdownOpen: false,
    userDropdownOpen: false,
    isLegalModalOpen: false,
    properties: [],
    currentPropertyId: null,
    currentPropertyName: "Loading...",
    lastRefreshText: "Loading...",
    user: {
      name: "Loading...",
      initials: "U",
      role: "User",
    },

    // --- INIT ---
    init() {
      this.fetchSessionInfo();
      this.fetchProperties();
      this.fetchLastRefreshTime();

      window.addEventListener("change-property", (event) => {
        const newId = event.detail.propertyId;
        if (this.currentPropertyId !== newId) {
          this.switchProperty(newId, false);
        }
      });
    },

    // --- METHODS ---
    async fetchSessionInfo() {
      try {
        const response = await fetch("/api/auth/session-info");
        const session = await response.json();
        if (session.isLoggedIn) {
          // This combines first and last name to show the full name
          this.user.name =
            `${session.firstName || ""} ${session.lastName || ""}`.trim() ||
            "User";
          this.user.initials = (session.firstName || "U").charAt(0);
          this.user.role = session.isAdmin ? "Administrator" : "User";
        }
      } catch (error) {
        console.error("Error fetching session info:", error);
        this.user.name = "Error";
      }
    },

    async fetchProperties() {
      try {
        const response = await fetch("/api/my-properties");
        if (!response.ok) throw new Error("Could not fetch properties.");
        const props = await response.json();
        this.properties = props;

        if (props.length > 0) {
          let savedPropertyId = localStorage.getItem("selectedPropertyId");
          const isValid = props.some((p) => p.property_id === savedPropertyId);

          if (savedPropertyId && isValid) {
            this.currentPropertyId = savedPropertyId;
          } else {
            this.currentPropertyId = props[0].property_id;
          }

          this.updateCurrentPropertyName();
          this.dispatchPropertyChangeEvent();
        } else {
          this.currentPropertyName = "No Properties Found";
        }
      } catch (error) {
        console.error("Error fetching properties:", error);
        this.currentPropertyName = "Error Loading";
      }
    },

    // --- THIS FUNCTION HAS BEEN UPDATED ---
    async fetchLastRefreshTime() {
      try {
        const response = await fetch("/api/last-refresh-time");
        if (!response.ok) throw new Error("Could not fetch refresh time."); // Fail silently to the catch block

        const data = await response.json();
        const lastRefreshDate = new Date(data.last_successful_run);
        const now = new Date();

        // 1. Format the full date and time string using toLocaleString
        const fullTimestamp = lastRefreshDate.toLocaleString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false, // Use 24-hour format
        });

        // 2. Calculate the difference in hours or minutes
        const diffMs = now - lastRefreshDate;
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        let relativeTime = "";

        if (diffHours < 1) {
          const diffMinutes = Math.floor(diffMs / (1000 * 60));
          relativeTime = `(${diffMinutes}m ago)`;
        } else {
          relativeTime = `(${diffHours}h ago)`;
        }

        // 3. Combine them into the final text
        this.lastRefreshText = `Data updated ${fullTimestamp} ${relativeTime}`;
      } catch (error) {
        // Fallback if the API fails
        this.lastRefreshText = "Live Data";
      }
    },

    updateCurrentPropertyName() {
      const currentProp = this.properties.find(
        (p) => p.property_id === this.currentPropertyId
      );
      if (currentProp) {
        this.currentPropertyName = currentProp.property_name;
      }
    },

    switchProperty(propertyId, dispatchEvent = true) {
      this.currentPropertyId = propertyId;
      this.updateCurrentPropertyName();
      localStorage.setItem("selectedPropertyId", propertyId);
      this.propertyDropdownOpen = false;

      if (dispatchEvent) {
        this.dispatchPropertyChangeEvent();
      }
    },

    // This function now sends both the ID and the name of the selected property.
    dispatchPropertyChangeEvent() {
      window.dispatchEvent(
        new CustomEvent("property-changed", {
          detail: {
            propertyId: this.currentPropertyId,
            propertyName: this.currentPropertyName, // Add the name to the event
          },
        })
      );
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
