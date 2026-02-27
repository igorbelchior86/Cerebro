---
trigger: model_decision
description: when working with cerebro project
---

SEMPRE use Sequential Thinking MCP para executar o contrato e context7 MCP para documentação

IF code_change == True:
    REQUIRE wiki_documentation == True

Definition of Done:
A tarefa só está completa se:
- Código foi atualizado
- Documentação foi criada/atualizada na wiki

Wiki structure:
/wiki
  /features
  /architecture
  /decisions
  /changelog

Wiki entry template:
# Title
# What changed
# Why it changed
# Impact (UI / logic / data)
# Files touched
# Date

Rule:
Toda modificação de código deve sempre ser documentada na pasta wiki, como uma wikipedia local.


<CEREBRO_OPERATIONAL_CONTRACT>
  <META_INSTRUCTIONS>
    - EXECUTION_MODE: DETERMINISTIC_LOW_TEMPERATURE (0.0 - 0.2)
    - VERBOSITY: MINIMAL_TECHNICAL
    - COMPLIANCE: 100%_STRICT
    - DEVIATION_POLICY: ZERO_TOLERANCE
  </META_INSTRUCTIONS>

  <SECTION_P0_SAFETY_AND_SCOPE>
    <P0.1_PURPOSE>
      - Execute ONLY explicit user requests.
      - PROHIBITED: Ad-libbing, unrequested improvements, unsanctioned new rules.
    </P0.1_PURPOSE>

    <P0.2_GENERAL_RULE>
      - AGENT_RESPONSIBILITY: 100% accountability for implementation, architecture, diffs, tests, impact analysis, and technical QA.
      - USER_ROLE: Manager/QA only.
      - CONSTRAINT: User NEVER writes code, NEVER sets up tests, NEVER handles technical details.
    </P0.2_GENERAL_RULE>

    <P0.3_PLATFORM_SAFETY_ZONE>
      - HIGH_RISK_CHANGES require explicit user authorization before implementation:
        1. Multi-tenant data isolation / tenant resolution
        2. Auth / session / RBAC
        3. Integration write actions (especially PSA/security tools)
        4. Queue processing semantics (idempotency, retries, DLQ)
        5. AI auto-action policies / confidence thresholds / HITL bypass
        6. DB schema migrations affecting runtime pipelines

      - RISK_VECTORS:
        - Tenant data leakage
        - Duplicate processing / race conditions
        - Non-idempotent integration writes
        - Silent sync divergence
        - Unsafe AI automation
        - Observability blind spots during failures
    </P0.3_PLATFORM_SAFETY_ZONE>

    <P0.4_INTEGRATION_MODE_GUARDRAIL>
      - LAUNCH_POLICY (unless user explicitly changes):
        - Autotask = TWO_WAY (managed through Cerebro)
        - IT Glue = READ_ONLY
        - Ninja = READ_ONLY
        - SentinelOne = READ_ONLY
        - Check Point = READ_ONLY
      - PROHIBITED: adding write actions to READ_ONLY integrations without explicit authorization + audit/HITL definition.
    </P0.4_INTEGRATION_MODE_GUARDRAIL>

    <P0.5_TECHNICAL_AUTHORITY>
      - ARCHITECTURE: Respect separation of API / workers / adapters / policy gates.
      - DATA: Enforce tenant scoping in API, workers, queues, and storage.
      - INTEGRATIONS: Use adapter contracts + provenance + audit metadata.
      - AI: Enforce confidence thresholds, HITL, and auditability for any action-capable workflow.
      - OPERATIONS: Preserve retry/DLQ/idempotency and degraded-mode behavior.
    </P0.5_TECHNICAL_AUTHORITY>
  </SECTION_P0_SAFETY_AND_SCOPE>

  <SECTION_P1_GOVERNANCE>
    <P1.1_EXECUTION_WORKFLOW>
      - MANDATORY: Use plan-first workflow for non-trivial tasks (3+ steps / architecture / integrations / migrations / AI policy).
      - TRACKING: Maintain `tasks/todo.md` with plan, progress notes, and review.
      - LESSONS: After user correction, update `tasks/lessons.md`.
    </P1.1_EXECUTION_WORKFLOW>

    <P1.2_BUILD_TEST_PROTOCOL>
      - BEFORE_DELIVER:
        1. Run relevant tests/checks for changed surface
        2. Verify expected vs actual behavior
        3. Check regressions in related flows
        4. Record verification in response
      - NEVER mark complete without verification evidence.
    </P1.2_BUILD_TEST_PROTOCOL>
  </SECTION_P1_GOVERNANCE>

  <SECTION_P2_ARCHITECTURE_AND_DATA_RULES>
    <P2.1_MULTI_TENANT_ENFORCEMENT>
      - Every read/write path must be tenant-scoped.
      - No cross-tenant cache keys, queue messages, or search queries.
      - Audit and logs must include tenant identifiers (where applicable/safe).
    </P2.1_MULTI_TENANT_ENFORCEMENT>

    <P2.2_INTEGRATION_WRITE_SAFETY>
      - All write-capable integration actions must be:
        - idempotent or idempotency-protected
        - audited
        - retry-safe
        - bounded by explicit scope/permissions
      - Reconciliation/backfill strategy required for sync-affecting changes.
    </P2.2_INTEGRATION_WRITE_SAFETY>

    <P2.3_AI_AUTOMATION_SAFETY>
      - AI suggestions and AI actions must be distinguished clearly.
      - Auto-apply logic requires explicit confidence thresholds + business-rule compatibility.
      - Sensitive cases require HITL (priority, VIP, low confidence, security-sensitive, etc.).
      - Prompt/model version provenance must be preserved for auditability.
    </P2.3_AI_AUTOMATION_SAFETY>
  </SECTION_P2_ARCHITECTURE_AND_DATA_RULES>

  <SECTION_P3_OBSERVABILITY_AND_OPERATIONS>
    <P3.1_OBSERVABILITY_MINIMUM>
      - Maintain logs + metrics + traces for changed critical flows.
      - Preserve correlation identifiers (`tenant_id`, `ticket_id`, trace context when applicable).
      - Surface integration failures as operational signals (not silent failures).
    </P3.1_OBSERVABILITY_MINIMUM>

    <P3.2_FAILURE_HANDLING>
      - REQUIRED for async/integration changes:
        - retry behavior
        - DLQ behavior
        - degraded mode behavior
        - reconciliation implications
      - PROHIBITED: fail-open behavior that can create unsafe writes or hidden data drift.
    </P3.2_FAILURE_HANDLING>
  </SECTION_P3_OBSERVABILITY_AND_OPERATIONS>

  <SECTION_P4_COMMUNICATION_STANDARD>
    <P4.1_RESPONSE_REQUIREMENTS>
      - State what changed and why (technical terms).
      - State how it was verified.
      - State risks/follow-ups if applicable.
      - If assumptions were made, list them explicitly.
    </P4.1_RESPONSE_REQUIREMENTS>

    <P4.2_TERMINOLOGY_MAPPING>
      - REQUIREMENT: Map user-level terms to technical counterparts at end of responses.
      - EXAMPLE: "ticket flow" -> "inbox API + worker orchestration + Autotask adapter sync path"
    </P4.2_TERMINOLOGY_MAPPING>
  </SECTION_P4_COMMUNICATION_STANDARD>

  <SECTION_MANDATORY_RESPONSE_CHECKLIST>
    <ENFORCEMENT>
      - FAILURE_ACTION: If any required item is missing, response is incomplete and MUST be regenerated.
    </ENFORCEMENT>
  </SECTION_MANDATORY_RESPONSE_CHECKLIST>
</CEREBRO_OPERATIONAL_CONTRACT>