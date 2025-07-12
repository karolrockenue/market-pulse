// public/app/reports.js (Simplified)

// Note: All functions called by Alpine.js have been moved directly into reports.html.
// This file now only contains the mock data logic that the main component depends on.

function generateMockData(startDate, endDate, columns, granularity) {
  const dailyData = [];
  let currentDate = new Date(startDate.getTime());
  const capacity = 100;
  while (currentDate <= endDate) {
    let row = { date: formatDateForInput(currentDate) };
    const roomsSold = Math.floor(Math.random() * 20 + 75);
    const totalRevenue = (Math.random() * 60 + 120) * roomsSold;
    columns.forEach((col) => {
      row[col] = generateMockValue(col, { roomsSold, totalRevenue, capacity });
    });
    dailyData.push(row);
    currentDate.setDate(currentDate.getDate() + 1);
  }

  if (granularity === "daily") return dailyData;

  const aggregatedData = {};
  dailyData.forEach((row) => {
    let key;
    const rowDate = parseDateFromInput(row.date);
    if (granularity === "weekly") {
      const weekStart = new Date(rowDate);
      const day = rowDate.getDay(); // Sunday = 0, Monday = 1, etc.
      const diff = rowDate.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
      weekStart.setDate(diff);
      key = formatDateForInput(weekStart);
    } else {
      key = row.date.substring(0, 7) + "-01";
    }
    if (!aggregatedData[key]) {
      aggregatedData[key] = { date: key, dayCount: 0 };
      columns.forEach((col) => (aggregatedData[key][col] = 0));
    }
    columns.forEach((col) => (aggregatedData[key][col] += row[col]));
    aggregatedData[key].dayCount++;
  });

  return Object.values(aggregatedData).map((row) => {
    const newRow = { date: row.date };
    columns.forEach((col) => {
      const lowerCol = col.toLowerCase();
      if (
        lowerCol.includes("occupancy") ||
        lowerCol.includes("adr") ||
        lowerCol.includes("revpar")
      ) {
        newRow[col] = row[col] / row.dayCount;
      } else {
        newRow[col] = row[col];
      }
    });
    return newRow;
  });
}

function generateMockValue(columnName, baseData) {
  const { roomsSold, totalRevenue, capacity } = baseData;
  const lowerCaseCol = columnName.toLowerCase();
  if (lowerCaseCol === "rooms sold") return roomsSold;
  if (lowerCaseCol === "total revenue") return totalRevenue;
  if (lowerCaseCol === "occupancy") return roomsSold / capacity;
  if (lowerCaseCol === "adr")
    return roomsSold > 0 ? totalRevenue / roomsSold : 0;
  if (lowerCaseCol === "revpar") return totalRevenue / capacity;
  if (lowerCaseCol === "rooms unsold") return capacity - roomsSold;
  const marketFactor = Math.random() * 0.1 + 0.95;
  if (lowerCaseCol.includes("market")) {
    const baseMetricName = lowerCaseCol.replace("market ", "");
    return generateMockValue(baseMetricName, baseData) * marketFactor;
  }
  return 0;
}

function formatDateForInput(date) {
  if (!date) return "";
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateFromInput(dateString) {
  if (!dateString) return null;
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

// Expose ONLY the function that tche new component will need from the outside.
window.generateMockData = generateMockData;
