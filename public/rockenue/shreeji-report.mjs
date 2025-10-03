// /public/rockenue/shreeji-report.mjs
// This module handles the frontend logic for the Shreeji Report page.

import sidebar from "/app/_shared/sidebar.mjs";

/**
 * A function to dynamically load the shared sidebar component into the page.
 */
async function loadSidebar() {
  const sidebarContainer = document.getElementById("sidebar-container");
  if (!sidebarContainer) {
    console.error("Sidebar container not found!");
    return;
  }
  try {
    const response = await fetch("/app/_shared/sidebar.html");
    if (!response.ok) throw new Error("Failed to fetch sidebar HTML");
    const sidebarHTML = await response.text();

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
 */
function setDefaultDate() {
  const datePicker = document.getElementById("report-date");
  if (datePicker) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const year = yesterday.getFullYear();
    const month = String(yesterday.getMonth() + 1).padStart(2, "0");
    const day = String(yesterday.getDate()).padStart(2, "0");
    datePicker.value = `${year}-${month}-${day}`;
  }
}

/**
 * Fetches the list of all hotels from the backend API.
 * It then populates the 'hotel-select' dropdown with the results.
 */
async function loadHotels() {
  const hotelSelect = document.getElementById("hotel-select");
  if (!hotelSelect) return;

  try {
    const response = await fetch("/api/rockenue/hotels");
    if (!response.ok) {
      throw new Error(`Failed to fetch hotels. Status: ${response.status}`);
    }
    const hotels = await response.json();

    hotelSelect.innerHTML = "";
    const promptOption = document.createElement("option");
    promptOption.textContent = "Select a hotel";
    promptOption.value = "";
    promptOption.disabled = true;
    promptOption.selected = true;
    hotelSelect.appendChild(promptOption);

    hotels.forEach((hotel) => {
      const option = document.createElement("option");
      option.value = hotel.hotel_id;
      option.textContent = hotel.property_name;
      hotelSelect.appendChild(option);
    });
  } catch (error) {
    console.error("Error loading hotels:", error);
    hotelSelect.innerHTML = '<option value="">Could not load hotels</option>';
  }
}

/**
 * NEW: Fetches the report data from the backend and renders it in the table.
 * This is the main function triggered by the "Generate Report" button.
 */
async function generateReport() {
  // Get references to the UI elements we'll need to interact with.
  const hotelSelect = document.getElementById("hotel-select");
  const datePicker = document.getElementById("report-date");
  const generateBtn = document.querySelector("button"); // The main button
  const tableBody = document.querySelector("tbody");

  // Get the selected values from the form.
  const selectedHotelId = hotelSelect.value;
  const selectedDate = datePicker.value;

  // --- 1. Input Validation ---
  if (!selectedHotelId) {
    alert("Please select a hotel before generating the report.");
    return;
  }

  // --- 2. Update UI to show a loading state ---
  generateBtn.disabled = true;
  generateBtn.textContent = "Generating...";
  tableBody.innerHTML = `<tr><td colspan="4" class="px-6 py-4 text-center text-gray-500">Loading report data...</td></tr>`;

  try {
    // --- 3. Fetch Data from the API ---
    // Construct the URL with query parameters for the selected hotel and date.
    const response = await fetch(
      `/api/rockenue/shreeji-report?hotel_id=${selectedHotelId}&date=${selectedDate}`
    );
    const reportData = await response.json();

    if (!response.ok) {
      // If the server returns an error (e.g., 500), throw an error with the message.
      throw new Error(reportData.error || "An unknown error occurred.");
    }

    // --- 4. Render the Results ---
    tableBody.innerHTML = ""; // Clear the loading message.

    if (reportData.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="4" class="px-6 py-4 text-center text-gray-500">No data found for the selected date.</td></tr>`;
    } else {
      // Loop through each row of data from the API.
      reportData.forEach((row) => {
        const tr = document.createElement("tr");

        // Determine text color based on vacancy status for better readability.
        const textColor =
          row.guestName === "--- VACANT ---"
            ? "text-gray-400"
            : "text-gray-900";

        // Create and append the table cells for each piece of data.
        tr.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap text-sm ${textColor}">${
          row.roomName
        }</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium ${textColor}">${
          row.guestName
        }</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-right ${textColor}">${row.balance.toFixed(
          2
        )}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm ${textColor}">${
          row.source
        }</td>
                `;
        tableBody.appendChild(tr);
      });
    }
  } catch (error) {
    // --- 5. Handle Errors ---
    console.error("Failed to generate report:", error);
    tableBody.innerHTML = `<tr><td colspan="4" class="px-6 py-4 text-center text-red-500">Error: ${error.message}</td></tr>`;
  } finally {
    // --- 6. Reset UI ---
    // No matter what happens, re-enable the button and reset its text.
    generateBtn.disabled = false;
    generateBtn.textContent = "Generate Report";
  }
}

// --- INITIALIZATION ---
document.addEventListener("DOMContentLoaded", () => {
  loadSidebar();
  setDefaultDate();
  loadHotels();

  // NEW: Add the click event listener to the "Generate Report" button.
  const generateBtn = document.querySelector('button[type="button"]');
  if (generateBtn) {
    generateBtn.addEventListener("click", generateReport);
  }
});
