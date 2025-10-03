// /public/rockenue/shreeji-report.mjs
// This module handles the frontend logic for the Shreeji Report page.

import sidebar from "/app/_shared/sidebar.mjs";

/**
 * A function to dynamically load the shared sidebar component into the page.
 * This is standard practice across the app.
 */
async function loadSidebar() {
  const sidebarContainer = document.getElementById("sidebar-container");
  if (!sidebarContainer) {
    console.error("Sidebar container not found!");
    return;
  }
  try {
    // Fetch the sidebar's HTML content
    const response = await fetch("/app/_shared/sidebar.html");
    if (!response.ok) throw new Error("Failed to fetch sidebar HTML");
    const sidebarHTML = await response.text();

    // Inject the HTML and initialize its Alpine.js component
    sidebarContainer.innerHTML = sidebarHTML;
    window.sidebar = sidebar;
    Alpine.initTree(sidebarContainer);
  } catch (error) {
    console.error("Error loading sidebar:", error);
    sidebarContainer.innerHTML =
      '<p class="p-4 text-red-500">Error: Could not load navigation.</p>';
  }
}

/**
 * Sets the default date for the date picker to yesterday.
 * This ensures the report is ready to run for the most common use case.
 */
function setDefaultDate() {
  const datePicker = document.getElementById("report-date");
  if (datePicker) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    // Format the date as YYYY-MM-DD, which is required for the date input value.
    const year = yesterday.getFullYear();
    // Pad month and day with a leading zero if they are single-digit.
    const month = String(yesterday.getMonth() + 1).padStart(2, "0");
    const day = String(yesterday.getDate()).padStart(2, "0");

    // Set the final formatted value.
    datePicker.value = `${year}-${month}-${day}`;
  }
}

// --- INITIALIZATION ---
// Functions that run as soon as the page's DOM is ready.
document.addEventListener("DOMContentLoaded", () => {
  loadSidebar();
  setDefaultDate();
});
