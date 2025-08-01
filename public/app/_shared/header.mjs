// /public/app/_shared/header.mjs
export default function pageHeader() {
  return {
    // --- STATE ---
    propertyDropdownOpen: false,
    userDropdownOpen: false,
    isLegalModalOpen: false,
    isSupportModalOpen: false,
    supportArticleContent: "",

    isSupportArticleLoading: false,
    properties: [],
    currentPropertyId: null,
    currentPropertyName: "Loading...",
    lastRefreshText: "Loading...",
    user: { name: "Loading...", initials: "U", role: "User" },

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
    // Add this entire function
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
          // 1. Remove the top border from all main headings
          contentElement.querySelectorAll("h3").forEach((el) => {
            el.classList.remove("!border-t", "border-gray-700");
          });

          // 2. Adapt the styling of the gray boxes for the light theme
          const containers =
            contentElement.querySelectorAll(".bg-gray-800\\/50");
          containers.forEach((el) => {
            el.classList.remove("bg-gray-800/50", "border-gray-700");
            el.classList.add("bg-slate-50", "border-slate-200");

            // Also fix the text colors specifically inside these boxes
            el.querySelectorAll(".text-gray-300").forEach((text) => {
              text.classList.remove("text-gray-300");
              text.classList.add("text-slate-700", "font-semibold");
            });
            el.querySelectorAll(".text-gray-400").forEach((text) => {
              text.classList.remove("text-gray-400");
              text.classList.add("text-slate-600");
            });
          });
          // 3. Fix all text and link colors for the light theme
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

    // --- EXISTING METHODS (Unchanged) ---
    async fetchSessionInfo() {
      try {
        const response = await fetch("/api/auth/session-info");
        const session = await response.json();
        if (session.isLoggedIn) {
          // Set user name and initials (this logic is unchanged)
          this.user.name =
            `${session.firstName || ""} ${session.lastName || ""}`.trim() ||
            "User";
          this.user.initials = (session.firstName || "U").charAt(0);

          // --- FIX: Use the new 'role' property from the API to set the display text ---
          // This provides a user-friendly name for each role key.
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
        }
      } catch (error) {
        console.error("Error fetching session info:", error);
        this.user.name = "Error";
      }
    },
    async fetchProperties() {
      try {
        const response = await fetch("/api/my-properties");
        if (!response.ok) throw new Error("Could not fetch properties");
        this.properties = await response.json();
        if (this.properties.length > 0) {
          // Check browser's local storage for a previously selected property ID.
          const savedPropertyId = localStorage.getItem("selectedPropertyId");

          // Check if the saved ID is valid and actually exists in the user's list of properties.
          // Check if the saved ID is valid by comparing it loosely (==) to handle
          // a string from localStorage vs a number from the API.
          const isValidSavedProperty =
            savedPropertyId &&
            this.properties.some((p) => p.property_id == savedPropertyId);

          // If a valid saved property exists, use it. Otherwise, default to the first property in the list.
          this.currentPropertyId = isValidSavedProperty
            ? savedPropertyId
            : this.properties[0].property_id;

          // Update the UI and notify other components of the active property.
          this.updateCurrentPropertyName();
          this.dispatchPropertyChangeEvent();
        }
      } catch (error) {
        console.error("Error fetching properties:", error);
        this.properties = [];
      }
    },
    async fetchLastRefreshTime() {
      try {
        const response = await fetch("/api/last-refresh-time");
        if (!response.ok) throw new Error("Could not fetch refresh time.");
        const data = await response.json();
        const lastRefreshDate = new Date(data.last_successful_run);
        const now = new Date();
        const fullTimestamp = lastRefreshDate.toLocaleString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });
        const diffMs = now - lastRefreshDate;
        const diffHours = Math.floor(diffMs / 3600000);
        let relativeTime =
          diffHours < 1
            ? `(${Math.floor(diffMs / 60000)}m ago)`
            : `(${diffHours}h ago)`;
        this.lastRefreshText = `Data updated ${fullTimestamp} ${relativeTime}`;
      } catch (error) {
        this.lastRefreshText = "Live Data";
      }
    },
    updateCurrentPropertyName() {
      // Find the property using a loose equality check (==) to match the
      // string ID from localStorage against the number ID from the API.
      const currentProp = this.properties.find(
        (p) => p.property_id == this.currentPropertyId
      );
      if (currentProp) this.currentPropertyName = currentProp.property_name;
    },
    switchProperty(propertyId, dispatchEvent = true) {
      // Set the new property ID in the component's state.
      this.currentPropertyId = propertyId;

      // Save the newly selected property ID to the browser's local storage.
      // This ensures it will be remembered on the next page load.
      localStorage.setItem("selectedPropertyId", propertyId);

      // Update the UI with the new property's name.
      this.updateCurrentPropertyName();

      // If needed, dispatch an event to notify other parts of the application about the change.
      if (dispatchEvent) this.dispatchPropertyChangeEvent();
    },
    dispatchPropertyChangeEvent() {
      // Find the property using a loose equality check (==) to ensure the
      // event is dispatched correctly, regardless of type differences.
      const currentProperty = this.properties.find(
        (p) => p.property_id == this.currentPropertyId
      );
      if (!currentProperty) return;
      window.dispatchEvent(
        new CustomEvent("property-changed", {
          detail: {
            propertyId: currentProperty.property_id,
            propertyName: currentProperty.property_name,
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
