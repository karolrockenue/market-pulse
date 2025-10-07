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
  tableBody.innerHTML = `<tr><td colspan="8" class="px-6 py-2 text-center text-xs text-gray-500">Loading report data...</td></tr>`;

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
      tableBody.innerHTML = `<tr><td colspan="8" class="px-6 py-2 text-center text-xs text-gray-500">No in-house guests found for the selected date.</td></tr>`;
    } else {
      reportData.forEach((row) => {
        const tr = document.createElement("tr");
        // NEW: Added the 'divide-x' class to create vertical lines between cells.
        tr.className = "divide-x divide-gray-200";
        tr.innerHTML = `
          <td class="px-6 py-2 whitespace-nowrap text-xs font-medium text-gray-900">${
            row.roomName
          }</td>
          <td class="px-6 py-2 whitespace-nowrap text-xs text-gray-500">${
            row.pax !== "---" ? row.pax : ""
          }</td>
          <td class="px-6 py-2 whitespace-nowrap text-xs text-gray-500">${
            row.guestName !== "---" ? row.guestName : ""
          }</td>
          <td class="px-6 py-2 whitespace-nowrap text-xs text-gray-500 text-right">${
            row.grandTotal !== 0 ? formatCurrency(row.grandTotal) : ""
          }</td>
          <td class="px-6 py-2 whitespace-nowrap text-xs text-gray-500">${
            row.checkInDate !== "---" ? row.checkInDate : ""
          }</td>
          <td class="px-6 py-2 whitespace-nowrap text-xs text-gray-500">${
            row.checkOutDate !== "---" ? row.checkOutDate : ""
          }</td>
          <td class="px-6 py-2 whitespace-nowrap text-xs text-gray-500 text-right font-semibold">${
            row.balance !== 0 ? formatCurrency(row.balance) : ""
          }</td>
          <td class="px-6 py-2 whitespace-nowrap text-xs text-gray-500">${
            row.source !== "---" ? row.source : ""
          }</td>
        `;
        tableBody.appendChild(tr);
      });
    }

    // --- POPULATE PERFORMANCE SUMMARY ---
    const summary = data.summary;
    document.getElementById("summary-vacant").textContent = summary.vacant;
    // NEW: Add conditional styling for the 'Blocked' summary value.
    const blockedSpan = document.getElementById("summary-blocked");
    blockedSpan.textContent = summary.blocked;
    if (summary.blocked > 0) {
      // If the count is greater than zero, make the text red.
      blockedSpan.classList.add("text-red-600");
    } else {
      // Otherwise, ensure the text is the default color by removing the class.
      blockedSpan.classList.remove("text-red-600");
    }

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

    // --- POPULATE TAKINGS SUMMARY (NEW FORMAT) ---
    const takings = data.takings;
    takingsContainer.innerHTML = ""; // Clear the loading message.

    if (takings && Object.keys(takings).length > 0) {
      // First, calculate the total sum of all takings.
      const totalTakings = Object.values(takings).reduce(
        (sum, amount) => sum + amount,
        0
      );

      // Create and append the "Taken Total" line. This line is styled to be more prominent.
      const totalDiv = document.createElement("div");
      totalDiv.className =
        "flex justify-between font-semibold text-xs text-gray-800 pb-2 mb-2 border-b border-gray-200";
      totalDiv.innerHTML = `
        <span>Taken Total:</span>
        <span>${formatCurrency(totalTakings)}</span>
      `;
      takingsContainer.appendChild(totalDiv);

      // Now, create and append a line for each individual payment method.
      for (const method in takings) {
        const amount = takings[method];
        const itemDiv = document.createElement("div");
        // These lines are styled to match the simple text format of the main table cells.
        itemDiv.className = "flex justify-between text-xs text-gray-500";
        itemDiv.innerHTML = `
          <span>${method}:</span>
          <span>${formatCurrency(amount)}</span>
        `;
        takingsContainer.appendChild(itemDiv);
      }
    } else {
      // If no takings are found, display a message with the matching text style.
      takingsContainer.innerHTML = `<p class="text-xs text-gray-500">No takings data found for this day.</p>`;
    }
  } catch (error) {
    console.error("Error generating report:", error);
    tableBody.innerHTML = `<tr><td colspan="8" class="px-6 py-2 text-center text-xs text-red-500">Error: ${error.message}</td></tr>`;
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
