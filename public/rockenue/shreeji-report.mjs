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

  // Clear previous summary data while loading.
  document.getElementById("summary-vacant").textContent = "--";
  document.getElementById("summary-blocked").textContent = "--";
  document.getElementById("summary-sold").textContent = "--";
  document.getElementById("summary-occupancy").textContent = "--";
  document.getElementById("summary-revpar").textContent = "--";
  document.getElementById("summary-adr").textContent = "--";
  document.getElementById("summary-revenue").textContent = "--";

  try {
    const response = await fetch(
      `/api/rockenue/shreeji-report?hotel_id=${hotelSelect.value}&date=${datePicker.value}`
    );
    const data = await response.json(); // data is now an object: { reportData: [], summary: {} }

    if (!response.ok) {
      throw new Error(data.error || "Failed to generate report.");
    }

    // A helper function to format currency nicely. Moved to a higher scope.
    // A helper function to format currency nicely. Moved to a higher scope.
    const formatCurrency = (amount) => {
      // THE FIX: Convert the incoming value (which may be a string) to a number.
      // parseFloat() will correctly handle numbers that are sent as strings from the API.
      const numericAmount = parseFloat(amount) || 0;
      return new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: "GBP",
      }).format(numericAmount);
    };

    // --- REFACTORED: Use the 'reportData' key for the table rows. ---
    const reportData = data.reportData;
    tableBody.innerHTML = ""; // Clear loading message

    if (reportData.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="7" class="px-6 py-4 text-center text-gray-500">No in-house guests found for the selected date.</td></tr>`;
    } else {
      // Loop through the report data and create a table row for each guest.
      reportData.forEach((row) => {
        const tr = document.createElement("tr");
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
    }

    // --- NEW: Populate the summary footer using the 'summary' key. ---
    const summary = data.summary;
    document.getElementById("summary-vacant").textContent = summary.vacant;
    document.getElementById("summary-blocked").textContent = summary.blocked;
    document.getElementById("summary-sold").textContent = summary.sold;
    // Format occupancy to two decimal places.
    document.getElementById("summary-occupancy").textContent =
      typeof summary.occupancy === "number"
        ? summary.occupancy.toFixed(2)
        : "0.00";
    document.getElementById("summary-revpar").textContent = formatCurrency(
      summary.revpar
    );
    document.getElementById("summary-adr").textContent = formatCurrency(
      summary.adr
    );
    document.getElementById("summary-revenue").textContent = formatCurrency(
      summary.revenue
    );
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
