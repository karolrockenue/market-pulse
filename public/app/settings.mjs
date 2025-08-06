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
    // User Management section
    teamMembers: [],
    isAccountOwner: false, // NEW: Flag to show/hide the grant access UI
    ownedProperties: [], // NEW: List of properties the user owns
    isLinkModalOpen: false, // NEW: Controls the new modal
    isLinking: false, // NEW: For showing a loading state on the button
    linkAccess: {
      // NEW: Object to hold form data and messages
      email: "",
      propertyId: "",
      message: "",
      messageType: "error",
    },
    // New state for the Connected Properties section
    connectedProperties: [],
    propertiesMessage: "",
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
      // The init function no longer loads component HTML. It goes straight to fetching data.
      await Promise.all([
        this.fetchProfile(),
        this.fetchTeamMembers(),
        this.fetchConnectedProperties(),
        this.fetchOwnedProperties(),
      ]);

      // Finally, show the page content
      this.$nextTick(() => {
        this.isInitialized = true;
      });
    },
    // --- METHODS ---

    // Property Management Methods
    /**
     * @description Fetches the list of properties connected to the user's account.
     */
    async fetchConnectedProperties() {
      // Set a loading message while we fetch the data
      this.propertiesMessage = "Loading properties...";
      try {
        // This existing endpoint provides the list of properties for the logged-in user.
        const response = await fetch("/api/my-properties");
        if (!response.ok) {
          throw new Error("Could not fetch connected properties.");
        }
        this.connectedProperties = await response.json();
        // If the list is empty, update the message to inform the user.
        if (this.connectedProperties.length === 0) {
          this.propertiesMessage =
            "No properties are connected to your account.";
        }
      } catch (error) {
        console.error("Error fetching properties:", error);
        this.propertiesMessage =
          "Failed to load properties. Please refresh the page.";
        this.connectedProperties = [];
      }
    },

    /**
     * @description Disconnects a property from the user's account after confirmation.
     * @param {string} propertyId The ID of the property to disconnect.
     */
    async disconnectProperty(propertyId) {
      // Show a confirmation dialog to prevent accidental disconnection.
      if (
        !window.confirm(
          "Are you sure you want to disconnect this property? This will remove your access permanently and cannot be undone."
        )
      ) {
        return; // Stop if the user clicks "Cancel"
      }

      try {
        // Call the new backend endpoint we just created.
        const response = await fetch("/api/users/disconnect-property", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ propertyId }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Failed to disconnect property.");
        }

        // Show the success message from the API.
        alert(result.message);

        // Check the response to see if any properties remain.
        if (result.remainingProperties === 0) {
          // If the last property was disconnected, the user has no more data to access.
          // Redirect them to the login page for a clean exit.
          window.location.href = "/login.html";
        } else {
          // If they still have other properties, just refresh the list on the page.
          await this.fetchConnectedProperties();
        }
      } catch (error) {
        console.error("Error disconnecting property:", error);
        alert(error.message); // Show any errors in an alert.
      }
    },

    // User Management Methods

    // User Management Methods

    /**
     * @description Fetches properties the user OWNS to determine if they are an Account Owner.
     * NOTE: This relies on a new endpoint we will create in the next step.
     */
    async fetchOwnedProperties() {
      try {
        // This new endpoint will only return properties for which the user has owner-level credentials.
        const response = await fetch("/api/users/owned-properties");
        if (!response.ok) throw new Error("Could not check ownership status.");

        this.ownedProperties = await response.json();

        // If the user owns one or more properties, mark them as an account owner.
        if (this.ownedProperties.length > 0) {
          this.isAccountOwner = true;
          // Set a default value for the dropdown in the modal
          this.linkAccess.propertyId = this.ownedProperties[0].property_id;
        }
      } catch (error) {
        console.error("Error fetching owned properties:", error);
        // Fail safely: if we can't verify ownership, don't show the UI.
        this.isAccountOwner = false;
      }
    },

    /**
     * @description Resets the "Grant Access" form and opens the modal.
     */
    openLinkModal() {
      // Clear any previous form data or messages
      this.linkAccess = {
        email: "",
        propertyId:
          this.ownedProperties.length > 0
            ? this.ownedProperties[0].property_id
            : "",
        message: "",
        messageType: "error",
      };
      this.isLinkModalOpen = true;
    },

    /**
     * @description Calls the backend to grant an existing user access to a property.
     */
    async grantAccess() {
      this.isLinking = true;
      this.linkAccess.message = ""; // Clear previous messages

      try {
        const response = await fetch("/api/users/link-property", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: this.linkAccess.email,
            propertyId: this.linkAccess.propertyId,
          }),
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error);

        // --- Success ---
        this.linkAccess.messageType = "success";
        this.linkAccess.message = result.message;
        this.linkAccess.email = ""; // Clear the email field on success
        await this.fetchTeamMembers(); // Refresh the team list to show the change
      } catch (error) {
        // --- Error ---
        console.error("Error granting access:", error);
        this.linkAccess.messageType = "error";
        this.linkAccess.message = error.message;
      } finally {
        this.isLinking = false;
      }
    },
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
