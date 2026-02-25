## Lesson: 2026-02-24 (gutter vs modular separation)
**Mistake**: Interpretei o pedido de “gutter” abaixo da hora/toggle como apenas espaçamento interno, sem destacar a seção inteira como um módulo separado.
**Root cause**: Foco excessivo no token visual (`gap`) e pouco na semântica estrutural do screenshot (seções destacadas por wrappers independentes, como colunas).
**Rule**: Quando o usuário comparar com separação entre colunas/painéis, implementar separação modular real (wrappers/containers distintos + vão), não apenas `margin`/`spacer`.
**Pattern**: Para pedidos de “destacar seção” em layouts bento/panel-based, validar se há mudança de contorno/agrupamento estrutural e não só distância entre elementos.

## Lesson: 2026-02-24 (screenshot parity requires geometry tuning)
**Mistake**: Mesmo após separar em módulos, mantive geometria muito tímida (gap/raio/padding), ainda distante da leitura visual do screenshot alvo.
**Root cause**: Assumi que a semântica estrutural por si só seria suficiente, sem calibrar magnitude visual dos espaços e raios.
**Rule**: Quando o usuário fornece screenshot de referência e pede “exatamente isso”, validar também a intensidade visual (gap, padding, border-radius), não só a estrutura.
**Pattern**: Em UI parity, aplicar correção em 2 fases: (1) semântica estrutural; (2) tuning geométrico fino para equivalência perceptiva.

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

## Lesson: 2026-02-20 (resizable right pane blocked by child fixed width)
**Mistake**: Painel direito parecia não redimensionar dinamicamente.
**Root cause**: O filho (`PlaybookPanel`) tinha largura fixa (`360px`), sobrescrevendo a largura do container redimensionável.
**Rule**: Em colunas resizables, componentes filhos devem usar `width: 100%` e respeitar constraints do parent.
**Pattern**: `fixed child width` dentro de pane resizable gera falsa sensação de resize quebrado.

## Lesson: 2026-02-20 (scope under-reported: issue affected all 3 panes)
**Mistake**: Foquei inicialmente na sidebar esquerda, mas o padrão de reconstrução estava no ciclo de polling da página inteira (left/main/right).
**Root cause**: Diagnóstico inicial ficou local (componente) e não no fluxo completo (route polling + backend trigger loop).
**Rule**: Para sintomas de reconstrução frequente, auditar sempre o pipeline end-to-end (frontend polling + endpoint behavior + merge rules), não só o componente visível.
**Pattern**: Re-render em múltiplas seções geralmente indica fonte de dados/polling compartilhada, não bug isolado de UI.

## Lesson: 2026-02-20 (meaningful != stable)
**Mistake**: Gate only blocked `Unknown` regressions but still allowed swapping between two meaningful variants (raw noisy vs normalized clean).
**Root cause**: Merge logic lacked quality ranking/tie-breakers for semantically equivalent fields.
**Rule**: SSOT merge must be monotonic by field quality, not only by non-empty checks.
**Pattern**: For polled multi-source ticket fields, use deterministic quality scoring + tie-breaks to prevent text flapping.

## Lesson: 2026-02-21 (fix local isolado não resolve split-brain de payload)
**Mistake**: Corrigi sintomas em partes (ordenação/lista/snapshot) sem eliminar completamente o caminho concorrente de metadados entre sidebar e center.
**Root cause**: O center continuava derivando campos críticos da lista da sidebar em vez de um payload canônico único do backend para o ticket atual.
**Rule**: Em bugs de oscilação por polling, só considerar resolvido quando houver uma única fonte canônica por etapa (`ticket > pipeline > llm > ui > cache`) sem caminhos paralelos para os mesmos campos.
**Pattern**: Se duas seções mostram o mesmo dado e divergem por segundos, existe split-brain de leitura; corrigir no contrato de resposta e no consumidor, não apenas no render.

## Lesson: 2026-02-21 (pipeline-ou-nada must fail fast end-to-end)
**Mistake**: Kept residual fallback-oriented runtime helpers/tests after the user explicitly mandated "pipeline ou nada".
**Root cause**: Partial migration to fail-fast left legacy fallback artifacts in code paths and naming, creating ambiguity and regression risk.
**Rule**: Under explicit no-fallback policy, all diagnose/playbook stages must either produce provider-backed outputs or set session `failed` with explicit error provenance.
**Pattern**: If `llm_outputs.model` can still contain `*fallback*`, contract is violated; audit services + tests + runtime reprocess path immediately.

## Lesson: 2026-02-21 (bulk reprocess scripts must load production-equivalent env)
**Mistake**: First bulk reprocess run executed without dotenv bootstrap, causing false-negative pipeline failures (`GEMINI_API_KEY not set`).
**Root cause**: Ad-hoc operational script imported orchestrator directly without app bootstrap environment loading.
**Rule**: Any direct TSX orchestration script must load `.env` (or run through already bootstrapped API runtime) before invoking pipeline services.
**Pattern**: Bulk reset/reprocess => bootstrap env first, then audit status/model for each ticket.

