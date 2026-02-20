## Lesson: 2026-02-20
**Mistake**: Sidebar showed import time rather than actual ticket creation time.
**Root cause**: `created_at` in `tickets_processed` was populated via DB default/current timestamp during ingestion; list ordering also used `last_updated_at`.
**Rule**: For timeline UI fields, always validate timestamp provenance end-to-end (source extraction -> persistence -> API ordering -> display).
**Pattern**: Any ticket timeline/card/time sort feature must avoid ingestion timestamps unless explicitly requested.

## Lesson: 2026-02-20 (navigation persistence)
**Mistake**: Sidebar UI context (active filter + list position) was lost after selecting a ticket.
**Root cause**: Component-local state was not persisted across route remounts; navigation used default scroll behavior.
**Rule**: For list-detail navigation, persist list UI state (filter/sort/scroll) across route transitions and disable auto-scroll jumps where appropriate.
**Pattern**: Any sidebar/list that navigates to detail routes must retain user context to avoid disorientation.

## Lesson: 2026-02-20 (blink on ticket switch)
**Mistake**: Previous fix preserved sidebar state but still navigated between dynamic routes, so full UI remounted and blinked.
**Root cause**: Persistence of scroll/filter alone does not prevent remount; route transition in `/triage/[id]` remained.
**Rule**: For master-detail ticket navigation, if smooth switching is required, avoid route remount on every selection and switch detail state in-place.
**Pattern**: Use state-driven detail selection + URL sync (`history.replaceState`) when UI continuity is higher priority than route-level remount behavior.

## Lesson: 2026-02-20 (card readability)
**Mistake**: Card layout hid too much of subject and split context into less useful rows.
**Root cause**: Single-line subject truncation and non-optimal information hierarchy.
**Rule**: In compact ticket cards, prioritize subject readability with 2-line clamp and group secondary metadata in one compact row.
**Pattern**: Time on left + org/requester on right improves scanability without increasing card height too much.

## Lesson: 2026-02-20 (title vs description boundary)
**Mistake**: Card sometimes displayed `Title + Description` concatenated as title.
**Root cause**: Parser title regex stopped at newline only, but some templates place `Description:` on same line/HTML flow.
**Rule**: Parse structured email fields with explicit marker boundaries, not only newline boundaries.
**Pattern**: `Title` extraction must stop at next known marker (`Description`, `Created by`, etc.).

## Lesson: 2026-02-20 (middle-column parity)
**Mistake**: Session timeline was too generic and lacked pipeline granularity from mock/template.
**Root cause**: UI was driven by short translation strings instead of stage-oriented message composition.
**Rule**: For pipeline UIs, represent each processing stage explicitly and include sub-steps where available.
**Pattern**: Build deterministic timeline from flow sections (`evidence`, `diagnosis`, `validation`, `playbook`) and keep user messages appended.

## Lesson: 2026-02-20 (explicit parity fields)
**Mistake**: Timeline first item remained generic and did not preserve source-specific narrative required by mockup.
**Root cause**: Stage generator lacked ticket-context interpolation (title/requester/org/site/priority).
**Rule**: For parity-driven UI fixes, reproduce required fields literally before expanding to broader improvements.
**Pattern**: Header and first pipeline event must always include concrete ticket identity + issue narrative.

## Lesson: 2026-02-20 (description noise)
**Mistake**: Raw ticket descriptions still included signatures/disclaimers/reply tails after basic normalization.
**Root cause**: Normalization handled formatting noise but not semantic noise blocks common in email flows.
**Rule**: Email-derived description fields require block-level cleanup (reply/disclaimer/signature) plus safety fallback.
**Pattern**: Apply deterministic text-cleaning pipeline at ingestion, not only at UI render time.

## Lesson: 2026-02-20 (layout jitter)
**Mistake**: UI still shifted vertically/horizontally during ticket switches despite state persistence fixes.
**Root cause**: Conditional mount/unmount of right panel and variable header row geometry.
**Rule**: For master-detail navigation, keep core columns mounted and reserve header control space to avoid reflow.
**Pattern**: Prefer `visibility:hidden` for optional badges and ellipsis-constrained titles in fixed-height headers.

## Lesson: 2026-02-20 (polling jitter)
**Mistake**: Even with layout stabilization, polling still rebuilt timeline with fresh timestamps, causing visual movement.
**Root cause**: Message array changed every polling cycle due to new Date timestamps and unconditional setMessages.
**Rule**: In polling UIs, update message timelines only on semantic state changes, not on polling ticks.
**Pattern**: Use deterministic timestamps + content signature guard + no auto-scroll on periodic refresh.

