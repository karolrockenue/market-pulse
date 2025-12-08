\# Changelog

All notable changes to the Sentinel Training Hub will be documented in this file.

\#\# \[Unreleased\]  
\#\#\# Planned  
\- Build \`etl\_pipeline.py\` to normalize Raw Reservation Exports.  
\- Create \`Unified Reservation Schema\` definition.  
\- Implement \`health\_check.py\` for raw JSON/CSV validation.

\#\# \[0.1.0\] \- 2025-12-06  
\#\#\# Added  
\- \*\*Project Blueprint v2.0\*\*: Shifted architecture to "Global Brain \+ Local Specialist".  
\- \*\*Data Strategy\*\*: Adopted "Daily Grain" granularity (splitting reservations into single nights).  
\- \*\*Market Intelligence\*\*: Added Codex Snapshot integration for market compression signals.

\#\#\# Removed  
\- \*\*Random Forest\*\*: Deprecated the V1 Random Forest approach in favor of Neural Networks.  
\- \*\*Snapshot Training\*\*: Removed dependency on daily snapshots for \*training\* (now used for operations only).  
