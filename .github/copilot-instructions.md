# SEMPRE use Sequential Thinking MCP para executar o contrato e context7 MCP para documentação

<OPERATIONAL_CONTRACT>
  <META_INSTRUCTIONS>
    - EXECUTION_MODE: DETERMINISTIC_LOW_TEMPERATURE (0.0 - 0.1)
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

    <P0.3_FINANCIAL_CORE_SACRED_ZONE>
      - MODIFICATION_LOCK: NO changes allowed without:
        1. Explicit User Authorization.
      
      - SACRED_COMPONENTS:
        - A) GastosCore (Logic): `UnifiedBalanceEngine.swift`, `BudgetEngine.swift`, Models (`Transaction`, `Budget`, `RecurrenceRule`).
        - B) GastosData (Parsing): `DTOs/`, `AppBootstrapRepository.swift`.
        - C) GastosApp (Bootstrap): `AppStore.swift` (`startDate`, `startBalanceMinor`).
        - D) Recurrence (Logic): `RecurrenceExpander.swift`.
      
      - RISK_VECTORS: Date errors, cent precision loss, history projection invalidation, off-by-one recurrence errors.
    </P0.3_FINANCIAL_CORE_SACRED_ZONE>

    <P0.4_SACRED_ZONE_WORKFLOW>
      1. DETECT impact on Sacred Zone.
      2. EXECUTE Golden Tests pre-change.
      3. PROVIDE rigorous technical justification.
      4. EXECUTE Golden Tests post-change.
    </P0.4_SACRED_ZONE_WORKFLOW>

    <P0.5_TECHNICAL_AUTHORITY>
      - COMPLIANCE: Strict adherence to `GastosAI-Technical-Authority.md`.
      - ARCHITECTURE: Respect Package boundaries and persistence rules defined in Section E1.
      - LOGIC: Maintain business logic parity with the reference JS implementation as mandated in Section E3.
    </P0.5_TECHNICAL_AUTHORITY>
  </SECTION_P0_SAFETY_AND_SCOPE>

  <SECTION_P1_GOVERNANCE>
    <P1.1_BUILD_CYCLE_PROTOCOL>
      - COMMAND: `scripts/build-and-run.sh`
      - EXECUTION_LOOP:
        WHILE (BUILD == FAIL) { FIX -> TEST }
        IF (BUILD == OK) { DELIVER }
    </P1.1_BUILD_CYCLE_PROTOCOL>
  </SECTION_P1_GOVERNANCE>

  <SECTION_P2_COMMUNICATION_STANDARD>
    <P2.1_TERMINOLOGY_MAPPING>
      - REQUIREMENT: Map every user-level term to its technical counterpart at the end of responses.
      - EXAMPLE: "bottom menu" -> "UITabBar / HomeTabRoot.swift".
    </P2.1_TERMINOLOGY_MAPPING>
  </SECTION_P2_COMMUNICATION_STANDARD>

  <SECTION_P3_REFACTORABLE_ZONE>
    <REFACTOR_SCOPE>
      - DEFINITION: UI/UX shell ONLY.
      - CONDITION: Refactor permissible ONLY IF Sacred Zone tests retain 100% pass rate.
    </REFACTOR_SCOPE>

    <COMPONENTS>
      - A) GastosDesign: Spacing, colors, animations, visuals.
      - B) GastosSwiftUI: `HomeTabRoot`, `ContentView`, `PanoramaSheet`, ViewModels.
    </COMPONENTS>

    <P3.2_DESIGN_SYSTEM_ENFORCEMENT>
      - MANDATE: Absolute compliance with `GastosAI-Design-LiquidGlass.md`.
      - PROTOCOLS: Follow `<SECTION_D2_SHEET_PROTOCOL_MANDATORY>` for all UI changes.
      - VALIDATION: Every UI response MUST include the Design System validation statement defined in `SECTION_D4` of the design document.
    </P3.2_DESIGN_SYSTEM_ENFORCEMENT>
  </SECTION_P3_REFACTORABLE_ZONE>

  <SECTION_P4_VERSION_CONTROL>
    <P4.1_VERSION_FORMAT>
      - KEY: `CFBundleShortVersionString` = `MAJOR.MINOR.BUILD` (Target: GastosApp).
      - KEY: `CFBundleVersion` = `BUILD_INTEGER`.
    </P4.1_VERSION_FORMAT>

    <P4.2_INCREMENT_LOGIC>
      - MAJOR: User-explicit decision ONLY (Data breaking/Redesign).
      - MINOR: New features, flow changes, business logic behavior shifts. (MINOR++, BUILD=0).
      - BUILD: Bugfixes, visuals, refactors, UX polish, performance. (BUILD++).
    </P4.2_INCREMENT_LOGIC>

    <P4.3_MANDATORY_VERSIONING_ACTION>
      1. CLASSIFY change type before implementation.
      2. UPDATE app version strings in code.
      3. REPORT: "App Version: X.Y.Z -> A.B.C (Reason)".
      4. CONSTRAINT: NEVER reduce version. One increment per logical change package.
    </P4.3_MANDATORY_VERSIONING_ACTION>
  </SECTION_P4_VERSION_CONTROL>

  <SECTION_MANDATORY_RESPONSE_CHECKLIST>
    <ENFORCEMENT>
      - FAILURE_ACTION: If any item is missing, the response is NULL and MUST be regenerated.
    </ENFORCEMENT>
  </SECTION_MANDATORY_RESPONSE_CHECKLIST>
</OPERATIONAL_CONTRACT>
