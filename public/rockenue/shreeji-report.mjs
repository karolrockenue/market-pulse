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
  // NEW: Get a reference to the new takings container.
  const takingsContainer = document.getElementById("takings-summary-container");

  if (!hotelSelect.value || !datePicker.value) {
    alert("Please select a hotel and a date.");
    return;
  }

  generateBtn.disabled = true;
  generateBtn.textContent = "Generating...";
  tableBody.innerHTML = `<tr><td colspan="8" class="px-6 py-4 text-center text-gray-500">Loading report data...</td></tr>`;

  // Clear previous summary and takings data while loading.
  document.getElementById("summary-vacant").textContent = "--";
  document.getElementById("summary-blocked").textContent = "--";
  document.getElementById("summary-sold").textContent = "--";
  document.getElementById("summary-occupancy").textContent = "--";
  document.getElementById("summary-revpar").textContent = "--";
  document.getElementById("summary-adr").textContent = "--";
  document.getElementById("summary-revenue").textContent = "--";
  takingsContainer.innerHTML = `<p class="text-sm text-gray-500">Loading takings data...</p>`;

  try {
    // NEW: Get the selected hotel's name and format the date for the new heading.
    const hotelName = hotelSelect.options[hotelSelect.selectedIndex].text;
    const date = new Date(datePicker.value + "T00:00:00"); // Use T00:00:00 to prevent timezone shifts.
    const dayOfWeek = date
      .toLocaleDateString("en-GB", { weekday: "long" })
      .toUpperCase();
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    const formattedDate = `${dayOfWeek} ${day}-${month}-${year}`;

    // NEW: Update the heading content.
    document.getElementById(
      "report-title"
    ).textContent = `${hotelName} - DAILY CHART`;
    document.getElementById("report-date-display").textContent = formattedDate;

    const response = await fetch(
      `/api/rockenue/shreeji-report?hotel_id=${hotelSelect.value}&date=${datePicker.value}`
    );
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to generate report.");
    }

    const formatCurrency = (amount) => {
      const numericAmount = parseFloat(amount) || 0;
      return new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: "GBP",
      }).format(numericAmount);
    };

    // --- POPULATE MAIN TABLE ---
    const reportData = data.reportData;
    tableBody.innerHTML = "";
    if (reportData.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="8" class="px-6 py-4 text-center text-gray-500">No in-house guests found for the selected date.</td></tr>`;
    } else {
      reportData.forEach((row) => {
        const tr = document.createElement("tr");
        // NEW: Added the 'divide-x' class to create vertical lines between cells.
        tr.className = "divide-x divide-gray-200";
        tr.innerHTML = `
          <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${
            row.roomName
          }</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${
            row.pax
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

    // --- POPULATE PERFORMANCE SUMMARY ---
    const summary = data.summary;
    document.getElementById("summary-vacant").textContent = summary.vacant;
    document.getElementById("summary-blocked").textContent = summary.blocked;
    document.getElementById("summary-sold").textContent = summary.sold;
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

    // --- NEW: POPULATE TAKINGS SUMMARY ---
    const takings = data.takings;
    takingsContainer.innerHTML = ""; // Clear the loading message.

    if (takings && Object.keys(takings).length > 0) {
      // Create a grid to display the takings.
      const grid = document.createElement("div");
      grid.className = "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4";

      // Loop through the takings object (e.g., { "Cash": 500, "Credit Card": 1250 }).
      for (const method in takings) {
        const amount = takings[method];
        const item = document.createElement("div");
        item.className = "bg-gray-50 p-3 rounded-md";
        // Create the content for each payment method.
        item.innerHTML = `
          <dt class="text-sm font-medium text-gray-500 truncate">${method}</dt>
          <dd class="mt-1 text-xl font-semibold text-gray-900">${formatCurrency(
            amount
          )}</dd>
        `;
        grid.appendChild(item);
      }
      takingsContainer.appendChild(grid);
    } else {
      // Show a message if no takings data was found.
      takingsContainer.innerHTML = `<p class="text-sm text-gray-500">No takings data found for this day.</p>`;
    }
  } catch (error) {
    console.error("Error generating report:", error);
    tableBody.innerHTML = `<tr><td colspan="8" class="px-6 py-4 text-center text-red-500">Error: ${error.message}</td></tr>`;
    // Also show an error in the takings container.
    takingsContainer.innerHTML = `<p class="text-sm text-red-500">Error: ${error.message}</p>`;
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