## Lesson: 2026-02-21 (quota/rate-limit is retriable, not terminal)
**Mistake**: Transient LLM provider failures (quota 429 / limiter) were marked as `failed` terminal sessions.
**Root cause**: Pipeline catch blocks classified all exceptions as terminal.
**Rule**: Provider transient failures must map to retriable status (`blocked`), while keeping `pipeline ou nada` (no fallback artifacts).
**Pattern**: `RESOURCE_EXHAUSTED`/`429`/limiter/timeout => `blocked`; deterministic validation/logic errors => `failed`.

## Lesson: 2026-02-21
**Mistake**: Checklist generation was not explicitly bound to all material hypotheses, causing action plans to drift to generic H1-only steps.
**Root cause**: Prompt contract between diagnosis and playbook lacked mandatory mapping and no post-generation alignment gate.
**Rule**: When model output depends on ranked hypotheses, enforce explicit hypothesis tags and validate coverage before accepting output.
**Pattern**: Any `top_hypotheses` -> procedural plan flow needs deterministic coverage checks.

## Lesson: 2026-02-21
**Mistake**: Assumed Gemma 3 27B usage via Groq without confirming the actual provider path in this deployment.
**Root cause**: Provider/model mapping was inferred from code defaults instead of explicitly aligning with user runtime setup.
**Rule**: When user names model + platform (e.g. Gemma in AI Studio), configure the exact provider path first, then tune limiter on that path.
**Pattern**: Multi-provider adapters require explicit provider confirmation before quota/rate-limit changes.

## Lesson: 2026-02-23 (assumed DB access)
**Mistake**: Requested user to provide DB access details even though the project has a default connection string.
**Root cause**: I tried to query with a missing/invalid `DATABASE_URL` instead of falling back to the built-in default.
**Rule**: If the repo includes a default DB connection string, use it before asking the user for access.
**Pattern**: When `DATABASE_URL` causes auth errors, retry with the repo default and only ask if that fails.

## Lesson: 2026-02-24 (table detection vs table perception)
**Mistake**: Declared "table detection/rendering fixed" before validating how it looked in the actual UI screenshot.
**Root cause**: I verified formatter logic in isolation but underweighted two real-world factors: over-splitting on roster role phrases (`Business Development`, `Williams Marketing`) and missing explicit table styling in `MarkdownRenderer`.
**Rule**: For formatting/rendering fixes, verify both the generated markdown structure and the visual presentation layer (`renderer + CSS`) against a real ticket screenshot before marking done.
**Pattern**: "Rendered data structure exists" != "user perceives correct UI"; always validate perception-critical changes end-to-end.

## Lesson: 2026-02-24 (clean display semantics vs pipeline semantics)
**Mistake**: Initially treated `text_clean` as both pipeline-clean text and UI-formatted output.
**Root cause**: I optimized for reusing the existing field instead of separating concerns between machine-parsable normalization and technician-facing presentation.
**Rule**: When the UI requires rich formatting (especially LLM-authored markdown), persist a dedicated display field/format flag and keep pipeline-clean text semantically plain.
**Pattern**: Canonical parsing text and display markdown should be separate artifacts (`canonical` vs `display`), with explicit format metadata.

## Lesson: 2026-02-24 (LLM formatter guard should recover before degrading UX)
**Mistake**: A first pass at blocking LLM paraphrase risk could over-degrade `Clean` back to plain text.
**Root cause**: Validation existed, but there was no intermediate strict-retry formatting step to preserve formatting quality while enforcing verbatim text.
**Rule**: For LLM formatting transforms, implement `candidate -> validate -> strict retry -> validate -> plain fallback`.
**Pattern**: If user feedback says "formatting was good, only text changed", keep the formatting path and tighten the wording contract instead of collapsing to plain fallback.

## Lesson: 2026-02-24 (verbatim guard must tolerate formatting labels)
**Mistake**: The verbatim guard still rejected good rich formatting because it expected near-exact text after markdown stripping.
**Root cause**: Rich formatting can legitimately add a small number of structural words (headers/labels), which looked like drift to a strict equality-style validator.
**Rule**: For rich-format validation, use high source-token coverage + low novel-token ratio (with a formatting-word allowlist), not near-exact equality.
**Pattern**: Guard false negatives show up as "no formatting at all" because the system silently falls back to plain text.

## Lesson: 2026-02-24 (separate LLM tasks by intent)
**Mistake**: I asked one normalization prompt to both reinterpret (`description_ui`) and produce verbatim-rich formatting (`description_display_markdown`).
**Root cause**: Mixed objectives in the same LLM response increased the chance of semantic bleed/paraphrase in the display field.
**Rule**: When two outputs have conflicting transformation goals (reinterpret vs format-only), use separate LLM calls with dedicated prompts.
**Pattern**: `canonical cleanup` and `display formatting` are distinct tasks; coupling them creates avoidable drift.

