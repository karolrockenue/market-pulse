## **DGX SPARK DEVELOPER HANDOVER BLUEPRINT (v1.0)**

### **1\. Project Context & Environment State**

This machine is the dedicated **AI Brain** for the **Market Pulse** application. All development is currently firewalled for the Phase 1 Cloudbeds certification.

| Parameter | Detail |
| :---- | :---- |
| **Developer Status** | Sole Developer (Karol) |
| **Hardware** | NVIDIA DGX Spark (GB10 Superchip) |
| **Project** | Market Pulse Monorepo (Node.js/React/Postgres) |
| **Project Location** | \~/market-pulse (Git Cloned on Spark Disk) |
| **Current Directory** | \~/market-pulse/web |
| **User** | sentinel |
| **Hostname** | spark-828c.local |

---

### **2\. Completed Setup & Verified Systems**

All prerequisite environments have been successfully installed and verified:

* **Network:** Verified 815 Mbit/s download speed.  
* **GPU Status:** Verified nvidia-smi shows **NVIDIA GB10**.  
* **Python/AI Environment:** Successfully created and activated spark\_test virtual environment (contains PyTorch/CUDA 13.0).  
* **Codebase Transfer:** The full project codebase was successfully cloned via git clone onto the Spark's hard drive.  
* **Node Version Fix:** The system's Node version was successfully upgraded to the required **v20.19.5** using **NVM**.  
* **Dependencies:** npm install was run in the correct web directory.

---

### **3\. Training Goal & The Persistent Wall**

The core training goal is to successfully run an architectural analysis query against the existing codebase using the **Cursor Composer**.

| Goal | Description | Status |
| :---- | :---- | :---- |
| **Desired Output** | A clean printout of the Summary and Required props for the component web/src/components/PropertyHubPage.tsx. | **BLOCKED** |
| **Final Command** | The command that must successfully execute: ./node\_modules/.bin/ts-node \--require ts-node/register \--require tsconfig-paths/register \-e "\[... long analysis script ...\]" | **FAILS** |
| **Persistent Error** | **bash: ./node\_modules/.bin/ts-node: No such file or directory** | **CRITICAL** |

---

### **4\. Guideline Blueprint for Next Session**

The problem is isolated to the final execution environment. The files *should* exist, but the Linux shell cannot locate the executable.

**Action Plan for Next AI:**

1. **Verify State:** Run pwd to confirm the developer is in the /web directory.  
2. **Verify Node:** Run node \-v to confirm Node **v20.x** is active.  
3. **Immediate Goal:** Resolve the **bash: No such file or directory** error, which is preventing all web development tasks. The AI must discover why the ts-node executable file is missing from the hard drive, despite npm install being executed under the correct Node version.  
4. **Final Verification:** Re-run the analysis script after the fix.

### **5. Developer Changelog (November 18, 2025)**

**Status:** Environment is fixed, but the AI feature is defective.

* **CRITICAL ENVIRONMENT RESOLUTION:** The persistent `bash: No such file or directory` error for the `ts-node` executable was **resolved**. The environment is confirmed to be working (Node v20.19.5, `ts-node`, and `tsconfig-paths` dependencies are all correctly installed and accessible).
* **NEW BLOCKER (AI FEATURE DEFECT):** The **Cursor Composer (CMD/CTRL+K)** feature is **defective**. It executes the necessary internal analysis scripts successfully, but **fails to translate the technical output into a human-readable summary**.
* **Symptom:** When a user enters a natural language query (e.g., "Summarize PropertyHubPage.tsx and list props"), the tool spits back the **raw technical output script** or the **raw data** instead of the intended simple answer.
* **Troubleshooting Note:** All standard and alternative global configuration paths (`~/.config/Code/User/settings.json`, `~/.cursor-server/User/settings.json`, etc.) were checked and confirmed to **not exist**, indicating that no local configuration is forcing the raw output mode.
* **Next Developer Action:** The next developer must investigate why the **AI Translation Layer** is failing to render human language output, possibly by checking for a software bug or an inaccessible hardcoded raw output setting.

---
CRITICAL RESOLUTION: The persistent AI Feature Defect (where the Cursor Composer returned raw data instead of a human summary) is RESOLVED.

CAUSE: The defect was caused by a user context issue. When the user executed CMD/CTRL + K while the Terminal Window was in focus, the AI analyzed the terminal's context (which is messy and non-code) and returned the raw technical output.

SOLUTION: The AI Translation Layer works perfectly when the user's cursor is focused directly on the code file (PropertyHubPage.tsx).

AI INTERFACE DIRECTIVE: SENTINEL/MARKET PULSE PROJECT

0. AI BOT COMMUNICATION PROTOCOL (MANDATORY)

Parameter

Directive

User Background

LITERALLY ZERO knowledge of DGX, PyTorch, CUDA, or complex Linux/ML terminology.

Communication Style

CONCISE, HUMAN LANGUAGE ONLY. No emojis, no filler, no conversational tone, no stock images, no videos. Use simple analogies only.

Instruction Format

ALWAYS provide ONE step at a time. Wait for confirmation before proceeding to the next step.

Error Handling

If a user error occurs (e.g., python3 command fails), assume it is an environment setup issue, not a code issue, and provide a clear fix (e.g., cd, source activate).

1. AI PROJECT CONTEXT & ENVIRONMENT

Concept

Purpose

Status

Project

Market Pulse AI Brain development.

Active.

Hardware

DGX Spark with NVIDIA GB10 GPU.

Verified. This machine must be used for all training.

AI Toolbox

(spark_test) Virtual Environment.

Verified. Must be activated to access PyTorch.

Tensors & CUDA

Data must be converted to a Tensor and transferred to the cuda (GPU) device.

Working. This confirms the DGX Spark is running at full power.

2. CURRENT TASK & NEXT STEPS

Stage

Goal

Status

Stage 1

Foundational Learning (Linear Model). Learn the concepts of Tensors, Loss, and Epochs by finding the simple rule $Y=2X$.

COMPLETE.

Result

Increased Epochs from 100 to 500. Loss dropped significantly, improving the prediction from $11.09$ to $11.69$ (Target $12.00$).

SUCCESS.

NEXT STEP

Introduce Convolutional Neural Network (CNN) Layers. Understand how the AI shifts from processing simple numbers to processing complex image data (like satellite or property photos).

PENDING.

3. PENDING ACTION (The Immediate Next Step)

Continue basic system training
