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
 * Main function to generate the report. It fetches data and populates the table.
 */
async function generateReport() {
  const hotelSelect = document.getElementById("hotel-select");
  const datePicker = document.getElementById("report-date");
  const tableBody = document.querySelector("#report-results-table tbody");
  const generateBtn = document.getElementById("generate-btn");

  if (!hotelSelect.value || !datePicker.value) {
    alert("Please select a hotel and a date.");
    return;
  }

  generateBtn.disabled = true;
  generateBtn.textContent = "Generating...";
  tableBody.innerHTML = `<tr><td colspan="7" class="px-6 py-4 text-center text-gray-500">Loading report data...</td></tr>`;

  try {
    const response = await fetch(
      `/api/rockenue/shreeji-report?hotel_id=${hotelSelect.value}&date=${datePicker.value}`
    );
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to generate report.");
    }

    tableBody.innerHTML = ""; // Clear loading message

    if (data.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="7" class="px-6 py-4 text-center text-gray-500">No in-house guests found for the selected date.</td></tr>`;
      return;
    }

    // A helper function to format currency nicely.
    const formatCurrency = (amount) => {
      return new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: "GBP",
      }).format(amount);
    };

    // Loop through the report data and create a table row for each guest.
    data.forEach((row) => {
      const tr = document.createElement("tr");
      // FINAL REVISION: Add the new table cells for the new columns.
      tr.innerHTML = `
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${
          row.roomName
        }</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${
          row.guestName
        }</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${
          row.checkInDate
        }</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${
          row.checkOutDate
        }</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${
          row.source
        }</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">${formatCurrency(
          row.grandTotal
        )}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right font-semibold">${formatCurrency(
          row.balance
        )}</td>
      `;
      tableBody.appendChild(tr);
    });
  } catch (error) {
    console.error("Error generating report:", error);
    tableBody.innerHTML = `<tr><td colspan="7" class="px-6 py-4 text-center text-red-500">Error: ${error.message}</td></tr>`;
  } finally {
    generateBtn.disabled = false;
    generateBtn.textContent = "Generate Report";
  }
}

// --- INITIALIZATION ---
document.addEventListener("DOMContentLoaded", () => {
  loadSidebar();
  setDefaultDate();
  loadHotels();

  // Attach the event listener to the "Generate Report" button.
  const generateBtn = document.getElementById("generate-btn");
  if (generateBtn) {
    generateBtn.addEventListener("click", generateReport);
  }
});