## Lesson: 2026-02-24 (format-only prompt can still over-constrain formatting)
**Mistake**: The strict formatter prompt prohibited adding any labels/headings, which prevented the simple rich formatting the user actually wanted.
**Root cause**: I optimized for verbatim preservation but accidentally removed the model's ability to add minimal structure (`Request`, `Signature`).
**Rule**: For format-only prompts, allow minimal generic structural labels while forbidding semantic rewrites.
**Pattern**: "No new words" is too strict for rich formatting; prefer "no new facts / no paraphrase" plus minimal structural labels.

## Lesson: 2026-02-24 (prompt needs explicit consistency rules for repeated structures)
**Mistake**: Similar onboarding tickets (Phase 1 vs Phase 2) produced inconsistent formatting because the prompt did not strongly prefer tables for repeated person rosters.
**Root cause**: I relied on generic "use tables when helpful" language instead of encoding a concrete trigger and fallback behavior.
**Rule**: For recurring ticket shapes (e.g. onboarding user rosters), specify an explicit formatting trigger (`3+ person-like rows => table`) and an ambiguity-safe fallback (`Name | Details`) in the prompt.
**Pattern**: If one example formats correctly and another similar one does not, the prompt lacks deterministic structure guidance.

## Lesson: 2026-02-23 (refresh must be hard reset, not UI-only)
**Mistake**: Implemented refresh that reset UI/session artifacts but still allowed org-level caches to repopulate pipeline outputs.
**Root cause**: Hard refresh semantics were incomplete (did not clear IT Glue org caches) and button UX did not match expectation.
**Rule**: Any user-facing 'refresh pipeline' action must explicitly define and enforce cache invalidation scope needed for true pipeline restart.
**Pattern**: If pipeline output reappears immediately after refresh, audit upstream caches (`*_snapshot`, `*_enriched`) and invalidate at ticket/org scope.

## Lesson: 2026-02-23 (manual refresh restart needs race guards + UI cache invalidation)
**Mistake**: Even after creating a new triage session on refresh, stale data still reappeared in the UI.
**Root cause**: Two surviving cache/race paths remained: (1) older background sessions could still repersist ticket-level artifacts (`ticket_ssot` / ticket artifacts), and (2) frontend local snapshot/poll responses were not invalidated during hard refresh.
**Rule**: For manual pipeline restart, protect ticket-scoped artifact persistence against superseded sessions and explicitly invalidate frontend local caches/in-flight polling responses.
**Pattern**: If refresh creates a new session but old data returns, check both async writer races (old session persisting global-by-ticket artifacts) and client-side memo/snapshot state.

## Lesson: 2026-02-23
**Mistake**: Considerei o fluxo atual como aderente sem validar o contrato detalhado do Prepare Context (2a..2f).
**Root cause**: Auditoria orientada por semelhança narrativa, não por especificação funcional exata.
**Rule**: Quando o usuário define contrato operacional detalhado, validar aderência item a item antes de concluir “ok”.
**Pattern**: Pipeline multi-fonte com LLM exige checagem por artefato persistido (snapshot, enriched, SSOT UI), não só por nomes de serviços.

## Lesson: 2026-02-23 (fix aplicado no código, mas runtime não recarregado)
**Mistake**: Declarei o toggle `Clean` como corrigido sem confirmar que o frontend em execução estava servindo o bundle atualizado.
**Root cause**: Validei source + typecheck, mas não validei runtime process/hot-reload para a tela real usada pelo usuário.
**Rule**: Em bug de UI “continua igual”, após patch e typecheck, verificar processo runtime (`:3000`) e reiniciar antes de marcar como resolvido.
**Pattern**: `code fixed + data exists + user still sees old UI` => checar bundle/runtime stale (Next dev/prod process) antes de reabrir backend investigação.

## Lesson: 2026-02-23 (reframed summary can invert ticket roles)
**Mistake**: Aceitei uma reinterpretação que atribuiu o nome do requester ao affected user em um ticket de "new employee".
**Root cause**: A normalização 2a priorizava resumo curto, mas sem guard explícito de papéis (requester vs affected user) quando o ticket fala de terceiro não nomeado.
**Rule**: Em `description_ui`, nunca usar `requester_name` como affected user sem evidência explícita; em onboarding/third-party requests, manter o affected user como "name not provided" quando ausente.
**Pattern**: Frases como "we have a new employee... he will need..." + assinatura do requester exigem guard de role assignment pós-LLM.

