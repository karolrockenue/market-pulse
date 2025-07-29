// /public/app/settings.mjs

export default function settingsPage() {
  return {
    // --- STATE ---
    isInitialized: false,
    // Profile section
    profile: { firstName: "", lastName: "", email: "" },
    originalProfile: {},
    isSaving: false,
    saveMessage: "",
    // User Management section
    teamMembers: [],
    isInviteModalOpen: false,
    isSendingInvite: false,
    invitation: {
      firstName: "",
      lastName: "",
      email: "",
      message: "", // For displaying success/error messages inside the modal
      messageType: "error", // 'success' or 'error'
    },

    // --- COMPUTED PROPERTIES ---
    get isProfileDirty() {
      if (!this.originalProfile.firstName) return false;
      return (
        this.profile.firstName !== this.originalProfile.firstName ||
        this.profile.lastName !== this.originalProfile.lastName
      );
    },

    // --- INITIALIZATION ---
    async init() {
      // Load shared components first
      await Promise.all([
        loadComponent("header", "header-placeholder"),
        loadComponent("sidebar", "sidebar-placeholder"),
      ]);

      // Then fetch page-specific data
      await Promise.all([this.fetchProfile(), this.fetchTeamMembers()]);

      // Finally, show the page content
      this.$nextTick(() => {
        this.isInitialized = true;
      });
    },

    // --- METHODS ---

    // User Management Methods
    /**
     * @description Fetches the list of active users and pending invitations.
     */
    async fetchTeamMembers() {
      try {
        const response = await fetch("/api/users/team");
        if (!response.ok) {
          throw new Error("Could not fetch team members.");
        }
        this.teamMembers = await response.json();
      } catch (error) {
        console.error("Error fetching team members:", error);
        this.teamMembers = [];
      }
    },
    /**
     * @description Sends a user invitation via the API.
     */
    async sendInvitation() {
      this.isSendingInvite = true;
      this.invitation.message = ""; // Clear previous messages

      try {
        const response = await fetch("/api/users/invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            invitee_first_name: this.invitation.firstName,
            invitee_last_name: this.invitation.lastName,
            invitee_email: this.invitation.email,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Failed to send invitation.");
        }

        // --- Success ---
        this.invitation.message = "Invitation sent successfully!";
        this.invitation.messageType = "success";

        // Clear the form fields but keep the modal open to show the success message
        this.invitation.firstName = "";
        this.invitation.lastName = "";
        this.invitation.email = "";

        await this.fetchTeamMembers(); // Refresh the user list in the background
      } catch (error) {
        // --- Error ---
        console.error("Error sending invitation:", error);
        this.invitation.message = error.message;
        this.invitation.messageType = "error";
      } finally {
        this.isSendingInvite = false;
      }
    },

    /**
     * @description Removes a user from the account.
     * @param {string} userEmail - The email of the user to remove.
     */
    async removeUser(userEmail) {
      // Confirm with the admin before deleting a user
      if (
        !window.confirm(
          `Are you sure you want to remove the user ${userEmail}? This action cannot be undone.`
        )
      ) {
        return;
      }

      try {
        const response = await fetch("/api/users/remove", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: userEmail }),
        });

        const result = await response.json();

        if (!response.ok) {
          // Display the specific error from the backend
          throw new Error(result.error || "Failed to remove user.");
        }

        // Show a temporary success message
        alert(result.message); // A simple alert for now
        await this.fetchTeamMembers(); // Refresh the user list
      } catch (error) {
        console.error("Error removing user:", error);
        alert(error.message); // Show error in an alert
      }
    },

    /**
     * @description Resets the invitation form and opens the modal.
     */
    openInviteModal() {
      this.invitation = {
        firstName: "",
        lastName: "",
        email: "",
        message: "",
        messageType: "error",
      };
      this.isInviteModalOpen = true;
    },

    // Profile Methods
    async fetchProfile() {
      try {
        const response = await fetch("/api/user/profile");
        if (!response.ok) throw new Error("Could not fetch profile.");
        const data = await response.json();

        this.profile.firstName = data.first_name || "";
        this.profile.lastName = data.last_name || "";
        this.profile.email = data.email || "";

        this.originalProfile = {
          firstName: data.first_name || "",
          lastName: data.last_name || "",
        };
      } catch (error) {
        console.error("Error fetching profile:", error);
        this.profile.email = "Could not load profile.";
      }
    },
    async saveProfile() {
      if (!this.isProfileDirty) return;

      this.isSaving = true;
      this.saveMessage = "";

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

        this.originalProfile.firstName = result.user.first_name;
        this.originalProfile.lastName = result.user.last_name;

        this.saveMessage = "Your profile has been updated successfully!";
      } catch (error) {
        console.error("Error saving profile:", error);
        this.saveMessage = "An error occurred. Please try again.";
      } finally {
        this.isSaving = false;
        setTimeout(() => (this.saveMessage = ""), 3000);
      }
    },
  };
}

// NOTE: We need to import the shared components here so they can be loaded by the init function.
import { loadComponent } from "/app/utils.mjs";
import pageHeader from "/app/_shared/header.mjs";
import sidebar from "/app/_shared/sidebar.mjs";
