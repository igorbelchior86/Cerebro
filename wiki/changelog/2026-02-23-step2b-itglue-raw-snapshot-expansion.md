# Step 2B IT Glue Raw Snapshot Expansion
# What changed
Expanded IT Glue collection in Prepare Context to capture a much broader raw organization snapshot before heuristic extraction. The pipeline now stores raw organization documents, document attachments (best-effort), document related items (best-effort), and flexible assets across all asset types (not only hardware-triggered paths), plus partial collection errors for observability.
# Why it changed
Step 2B requires capturing as much IT Glue data as the API permits for the resolved org and persisting raw data in `itglue_org_snapshot` before LLM heuristic extraction. The previous implementation captured only a subset and gated flexible assets by symptom.
# Impact (UI / logic / data)
UI: No direct UI change.
Logic: IT Glue collection now performs broader org retrieval and per-document expansion with partial-failure tolerance (`Promise.allSettled`).
Data: `itglue_org_snapshot.payload` now includes `documents_raw`, `document_attachments_by_id`, `document_related_items_by_id`, and `collection_errors` in addition to existing fields.
# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/clients/itglue.ts
- /Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/prepare-context.ts
# Date
2026-02-23