## Lesson: 2026-02-23 (history without scope pollutes Prepare Context)
**Mistake**: O 2e retornou casos históricos de outras empresas quando `org` ficou `unknown`.
**Root cause**: A busca ampla de histórico fazia fallback no tenant inteiro sem exigir boundary de escopo (org/company) e o filtro posterior de org não protegia quando o alvo também era `unknown`.
**Rule**: Histórico só pode retornar related cases com escopo confiável (`orgId` ou `companyName`); sem escopo, bloquear a correlação e registrar o motivo.
**Pattern**: `org=unknown` + `related_cases > 0` em ambiente multi-tenant quase sempre indica contaminação cross-company.

## Lesson: 2026-02-23 (SSOT cannot regress known intake fields)
**Mistake**: O SSOT final saiu com `company=unknown` e outros campos básicos degradados, apesar de a sidebar (intake) já possuir valores corretos.
**Root cause**: O builder do SSOT aceitava `sections.*` finais como fonte única, sem merge protetivo contra regressão para `unknown`.
**Rule**: Campos conhecidos no intake (empresa, requester, título, descrição, created_at, emails) são baseline; SSOT pode enriquecer, mas não degradar para `unknown`.
**Pattern**: Se sidebar/raw mostra valor e center/right (SSOT) mostra `unknown`, existe regressão de merge no pipeline final.

## Lesson: 2026-02-23 (normalization can remove org clues before org inference)
**Mistake**: A inferência de empresa continuou falhando mesmo com regex melhor, porque o pipeline limpava `rawBody` antes de inferir `company`.
**Root cause**: A ordem das etapas usava narrativa pós-normalização para inferir org/company, perdendo boilerplate útil como “ticket created for <company>”.
**Rule**: Inferência de org/company deve considerar a narrativa original (pré-normalização) além da narrativa limpa.
**Pattern**: Se `text_original` contém empresa e `company=unknown`, verificar mutação prematura do `rawBody`/narrative.

## Lesson: 2026-02-23 (broader extraction problem > client-specific fix)
**Mistake**: A tentação inicial foi corrigir a ausência de ISP/firewall/WiFi olhando um caso específico (CAT) em vez de melhorar a modelagem genérica da extração do IT Glue.
**Root cause**: Foco excessivo em output de um ticket sem formalizar classes de evidência reutilizáveis (WAN assets, password metadata, docs relevantes, alias de org).
**Rule**: Quando um ticket revela dados claros em IT Glue mas SSOT sai `unknown`, corrigir primeiro a capacidade genérica de extrair/normalizar/classificar evidências por tipo — nunca hardcode por org.
**Pattern**: `screenshots show rich ITG data` + `round2 counts zero/unknown` => revisar org resolver + extractors genéricos (WAN/password metadata/doc ranking), não valores específicos do cliente.

## Lesson: 2026-02-23 (false-positive org match can silently nullify enrichment)
**Mistake**: Considerei a extração IT Glue como principal culpada, mas o pipeline estava consultando a org errada (`Composite Resources, Inc.`) para um ticket de `CAT Resources, LLC`.
**Root cause**: Resolver de org usava `find()` sobre lista parcial (`getOrganizations()` default 100) com matching permissivo/fallback por domínio com ruído, permitindo falso positivo por similaridade corporativa.
**Rule**: Resolução de org multi-tenant deve usar inventário amplo (`page[size]=1000` quando suportado), ranking por score (não primeiro match booleano) e penalidade para overlap só em tokens genéricos.
**Pattern**: `SSOT.company correto` + `round2 org match nome diferente` + `ITG passwords/docs/assets = 0` => bug no org resolver, não (apenas) no extractor.

## Lesson: 2026-02-23 (schema assumptions in SQL filters must be runtime-verified)
**Mistake**: O filtro de histórico broad por empresa foi implementado usando `tickets_processed.company`, mas a coluna não existe no schema real.
**Root cause**: Assumi que o campo `company` estava persistido em `tickets_processed` sem confirmar `information_schema`/migrations locais.
**Rule**: Toda nova query SQL que depende de coluna recém-assumida deve ser validada contra o schema real (ou usar fonte já confirmada, ex.: `ticket_ssot.payload`).
**Pattern**: Se `typecheck` passa e o runtime falha com `42703`, revisar suposições de schema imediatamente antes de depurar lógica de negócio.

## Lesson: 2026-02-23 (IT Glue parent org can be valid while UI screenshots come from child org)
**Mistake**: Marquei o match `Composite Resources, Inc.` como incorreto sem validar a relação parent/child no IT Glue.
**Root cause**: Interpretei o nome exibido no snapshot como mismatch, mas o tenant usa `Composite` (parent) e `CAT Resources` (child) com dados distribuídos por recursos diferentes.
**Rule**: Em IT Glue, validar a árvore de organizações (`parent-id` / `ancestor-ids`) antes de concluir que um match é “errado”; screenshots de UI podem estar no child org enquanto o pipeline resolveu o parent.
**Pattern**: `org snapshot name != company display name` + endereços/configs batem => investigar parent/child split e onde cada tipo de dado (passwords/docs/WAN) está armazenado.

