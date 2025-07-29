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
    inviteMessage: "",
    invitation: { firstName: "", lastName: "", email: "" },

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
      this.inviteMessage = "";

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

        this.inviteMessage = "Invitation sent successfully!";
        await this.fetchTeamMembers(); // Refresh the list after sending invite

        // Close the modal and reset the form on success
        this.isInviteModalOpen = false;
        this.invitation = { firstName: "", lastName: "", email: "" };
      } catch (error) {
        console.error("Error sending invitation:", error);
        this.inviteMessage = error.message;
      } finally {
        this.isSendingInvite = false;
        // Don't clear the message here, we'll move it to the modal
      }
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