## Lesson: 2026-02-20 (PrepareContext rundown)
**Mistake**: Timeline item 2 appeared only conditionally and could disappear for some completed tickets.
**Root cause**: Rendering depended strictly on evidence pack presence.
**Rule**: Key pipeline milestones required by UX must render deterministically with data-driven enrichment and safe fallbacks.
**Pattern**: Always render PrepareContext stage; enrich details from pack when available.

## Lesson: 2026-02-20 (real vs generic source crossing)
**Mistake**: PrepareContext steps looked factual but were assembled from static/generic templates.
**Root cause**: UI labels were derived from shallow pack fields instead of explicit provenance records per source.
**Rule**: If the UI claims data was crossed, pipeline must emit auditable source findings (`queried`, `matched`, and summary/details) from actual calls.
**Pattern**: Add a `source_findings` contract in evidence payload and let UI render it first, with legacy fallback only for old tickets.

## Lesson: 2026-02-20 (iterative crossing vs linear)
**Mistake**: Source crossing was effectively linear and did not revisit systems after enrichment.
**Root cause**: Pipeline aggregated one-pass outputs without explicit multi-round refinement model.
**Rule**: For triage correlation, model the flow as iterative rounds and store chronology (`round`) in provenance records.
**Pattern**: Intake anchors -> source pass -> enriched terms -> historical pass -> refinement pass, then UI reflects the same sequence.

## Lesson: 2026-02-20 (history source regression)
**Mistake**: Sidebar history endpoint was narrowed to one table and dropped legacy session data from the UI.
**Root cause**: List API coupled to ingestion source (`tickets_processed`) instead of canonical session history.
**Rule**: Ticket list endpoints must aggregate all authoritative history sources and dedupe by ticket identity.
**Pattern**: Merge + normalize + sort strategy in API before rendering list-based navigation UIs.

## Lesson: 2026-02-20 (home route auth fetch)
**Mistake**: Same endpoint behaved differently across pages because one route omitted credentials.
**Root cause**: Inconsistent fetch options between triage detail and triage home implementations.
**Rule**: Any session-protected API call must always include `credentials: include` on frontend.
**Pattern**: Centralize or standardize fetch config for shared endpoints to prevent silent empty states.

## Lesson: 2026-02-20 (schema drift + stale process)
**Mistake**: Introduced query dependency on new column without guaranteeing migration rollout across all running DBs/processes.
**Root cause**: Mixed schema versions + detached API process still running old code path.
**Rule**: For evolving schemas, make read paths backward-compatible and always verify against live running process after deploy/restart.
**Pattern**: `information_schema` capability check + explicit stack restart + live endpoint assertion.

## Lesson: 2026-02-20 (best-source precedence for historical payloads)
**Mistake**: Sidebar read model preferred stale/low-quality fields from legacy evidence payload over cleaner processed ticket data.
**Root cause**: No data-quality precedence policy in merge layer.
**Rule**: In merged read models, prioritize highest-quality parsed source and fallback only when missing.
**Pattern**: processed ticket fields > sanitized pack fields > hard fallback.

## Lesson: 2026-02-20 (fallback precedence bug)
**Mistake**: Added raw fallback source but forgot to include it in title precedence.
**Root cause**: Merge policy implemented partially across fields.
**Rule**: When introducing a new fallback source, apply it consistently to every displayed field.
**Pattern**: validate by asserting a known edge pair (valid session-only ticket vs noisy one).

## Lesson: 2026-02-20 (requester semantics)
**Mistake**: Mapped requester to ticket creator (`Created by`) even when text clearly identified a different affected user.
**Root cause**: Extraction logic optimized for metadata field, not business meaning.
**Rule**: For requester in UI, prioritize requested-for/affected user from ticket narrative before creator metadata.
**Pattern**: `request from X` > salutation name > `Created by` fallback.

## Lesson: 2026-02-20 (playbook pipeline blocked by schema drift)
**Mistake**: PrepareContext and ingestion persistence assumed `tickets_processed.company` exists, breaking pipeline when DB migration wasn't applied.
**Root cause**: Read/write paths were not equally backward-compatible across evolving schema.
**Rule**: Any schema extension must include compatibility guards in all critical pipeline stages (ingest + prepare + list).
**Pattern**: Runtime column capability check + fallback projection/query branch.