## Lesson: 2026-02-24 (IT Glue tenant endpoints and attribute naming must be runtime-probed)
**Mistake**: Tratei `documents_raw: 0` e `passwords: 0` como ausência de dados antes de validar endpoint behavior e shape real do tenant.
**Root cause**: O tenant retornava `404` no endpoint global `/documents` filtrado por org (mas o nested funcionava), e parte da extração lia attrs em `snake_case` enquanto a API devolvia `kebab-case`; além disso erros viravam `[]` em alguns paths.
**Rule**: Em troubleshooting de IT Glue, sempre confirmar endpoint (global vs nested), permissões e naming (`kebab/snake`) com probe real antes de concluir “sem dados”.
**Pattern**: UI mostra dados + snapshot API mostra zeros => verificar primeiro `404/403 masked`, rota nested, e parser de atributos.

## Lesson: 2026-02-24 (multi-scope collection can silently blow API quota without per-round budgets)
**Mistake**: Ampliei a coleta IT Glue para parent+child orgs e flexible assets, mas sem guardrails explícitos de volume por ticket.
**Root cause**: O loop `scope_orgs x flexible_asset_types` multiplicou chamadas rapidamente (centenas por ticket), e a expansão de attachments/related items adicionou mais fan-out.
**Rule**: Toda coleta multi-scope/multi-endpoint precisa de budget por round (request cap), limites de escopo, limites de fan-out e priorização de endpoints/tipos por relevância.
**Pattern**: Se um fix melhora cobertura mas o tenant começa a retornar 429/quota exceeded, revisar imediatamente loops de cartesian product e adicionar request budgets auditáveis no `source_findings`.

## Lesson: 2026-02-24 (LLM fusion output must be schema-valid AND evidence-grounded)
**Mistake**: O pipeline aceitou uma inferência LLM inventada (`internal_hr_system`) e gravou `Alex Hall` no `SSOT` como affected user sem evidência real no ticket/IT Glue/Ninja.
**Root cause**: A sanitização do `fusion` validava formato/schema, mas não validava grounding (`evidence_refs`/`inference_refs`) contra os candidatos/links/inferences realmente gerados pelo pipeline.
**Rule**: Em fusão multi-fonte, saída da LLM só é válida se estiver ancorada em evidências e inferências previamente geradas pelo pipeline; `schema-valid` não basta.
**Pattern**: Se `fusion_audit` menciona sistemas/fatos não presentes nos candidates (`internal_hr_system`, etc.), a validação pós-LLM está frouxa.

## Lesson: 2026-02-24 (UI consistency requires shared SSOT-derived display semantics, not just shared payload)
**Mistake**: Sidebar e center/right consumiam dados do mesmo ticket, mas exibiam “User” com semânticas diferentes (`requester` vs `affected_user`), criando split-brain visual.
**Root cause**: Cada superfície tinha sua própria precedence/fallback para o campo exibido, sem uma regra comum derivada do SSOT.
**Rule**: Se a UI diz usar SSOT, cada rótulo visual (ex.: `User`) precisa de uma regra única e compartilhada de derivação a partir do SSOT.
**Pattern**: `sidebar user != right panel user` pode ser bug de semântica/fallback mesmo quando ambos “usam SSOT” parcialmente.

## Lesson: 2026-02-24 (contamination guards need domain-safe allowability, not broad keyword bans)
**Mistake**: O `PlaybookWriter` bloqueava playbooks legítimos de troubleshooting por regex ampla (`debug`, `api response`) no contamination guard.
**Root cause**: Os padrões foram escritos para bloquear vazamento meta de LLM/engine, mas sem considerar que termos como `API response` e `debug logs` são comuns em playbooks operacionais.
**Rule**: Guards anti-contaminação devem bloquear contexto meta explícito (`LLM/model/prompt/json response`) e evitar palavras genéricas usadas em troubleshooting técnico.
**Pattern**: Falha consistente no `PlaybookWriter` com `Validation=approved` e `last_error=contamination guard blocked` => verificar regex overbroad antes de culpar PrepareContext/Diagnose.

## Lesson: 2026-02-24 (SSOT anti-regression must preserve display-critical intake formatting, not only non-unknown semantics)
**Mistake**: O `company` do ticket regrediu visualmente após processamento (ex.: nome colapsado/normalizado) porque o merge do SSOT só bloqueava `unknown`, não versões “significativas” porém piores que o intake.
**Root cause**: `applyIntakeAntiRegressionToSSOT` usava `pickBetter` baseado apenas em `unknown`, permitindo que variantes processadas do mesmo nome substituíssem a forma canônica do intake.
**Rule**: Campos de display críticos vindos do intake (`company`, `requester`) devem preservar a forma bruta canônica quando disponível; anti-regressão precisa proteger também contra regressão de formatação/qualidade, não só `unknown`.
**Pattern**: UI correta logo após reset e piora após `Prepare Context` => verificar se o SSOT está sobrescrevendo valor de intake com variante semântica degradada.

