// /api/utils/pacing.utils.js

/**
 * Helper function to get the number of days in a specific month and year.
 * @param {number} year - The full year (e.g., 2025)
 * @param {number} monthIndex - The 0-based month index (0-11)
 * @returns {number} The number of days in that month
 */
function getDaysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/**
 * [SINGLE SOURCE OF TRUTH]
 * Calculates the pacing status (Red/Yellow/Green) for a given budget month.
 * This logic is migrated from Budgeting.tsx to be reused by all API endpoints.
 *
 * @param {object} data - An object containing all necessary metrics.
 * @param {number} data.targetRev - The gross revenue target for the month.
 * @param {number} data.actualRev - The actual revenue on the books (MTD + OTB).
 * @param {number} data.capacityCount - The total physical room capacity for the *entire* month.
 * @param {number} data.totalSoldRoomNights - The total room nights sold (MTD + OTB).
 * @param {number} [data.physicalUnsoldRemaining] - Physical unsold inventory *from today forward*. (Required for Current Month).
 * @param {object} benchmarks - The benchmark object from getBenchmarks().
 * @param {number} benchmarks.benchmarkOcc - The benchmark occupancy (e.g., 75.0).
 * @param {number} benchmarks.benchmarkAdr - The benchmark ADR (e.g., 120.0).
 * @param {number} year - The full year (e.g., 2025).
 * @param {number} monthIndex - The 0-based month index (0-11).
 *
 * @returns {object} { statusTier: 'green'|'yellow'|'red'|'loading', statusText: 'On Target'|'At Risk'|... }
 */
function calculatePacingStatus({
  targetRev = 0,
  actualRev = 0,
  capacityCount = 0,
  totalSoldRoomNights = 0,
  physicalUnsoldRemaining, // Can be null/undefined for past/future
  benchmarks,
  year,
  monthIndex,
}) {
  // --- 1. Get Date Info ---
  const today = new Date();
  const currentYearActual = today.getFullYear();
  const currentMonthActual = today.getMonth(); // 0-indexed

  const isCurrentMonth = year === currentYearActual && monthIndex === currentMonthActual;
  const isPastMonth = year < currentYearActual || (year === currentYearActual && monthIndex < currentMonthActual);
  const isFutureMonth = year > currentYearActual || (year === currentYearActual && monthIndex > currentMonthActual);

  // --- 2. Base Pacing Calculations ---
  const remainingTarget = targetRev - actualRev;

  // --- 3. Determine Status Tiers (Green/Yellow/Red) ---
  let statusTier = 'green';
  let statusText = 'On Target';
  let requiredADR = 0;
  let benchmarkAdr = 0;
  let benchmarkOcc = 0;
  let roomsLeftToSell = 0;

  // Rules for defaulting to Green
  if (targetRev <= 0) {
    statusTier = 'green';
    statusText = 'No Target';
  } else if (remainingTarget <= 0 && actualRev > 0) {
    statusTier = 'green';
    statusText = 'Target Met';
  } else if (isPastMonth) {
    // Simple comparison for past months
    if (actualRev < targetRev * 0.9) {
      statusTier = 'red';
      statusText = 'Off Target';
    } else if (actualRev < targetRev) {
      statusTier = 'yellow';
      statusText = 'Off Target';
    } else {
      statusTier = 'green';
      statusText = 'Target Met';
    }
  } else if (!benchmarks) {
    statusTier = 'loading';
    statusText = 'Loading...';
  } else {
    // --- Logic for Current & Future Months ---
    benchmarkOcc = benchmarks.benchmarkOcc || 75.0; // e.g., 75.0
    benchmarkAdr = benchmarks.benchmarkAdr || 120.0;
const benchmarkOccDecimal = benchmarkOcc / 100; // e.g., 0.75

    if (isCurrentMonth && physicalUnsoldRemaining !== null && physicalUnsoldRemaining !== undefined) {
      // --- Current Month Logic ---
      // Project sales based on benchmark occ against *remaining physical inventory from today*.
      roomsLeftToSell = physicalUnsoldRemaining * benchmarkOccDecimal;

    } else if (isFutureMonth) {
      // --- [FIXED] Future Month Logic ---
      // Project sales based on benchmark occ against *total physical unsold rooms for the month*.
      const totalPhysicalUnsoldForMonth = capacityCount - totalSoldRoomNights;
      roomsLeftToSell = totalPhysicalUnsoldForMonth * benchmarkOccDecimal;
      if (roomsLeftToSell < 0) roomsLeftToSell = 0; // Ensure it's not negative
    }

    // Calculate Required ADR based on the determined roomsLeftToSell
    if (roomsLeftToSell > 0 && remainingTarget > 0) {
      requiredADR = remainingTarget / roomsLeftToSell;
    } else if (remainingTarget > 0) {
      // Still need revenue but no rooms left to sell -> impossible target
      requiredADR = benchmarkAdr * 999; // Set high number for Red status
    } else {
      // Target met or no rooms left & no target left -> Green
      requiredADR = 0;
    }

    // Compare Required ADR to Benchmark ADR to set the tier
    const adrRatio = benchmarkAdr > 0 ? requiredADR / benchmarkAdr : (requiredADR > 0 ? 999 : 1);

    if (requiredADR === 0 && remainingTarget <= 0) {
      statusTier = 'green';
      statusText = 'Target Met';
    } else if (adrRatio > 1.15) {
      statusTier = 'red';
      statusText = 'At Risk';
    } else if (adrRatio > 1.0) {
      statusTier = 'yellow';
      statusText = 'Slightly Behind';
    } else {
      statusTier = 'green';
      statusText = 'On Target';
    }
  }

  // --- 4. Return all data ---
  return {
    statusTier,
    statusText,
    // (DEBUG) You can uncomment these to help with validation
    // requiredADR,
    // benchmarkAdr,
    // roomsLeftToSell,
  };
}

module.exports = {
  calculatePacingStatus,
  getDaysInMonth,
};