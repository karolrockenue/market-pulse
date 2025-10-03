// /public/rockenue/rockenue.mjs
// This module handles the frontend logic for the Rockenue section.

/**
 * A function to dynamically load the shared sidebar component into the page.
 * The application uses a shared "headerless" component architecture.
 */
async function loadSidebar() {
  // Find the container element in the HTML.
  const sidebarContainer = document.getElementById("sidebar-container");
  if (!sidebarContainer) {
    console.error("Sidebar container not found!");
    return;
  }

  try {
    // Fetch the raw HTML content of the shared sidebar.
    // The path is relative to the public root.
    const response = await fetch("/app/_shared/sidebar.html");
    if (!response.ok) throw new Error("Failed to fetch sidebar HTML");
    const sidebarHTML = await response.text();

    // Inject the fetched HTML into the container.
    sidebarContainer.innerHTML = sidebarHTML;

    // After loading the HTML, import and initialize the sidebar's own JavaScript module.
    // This makes the sidebar interactive (e.g., dropdowns, navigation).
    const sidebarModule = await import("/app/_shared/sidebar.mjs");
    sidebarModule.initSidebar(); // Assuming an 'initSidebar' function exists in the module.
  } catch (error) {
    console.error("Error loading sidebar:", error);
    // Display an error message to the user if the sidebar fails to load.
    sidebarContainer.innerHTML =
      '<p class="p-4 text-red-500">Error: Could not load navigation.</p>';
  }
}

// --- INITIALIZATION ---
// This code runs automatically when the page is loaded.
document.addEventListener("DOMContentLoaded", () => {
  // Load the sidebar as soon as the basic page structure is ready.
  loadSidebar();
});
