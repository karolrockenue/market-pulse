// public/constants.js

// This is now the single source of truth for this data map.
// The "export" keyword makes it available to other files.
export const DATASET_7_MAP = {
  // Booking Category
  adr: { name: "ADR", category: "Booking", type: "currency" },
  revpar: { name: "RevPAR", category: "Booking", type: "currency" },
  adults_count: { name: "Adults", category: "Booking", type: "number" },
  children_count: { name: "Children", category: "Booking", type: "number" },
  room_guest_count: {
    name: "Room Guest Count",
    category: "Booking",
    type: "number",
  },
  // Finance Category
  total_revenue: {
    name: "Total Revenue",
    category: "Finance",
    type: "currency",
  },
  room_revenue: {
    name: "Total Room Revenue",
    category: "Finance",
    type: "currency",
  },
  room_rate: { name: "Room Rate", category: "Finance", type: "currency" },
  misc_income: { name: "Misc. Income", category: "Finance", type: "currency" },
  room_taxes: { name: "Total Taxes", category: "Finance", type: "currency" },
  room_fees: { name: "Total Fees", category: "Finance", type: "currency" },
  additional_room_revenue: {
    name: "Other Room Revenue",
    category: "Finance",
    type: "currency",
  },
  non_room_revenue: {
    name: "Total Other Revenue",
    category: "Finance",
    type: "currency",
  },
  // Occupancy Category
  occupancy: { name: "Occupancy", category: "Occupancy", type: "percent" }, // MODIFIED: Renamed from "Occupancy (Direct)"
  mfd_occupancy: {
    name: "Adjusted Occupancy",
    category: "Occupancy",
    type: "percent",
  },
  rooms_sold: { name: "Rooms Sold", category: "Occupancy", type: "number" },
  capacity_count: { name: "Capacity", category: "Occupancy", type: "number" },
  blocked_room_count: {
    name: "Blocked Rooms",
    category: "Occupancy",
    type: "number",
  },
  out_of_service_count: {
    name: "Out of Service Rooms",
    category: "Occupancy",
    type: "number",
  },
};
