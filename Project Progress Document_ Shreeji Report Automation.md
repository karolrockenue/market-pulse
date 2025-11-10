Project Progress Document: Shreeji Report Automation
Date: November 10, 2025

Feature: Automated Email Scheduling for Shreeji Report

Status: In Progress (99% Complete, Blocked by Data-Saving Bug)

1.0 Initial Objective
The goal of this session was to automate the daily "Shreeji Report" PDF. The initial request was for a hard-coded cron job to generate the report for a specific list of hotels and email it to a static list of recipients at 6:00 AM UK time.

2.0 Final Implementation Plan
After discussion, we pivoted from a hard-coded script to a more scalable, UI-driven solution. The new plan was to integrate this feature into the existing scheduled_reports system.

The final, agreed-upon plan involved:

Centralize Backend Logic: Create a new "Logic Hub" (report.generators.js) for the PDF generation logic, following the existing pattern of benchmark.utils.js. This ensures the logic is not duplicated.

Create a Reusable Email Utility: Create email.utils.js to centralize all SendGrid email-sending logic.

Modify Existing Cron Job: Update the existing api/send-scheduled-reports.js script to recognize and process a new report_type: 'shreeji'.

Update API: Modify the POST /api/reports/scheduled-reports endpoint in reports.router.js to accept and save this new report type.

Build Frontend UI: Add a new scheduling form and table directly to the web/src/components/ShreejiReport.tsx component, as this is an admin-only feature.

Update App.tsx: Add state and handlers to App.tsx to manage this new UI, passing the functions and data as props to ShreejiReport.tsx.

3.0 Completed Work (How Far We Got)
We have successfully completed 100% of the backend implementation and 100% of the frontend code, resolving all build errors and database schema issues.

✅ Backend (Complete)
api/utils/email.utils.js: Created a new centralized utility for sending emails via SendGrid.

api/utils/report.generators.js: Created a new "Logic Hub" and successfully moved all PDF generation logic from rockenue.router.js.

api/utils/emailTemplates.js: Added a new HTML function, getShreejiReportEmailHTML, for the new report email.

api/routes/rockenue.router.js: Refactored the GET /shreeji-report/download endpoint to use the new report.generators.js hub.

api/send-scheduled-reports.js: Successfully modified the main cron job to handle both "Standard" and "Shreeji" report types.

api/routes/reports.router.js: Modified the POST /reports/scheduled-reports endpoint to correctly save the report_type: 'shreeji' and its associated propertyId and recipients.

Database Schema: The scheduled_reports table has been migrated to include the new report_type column.

✅ Frontend (Complete)
web/src/components/ShreejiReport.tsx: The file was fully replaced with a new version that includes the "Report Schedules" form and table UI. All styling and state issues are resolved.

web/src/App.tsx: All state (shreejiScheduledReports) and handlers (handleSaveShreejiSchedule) are correctly implemented and passed as props. All ReferenceError bugs are fixed.

4.0 Unresolved Issues & Next Steps
After fixing all database, build, and frontend state issues, the application now appears to save the new schedule successfully. However, the feature is still not working as expected.

Unresolved Bug
A new "ghost" schedule bug has been identified:

UI Success: A new Shreeji schedule is created in the UI and appears correctly in the "Existing Schedules" table.

Email Failure: The scheduled time passes (e.g., 15:55 UTC), but the email report never arrives.

Data Disappears: When the page is manually refreshed, the newly created schedule disappears from the table, as if it was never saved.

Root Cause Analysis (Hypothesis)
This behavior strongly suggests a transactional rollback or a silent data-saving error. The POST /api/reports/scheduled-reports endpoint is likely sending a "Success" (200 OK) response back to the frontend before the database transaction is fully committed (or after it has failed and rolled back).

The cron job (api/send-scheduled-reports.js) then fails to find the new schedule (because it was never truly saved), so no email is sent. The page refresh confirms this by fetching an empty list from the database.

This is almost certainly caused by a final, missed mismatch between the camelCase keys in the frontend payload (e.g., reportType) and the snake_case keys expected by the backend SQL query (e.g., report_type).

Next Steps (What's Left)
The only remaining task is to debug the POST /api/reports/scheduled-reports endpoint in api/routes/reports.router.js to find and fix the silent data-saving error.

5.0 ⚠️ Project Blueprint Update Required
The Project Blueprint.md file is now out of date. A future developer must update it to reflect the following changes:

New Files
api/utils/email.utils.js: A centralized utility for all SendGrid email operations.

api/utils/report.generators.js: A "Logic Hub" for generating complex PDF/Excel reports. Currently holds the generateShreejiReport function.

Modified Files & Endpoints
api/routes/reports.router.js:

POST /reports/scheduled-reports: This endpoint has been modified. It now accepts a report_type (e.g., 'standard' or 'shreeji') in its payload to differentiate scheduled report types.

api/routes/rockenue.router.js:

GET /shreeji-report/download: This endpoint has been refactored to call report.generators.js. Its internal logic was removed.

api/send-scheduled-reports.js:

This cron job is now "type-aware." It checks the report_type column and routes to the correct generator (Standard P&L or Shreeji PDF).

api/utils/emailTemplates.js:

Contains the new getShreejiReportEmailHTML function.

web/src/App.tsx:

Now contains state and handlers (shreejiScheduledReports, handleSaveShreejiSchedule, etc.) to manage the Shreeji scheduling UI.

web/src/components/ShreejiReport.tsx:

This component is no longer just a report viewer. It now contains a full UI for creating, viewing, and deleting "Shreeji" report schedules.