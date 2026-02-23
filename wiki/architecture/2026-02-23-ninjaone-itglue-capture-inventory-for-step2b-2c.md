# NinjaOne and IT Glue Capture Inventory for Step 2B/2C
# What changed
Created a research-backed capture inventory for IT Glue and NinjaOne before continuing Step 2C implementation. The document confirms IT Glue capabilities and limits from official docs, inventories NinjaOne categories/endpoints from public Postman/API docs alternatives, compares them against the current `NinjaOneClient`, and marks implementation gaps for the `Prepare Context` capture contract.
# Why it changed
The Step 2B/2C contract requires knowing all capturable data first and only then implementing capture. Previous implementation work was too incremental and risked missing important resources.
# Impact (UI / logic / data)
UI: No direct UI change.
Logic: Establishes the required source-of-truth checklist for expanding IT Glue/NinjaOne collection.
Data: Defines the target breadth for `itglue_org_snapshot` and the upcoming `ninja_org_snapshot` capture.
# Files touched
- /Users/igorbelchior/Documents/Github/Cerebro/wiki/architecture/2026-02-23-ninjaone-itglue-capture-inventory-for-step2b-2c.md
# Date
2026-02-23

## Scope
- Contract alignment for `Prepare Context` Step `2b` (IT Glue) and Step `2c` (NinjaOne)
- Inventory first, implementation second

## IT Glue (Official) - Confirmed

### Official Source
- `https://api.itglue.com/developer/`

### Confirmed platform constraints (official)
- `page[size]` maximum is `1000` (explicitly documented)
- Rate limit is `3000 requests` within a `5-minute window` (HTTP `429` on throttle)

### Confirmed resource coverage relevant to our capture contract (official resource list)
- `Attachments`
- `Documents`
- `Related Items`
- `Configurations`
- `Passwords`
- `Flexible Asset Types`
- `Flexible Assets`
- `Locations`
- `Domains`
- `SSL Certificates`
- `Organizations`
- `Contacts`

### Notes for Step 2B capture strategy
- Use org-scoped retrieval whenever available.
- Respect throttling and pagination (`page[size]` up to 1000, but avoid max-by-default unless needed).
- `Attachments` and `Related Items` are first-class resources in IT Glue docs, so they must be included in the snapshot plan (not treated as optional nice-to-have).

## NinjaOne (Alternative Public Sources) - Research Inventory

### Sources used (public)
- Postman public docs/collection page for `NinjaOne Public API 2.0` (official NinjaOne workspace on Postman)
- NinjaOne public `apidocs` links referenced from that Postman page (`app/eu/oc.ninjarmm.com/apidocs`)
- NinjaOne “Public API Operations” page (broken/incomplete as catalog, but confirms intended docs path and usage pattern)

### What is reliably confirmed from the public Postman docs page
- Collection exists publicly and is maintained (`NinjaOne Public API 2.0`)
- Region-specific API doc links are referenced:
  - NA core docs
  - EU core docs
  - OC core docs
- OAuth 2.0 auth model is used for collection requests
- At least these folders/categories are visible on the public docs page:
  - `api/v2`
  - `alerts`
  - `organizations`
  - `webhook`
- Confirmed requests/examples visible on page:
  - `GET /api/v2/alerts`
  - `DELETE /api/v2/alert/:uid`
  - `POST /api/v2/alert/:uid/reset`
  - `GET /api/v2/organizations`
  - `GET /api/v2/organizations-detailed`

### What is additionally indicated by public snippets / API docs mirrors (lower confidence than full collection export)
- Device-focused endpoints exist for:
  - device details
  - activities
  - alerts
  - last logged-on user
  - network interfaces
  - software inventory
  - disk/storage/processor info
  - windows services
  - patching reports/history/pending patches
  - custom fields
  - jobs / active jobs
  - policy override summary
  - device link / scripting options
- Organization and documentation-related resources exist (NinjaOne’s own “Public API Operations” example references organization and document IDs in URL paths)

## Current `NinjaOneClient` Coverage (Local Code)

### Implemented methods (current)
- `getDevice`
- `listDevices`
- `listDevicesByOrganization`
- `getDeviceChecks`
- `getDeviceDetails`
- `getDeviceLastLoggedOnUser`
- `listLastLoggedOnUsers` (query)
- `getDeviceActivities`
- `getDeviceNetworkInterfaces`
- `querySoftware` (query endpoint)
- `listOrganizations`
- `getOrganization`
- `listAlerts`

### Coverage assessment vs Step 2C capture goal
- Good baseline for:
  - org list + org detail
  - device inventory
  - alerts
  - selected device telemetry (details/activities/interfaces/checks/user)
- Missing for broad “capture everything possible” snapshot:
  - `organizations-detailed` (org + locations/policy mappings)
  - per-device software inventory endpoint (not just global query)
  - disk/storage volumes
  - processors
  - windows services
  - patch reports/history/pending/rejected endpoints
  - device custom fields
  - device-specific triggered alerts endpoint(s)
  - device job endpoints
  - policy override summary
  - device link / scripting options
  - (potentially) org-scoped docs/folders/documents endpoints if available in public API 2.0
  - pagination coverage normalization for endpoints that return cursors/pages

## Gaps to close before finalizing Step 2C

### Gap A - NinjaOne API inventory fidelity
- We still need a full endpoint list from the public Postman collection export (best) or authenticated apidocs catalog (fallback).
- Current public page scraping confirms categories and examples but not full request matrix.

### Gap B - `NinjaOneClient` breadth
- Add missing read-only endpoints above in a controlled way.
- Standardize pagination/cursor handling for high-volume resources.

### Gap C - `ninja_org_snapshot` contract
- Define snapshot sections explicitly before implementation:
  - `organization`
  - `organization_detailed`
  - `devices`
  - `alerts`
  - `selected_device`
  - `selected_device_details`
  - `selected_device_checks`
  - `selected_device_network_interfaces`
  - `selected_device_activities`
  - `selected_device_last_logged_on_user`
  - `selected_device_software_inventory`
  - `selected_device_patching`
  - `selected_device_hardware_storage_cpu`
  - `selected_device_services`
  - `custom_fields`
  - `jobs`
  - `collection_errors`

### Gap D - Rate/volume strategy
- Need endpoint-level page/cursor strategy and throttling for NinjaOne (official limits not yet confirmed from a reliable public source in this research pass).

## Execution Rule (Next)
- Do not finalize Step `2c` implementation until the NinjaOne endpoint inventory is completed (preferably from exported Postman collection JSON).
