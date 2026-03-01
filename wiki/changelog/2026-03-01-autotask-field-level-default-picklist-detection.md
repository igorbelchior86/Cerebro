# Autotask Field-Level Default Picklist Detection
# What changed
- Updated `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/clients/autotask.ts` so ticket picklist parsing now detects defaults not only from item-level booleans (`isDefault`, `isDefaultValue`, etc.), but also from field-level metadata such as `defaultValue`, `defaultPicklistValue`, `defaultValueId`, and similar variants.
- When the field metadata exposes a default identifier, the parser now marks the matching option as `isDefault`, allowing the frontend draft prefill logic to consume the real provider default.

# Why it changed
- The user reported that Autotask shows `Status`, `Priority`, `SLA`, and `Queue` with defaults, but Cerebro was not auto-loading the SLA default.
- The most likely mismatch was that Autotask published the default for SLA at the field level, while Cerebro only inspected per-option flags.

# Impact (UI / logic / data)
- UI: The New Ticket draft can now auto-select the real Autotask SLA default when the provider exposes it via field metadata.
- Logic: Default detection for ticket picklists is now more faithful to Autotask metadata semantics.
- Data: No persistence/schema change; this is metadata interpretation only.

# Files touched
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/clients/autotask.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/tasks/todo.md`
- `/Users/igorbelchior/Documents/Github/Cerebro/tasks/lessons.md`

# Date
- 2026-03-01