## Lesson: 2026-02-24 (company extraction from HTML emails must decode entities before regex matching)
**Mistake**: A inferência de empresa caiu para fallback de domínio (`Garmonandcompany`) mesmo com a frase correta “created for GARMON & CO. INC.” presente no email do Autotask.
**Root cause**: O parser aplicava regex no HTML cru com entidades (`&amp;`), e os padrões de empresa não toleravam a sequência codificada; isso quebrava a captura e ativava o fallback por domínio.
**Rule**: Sempre decodificar entidades HTML básicas antes de regex semânticos em texto de email (`company`, `requester`, etc.).
**Pattern**: Empresa correta visível em email HTML + SSOT mostra versão derivada do domínio => suspeitar de `&amp;`/entities quebrando regex de extração.

## Lesson: 2026-02-24 (background pipeline failures must persist last_error, not only status)
**Mistake**: `/playbook/full-flow` background processing marcava sessões como `failed`/`pending` sem salvar `last_error`, deixando a UI mostrar `FAILED` sem causa.
**Root cause**: O catch de `triggerBackgroundProcessing()` atualizava apenas `status` e `updated_at`.
**Rule**: Todo path que muda `triage_sessions.status` para erro/retry deve persistir a mensagem em `last_error`.
**Pattern**: Ticket em `FAILED` após refresh com `triage_sessions.last_error = null` => verificar catch/background route fora do orquestrador principal.

## Lesson: 2026-02-24 (playbook evidence guardrails should block assertive unsupported drift, not incidental mentions)
**Mistake**: O playbook de um ticket de WiFi foi bloqueado por `unsupported inference` mesmo com `Prepare Context`, `Diagnose` e `Validation` corretos.
**Root cause**: `shouldBlockPlaybookOutput` tratava qualquer menção a termos high-risk (ex.: `malware`) sem evidência como bloqueante, inclusive quando apareciam de forma incidental/defensiva no texto.
**Rule**: Guardrail de playbook deve bloquear deriva **assertiva/perigosa** (root cause/compromise/remediação de incidente) sem evidência, não menções incidentais que não redefinem o caso.
**Pattern**: `last_error = Playbook guardrail blocked unsupported inference` em tickets operacionais/rede => revisar heurística de "high-risk drift" para contexto/assertividade.

## Lesson: 2026-02-24 (don’t over-prescribe rollout strategy in a non-production codebase)
**Mistake**: Propus rollout paralelo/gradual como se houvesse ambiente de produção ativo para a Fase 3.
**Root cause**: Assumi restrições de deploy típicas sem validar o estágio real do produto (ainda em desenvolvimento).
**Rule**: Antes de recomendar estratégia de rollout, confirmar se o app está em produção; em ambiente de desenvolvimento, priorizar implementação direta + validação em tickets reais.
**Pattern**: Usuário corrige “sem produção” => reduzir overhead de rollout e acelerar implementação.
## Lesson: 2026-02-24 (UI Unknown with timeline-known value is often SSOT completeness breach, not a UI fallback issue)
**Mistake**: Diagnostiquei o card `Phone Provider = Unknown` como problema de fallback/binding da UI para fontes diferentes, mesmo após o usuário reforçar que a UI deve consumir exclusivamente SSOT.
**Root cause**: Eu foquei no sintoma visual (timeline mostra valor, card não) e propus mitigação na UI antes de validar o contrato arquitetural: se o pipeline sabe o dado, ele deve ser promovido ao SSOT.
**Rule**: Em campos de UI de contexto (`user/company/provider/device`), discrepância entre superfícies não deve ser corrigida com fallback na UI; primeiro tratar como falha de promoção/completude do SSOT.
**Pattern**: Timeline/evento operacional menciona valor inferido e card SSOT mostra `Unknown` => investigar `PrepareContext`/merge para SSOT, não adicionar fallback em `page.tsx`.

## Lesson: 2026-02-24 (intake classification must be queue-actionability-first, not semantic-label-first)
**Mistake**: Eu inicialmente classifiquei os exemplos por semântica (`bounce`, `marketing`, `digest`) como se isso resolvesse a triagem, mas para a fila todos eram noise/gibberish.
**Root cause**: Modelei o problema como taxonomia de conteúdo bruto, não como gate de acionabilidade operacional da fila.
**Rule**: No Playbook Brain intake, a primeira classificação deve ser `actionable vs non-actionable (gibberish)`; subtipos semânticos só entram como camada secundária para auditoria/UX.
**Pattern**: Se a pergunta do usuário menciona economia de API e medo de falso positivo, priorizar `queue-actionability` + `abstenção`, não taxonomia semântica de email.

