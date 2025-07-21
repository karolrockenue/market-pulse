// /public/app/settings.mjs

// Import all necessary functions and components at the top level.
import { loadComponent } from "/app/utils.mjs";
import pageHeader from "/app/_shared/header.mjs";
import sidebar from "/app/_shared/sidebar.mjs";

export default function settingsPage() {
  return {
    // --- STATE ---
    isInitialized: false,
    activeTab: "profile",

    // --- INITIALIZATION ---
    // This init() function now controls the entire page setup process.
    async init() {
      // 1. First, tell Alpine about the child components we are about to load.
      // This is crucial to do *before* their HTML is added to the page.
      Alpine.data("pageHeader", pageHeader);
      Alpine.data("sidebar", sidebar);

      // 2. Now, load the component HTML into the placeholders.
      // The `loadComponent` utility will fetch the HTML and then call `Alpine.initTree`
      // to make the new content interactive.
      await loadComponent("header", "header-placeholder");
      await loadComponent("sidebar", "sidebar-placeholder");

      // 3. Finally, set the flag to make the main content visible.
      // We use $nextTick to ensure Alpine has processed the DOM updates.
      this.$nextTick(() => {
        this.isInitialized = true;
      });
    },

    // --- METHODS ---
    // (Placeholder for future methods)
  };
}
