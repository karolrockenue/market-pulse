Sentinel Async Architecture Plan (v1.1)

Goal: Solve the "15-second latency" problem when updating multiple rates. Strategy: Move from "Serial Processing" to "Optimistic UI + Background Queue".

1. The Concept (The "Hybrid" Model)

We are decoupling the User Action from the System Execution.

User Experience (Optimistic): The user clicks "Submit," and the UI updates instantly. The user can leave the page immediately.

System Execution (Queue): The actual work happens in the background, managed by a database queue.

The "Kick" & "Cron": * The Kick: The API immediately triggers the worker to start processing (for speed).

The Cron: A 5-minute timer cleans up any jobs that the "Kick" missed (for reliability).

2. Database Architecture (The Persistence Layer)

We need two new tables to ensure data is never lost, even if the server sleeps.

Table A: sentinel_job_queue

Purpose: Stores the rate updates waiting to be sent to Cloudbeds.

Why: Acts as the "To-Do List" for the worker script.

Key Data: * payload: The list of rates (e.g., [{date: '2025-12-25', rate: 120}]).

status: 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'.

error_log: Stores the exact error message if Cloudbeds rejects it.

Table B: sentinel_notifications

Purpose: Stores alerts for the user (since they might have navigated away).

Why: Allows us to show a "Bell" icon with a history of what happened.

Key Data: * type: 'ERROR' or 'SUCCESS'.

message: Human-readable text (e.g., "3 Rate Updates Failed").

is_read: Tracks if the user has seen the alert.

3. Backend Implementation (The Logic)

Step A: Modify POST /overrides (The "Quick" Endpoint)

Current Behavior: Calculates rates -> Calls Cloudbeds -> Waits -> Returns success.

New Behavior: 1. Calculates rates (Base + Differentials).

2. INSERT the payload into sentinel_job_queue.

3. Trigger: Sends an async fetch request to the Worker URL (The "Kick").

4. Returns 200 OK to the frontend immediately.

Step B: Create api/workers/process-queue.js (The Worker)

Logic: 1. Fetch: Queries the DB for 'PENDING' jobs (FIFO - Oldest first).

2. Lock: Sets status to 'PROCESSING' so no other worker touches them.

3. Execute: Sends the data to Cloudbeds (using the Batch API where possible).

4. Finish: * If Success: Update job status to 'COMPLETED'.

If Failure: Update job status to 'FAILED', write to error_log, and insert a row into sentinel_notifications. Send an email via SendGrid.

4. Frontend Implementation (The Experience)

Step A: Optimistic Rate Manager

Logic: When "Submit" is clicked:

Update the savedOverrides state immediately (turning the cells blue).

Show a non-blocking "Syncing..." indicator in the header.

Clear the "Pending" (yellow) state.

Allow the user to continue working or leave the page.

Step B: Notification Bell

UI: Add a Bell icon to the Top Navigation.

Logic: * Poll sentinel_notifications every ~30-60 seconds.

If unread items exist, show a red badge count.

Clicking the bell shows a dropdown of recent events.

5. Summary of Workflow

User enters Rate -> Clicks Submit.

UI: Instantly shows Blue rate.

API: Saves to Queue -> Kicks Worker -> Returns OK.

Worker: Wakes up -> Pushes to Cloudbeds -> Marks Complete.

(If Error): Worker adds Notification -> User sees Red Dot on Bell -> User gets Email.

6. Detailed Implementation Guide (Step-by-Step)

This section breaks down the architecture into specific coding tasks for the developer.

Phase 1: Database Setup (SQL)

Goal: Create the persistent storage for the queue and notifications.

Run Migration: Execute the following SQL in the Neon Console to create the tables.

CREATE TABLE sentinel_job_queue (

id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

hotel_id INTEGER NOT NULL,

job_type TEXT NOT NULL DEFAULT 'RATE_UPDATE',

payload JSONB NOT NULL,

status TEXT NOT NULL DEFAULT 'PENDING',

attempts INTEGER DEFAULT 0,

last_error TEXT,

created_at TIMESTAMPTZ DEFAULT NOW(),

updated_at TIMESTAMPTZ DEFAULT NOW()

);

CREATE INDEX idx_queue_status ON sentinel_job_queue(status, created_at);

CREATE TABLE sentinel_notifications (

id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

type TEXT NOT NULL, -- 'ERROR', 'INFO'

title TEXT NOT NULL,

message TEXT NOT NULL,

is_read BOOLEAN DEFAULT FALSE,

created_at TIMESTAMPTZ DEFAULT NOW()

);

CREATE INDEX idx_notifications_unread ON sentinel_notifications(is_read) WHERE is_read = FALSE;

Phase 2: Backend Adapter (Batching Support)

Goal: Enable sentinel.adapter.js to handle arrays of rates.

Update api/adapters/sentinel.adapter.js: * Create a new function postRateBatch(propertyId, ratesArray).

Map ratesArray to the Cloudbeds putRate format (nested array rates[0], rates[1], etc.).

