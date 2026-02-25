# SSOT: Autotask Authoritative Fields
# What changed
- Added an `autotask_authoritative` block to `ticket_ssot.payload` to persist manual/authoritative Autotask fields directly from the ticket source.
- Persisted authoritative Autotask fields include:
  - `ticket_number`
  - `ticket_id_numeric`
  - `title`
  - `description`
  - `company_id`
  - `contact_id`
  - `assigned_resource_id`
- Updated SSOT anti-regression merge to anchor top-level `ticket_id` and `title` to authoritative Autotask values when present.
- Updated `/playbook` session payload assembly to prioritize `ssot.autotask_authoritative` for canonical `ticket.id`, `ticket.title`, and `ticket.description`, and to expose `company_id/contact_id/assigned_resource_id` in the ticket payload.

# Why it changed
- These fields are manually configured/verified in Autotask and should be treated as higher-trust than inferred/cross-correlated values.
- Persisting them explicitly in SSOT creates a cleaner architecture: one canonical source in backend cache, then distributed to UI wherever required.
- This reduces unnecessary inference/override logic for values that are already operator-maintained.

# Impact (UI / logic / data)
- UI: No direct visual redesign, but the API payload consumed by the UI now prefers authoritative Autotask values for core ticket identity/title/description.
- Logic: SSOT now carries a dedicated authoritative layer from Autotask instead of relying only on normalized/inferred fields.
- Data: No schema changes (JSONB payload only). New fields are stored inside `ticket_ssot.payload`.

# Files touched
- `apps/api/src/services/prepare-context.ts`
- `apps/api/src/routes/playbook.ts`
- `tasks/todo.md`
- `wiki/changelog/2026-02-25-ssot-autotask-authoritative-fields.md`

# Date
- 2026-02-25