## Lesson: 2026-02-20 (integration split-brain + evidence drift)
**Mistake**: Integration health UI used workspace credentials from DB, but PrepareContext runtime used process env credentials; diagnosis/playbook also over-weighted weak priors and missing-data failures.
**Root cause**: Credential source paths were not unified across runtime stages; LLM prompts lacked strict grounding constraints against high-risk inference drift.
**Rule**: For every external integration, all runtime consumers must read from the same tenant/workspace credential source as the health endpoint; missing integration data must stay as data gap unless ticket-scoped evidence says otherwise.
**Pattern**: Shared credential resolver + evidence guardrail checks (diagnosis/playbook) with deterministic fallback when unsupported narratives appear.

## Lesson: 2026-02-20 (partial capability vs total failure in IT Glue)
**Mistake**: Treated IT Glue runbooks endpoint `404` as total IT Glue outage in PrepareContext.
**Root cause**: Single-call failure in one IT Glue capability (`/documents`) was mapped to whole-stage failure.
**Rule**: Integration collection must degrade gracefully per capability (runbooks/docs/configs/contacts), not fail-all on one endpoint.
**Pattern**: classify endpoint-specific errors, continue with remaining data sources, and emit granular `source_findings` instead of broad `missing_data` failure.
## Lesson: 2026-02-20 (tooling freeze on direct shell DB path)
**Mistake**: Attempted operational DB cleanup using `psql` + `source .env`, which failed/hung in this environment.
**Root cause**: Assumed `psql` availability and `.env` shell-safe formatting; both assumptions were false.
**Rule**: For this repo, prefer project-native Node/TS scripts (`tsx` + existing DB module) over direct shell DB tooling unless availability is confirmed first.
**Pattern**: Before DB ops, validate tool availability (`which psql`) or skip directly to app-native query path.
## Lesson: 2026-02-20 (zero-score device fallback contamination)
**Mistake**: Device resolver accepted `ninjaOrgDevices[0]` even when correlation score was zero.
**Root cause**: Fallback policy optimized for continuity, not evidentiary correctness.
**Rule**: Candidate resolution must never promote a zero-confidence fallback into confirmed evidence.
**Pattern**: If top score < minimum threshold, persist explicit unresolved state (`missing_data`) and stop propagation to digest/playbook.
## Lesson: 2026-02-20 (do not ask for confirmation when user reports concrete bug)
**Mistake**: I offered "if you want, I can fix now" after a direct bug report.
**Root cause**: Communication default slipped into optional mode instead of autonomous execution mode.
**Rule**: When user reports a concrete defect, execute fix immediately and only report progress/outcome.
**Pattern**: Bug report -> root cause -> patch -> verify -> report. No confirmation prompt in-between.

## Lesson: 2026-02-20 (manual reprocess without env causes fallback homogenization)
**Mistake**: Reprocessed tickets with a standalone script that did not load `.env`, forcing diagnose/playbook to `rules-fallback` and producing near-identical outputs.
**Root cause**: Operational script bypassed API bootstrap/runtime environment loading assumptions.
**Rule**: Any manual/offline reprocess path must explicitly load production-equivalent env and record model provenance per step.
**Pattern**: If multiple tickets suddenly share generic playbooks, verify `llm_outputs.model` before analyzing prompt quality.

## Lesson: 2026-02-20 (provider contract must be explicit during manual reprocess)
**Mistake**: Reprocessed tickets with provider drift (Groq) while operational expectation was Gemini.
**Root cause**: Manual script relied on ambient env/default provider instead of explicit provider override per run.
**Rule**: For manual ticket reprocessing, always force `LLM_PROVIDER` explicitly and verify persisted `llm_outputs.model` afterward.
**Pattern**: Any mismatch between expected and observed playbook style should trigger immediate provider provenance check.

## Lesson: 2026-02-20 (target file precision under user pressure)
**Mistake**: Validei paridade no `new.html` em vez do componente real do projeto (`apps/web`).
**Root cause**: Assumi o arquivo citado anteriormente como fonte de verdade sem reconfirmar o alvo de implementação no app.
**Rule**: Em tarefas de paridade visual, sempre validar primeiro o componente renderizado na rota real antes de usar arquivos de referência estáticos.
**Pattern**: "mock/reference file" != "runtime component"; localizar binding real (`page` -> `component`) antes de concluir análise.