Use axios.post to send the batch in a single request.

Phase 3: Backend Router (The Producer)

Goal: Make POST /overrides return instantly.

Modify api/routes/sentinel.router.js (POST /overrides): * Remove: The loop that calls sentinelAdapter.postRate.

Logic: * Calculate all final rates (Base + Differentials).

Construct the payload object: { pmsPropertyId, rates: [...] }.

INSERT into sentinel_job_queue with status 'PENDING'.

The "Kick": Add a fire-and-forget fetch call:

// Don't await this!

fetch(`${process.env.BASE_URL}/api/sentinel/process-queue`, {

 method: 'POST',   


 headers: { 'Authorization': \`Bearer ${process.env.CRON\_SECRET}\` }   


}).catch(err => console.error('Kick failed', err));

Return: res.status(200).json({ success: true, message: 'Queued' }).

Phase 4: The Worker (The Consumer)

Goal: Process jobs in the background.

Create api/cron/process-queue.js: * Route: POST /api/sentinel/process-queue.

Security: Validate CRON_SECRET (so only we or Vercel Cron can trigger it).

Logic: 1. SELECT * FROM sentinel_job_queue WHERE status = 'PENDING' LIMIT 50.

2. Loop through jobs.

3. For each job, call sentinelAdapter.postRateBatch.

4. Success: UPDATE sentinel_job_queue SET status = 'COMPLETED'.

5. Failure: * UPDATE sentinel_job_queue SET status = 'FAILED', last_error = error.message.

INSERT INTO sentinel_notifications (Title: "Update Failed", Message: error.message).

Trigger SendGrid email (optional for MVP, strongly recommended).

Phase 5: Frontend (Optimistic UI)

Goal: Give the user instant feedback.

Modify SentinelRateManager.tsx: * Update handleSubmitChanges: 1. Snapshot: Create a copy of pendingOverrides.

2. Optimistic Update: Immediately merge these into savedOverrides.

3. Clear Pending: Set setPendingOverrides({}).

4. Show Status: Set a new state syncStatus = 'SYNCING'.

5. API Call: Call POST /overrides.

6. Handle Result: * If success: Set syncStatus = 'SAVED'.

* If network fail (500): Revert savedOverrides (optional, or just show error toast).

Phase 6: Notification Bell

Goal: Inform the user of background failures.

Create web/src/components/NotificationBell.tsx: * Use Popover from shadcn/ui.

Fetch unread count from /api/sentinel/notifications/unread.

Display list of recent notifications.

Update TopNav.tsx: * Insert <NotificationBell /> next to the User Profile.

7.0 Changelog (v1.1) - Async Architecture & Notification System

🚀 Achieved

Phase 1: Database Architecture: Successfully created sentinel_job_queue and sentinel_notifications tables to support async processing and user alerts.

Phase 2: Backend Adapter (Batching): Implemented postRateBatch in sentinel.adapter.js to support bulk rate updates via Cloudbeds putRate API (v1.3).

Phase 3: Backend Router (Producer): Refactored POST /overrides to use a "Producer" pattern.

Implemented Chunking Logic: Automatically splits large updates into batches of 30 to respect Cloudbeds API limits.

Implemented Internal Kick: Replaced unreliable network fetches with setImmediate to trigger the worker instantly within the same process.

Phase 4: The Worker (Consumer): Implemented runBackgroundWorker logic directly within sentinel.router.js. It successfully processes jobs from the queue (FIFO), handles Cloudbeds batch limits, and records success/failure.

Phase 5: Frontend (Optimistic UI): Updated SentinelRateManager.tsx to provide instant user feedback ("Updates Queued") while processing happens in the background.

Phase 6: Notification Bell (Backend & Logic):

Created GET /api/sentinel/notifications endpoint to fetch user alerts.

Created POST /api/sentinel/notifications/mark-read endpoint to clear alerts.

Created NotificationBell.tsx component with polling logic (every 15s) to fetch live updates from the database.

Integrated NotificationBell into TopNav.tsx.

Cleanup: Removed the deprecated "Cloudbeds Certification Tester" block from SentinelControlPanel.tsx.

⚠️ Outstanding Items / Known Issues

Notification Bell Testing: The bell functionality (polling, displaying alerts, marking as read) is implemented but has not yet been fully tested end-to-end in the live environment.

Notification Bell UI Issues:

Tailwind Issue: The bell icon or popover styling might not be rendering correctly due to potential Tailwind class conflicts or missing styles.

Transparent Popup: The notification dropdown background appears transparent or incorrect, making text hard to read. This needs resolving in the next session.

End-to-End Verification: We need to verify that a failed job (e.g., force a failure) actually triggers a red notification badge on the bell.

Next Session Plan

Fix UI: Debug and fix the NotificationBell styling (transparency issue).

Test: Perform an end-to-end test of the notification system.

Migrate: Begin the "Great Merge" to switch from the dev adapter to the production cloudbedsAdapter.js.