### **Project Progress Document: Shreeji Report Automation**

* **Date:** November 10, 2025  
* **Feature:** Automated Email Scheduling for Shreeji Report  
* **Status:** In Progress (90% Complete, Blocked by Frontend Bug)

---

### **1.0 Initial Objective**

The goal of this session was to automate the daily "Shreeji Report" PDF. The initial request was for a hard-coded cron job to generate the report for a specific list of hotels and email it to a static list of recipients at 6:00 AM UK time.

---

### **2.0 Final Implementation Plan**

After discussion, we pivoted from a hard-coded script to a more scalable, UI-driven solution. The new plan was to integrate this feature into the existing `scheduled_reports` system.

The final, agreed-upon plan involved:

1. **Centralize Backend Logic:** Create a new "Logic Hub" (`report.generators.js`) for the PDF generation logic, following the existing pattern of `benchmark.utils.js`. This ensures the logic is not duplicated.  
2. **Create a Reusable Email Utility:** Create `email.utils.js` to centralize all SendGrid email-sending logic.  
3. **Modify Existing Cron Job:** Update the existing `api/send-scheduled-reports.js` script to recognize and process a new `report_type: 'shreeji'`.  
4. **Update API:** Modify the `POST /api/reports/scheduled-reports` endpoint in `reports.router.js` to accept and save this new report type.  
5. **Build Frontend UI:** Add a new scheduling form and table *directly* to the `web/src/components/ShreejiReport.tsx` component, as this is an admin-only feature.  
6. **Update `App.tsx`:** Add state and handlers to `App.tsx` to manage this new UI, passing the functions and data as props to `ShreejiReport.tsx`.

---

### **3.0 Completed Work (How Far We Got)**

We have successfully completed 100% of the backend implementation and 90% of the frontend.

#### **✅ Backend (Complete)**

* **`api/utils/email.utils.js`:** Created a new centralized utility for sending emails via SendGrid.  
* **`api/utils/report.generators.js`:** Created a new "Logic Hub" and successfully moved all PDF generation logic from `rockenue.router.js`.  
* **`api/utils/emailTemplates.js`:** Added a new HTML function, `getShreejiReportEmailHTML`, for the new report email.  
* **`api/routes/rockenue.router.js`:** Refactored the `GET /shreeji-report/download` endpoint to use the new `report.generators.js` hub, fixing a PDF export bug in the process.  
* **`api/send-scheduled-reports.js`:** Successfully modified the main cron job to handle both "Standard" and "Shreeji" report types.  
* **`api/routes/reports.router.js`:** Modified the `POST /reports/scheduled-reports` endpoint to correctly save the `report_type: 'shreeji'` and its associated `propertyId` and `recipients`.

#### **🟡 Frontend (In Progress)**

* **`web/src/components/ShreejiReport.tsx`:** The file was fully replaced with a new version that includes the "Report Schedules" form and table UI.  
* **`web/src/App.tsx`:** We attempted to add the necessary state (e.g., `shreejiScheduledReports`) and handlers (e.g., `handleSaveShreejiSchedule`) to power the new UI.

---

### **4.0 Unresolved Issues & Next Steps**

The feature is currently blocked by a critical bug in `App.tsx` that prevents the application from loading.

#### **Unresolved Bug**

The application crashes on load with the following error:

Uncaught (in promise) ReferenceError: setIsLoadingShreejiSchedules is not defined at fetchShreejiSchedules (App.tsx:260:7)

#### **Root Cause Analysis**

This error is caused by flawed modifications to `App.tsx`.

1. **Invalid Hook Call:** State variables (`shreejiScheduledReports`, `isLoadingShreejiSchedules`) were added *outside* the main `App()` component body (at line 76), which is not allowed in React and causes the crash.  
2. **Duplicate Handlers:** The handler functions (`handleSaveShreejiSchedule`, `handleDeleteShreejiSchedule`) were also added in the wrong place, creating duplicates of the correct functions that exist *inside* the component (near line 1087).

#### **Next Steps (What's Left)**

The *only* remaining task is to fix `App.tsx`. The fix I provided in our last step (and which I re-confirm here) will resolve the issue:

1. **DELETE** the misplaced `useState` declarations from lines 76-77 of `App.tsx`. The correct state is already declared inside the component at line 129\.  
2. **DELETE** the duplicate `handleSaveShreejiSchedule` and `handleDeleteShreejiSchedule` functions from lines 834-881 of `App.tsx`. The correct functions are already declared at line 1087\.  
3. **VERIFY** that the `<ShreejiReport />` component (at line 1609\) is correctly receiving the props (scheduledReports, isLoadingSchedules, etc.) as implemented.

Once these cleanup steps are applied to `App.tsx`, the bug will be resolved, and the feature implementation will be 100% complete.

---

### **5.0 ⚠️ Project Blueprint Update Required**

The `Project Blueprint.md` file is now out of date. A future developer must update it to reflect the following changes:

#### **New Files**

* **`api/utils/email.utils.js`:** A centralized utility for all SendGrid email operations.  
* **`api/utils/report.generators.js`:** A "Logic Hub" for generating complex PDF/Excel reports. Currently holds the `generateShreejiReport` function.

#### **Modified Files & Endpoints**

* **`api/routes/reports.router.js`:**  
  * `POST /reports/scheduled-reports`: This endpoint has been modified. It now accepts a `report_type` (e.g., 'standard' or 'shreeji') in its payload to differentiate scheduled report types.  
* **`api/routes/rockenue.router.js`:**  
  * `GET /shreeji-report/download`: This endpoint has been refactored to call `report.generators.js`. Its internal logic was removed.  
* **`api/send-scheduled-reports.js`:**  
  * This cron job is now "type-aware." It checks the `report_type` column and routes to the correct generator (Standard P\&L or Shreeji PDF).  
* **`api/utils/emailTemplates.js`:**  
  * Contains the new `getShreejiReportEmailHTML` function.  
* **`web/src/App.tsx`:**  
  * Now contains state and handlers (`shreejiScheduledReports`, `handleSaveShreejiSchedule`, etc.) to manage the Shreeji scheduling UI.  
* **`web/src/components/ShreejiReport.tsx`:**  
  * This component is no longer just a report viewer. It now contains a full UI for creating, viewing, and deleting "Shreeji" report schedules.

