// /public/app/_shared/sidebar.mjs
export default function sidebar() {
  return {
    isAdmin: false, // Default to not showing the admin link

    // The init function runs when the component is loaded
    init() {
      this.checkUserRole();
    },

    // Fetches session info from the server to check for admin status
    // Fetches session info from the server to check for admin status
    async checkUserRole() {
      try {
        const response = await fetch("/api/auth/session-info");
        const sessionInfo = await response.json();

        // --- FIX: Check if the user's role from the API is 'super_admin' ---
        if (sessionInfo.role === "super_admin") {
          this.isAdmin = true;
        }
      } catch (error) {
        console.error("Could not check user role:", error);
        this.isAdmin = false; // Ensure link is hidden on error
      }
    },
  };
}
