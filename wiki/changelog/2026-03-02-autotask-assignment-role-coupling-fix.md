# Autotask Assignment Role Coupling Fix
# What changed
- Updated `apps/api/src/services/orchestration/autotask-ticket-workflow-gateway.ts` to enforce assignment role coupling required by Autotask.
- Added helper resolution logic:
  - Parse explicit role (`assigned_resource_role_id` / `assignedResourceRoleID`) when provided.
  - Fallback to resource metadata lookup (`getResource(resourceId).defaultServiceDeskRoleID`).
- Applied this logic to all relevant write handlers:
  - `create`
  - `assign`
  - `legacy_update`
- Added/updated tests in `apps/api/src/__tests__/services/autotask-ticket-workflow-gateway.test.ts` for role auto-inclusion on create/assign.

# Why it changed
- New Ticket / Primary Tech assignment was failing with Autotask 500:
  - `Data violation: When assigning a Resource, you must assign both a assignedResourceID and assignedResourceRoleID.`
- Payload was sending resource id without the coupled role id.

# Impact (UI / logic / data)
- UI: Primary tech selection no longer fails due to missing assignment role coupling.
- Logic: Gateway now guarantees provider-required pair for assignment writes.
- Data: No schema/API version changes; write payload completeness improved.

# Files touched
- apps/api/src/services/orchestration/autotask-ticket-workflow-gateway.ts
- apps/api/src/__tests__/services/autotask-ticket-workflow-gateway.test.ts

# Date
- 2026-03-02
