### **Plan 2.0: Project Cleanup & Documentation**

This document outlines the two-phase plan to clean the `market-pulse` repository of all obsolete files and then generate a new, comprehensive `Project Overview 2.0.md` document based on the final React architecture.

---

### **Phase 1: Obsolete File Cleanup**

**Objective:** To safely delete the old Alpine.js `/public` folder and all unused prototype components from the `/web` directory.

#### **Step 1.1: Create a "Cleanup" Branch**

* **Action:** Create a new Git branch from `feature/react-migration` to isolate this work.

**Command:**  
Bash  
git checkout \-b feature/code-cleanup

* 

#### **Step 1.2: Remove the Obsolete Alpine.js `/public` Folder**

* **Analysis:** The original `/public` folder contained the Alpine.js frontend. The new architecture serves all static content exclusively from the `web/build` directory. This folder is now 100% obsolete.  
* **Actions:**

Remove the directory:  
Bash  
git rm \-r public

1. 

Commit the deletion:  
Bash  
git commit \-m "chore: remove obsolete /public folder (Alpine.js)"

2. 

Push the branch:  
Bash  
git push origin feature/code-cleanup

3.   
* **Test Point (Manual):** After pushing, verify that the new Vercel preview deployment for `feature/code-cleanup` still loads and serves the React application perfectly.

#### **Step 1.3: Identify Unused React Components in `/web`**

* **Analysis:** The changelog confirms many prototype components in `/web/src/components` were replaced with new versions and are no longer imported. We must trace the app's import tree to find and remove them.  
* **Action Plan (Interactive Session):**  
  1. **User:** Upload the main application entry point, `web/src/App.tsx`.  
  2. **AI:** Analyze `App.tsx` and list all *directly* imported component files (e.g., `TopNav.tsx`, `Sidebar.tsx`, `LandingPage.tsx`).  
  3. **User:** Upload the component files requested by the AI.  
  4. **AI:** Recursively trace all *nested* imports from those files, building a complete "Used Component Tree" (a list of all files verifiably part of the final application).  
  5. **User:** Provide a complete list of all `.tsx` files in the `web/src/components` directory (e.g., by running `ls web/src/components` or `dir web\src\components`).  
  6. **AI:** Perform a "diff" between the full file list and the "Used Component Tree" and provide a definitive list of component files that are safe to delete.  
  7. **User:** Delete the identified files from the `web/src/components` directory.  
  8. **Test Point (Manual):** After deleting the files, run `yarn build` from within the `web` directory to confirm the build completes and no active dependencies were removed.

---

### **Phase 2: Update Documentation (Task 2.1)**

**Objective:** To create a new `Project Overview 2.0.md` document that reflects the new React architecture and incorporates all features and milestones from the changelogs.

#### **Step 2.1: Project 2.0: Source of Truth Analysis (New Workflow)**

* **Objective:** To build the new documentation from a "full picture" analysis of the final, clean codebase.  
* **Action Plan:**  
  1. **User:** Upload all final project files (all `.js`, `.tsx`, `.json`, etc.) from both the root and the `/web` directory.  
  2. **AI:** Conduct a comprehensive analysis of the complete codebase.  
  3. **AI:** Use this analysis to generate the new, highly detailed `Project Overview 2.0.md`, which will include:  
     * A complete file-by-file breakdown.  
     * A map of all React component props and states.  
     * A definitive list of all API endpoints and the server functions that handle them.  
     * A trace of all database interactions, linking endpoints to specific SQL queries.

#### **Step 2.2: Initialize the New Document**

* **Action (AI):** Generate a new file, `Project Overview 2.0.md`, using the original `Project Overview.md` as a template.

#### **Step 2.3: Update Core Architecture Sections**

* **Action (AI):** Perform the following updates to the new document:  
  * **Technology Stack:** Change "Frontend: Alpine.js" to "Frontend: React (Vite)".  
  * **Project File Structure:**  
    * Remove the entire `/public` directory tree.  
    * Add the new `/web` directory tree (`/web/src/components`, `web/src/App.tsx`, `web/package.json`, etc.).  
    * Update the "server entry point" from `api/index.js` to `server.js`.  
  * **Deployment:** Add details about the `vercel-build` script and the single-server monorepo architecture.

#### **Step 2.4: Synthesize All New Features & Endpoints**

* **Action (AI):** Read the entire `Market Pulse_ React Migration Changelog.md` and integrate all new functionality into the documentation:  
  * **New API Routers:** Add sections for `budgets.router.js`, `support.router.js`, and the new endpoints in `rockenue.router.js` (`/api/rockenue/portfolio`).  
  * **Updated Endpoints:** Update `reports.router.js` to include `POST /api/reports/run` and `POST /api/reports/year-on-year`.  
  * **New Features:** Add sections for the "Budgeting Page," "Year-on-Year Report," "Rockenue Portfolio Overview," and the "Support/Legal" page flow.

#### **Step 2.5: Add New Architectural Milestones**

* **Action (AI):** Add new sections to the "Architectural Milestones" part of the document:  
  * **14.0 Architectural Milestone: Budget Pacing Logic** (Describing the 3-tier "Green/Yellow/Red" logic).  
  * **15.0 Architectural Milestone: Rockenue Management Data Model** (Describing `is_rockenue_managed` and `rockenue_managed_assets`).  
  * **16.0 Architectural Milestone: React Migration & Monorepo Deployment** (Describing the final `server.js` \+ `web/build` \+ `vercel.json` architecture).

