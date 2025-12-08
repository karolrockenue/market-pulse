\# Sentinel Implementation Plan

\#\# Phase 1: Data Engineering (We are here)  
The goal is to establish a pipeline that converts raw, messy reservation data into a clean "Daily Grain" format for the AI.

\- \[ \] \*\*Clean Up\*\*: Archive/Delete old V1 scripts (\`train\_model\_v1.py\`).  
\- \[ \] \*\*Directory Setup\*\*: Create \`datasets/raw\_exports\`, \`datasets/processed\`, and \`models/global\`.  
\- \[ \] \*\*Schema Definition\*\*: Document the \`Unified\_Schema.md\` (Columns: \`booking\_date\`, \`stay\_date\`, \`price\`, \`market\_compression\`).  
\- \[ \] \*\*Build ETL Pipeline\*\*: Write \`etl\_pipeline.py\` to:  
    \- Ingest Cloudbeds/Booking.com CSVs.  
    \- Split multi-night stays into single-night rows.  
    \- Normalize currency and status.  
\- \[ \] \*\*Run Initial Load\*\*: Process 1 year of historical data to verify the pipeline.

\#\# Phase 2: Global Model Training  
The goal is to train the "Foundation Model" on the cleaned history.

\- \[ \] \*\*Model Architecture\*\*: Create \`train\_global.py\` using PyTorch/TensorFlow.  
\- \[ \] \*\*Feature Engineering\*\*: Add "Seasonality Vectors" and "Lead Time Curves" to the input.  
\- \[ \] \*\*Training Loop\*\*: Train the model on the \`processed\` dataset.  
\- \[ \] \*\*Validation\*\*: Verify the model correctly predicts high prices for known high-demand dates (e.g., past holidays).

\#\# Phase 3: Operations Bridge  
\- \[ \] \*\*Live Feed\*\*: Connect Daily Snapshots (PMS) for real-time inference.  
