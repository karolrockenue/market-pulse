// /public/app/settings.mjs

export default function settingsPage() {
  return {
    // --- STATE ---
    isInitialized: false,

    // Profile section state
    profile: { firstName: "", lastName: "", email: "" },
    originalProfile: {},
    isSaving: false,
    saveMessage: "",
    // --- STATE ---
    isInitialized: false,

    // Profile section state
    profile: { firstName: "", lastName: "", email: "" },
    originalProfile: {},
    isSaving: false,
    saveMessage: "",

    // NEW: State for User Management table
    teamMembers: [],

    // NEW: State for the User Management section
    isInviteModalOpen: false,
    isSendingInvite: false,
    inviteMessage: "",
    invitation: {
      firstName: "",
      lastName: "",
      email: "",
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
    // --- INITIALIZATION ---
    async init() {
      // Fetch all data in parallel for a faster load
      await Promise.all([
        this.fetchProfile(),
        this.fetchTeamMembers(), // Fetch team data on page load
      ]);

      // We no longer need to manually load components here,
      // the new `initPage` function in the HTML handles it.
      this.$nextTick(() => {
        this.isInitialized = true;
      });
    },

    // --- METHODS ---
    // --- METHODS ---

    /**
     * @description Fetches the list of active users and pending invitations.
     */
    async fetchTeamMembers() {
      try {
        // This new endpoint will combine active users and pending invites
        const response = await fetch("/api/users/team");
        if (!response.ok) {
          throw new Error("Could not fetch team members.");
        }
        this.teamMembers = await response.json();
      } catch (error) {
        console.error("Error fetching team members:", error);
        // Silently fail for now, the UI will just show an empty table
        this.teamMembers = [];
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

    // NEW: User Management Methods
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
          // Use the specific error message from the API if available
          throw new Error(result.error || "Failed to send invitation.");
        }

        this.inviteMessage = "Invitation sent successfully!";
        // Close the modal and reset the form on success
        this.isInviteModalOpen = false;
        this.invitation = { firstName: "", lastName: "", email: "" };
      } catch (error) {
        console.error("Error sending invitation:", error);
        this.inviteMessage = error.message;
      } finally {
        this.isSendingInvite = false;
        // Clear the message after a few seconds
        setTimeout(() => (this.inviteMessage = ""), 4000);
      }
    },
  };
}

// NOTE: We need to import the shared components here so they can be loaded by the init function.
import { loadComponent } from "/app/utils.mjs";
import pageHeader from "/app/_shared/header.mjs";
import sidebar from "/app/_shared/sidebar.mjs";
