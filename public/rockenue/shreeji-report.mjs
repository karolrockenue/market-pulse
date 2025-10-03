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

/**
 * NEW FUNCTION: Fetches the list of all hotels from the backend API.
 * It then populates the 'hotel-select' dropdown with the results.
 */
async function loadHotels() {
  // Get the dropdown element from the page.
  const hotelSelect = document.getElementById("hotel-select");
  if (!hotelSelect) return; // Exit if the element doesn't exist.

  try {
    // Call the new API endpoint we created in the previous step.
    const response = await fetch("/api/rockenue/hotels");

    // If the server responds with an error (e.g., 403 Forbidden), handle it.
    if (!response.ok) {
      throw new Error(`Failed to fetch hotels. Status: ${response.status}`);
    }

    // Parse the JSON data from the response.
    const hotels = await response.json();

    // Clear the initial "Loading hotels..." message.
    hotelSelect.innerHTML = "";

    // Add a default, non-selectable prompt as the first option.
    const promptOption = document.createElement("option");
    promptOption.textContent = "Select a hotel";
    promptOption.value = "";
    promptOption.disabled = true;
    promptOption.selected = true;
    hotelSelect.appendChild(promptOption);

    // Loop through each hotel returned from the API.
    hotels.forEach((hotel) => {
      // Create a new <option> element for each hotel.
      const option = document.createElement("option");
      // Set the value to the hotel's unique ID.
      option.value = hotel.hotel_id;
      // Set the displayed text to the hotel's name.
      option.textContent = hotel.property_name;
      // Add the new option to the dropdown.
      hotelSelect.appendChild(option);
    });
  } catch (error) {
    // If an error occurs, log it and update the dropdown to show a failure message.
    console.error("Error loading hotels:", error);
    hotelSelect.innerHTML = '<option value="">Could not load hotels</option>';
  }
}

// --- INITIALIZATION ---
// Functions that run as soon as the page's DOM is ready.
document.addEventListener("DOMContentLoaded", () => {
  // We now call all three functions to set up the page.
  loadSidebar();
  setDefaultDate();
  loadHotels();
});
