// /public/app/settings.mjs

export default function settingsPage() {
  return {
    // --- STATE ---
    isInitialized: false,
    // NEW: State for the "My Profile" section
    profile: {
      firstName: "",
      lastName: "",
      email: "",
    },
    // NEW: A copy to compare against for changes
    originalProfile: {},
    // NEW: State to manage the save button and success messages
    isSaving: false,
    saveMessage: "",

    // --- COMPUTED PROPERTIES ---
    /**
     * @description A computed property to check if the profile form has been changed.
     * This is used to enable/disable the "Save Changes" button.
     * @returns {boolean}
     */
    get isProfileDirty() {
      if (!this.originalProfile.firstName) return false; // Don't allow save if initial data isn't loaded
      return (
        this.profile.firstName !== this.originalProfile.firstName ||
        this.profile.lastName !== this.originalProfile.lastName
      );
    },

    // --- INITIALIZATION ---
    async init() {
      // The shared component loading logic remains the same.
      await loadComponent("header", "header-placeholder");
      await loadComponent("sidebar", "sidebar-placeholder");

      // NEW: Fetch the user's profile data after components are loaded
      await this.fetchProfile();

      this.$nextTick(() => {
        this.isInitialized = true;
      });
    },

    // --- METHODS ---

    /**
     * @description Fetches the user's profile data from the API.
     */
    async fetchProfile() {
      try {
        const response = await fetch("/api/user/profile");
        if (!response.ok) throw new Error("Could not fetch profile.");
        const data = await response.json();

        // Populate both the editable profile object and the original copy
        this.profile.firstName = data.first_name || "";
        this.profile.lastName = data.last_name || "";
        this.profile.email = data.email || "";

        this.originalProfile = {
          firstName: data.first_name || "",
          lastName: data.last_name || "",
        };
      } catch (error) {
        console.error("Error fetching profile:", error);
        // Handle error case, maybe show a message to the user
        this.profile.email = "Could not load profile.";
      }
    },

    /**
     * @description Saves the updated profile data to the backend.
     */
    async saveProfile() {
      if (!this.isProfileDirty) return; // Don't save if nothing has changed

      this.isSaving = true;
      this.saveMessage = ""; // Clear previous messages

      try {
        const response = await fetch("/api/user/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: this.profile.firstName,
            lastName: this.profile.lastName,
          }),
        });

        if (!response.ok) throw new Error("Failed to save profile.");

        const result = await response.json();

        // Update the "original" data to match the new saved state
        this.originalProfile.firstName = result.user.first_name;
        this.originalProfile.lastName = result.user.last_name;

        // Show a success message
        this.saveMessage = "Your profile has been updated successfully!";
      } catch (error) {
        console.error("Error saving profile:", error);
        this.saveMessage = "An error occurred. Please try again.";
      } finally {
        this.isSaving = false;
        // Hide the success message after a few seconds
        setTimeout(() => (this.saveMessage = ""), 3000);
      }
    },
  };
}

// NOTE: We need to import the shared components here so they can be loaded by the init function.
// This is a temporary measure until the page loader is refactored.
import { loadComponent } from "/app/utils.mjs";
import pageHeader from "/app/_shared/header.mjs";
import sidebar from "/app/_shared/sidebar.mjs";
