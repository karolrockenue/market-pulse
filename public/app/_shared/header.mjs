// /public/app/_shared/header.mjs
export default function pageHeader() {
  return {
    // --- STATE ---
    propertyDropdownOpen: false,

    userDropdownOpen: false,
    isLegalModalOpen: false, // Add this line
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

      // Listen for a custom event from a page to change the property
      window.addEventListener("change-property", (event) => {
        const newId = event.detail.propertyId;
        if (this.currentPropertyId !== newId) {
          this.switchProperty(newId, false); // don't trigger a new event
        }
      });
    },

    // --- METHODS ---
    async fetchSessionInfo() {
      try {
        const response = await fetch("/api/auth/session-info");
        const session = await response.json();
        if (session.isLoggedIn) {
          this.user.name = session.firstName || "User";
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
          // Try to get the last selected property from localStorage
          let savedPropertyId = localStorage.getItem("selectedPropertyId");

          // Check if the saved ID is valid
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

    async fetchLastRefreshTime() {
      try {
        const response = await fetch("/api/last-refresh-time");
        const data = await response.json();
        const lastRefreshDate = new Date(data.last_successful_run);
        this.lastRefreshText = `Data updated ${lastRefreshDate.toLocaleDateString(
          "en-GB",
          { day: "2-digit", month: "short", year: "numeric" }
        )}`;
      } catch (error) {
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
      localStorage.setItem("selectedPropertyId", propertyId); // Save selection
      this.propertyDropdownOpen = false;

      if (dispatchEvent) {
        this.dispatchPropertyChangeEvent();
      }
    },

    dispatchPropertyChangeEvent() {
      // Dispatch a custom event that the main page component can listen to
      window.dispatchEvent(
        new CustomEvent("property-changed", {
          detail: { propertyId: this.currentPropertyId },
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
