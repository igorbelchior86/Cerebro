# Diagnostic Logs: Problem + Cause

## [T20260218.0014] - Identity, Prompt Leakage & Hallucination

### 1. Account Name Discrepancy (Andrew Sells vs. GARMON\ASells)
- **Problem**: Sidebar shows the domain username instead of the human name, and LLM fails to reconcile them.
- **Cause**: The `prepare-context.ts` service extracts the "last logged in user" directly from NinjaOne/RMM properties (as `GARMON\ASells`). While the LLM normalization correctly identifies "Andrew Sells" from the ticket, the `EntityResolution` logic does not have a high-confidence link to bridge these two formats. The LLM then mentions the "discrepancy" in hypotheses instead of resolving it because it lacks the proof that they are the same individual.

### 2. Hallucinated "GoTo Connect" Steps
- **Problem**: Checklist includes VoIP/GoTo Connect steps for a non-VoIP case.
- **Cause**: The `technologyFacets` detection in `prepare-context.ts` uses a regex `/\bgoto(\s?connect)?\b/i`. If the ticket narrative contains the phrase "go to" or similar, it triggers a false positive for the "GoTo Connect" facet. This facet then injects "Validate VoIP registration" into the `EvidencePack` as a candidate action, which the LLM blindly incorporates into the playbook.

### 3. Prompt Leakage in Hypothesis Cards
- **Problem**: Hypothesis cards and resolution steps contain internal prompt instructions like "Hypothesis Mapping Rule".
- **Cause**: The `PlaybookWriterService` prompt is overly dense with instructional headers. The LLM is echoing the "MANDATORY" instructions (headers) back into the output stream. This occurs because the prompt does not sufficiently distinguish between "Instructions describing the format" and "Content describing the case," causing the model to treat the rules as section headers for the final Markdown.

### 4. Hypothesis Card "Gibberish"
- **Problem**: Resolution steps like "[H3] Step 8: Addresses the need for thorough documentation" appear at the end.
- **Cause**: The repair logic in `PlaybookWriterService` (lines 80-90) triggers if alignment fails. The model, attempting to force alignment in a second pass, creates "low-value" steps just to satisfy the constraint that "[H3] must be actioned," resulting in generic filler content.

### 5. Inconsistent Company Name in Sidebar
- **Problem**: Left sidebar is correct, right sidebar context is wrong.
- **Cause**: The Left Sidebar (Session context) pulls from the `triage_sessions` DB entry (initialized during intake). The Right Sidebar (Context section) pulls from the `EvidencePack.org` or `IterativeEnrichment` sections, which are populated during `PrepareContext`. If `PrepareContext` enriches the name from a different source (like IT Glue's formal name vs. Autotask's display name) and doesn't normalize back to the Session's "canonical" name, the UI displays two different strings for the same entity.

---

## [T20260218.0017] - Precision Erosion & Template Overlap (The "Outlook/Gmail" Hallucination)

### 1. Hallucinated Uncertainty (Generalization Bias)
- **Problem**: Ticket explicitly mentions "Microsoft365", but checklist includes generic options like "Outlook, Gmail, etc."
- **Cause**: **Precision Erosion**. The LLM is suffering from a "Generalization Bias" where it defaults to a broader troubleshooting template (likely influenced by general support training or enriched generic docs) instead of strictly anchoring to the `technologyFacets` provided.
- **Root Logic Failure**: The `PlaybookWriterService` treats the detected tech context ("Microsoft 365") as *supplementary* rather than *restrictive*. When the LLM generates the checklist, it views "Outlook, Gmail" as helpful alternatives in case the "Microsoft365" mention was imprecise, effectively re-introducing uncertainty that the user already resolved in the intake.

### 2. Modality Mismatch (Call Request vs. Asynch Instruction)
- **Problem**: Ticket asks for a "Call to help troubleshoot," but the checklist gives a passive instruction ("Instruct user to...").
- **Cause**: The `DiagnoseService` and `PlaybookWriterService` lack a **Communication Modality Anchor**. Even though the phone number is extracted, the "Samurai" style focus on "wooden/specific" technical steps causes the model to prioritize the *fix* over the *engagement method*. The system does not "force" the first step to be the requested action (CALL) because it treats contact info as metadata, not as a command.

---

## [T20260218.0019] - Context Contamination & Hallucinated Tech (Lily & GPO)

### 1. Title Degradation (Description-as-Title)
- **Problem**: Sidebar title uses a snippet of the description instead of the original ticket title.
- **Cause**: **Over-normalization**. In `prepare-context.ts`, the `normalizeTicketForPipeline` method (LLM-based) is allowed to overwrite the technical title provided by Autotask. If the LLM generates a "more readable" title by summarising the first few lines of the description, it destroys the structured metadata of the original ticket.

### 2. Context Leakage (Lily & Laptop Quotes)
- **Problem**: Playbook mentions a user ("Lily"), researched laptop options, and quotes—none of which belong to this ticket.
- **Cause**: **Unbounded Historical Context**. The `findRelatedCases` logic pulls historical `approved` sessions based on loose keyword matches. These results are injected into the `DiagnoseService` prompt under a flat `### Related Cases` header.
- **Root Logic Failure**: The LLM fails to maintain a strict boundary between "Current Evidence" and "Historical Reference". Because the prompt doesn't explicitly warn that "Past Cases are for inspiration only and must not be used for entity/action mapping," the model "hallucinates" that these past entities (Lily) and actions (Quotes) are part of the current workflow.

### 3. Hallucinated "Group Policy" (GPO) Hypotheses
- **Problem**: Checklist suggests investigating GPO for a simple email application issue.
- **Cause**: **Knowledge Base Overfitting**. When the `DiagnoseService` lacks strong specific evidence (due to poor enrichment), it defaults to a "Sophisticated Guess" (GPO). Because GPO is a common cause for "overriding behavior" in enterprise environments, the model injects it as a generic [H3] to satisfy the requirement of having multiple hypotheses, even when the tech facets for the current ticket don't support it.

---

## [T20260219.0005] - Disambiguation Leakage & Step Redundancy

### 1. Entity Disambiguation Leakage
- **Problem**: Playbook lists multiple internal names (Jelithza Duque, Andrea Legarda) that weren't the requester.
- **Cause**: **Disambiguation Question Inclusion**. When `EntityResolution` fails to match the requester perfectly (status: `ambiguous`), the `disambiguation_question` containing the list of all IT Glue contacts for that organization is passed to the LLM. The LLM, attempting to be helpful, includes all these candidate names in Step 1 ("Contact Diego, Maggie, Jelithza or Andrea to confirm...") instead of filtering for the most likely requester.

### 2. Step Redundancy & Duplication
- **Problem**: "Research Cell Booster Options" recommended twice.
- **Cause**: **Constraint Satisfaction Failure**. The `Hypothesis Mapping Rule` in the writer prompt forces at least one step per hypothesis. If the model determines that H3 is a specific issue (e.g. Signal Strength) but can only think of one actionable step, it will repeat that step with slight variations just to satisfy the instruction to "Map checklist steps to hypotheses" and meet the length requirement.

### 3. Persistent VoIP/GoTo Hallucination
- **Problem**: VoIP validation in an Outlook case.
- **Cause**: **GoTo Regex Over-triggering**. (Repeated finding) The regex `/\bgoto(\s?connect)?\b/i` is too sensitive and triggers on common phrases like "go to the portal," leading the system to believe a VoIP tech stack is involved.



