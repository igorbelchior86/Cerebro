# IT Glue Generic Extractors And Org Matching Hardening
# What changed
- Added a generic deterministic IT Glue extraction slice to `PrepareContext`:
  - WAN/ISP candidate extraction from IT Glue assets/configs/docs
  - Infra candidate extraction from IT Glue password metadata/configs/assets (firewall / WiFi / switch)
  - IT Glue document ranking by ticket intent (e.g., onboarding/install/network relevance)
- Threaded `itgluePasswords` and `itglueAssets` into iterative enrichment builders so network/infra sections can use broader IT Glue evidence without relying only on LLM enrichment.
- Hardened `fuzzyMatch` to normalize punctuation and legal suffixes (`LLC`, `Inc`, etc.) and use token-overlap matching, improving org resolution for IT Glue/Ninja without client-specific rules.
- Added `blocked_reason` to `ticket_context_appendix.history_correlation` type for contract alignment with actual appendix payloads.

# Why it changed
- The observed failure pattern was broader than a single org: IT Glue clearly had relevant WAN/password/doc data, but the pipeline was not extracting/promoting it into the SSOT.
- Org matching was also brittle (punctuation/legal suffix mismatch), causing `org match: none` despite the organization existing in IT Glue.
- The goal is a reusable extraction model, not hardcoded fixes for `CAT Resources, LLC`.

# Impact (UI / logic / data)
- UI: More SSOT-backed context fields (especially `isp_name`, `wifi_make_model`, `firewall_make_model`) can now populate when IT Glue contains metadata clues.
- Logic: Prepare Context now leverages a broader evidence surface from IT Glue (WAN assets + password metadata + ranked docs) before falling back to weak keyword inference.
- Data: Evidence pack doc ordering becomes more ticket-intent-aware; org matching should succeed more often for punctuation/suffix variants.

# Files touched
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/api/src/services/prepare-context.ts`
- `/Users/igorbelchior/Documents/Github/Cerebro/tasks/todo.md`
- `/Users/igorbelchior/Documents/Github/Cerebro/tasks/lessons.md`

# Date
- 2026-02-23
