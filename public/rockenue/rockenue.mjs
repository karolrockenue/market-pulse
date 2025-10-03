// /public/rockenue/rockenue.mjs
// This module handles the frontend logic for the Rockenue section.

// Import the default export from the sidebar module, which is an Alpine.js component function.
import sidebar from "/app/_shared/sidebar.mjs";

/**
 * A function to dynamically load the shared sidebar component into the page.
 * The application uses a shared "headerless" component architecture.
 */
async function loadSidebar() {
  const sidebarContainer = document.getElementById("sidebar-container");
  if (!sidebarContainer) {
    console.error("Sidebar container not found!");
    return;
  }

  try {
    // Step 1: Fetch the raw HTML content of the shared sidebar.
    const response = await fetch("/app/_shared/sidebar.html");
    if (!response.ok) throw new Error("Failed to fetch sidebar HTML");
    const sidebarHTML = await response.text();

    // Step 2: Inject the fetched HTML into the container.
    sidebarContainer.innerHTML = sidebarHTML;

    // Step 3: THE FIX - Make the sidebar's Alpine component available on the window.
    // Alpine.js needs to be able to find the 'sidebar' function when it scans the new HTML.
    window.sidebar = sidebar;

    // Step 4: THE FIX - Tell Alpine.js to initialize the components within the newly added HTML.
    // This will find the x-data="sidebar()" attribute in the sidebar's HTML and bring it to life.
    Alpine.initTree(sidebarContainer);
  } catch (error) {
    console.error("Error loading sidebar:", error);
    // Display a user-friendly error message if the sidebar fails to load.
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