## Lesson: 2026-02-24 (UI controls need visual QA after functional delivery)
**Mistake**: Entreguei o botão de filtro/supressão funcionalmente correto, mas não fiz uma segunda passada de polish visual suficiente para o ícone/controle no contexto real da UI.
**Root cause**: Foco excessivo em comportamento e segurança operacional (`Suppress > Delete`) sem revisar o acabamento visual dos controles de ação no header.
**Rule**: Após mudanças de UI com ícones/botões compactos, sempre fazer uma passada de QA visual (proporção, peso do traço, padding, contraste) antes de considerar “done”.
**Pattern**: Feedback curto do usuário tipo “esse ícone está horrível” normalmente aponta para proporção/legibilidade, não para fluxo/arquitetura.

## Lesson: 2026-02-24 (visual feedback requests require clearly perceptible changes, not subtle polish)
**Mistake**: Interpretei "esse ícone está horrível" como pedido de polish incremental e entreguei uma mudança visual sutil demais, que o usuário percebeu como "zero mudanças".
**Root cause**: Não calibrei a severidade do feedback visual; para crítica forte de UI, o usuário espera uma alteração claramente perceptível no elemento central (glyph), não apenas container/hover.
**Rule**: Quando o usuário rejeitar um ícone explicitamente, trocar o glyph de forma evidente primeiro; depois ajustar acabamento.
**Pattern**: Feedback "zero mudanças" após UI polish = o problema principal continua no símbolo/forma, não nos detalhes de borda/sombra.

## Lesson: 2026-02-24 (diagnose metadata consumers must treat missing fields as legacy-compatible)
**Mistake**: No `ValidatePolicyService`, tratei `playbook_anchor_eligible` ausente como `false`, fazendo diagnósticos antigos parecerem "sem âncora" e degradando status/validação sem motivo.
**Root cause**: Assumi presença universal de metadata nova da Fase 3, ignorando compatibilidade com payloads legados e fixtures de teste.
**Rule**: Ao integrar campos opcionais novos no pipeline (`Diagnose -> Validate -> Playbook`), ausência do campo deve ter comportamento compatível explícito (ex.: `anchorEligible = true` por default para legado).
**Pattern**: Introdução de metadata opcional + queda inesperada de testes "happy path" => revisar defaults de compatibilidade antes de mexer em thresholds.

## Lesson: 2026-02-24 (risk gates need real-world destructive verb coverage, not only abstract patterns)
**Mistake**: O novo gate de ação destrutiva não bloqueou o caso de teste “Factory reset the firewall...” porque o matcher não incluía `factory reset`.
**Root cause**: Cobertura de regex focada em verbos genéricos (`delete`, `disable`, `wipe`) sem considerar frases operacionais comuns de MSP/network.
**Rule**: Ao implementar guardrails de remediação destrutiva, incluir vocabulário operacional concreto (`factory reset`, `reset firewall`, etc.) e validar com exemplos reais de linguagem de técnico.
**Pattern**: Teste de risco falha com `status=approved` quando deveria bloquear => antes de mexer em lógica de status, revisar cobertura lexical do matcher.

## Lesson: 2026-02-24 (prompt-only contracts are not real contracts)
**Mistake**: O `PlaybookWriter` já descrevia uma boa estrutura no prompt, mas o validador de estrutura só dava `warn`, então a Fase 5 podia sair sem `Escalation`/`Checklist`/`Hypotheses` consistentes.
**Root cause**: Dependência excessiva na obediência da LLM ao prompt, sem gate determinístico pós-geração.
**Rule**: Quando o usuário define um contrato de saída (ex.: seções do playbook), transformar em validação determinística + repair automático antes de aceitar o output.
**Pattern**: “A seção está no prompt mas não é garantida” => adicionar validator que falha/testa o contrato, não só instrução textual.

## Lesson: 2026-02-24 (numbered references must be anchored to the same list)
**Mistake**: Interpretei "now 3 and 4" como referência aos "next steps" mais recentes em vez de aos findings numerados da auditoria, apesar do contexto imediato ainda estar ancorado na lista de findings.
**Root cause**: Eu não confirmei explicitamente qual lista numerada estava ativa quando havia múltiplas listas numeradas no contexto recente (findings, next steps, plan steps).
**Rule**: Quando o usuário usa referências numéricas curtas ("1 and 2", "3 and 4"), mapear primeiro para a última lista explicitamente discutida; se houver ambiguidade real, citar as opções antes de assumir.
**Pattern**: Conversa com múltiplas listas numeradas + resposta curta do usuário => responder com mapeamento explícito ("you mean findings X/Y") antes de propor novo trabalho.

## Lesson: 2026-02-24 (UI wording can hide code-scope requirements)
**Mistake**: Interpretei "remove the reframed" como remoção apenas da opção visual do toggle, quando o usuário queria remover o conceito/campo do código-base.
**Root cause**: Eu ancorei na screenshot/UI e executei o menor patch visual sem validar se "entirely from the codebase" era o escopo real do termo.
**Rule**: Quando o usuário pede remover algo nomeado (ex.: `Reframed`) e mostra UI, confirmar/remover também o modelo de dados/campos associados, não só o controle visual.
**Pattern**: Solicitação de UI + termo de domínio/campo explícito => procurar referências globais (`rg`) antes de limitar o patch ao componente.
## Lesson: 2026-02-24 (display anti-regression can freeze low-quality intake fallbacks if provenance is ignored)
**Mistake**: A correção anterior de anti-regressão para `company` preservava `ticket.company` de forma incondicional quando não era `unknown`, mantendo nomes degradados derivados de domínio na UI.
**Root cause**: O anti-regressão tratava todo valor de intake como canônico sem distinguir valor real de empresa vs fallback heurístico de domínio.
**Rule**: Campos de display críticos devem preservar intake somente quando o intake for de alta qualidade; se o valor tiver padrão de fallback por domínio, ele deve poder ser substituído por nome inferido/display-ready.
**Pattern**: `company` continua com string colada tipo `Garmonandcompany` após correção de SSOT => verificar anti-regressão/proveniência, não apenas extração HTML.

## Lesson: 2026-02-24 (prefer local UI override when backend semantics are derived-only)
**Mistake**: Na primeira proposta para "incluir manualmente nos filtrados", eu puxei a solução para um modelo de filtro + overrides mais amplo do que o pedido imediato.
**Root cause**: Foquei na semântica de produto antes de otimizar por menor impacto técnico/UX para o caso real do usuário.
**Rule**: Quando o backend fornece um estado derivado (ex.: supressão automática calculada) e o usuário pede um controle manual pontual, avaliar primeiro um override local e explícito na UI antes de redesenhar o modelo.
**Pattern**: Usuário responde com "tenho uma ideia mais simples" => reduzir escopo, reaproveitar fluxo existente e evitar acoplamento desnecessário com backend.

## Lesson: 2026-02-24 (manual suppression is operational control, not only UI categorization)
**Mistake**: Entreguei supressão manual como MVP frontend-only, tratando o pedido como categorização visual e não como controle operacional de pipeline.
**Root cause**: Não alinhei a intenção econômica/operacional implícita (evitar processamento e gasto de token) com a semântica de "suprimido".
**Rule**: Quando um estado afeta triagem/processamento (ex.: `suppressed`), assumir persistência backend + enforcement de execução por padrão, a menos que o usuário peça explicitamente algo apenas visual.
**Pattern**: Usuário questiona "não deveria evitar pipeline/token?" => faltou guardar/checar estado no backend e adicionar guard no worker/orchestrator.

## Lesson: 2026-02-24 (sidebar list queries must anchor on source-of-truth inbox table, not processing sessions)
**Mistake**: A lista `/email-ingestion/list` ancorava em `triage_sessions`, então tickets manualmente suprimidos antes de qualquer sessão desapareciam totalmente da sidebar (inclusive do contador de suprimidos).
**Root cause**: Modelei a sidebar como "tickets com sessão" em vez de "tickets do inbox", mas o novo fluxo de supressão manual atua em `tickets_processed` e pode ocorrer antes do pipeline.
**Rule**: Se a UI representa o inbox de tickets, a query deve ancorar em `tickets_processed`; dados de pipeline (`triage_sessions`, `evidence_packs`, `ticket_ssot`) entram como joins opcionais.
**Pattern**: Filtro toggle não revela itens e contador não bate após ação backend em ticket ainda não processado => verificar se a query base exclui itens sem sessão/artefatos.

## Lesson: 2026-02-24 (don’t render high-confidence UI structures from low-confidence text parsing)
**Mistake**: Transformei linhas heurísticas de onboarding em cards visuais “bonitos”, mas o parsing ainda era impreciso; a UI passou sensação de estrutura confiável com dados errados/ambíguos.
**Root cause**: Priorizei impacto visual antes de calibrar confiança semântica da extração local.
**Rule**: Quando a extração é heurística e parcial, usar disclosure + tabela compacta + sinalização explícita de “heuristic parse”, mantendo o texto limpo como fonte principal.
**Pattern**: Feedback “ficou horrível/confusing” em UI derivada de texto => reduzir ornamentação, diminuir peso visual e rebaixar a extração para camada secundária.

## Lesson: 2026-02-24 (when UX trust breaks, prefer simple readable formatting over clever parsing UI)
**Mistake**: Mesmo após simplificar para disclosure/tabela, eu ainda mantive uma camada de parsing heurístico visível em um contexto onde o usuário queria apenas legibilidade de email body.
**Root cause**: Continuei tentando “salvar” a ideia de extração visual em vez de aceitar o pedido real: formatting simples e previsível.
**Rule**: Se o usuário pedir explicitamente “simples email body formatting”, remover parsing visual/estruturas derivadas e focar em parágrafos + listas + assinatura.
**Pattern**: Reação forte negativa a iterações de UI (“tudo isso uma merda”) => reset para baseline simples e confiável antes de qualquer refinamento.
