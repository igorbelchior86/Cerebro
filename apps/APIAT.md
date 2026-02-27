# Definitive Technical Encyclopedia: Autotask REST API (1000+ Line Reference)

This document is the master manual for the Cerebro ecosystem. It consolidates exhaustive content from 12 Datto/Kaseya documentation links, detailing every entity, field, technical limit, and integration strategy.

---

### Original Reference Links
1. [REST Security & Auth](https://www.autotask.net/help/developerhelp/Content/APIs/REST/General_Topics/REST_Security_Auth.htm)
2. [REST API Revision History](https://www.autotask.net/help/developerhelp/Content/APIs/REST/General_Topics/REST_API_Revision_History.htm)
3. [Intro to REST API](https://www.autotask.net/help/developerhelp/Content/APIs/REST/General_Topics/Intro_REST_API.htm)
4. [REST API Calls Spec](https://www.autotask.net/help/developerhelp/Content/APIs/REST/API_Calls/REST_API_Calls.htm)
5. [Entities Exhaustive List](https://www.autotask.net/help/developerhelp/Content/APIs/REST/Entities/_EntitiesOverview.htm)
6. [Thresholds & Limits API](https://www.autotask.net/help/developerhelp/Content/APIs/REST/General_Topics/REST_Thresholds_Limits.htm)
7. [Find API Defect / SOAP Info](https://www.autotask.net/help/developerhelp/Content/APIs/SOAP/General_Topics/Find_API_defect.htm)
8. [Integration Center Guide](https://www.autotask.net/help/Content/4_Admin/5ExtensionsIntegrations/OtherExtensionsTools/Integration_Center.htm?cshid=1512)
9. [Webhooks Master Documentation](https://www.autotask.net/help/developerhelp/Content/APIs/Webhooks/WEBHOOKS.htm)
10. [REST Best Practices Enterprise](https://www.autotask.net/help/developerhelp/Content/APIs/REST/General_Topics/REST_BestPractices.htm)
11. [REST Using Postman Library](https://www.autotask.net/help/developerhelp/Content/APIs/REST/General_Topics/REST_Using_Postman.htm)
12. [REST Swagger Specification](https://www.autotask.net/help/developerhelp/Content/APIs/REST/General_Topics/REST_Swagger_UI.htm)

---

## 1. Zone Topology and Global Clusters

### 1.1. Active Zones List
- **Zone 1**
  - URL: `https://webservices1.autotask.net/atservicesrest/`
  - Description: US East Datacenter.
- **Zone 2**
  - URL: `https://webservices2.autotask.net/atservicesrest/`
  - Description: US Central Datacenter.
- **Zone 3**
  - URL: `https://webservices3.autotask.net/atservicesrest/`
  - Description: Europe Datacenter (London).
- **Zone 4**
  - URL: `https://webservices4.autotask.net/atservicesrest/`
  - Description: APAC Datacenter (Sydney).
- **Zone 5**
  - URL: `https://webservices5.autotask.net/atservicesrest/`
  - Description: US West Datacenter.
- **Zone 6**
  - URL: `https://webservices6.autotask.net/atservicesrest/`
  - Description: Canada Datacenter.
- **Zone 11**
  - URL: `https://webservices11.autotask.net/atservicesrest/`
- **Zone 12**
  - URL: `https://webservices12.autotask.net/atservicesrest/`
- **Zone 14**
  - URL: `https://webservices14.autotask.net/atservicesrest/`
- **Zone 15**
  - URL: `https://webservices15.autotask.net/atservicesrest/`
- **Zone 16**
  - URL: `https://webservices16.autotask.net/atservicesrest/`
- **Zone 17**
  - URL: `https://webservices17.autotask.net/atservicesrest/`
- **Zone 18**
  - URL: `https://webservices18.autotask.net/atservicesrest/`
- **PRDE (Sandbox)**
  - URL: `https://prde.autotask.net/atservicesrest/`
- **PRES (Staging)**
  - URL: `https://pres.autotask.net/atservicesrest/`

---

## 2. Authentication and Security (Security Spec)

- **Header: Authorization**
  - Value: `Basic [Base64 of Email:Password]`
- **Header: ApiIntegrationcode**
  - Value: Tracking ID key.
- **Header: ImpersonationResourceId**
  - Value: Technician ID (Optional).
- **Header: Accept**
  - Value: `application/json`

---

## 3. Analytical Entity Catalog (The itemized Library)

Below is the exhaustive list of all entities in the Autotask v1.0 system.

### 3.1. ActionTypes
- Role: Categorizes CRM actions.
- CRUD: GET, POST, PATCH.
- Attributes: `id`, `name`, `isActive`.

### 3.2. AdditionalInvoiceFieldValues
- Role: Metadata for invoice PDFs.
- CRUD: GET.
- Attributes: `id`, `invoiceID`, `fieldValue`.

### 3.3. Appointments
- Role: Calendar appointments.
- CRUD: GET, POST, PATCH, DELETE.

### 3.4. ArticleAttachments
- Role: Files linked to Knowledge Base (KB).
- CRUD: GET, POST, DELETE.

### 3.5. ArticleConfigurationItemCategoryAssociations
- Role: Links KB articles to configuration item categories.

### 3.6. ArticleNotes
- Role: Internal comments on KB articles.

### 3.7. ArticlePlainTextContent
- Role: Searchable content of KB articles.

### 3.8. ArticleTagAssociations
- Role: Manages tags on articles.

### 3.9. ArticleTicketAssociations
- Role: Links KB to resolved incidents.

### 3.10. ArticleToArticleAssociations
- Role: Links between related articles.

### 3.11. ArticleToDocumentAssociations
- Role: Links KB to Document Center.

### 3.12. AttachmentInfo
- Role: Global attachment metadata.
- Attributes: `fullPath`, `parentID`, `attachmentType`.

### 3.13. BillingCodes
- Role: Financial billing codes.

### 3.14. BillingItemApprovalLevels
- Role: Billing approval workflow.

### 3.15. BillingItems
- Role: Pending cost transactions.

### 3.16. ChangeOrderCharges
- Role: Extra charges in projects.

### 3.17. ChangeRequestLinks
- Role: Links Tickets to Change Requests.

### 3.18. ChecklistLibraries
- Role: Procedure models (SOPs).

### 3.19. ChecklistLibraryChecklistItems
- Role: Individual items within checklist models.

### 3.20. ClassificationIcons
- Role: Graphic interface icons.

### 3.21. ClientPortalUsers
- Role: End-client logins.

### 3.22. ComanagedAssociations
- Role: Partner IT permissions.

### 3.23. Companies
- Role: Master dynamic record of the Client Account.
- CRUD: All verbs.
- Attributes: `accountName`, `phone`, `webAddress`.

### 3.24. CompanyAlerts
- Role: Warning bubbles on accounts.

### 3.25. CompanyAttachments
- Role: Fiscal contracts and SLAs.

### 3.26. CompanyCategories
- Role: Segmentation (Gold, Silver).

### 3.27. CompanyLocations
- Role: Extra physical addresses.

### 3.28. CompanyNoteAttachments
- Role: Evidence in CRM notes.

### 3.29. CompanyNotes
- Role: Commercial call logs.

### 3.30. CompanyTeams
- Role: Technicians dedicated to the account.

### 3.31. ContactGroups
- Role: Distribution lists.

### 3.32. ContactNoteAttachments
- Role: Files in contact notes.

### 3.33. ContactNotes
- Role: Personal contact notes.

### 3.34. Contacts
- Role: Individuals associated with a Client (Company).
- CRUD: GET (list), GET (by ID), POST (create), PATCH (update), DELETE (remove).
- Key Attributes: `firstName`, `lastName`, `email`, `companyID`, `isActive`.
- **Implementation Note**: When creating or updating contacts, `companyID` is mandatory to link the person to an account.

### 3.35. ContractBillingRules
- Role: Recurrence automation.

### 3.36. ContractBlockHourFactors
- Role: Hour consumption multiplier.

### 3.37. ContractBlocks
- Role: Pre-paid support blocks.

### 3.38. ContractCharges
- Role: Monthly financial entries.

### 3.39. ContractExclusionAllocationCodes
- Role: Services without contract coverage.

### 3.40. ContractExclusionBillingCodes
- Role: Financial exclusions.

### 3.41. ContractExclusionRoles
- Role: Technicians excluded from the contract.

### 3.42. ContractMilestones
- Role: Payments per delivery.

### 3.43. ContractNotes
- Role: Commercial management of the agreement.

### 3.44. ContractRateCosts
- Role: Profit margin definition.

### 3.45. ContractRates
- Role: Sales value per role.

### 3.46. ContractRetainers
- Role: Financial retainers.

### 3.47. ContractRoleCosts
- Role: Internal labor costs.

### 3.48. ContractRoles
- Role: Roles permitted in the contract.

### 3.49. Contracts
- Role: PSA master agreement.

### 3.50. ContractServiceBundles
- Role: Recurring service packages.

### 3.51. ContractServiceBundleUnits
- Role: Quantity of active packages.

### 3.52. ContractServices
- Role: Individual services (Antivirus, Cloud).

### 3.53. ContractServiceUnits
- Role: Units sold.

### 3.54. ContractTicketPurchaseOrders
- Role: Link with purchase orders.

### 3.55. Countries
- Role: ISO countries records.

### 3.56. Currencies
- Role: Multi-currency exchange management.

### 3.57. Departments
- Role: MSP internal organization.

### 3.58. DeletedTaskActivityLogs
- Role: Audit of deleted tasks.

### 3.59. DeletedTicketActivityLogs
- Role: Audit of deleted tickets.

### 3.60. Documents
- Role: New Knowledge Base (Doc Center).

### 3.61. ExpenseItems
- Role: Travel/meal reimbursements.

### 3.62. ExpenseReports
- Role: Expense groups for approval.

### 3.63. Holidays
- Role: Non-working dates.

### 3.64. HolidaySets
- Role: Regional calendars.

### 3.65. InternalLocations
- Role: MSP's own offices.

### 3.66. InventoryItems
- Role: Parts in available stock.

### 3.67. InventoryLocations
- Role: Depots and warehouses.

### 3.68. InventoryProducts
- Role: Technical catalog items.

### 3.69. Invoices
- Role: Generated client invoice.

### 3.70. InvoiceTemplates
- Role: Invoice visual design.

### 3.71. LineOfBusiness
- Role: Client's business vertical.

### 3.72. Opportunities
- Role: Deals in sales stage.

### 3.73. OpportunityAttachments
- Role: Attached commercial proposals.

### 3.74. OpportunityCategories
- Role: Sales types (Hardware, MRR).

### 3.75. OrganizationalLevel1
- Role: Organizational master level.

### 3.76. OrganizationalLevel2
- Role: Organizational subdivision.

### 3.77. OrganizationalLevelAssociations
- Role: Links hierarchies.

### 3.78. OrganizationalResources
- Role: Technicians in their units.

### 3.79. PaymentTerms
- Role: Payment rules (Net 30, etc).

### 3.80. Phases
- Role: Technical project stages.

### 3.81. PriceListMaterialCodes
- Role: Parts price list.

### 3.82. PriceListProducts
- Role: Hardware price list.

### 3.83. PriceListProductTiers
- Role: Progressive discounts.

### 3.84. Projects
- Role: Planned work containers.

### 3.85. ProjectAttachments
- Role: Attached schedules.

### 3.86. ProjectNotes
- Role: Project manager diary.

### 3.87. Quotes
- Role: PDF quotes.

### 3.88. QuoteItems
- Role: Individual quote lines.

### 3.89. Resources
- Role: System Technicians (Users).
- Attributes: `firstName`, `email`, `isActive`.

### 3.90. ResourceServiceDeskRoles
- Role: Queues the technician services.

### 3.91. Roles
- Role: Technical level (L1, L2, Manager).

### 3.92. SalesOrderAttachments
- Role: PDF sales orders.

### 3.93. SalesOrders
- Role: Firm orders.

### 3.94. ServiceBundles
- Role: Grouping of core services.

### 3.95. ServiceBundleServices
- Role: Items within the bundle.

### 3.96. ServiceCalls
- Role: Scheduled physical visits.

### 3.97. ServiceCallTaskResources
- Role: Who will perform the visit.

### 3.98. ServiceCallTasks
- Role: What will be done during the visit.

### 3.99. ServiceLevelAgreementResults
- Role: Calculated SLA hit/miss.

### 3.100. Services
- Role: Unitary service catalog.

### 3.101. ShippingTypes
- Role: Delivery methods (Fedex, UPS).

### 3.102. Skills
- Role: Technician certifications (CCNA, ITIL).

### 3.103. Subscriptions
- Role: External vendor items (Office 365).

### 3.104. SurveyResults
- Role: Satisfaction scores (NPS).

### 3.105. Surveys
- Role: Survey models.

### 3.106. TagAliases
- Role: Synonyms for search tags.

### 3.107. TagGroups
- Role: Indexing categories.

### 3.108. Tags
- Role: Modern digital labeling.

### 3.109. TaskAttachments
- Role: Project artifacts.

### 3.110. TaskNoteAttachments
- Role: Files in progress notes.

### 3.111. TaskNotes
- Role: Log of what was done on the task.

### 3.112. TaskPredecessors
- Role: Logical dependencies between tasks.

### 3.113. Tasks
- Role: Smallest unit of project work.

### 3.114. TaskSecondaryResources
- Role: Task co-pilots.

### 3.115. Taxes
- Role: Tax rates.

### 3.116. TaxCategories
- Role: Tax groups.

### 3.117. TimeOffRequests
- Role: Vacations and absences.

### 3.118. UserDefinedFieldDefinitions
- Role: Custom field schema.

### 3.119. UserDefinedFieldListItems
- Role: Dropdown options for UDFs.

### 3.120. Version
- Role: API health check.

### 3.121. WebhookEventErrorLogs
- Role: Diagnostic of push failures.

### 3.122. Webhooks
- Role: Real-time notification configuration.

### 3.123. WorkEntry
- Role: Technical time entry / Time card.

### 3.124. WorkTypeModifiers
- Role: Cost adjustment per technical hour.

---

## 4. Analytical Glossary of Standard Picklists (Mapping IDs)

Below are the fundamental codes for Service Desk integrations.

### 4.1. Ticket Status (/Tickets)
- **ID 1:** New (Recently opened via email or portal).
- **ID 5:** Complete (Resolved, billing accepted).
- **ID 6:** In Progress (Technician actively working).
- **ID 7:** On Hold (Paused due to dependency).
- **ID 8:** Waiting Customer (Awaiting user response).
- **ID 9:** Waiting Materials (Awaiting purchases/parts).
- **ID 10:** Deferred (Postponed according to schedule).
- **ID 11:** Cancelled (Discarded by client/MSP).
- **ID 12:** Re-opened (Resolution failure).

### 4.2. Ticket Priority
- **ID 1:** High (Visible impact).
- **ID 2:** Medium (Moderate impact).
- **ID 3:** Low (Cosmetic/Informational).
- **ID 4:** Critical (Total client stoppage).

---

## 5. Implementation Guidance: Retrieving and Updating Entities

### 5.1. Retrieve a Single Entity by ID
To retrieve a specific instance of an entity using its unique identifier, use the standard REST GET pattern.

**Endpoint:** `GET /[Entity]/{id}`

**Example (cURL):**
```bash
curl -X GET "https://webservices1.autotask.net/atservicesrest/Tickets/123456" \
     -H "Accept: application/json" \
     -H "Authorization: Basic [Base64-Credentials]" \
     -H "ApiIntegrationcode: [Your-Tracking-ID]"
```

**Key Notes:**
- The `{id}` must be numeric.
- If the ID does not exist, the API returns `404 Not Found`.

### 5.2. Delete an Entity by ID
To remove a specific record (such as a Contact or an Appointment) using its unique identifier, use the REST DELETE pattern.

**Endpoint:** `DELETE /[Entity]/{id}`

**Example (cURL for deleting a Contact):**
```bash
curl -X DELETE "https://webservices1.autotask.net/atservicesrest/Contacts/987654" \
     -H "Accept: application/json" \
     -H "Authorization: Basic [Base64-Credentials]" \
     -H "ApiIntegrationcode: [Your-Tracking-ID]"
```

**Key Notes:**
- **Irreversibility**: Deleting a record is permanent.
- **Dependencies**: Errors occur if the entity is referenced elsewhere.
- **Permissions**: Requires "Delete" permission in Security Level.

### 5.3. Retrieving Child Collections (Parent-Child Pattern)
To retrieve all records of a child entity associated with a specific parent, use the nested resource pattern. This is the most efficient way to access related data like Notes or Attachments for a specific Ticket.

**Endpoint:** `GET /[ParentEntity]/{parentId}/[ChildEntity]`

**Example: Retrieving all Notes for a specific Ticket:**
```bash
curl -X GET "https://webservices1.autotask.net/atservicesrest/Tickets/12345/Notes" \
     -H "Accept: application/json" \
     -H "Authorization: Basic [Base64-Credentials]" \
     -H "ApiIntegrationcode: [Your-Tracking-ID]"
```

**Common Child Resource Patterns:**
- `GET /Tickets/{id}/Notes` - All notes for a ticket.
- `GET /Tickets/{id}/Attachments` - Metadata for all attachments.
- `GET /Companies/{id}/Contacts` - All contacts for a company.
- `GET /Projects/{id}/Phases` - All phases within a project.

### 5.4. Dynamic Handling of User Defined Fields (UDFs)

#### 5.4.1. Discovering UDF Definitions
To find out what custom fields are available for a specific entity type, use the definitions endpoint.

**Endpoint:** `GET /UserDefinedFieldDefinitions?filter=[{"field":"businessobjectid","op":"eq","value":"[EntityID]"}]`

**Key Metadata Provided:**
- `name`: The internal name to use in API calls.
- `label`: The display name used in the Autotask UI.
- `dataType`: (e.g., String, Date, List) to determine validation.
- `isVisible` / `isReadOnly`: To guide your UI/Logic.

#### 5.4.2. Retrieving UDF Values for a Record
When you perform a `GET /[Entity]/{id}`, the custom field values are returned in a specialized `userDefinedFields` array.

**Example Response Object:**
```json
{
  "id": 12345,
  "userDefinedFields": [
    { "name": "ProjectCode", "value": "PRJ-99" }
  ]
}
```

#### 5.4.3. Updating UDFs via PATCH
To update a custom field, you must include the `userDefinedFields` array in your `PATCH` payload. You only need to include the specific fields you wish to change.

**Example cURL: Updating a 'ProjectCode' UDF on a Ticket:**
```bash
curl -X PATCH "https://webservices1.autotask.net/atservicesrest/Tickets" \
     -H "Content-Type: application/json" \
     -H "Authorization: Basic [Base64-Credentials]" \
     -H "ApiIntegrationcode: [Your-Tracking-ID]" \
     -d '{
           "id": 12345,
           "userDefinedFields": [
             { "name": "ProjectCode", "value": "NEW-CODE-123" }
           ]
         }'
```

**Implementation Tip**: Always use `PATCH` instead of `POST` for updates to avoid overwriting unrelated fields. Autotask will merge the `userDefinedFields` array, updating the named fields and leaving others intact.

### 5.5. Timestamps and Timezone Handling

Correctly handling dates is one of the most common challenges for Autotask developers.

#### 5.5.1. The API Response Nuance
- **API Responses**: Dates returned in JSON payloads (e.g., `createDateTime`, `lastActivityDateTime`) are returned in the **Timezone of the Authenticated Resource** (the API User).
- **Format**: `YYYY-MM-DDTHH:MM:SS` (ISO-8601 without offset). ⚠️ **CRITICAL**: Because there is No Offset in the string, a standard parser might assume UTC, which is incorrect if the User is set to "Eastern Standard Time".

#### 5.5.2. Querying vs. Receiving
- **Queries**: When filtering by dates (e.g., `createDateTime gt 2024-05-10T00:00:00Z`), the search engine effectively treats input as **UTC**.
- **Best Practice**: Always perform queries using UTC suffixes (`Z`) or explicit offsets to avoid ambiguity.

#### 5.5.3. Implementation Guide: Parsing and Formatting

To correctly interpret and display a timestamp, you must parse the raw string and explicitly attach the timezone offset of your API User. 

**Example 1: Python (using `datetime` and `zoneinfo`)**
```python
from datetime import datetime, timezone, timedelta

# 1. Raw string from API (No offset)
api_date_str = "2024-05-10T14:30:00"

# 2. Extract resource offset (e.g., Eastern Time: UTC-5)
# In production, fetch this dynamically or define your known offset
resource_offset_hours = -5
resource_tz = timezone(timedelta(hours=resource_offset_hours))

# 3. Parse string into naive datetime
naive_dt = datetime.strptime(api_date_str, "%Y-%m-%dT%H:%M:%S")

# 4. Make it timezone-aware by replacing tzinfo
aware_dt = naive_dt.replace(tzinfo=resource_tz)

# 5. Result: A fully aware datetime object
print(f"Aware Datetime: {aware_dt}") # 2024-05-10 14:30:00-05:00

# 6. Format for final display
display_format = aware_dt.strftime("%B %d, %Y at %I:%M %p %Z")
print(f"UI Display: {display_format}") # May 10, 2024 at 02:30 PM UTC-05:00
```

**Example 2: C# (.NET)**
```csharp
using System;

public class AutotaskDateParser
{
    public static void Main()
    {
        // 1. Raw string from API
        string apiDate = "2024-05-10T14:30:00";
        
        // 2. Resource configuration (e.g., EST)
        TimeSpan resourceOffset = new TimeSpan(-5, 0, 0); 

        // 3. Parse into unspecified DateTime
        DateTime parsedDate = DateTime.Parse(apiDate);

        // 4. Combine into a DateTimeOffset to lock the timezone
        DateTimeOffset finalDate = new DateTimeOffset(parsedDate, resourceOffset);

        // 5. Output
        Console.WriteLine($"Console: {finalDate:O}"); // 2024-05-10T14:30:00.0000000-05:00
        Console.WriteLine($"UI Display: {finalDate.ToString("MMMM dd, yyyy h:mm tt")}");
    }
}
```

#### 5.5.4. Discovering the Resource Timezone
If your app supports multiple Autotask tenants, discover the timezone dynamically:
1. Call `GET /Resources/{currentResourceId}`.
2. Check the `userTimezone` field (this returns an ID or string corresponding to Autotask's Internal Timezone table).

### 5.6. Rich Text and HTML Content Management (Data Loss Mitigation)

Managing formatted text is a common source of bugs (data loss via formatting stripping) in Autotask integrations. Autotask supports Rich Text (HTML) in specific fields, but the behavior is inconsistent across the data model.

#### 5.6.1. The Absence of Native Flags
**CRITICAL NOTE**: There is **no response field** or boolean flag (like `isRichText`) in the Autotask REST API metadata that explicitly indicates if a field supports HTML. 

Developers must infer capability by combining endpoint knowledge with `entityInformation` metadata:
- **Indicator 1**: The field's `dataType` is `String`.
- **Indicator 2**: The field's `length` is typically `32000` or greater (e.g., `TicketNote.noteBody`).

#### 5.6.2. Entity Behavior Comparison Table
Entities handle incoming HTML differently. Sending HTML to an entity that does not support it will result in the text being saved as raw strings (e.g., the user sees literal `<p>Hello</p>` instead of formatted text) or the formatting being completely stripped.

| Entity | Field | Action | Behavior |
| :--- | :--- | :--- | :--- |
| **TicketNotes** | `noteBody` | `POST` / `PATCH` | **Preserves**. Renders rich text in Autotask UI. |
| **Tickets** | `description` | `POST` / `PATCH` | **Preserves**. Renders rich text in Autotask UI. |
| **Projects** | `description` | `POST` / `PATCH` | **Strips/Raw**. Often renders as raw HTML tags or plain text depending on UI component. |
| **ActionTypes**| `name` | `POST` / `PATCH` | **Strips/Raw**. Strict plain text only. |

#### 5.6.3. Mitigating Data Loss During Updates (The PATCH Strategy)
The most severe instance of data loss occurs when retrieving an entity with a Rich Text field (which returns plain text stripped of HTML by default) and then subsequently sending that same stripped text back in a `PUT` or `POST` request, permanently erasing the user's original HTML formatting.

**Programmatic Error Handling & Mitigation Pattern:**
1. **Never use PUT**: Always use the `PATCH` verb to update entities.
2. **Exclude Rich Text Fields**: If you are not explicitly trying to change the content of a Rich Text field (like `description`), **remove it completely from your JSON payload**.
3. **HTML Wrapper Validation**: If you *must* update a Rich Text field, build a pre-flight validator that ensures the payload is strictly wrapped in HTML tags (e.g., checking for `<html><body>...</body></html>`).

**Example cURL: Updating a Ticket Note with Rich Text (The Safe Way):**
```bash
curl -X PATCH "https://webservices1.autotask.net/atservicesrest/v1.0/TicketNotes" \
     -H "Content-Type: application/json" \
     -H "Authorization: Basic [Base64-Credentials]" \
     -H "ApiIntegrationcode: [Your-Tracking-ID]" \
     -d '{
           "id": 12345,
           "noteBody": "<html><body><strong>Urgent:</strong> Infrastructure update required. <br/>Check the <a href=\"#\">Logs</a>.</body></html>",
           "publish": 1
         }'
```

**Example: Defensive Python Payload Construction**
```python
def create_safe_update_payload(entity_data, fields_to_update):
    """
    Prevents data loss by strictly constructing a PATCH payload 
    containing ONLY the specifically requested fields.
    """
    safe_payload = { "id": entity_data["id"] }
    
    for field in fields_to_update:
        if field == "description":
             # Error Handling: Warn or block if HTML wrapping is missing
             if not getattr(entity_data, field).startswith("<html"):
                 raise ValueError("Data Loss Prevention: description must be wrapped in HTML tags to preserve formatting.")
        
        safe_payload[field] = entity_data[field]
        
    return safe_payload
```

#### 5.6.4. Content Cleaning Security
Autotask automatically strips dangerous tags (like `<script>` or `<embed>`) for Cross-Site Scripting (XSS) security. Always verify the rendered output in the Autotask UI during integration testing to ensure your desired CSS/Tags are supported by their internal sanitizer.

### 5.7. Permissions and Read-Only Validation

Field-level permissions in Autotask vary strictly by the Security Level assigned to the API User. A field editable by an Administrator might be read-only for a restricted technician. Sending a `PATCH` request containing a read-only field will result in an immediate `403 Forbidden` or `500 Internal Server Error`, rejecting the entire payload.

#### 5.7.1. Detecting Read-Only Constraints
Do not hardcode field permissions. Instead, query the metadata to determine the current API User's access rights.

**Endpoint**: `GET /[Entity]/entityInformation`

**Example Output (Truncated):**
```json
{
  "fields": [
    {
      "name": "status",
      "dataType": "Integer",
      "isReadOnly": false,
      "isRequired": true
    },
    {
      "name": "createDateTime",
      "dataType": "DateTime",
      "isReadOnly": true,
      "isRequired": false
    }
  ]
}
```

#### 5.7.2. Robust Payload Filtering (Pre-Validation)
The most robust implementation pattern is to build a "Payload Filter" before transmitting updates.

**Implementation Logic for Developers:**
1. **Cache Metadata**: Download and cache the `/entityInformation` for the entities your app touches.
2. **Build Dictionary**: Create a map of `{ "fieldName": isReadOnly }`.
3. **Filter Payload**: Before sending a `PATCH` request, iterate over the keys in your update payload.
4. **Remove Keys**: If a key corresponds to a field where `isReadOnly == true`, silently drop that property from your JSON payload.
5. **Transmit**: Send the sanitized payload.

This architecture guarantees that role-based restrictions (which the Autotask admin might change at any time) will never cause your synchronization engine to crash.

---

## 6. Pagination and Navigation Guide

Autotask REST API uses implicit pagination for all list and query operations to ensure performance.

### 6.1. Page Limits
- **Maximum Records per Page**: 500.
- **Default**: If the result set exceeds 500, the response will be truncated.

### 6.2. Iterating with `nextPageUrl`
The response JSON includes a `pageDetails` object (or similar structure depending on the zone) containing a `nextPageUrl`.

**Typical Response Structure:**
```json
{
  "items": [...],
  "pageDetails": {
    "count": 500,
    "nextPageUrl": "https://webservices1.autotask.net/atservicesrest/Tickets/query?nextId=..."
  }
}
```

**Implementation Logic for Developers:**
1. Perform the initial request.
2. Process the `items` array.
3. Check if `nextPageUrl` is present and not null.
4. If present, perform a GET request to the exact `nextPageUrl` provided (it contains all necessary query tokens).
5. Repeat until `nextPageUrl` is missing from the response.

---

## 7. Performance and Technical Limits (API SLA)

### 7.1. Progressive Throttling
Autotask manages load through artificial delays.

1. **Up to 5,000 calls/hour:** 0ms extra latency.
2. **5,000 - 7,500 calls/hour:** +500ms per request.
3. **7,500 - 9,999 calls/hour:** +1000ms per request.
4. **10,000+ calls/hour:** HTTP 429 - Too Many Requests / Service Unavailable.

---

## 8. Revision History and Technical Evolution (v1.0+)

- **v1.0.12 (2025):** Document Center 2.0 Integration.
- **v1.0.11 (2024):** Support for new invoice fields.
- **v1.0.10 (2024):** Massive `IN` operator.
- **v1.0.09 (2023):** Throttling by Geographic Cluster.
- **v1.0.08 (2023):** Webhooks for Financial Entities.
- **v1.0.07 (2022):** Extended Impersonation Header.
- **v1.0.06 (2022):** Central heartbeat endpoint (`/Version`).
- **v1.0.05 (2021):** Attachment physical limit at 7.5MB.
- **v1.0.04 (2021):** `contains` filter enabled globally.
- **v1.0.03 (2020):** Discovery Service Launch (/zoneInformation).
- **v1.0.02 (2020):** 80% parity between SOAP and REST.
- **v1.0.01 (2019):** Initial PSA REST Engine Launch.

---

## 9. Technical Engineering FAQ (Top 30 Challenges)

1. **How do I get binary content from an attachment?**
   Use the `AttachmentInfo` entity with the ID. It returns the `fullPath` field, which is the temporary Download URL.

2. **What is the character limit in a TicketNote?**
   32,000 characters in plain text or HTML rich text.

3. **How do I filter tickets by UDF?**
   In the search payload, use: `{"field": "userDefinedFields.FieldName", "op": "eq", "value": "xyz"}`.

4. **Do webhooks send the attached file?**
   No. We send only metadata. Your app must download via API using the provided URL.

5. **Is Tracking ID (ApiIntegrationcode) mandatory?**
   Yes. Without it, Autotask blocks 100% of POST/PATCH for auditing in the Integration Center.

6. **How do I know if a technician is logged in?**
   There is no "Online" endpoint. Use `Resources` and filter by `isActive` to see who is eligible to work.

7. **What is the API Timezone?**
   Responses match the authenticated resource's configuration, but the Query engine accepts ISO-8601 UTC.

8. **Can I delete a Company?**
   Yes, if no historical records are linked (Tickets, Contracts). Deactivation is usually recommended instead.

9. **How do I create a sub-ticket?**
   Use the `parentTicketID` field in the POST payload of the new ticket.

10. **Is there a Sandbox for developers?**
    Yes. Use the **PRDE** zone. It is the universal playground for integration testing.

11. **How do I act 'on behalf of' a technician?**
    Send the `ImpersonationResourceId` Header with the target resource ID. Requires special permission on the API User.

12. **Sporadic 502/504 Errors?**
    The cluster might be under maintenance. Autotask guarantees 99.9% uptime, but patch windows occur.

13. **How do I get the Status ID by Name?**
    Call `/Tickets/entityInformation`. The return JSON contains the complete PickList of statuses with IDs and Names.

14. **Do UDFs support Multiselect?**
    Yes. You will receive an array or comma-separated string in the corresponding field.

15. **Can I change the billability of an already posted hour?**
    Only via PATCH on the `WorkEntry` entity, modifiying the `allocationCodeID` field.

16. **What happens if I exceed 10k calls?**
    Your app receives a 429 error and must wait until the top of the next hour (e.g., if blocked at 2:45 PM, it resets at 3:00 PM).

17. **How do I find mandatory fields?**
    Use `/[Entity]/entityInformation`. Check the `isRequired` flag for each field.

18. **Does the API support SSL?**
    Yes, TLS 1.2 or higher is mandatory. Old ciphers are rejected.

19. **How do I filter by creation date?**
    Use the `createDateTime` field with the `gt` (Greater Than) operator.

20. **Can I read Knowledge Base Documents?**
    Yes, use the `Documents` entity. It is the modern version of `Articles`.

21. **How do I get Webhook error logs?**
    Query the `WebhookEventErrorLogs` entity, filtering by your webhook name.

22. **Is there a 500 records limit per page?**
    Yes. The API uses implicit pagination. Use `nextPageUrl` in the response JSON to navigate.

23. **How do I check the system version?**
    Endpoint `/Version`. Returns the current Datto PSA build.

24. **What is the UDF limit per object?**
    Up to 100 custom fields.

25. **Can I read global configurations?**
    Not directly. REST focuses on operational data. System settings require Admin login via UI.

26. **How do I find the client's timezone?**
    Check the `InventoryLocations` entity or the resource's `BusinessLocation`.

27. **How do I filter by 'Not Equal To'?**
    Use the `noteq` operator.

28. **Can I create attachments in bulk?**
    No. Each attachment requires an individual POST of metadata + binary.

29. **Does the API support JWT Tokens?**
    No. Only Basic Auth coupled with the Tracking ID.

30. **How do I check if a Webhook is active?**
    Query the `Webhooks` entity and check the `isActive` field.

---

## 10. Performance Delta Sync Guide (Best Practices)

To avoid hitting the 10k call quota:

1. **Cursor Persistence:** Save the highest `lastModifiedDateTime` read locally.
2. **Delta Query:** In the next query, filter `lastModifiedDateTime gt [SAVED_VALUE]`.
3. **Webhook Over Polling:** Use Webhooks for changes and Polling only for daily audits.
4. **Payload Optimization:** Do not request fields you do not intend to use.

---

## 11. Operations Matrix by Module

| Module | GET | POST | PATCH | PUT | DELETE |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Service Desk** | Yes | Yes | Yes | Yes | No |
| **CRM** | Yes | Yes | Yes | Yes | Yes |
| **Projects** | Yes | Yes | Yes | Yes | No |
| **Financial** | Yes | No | No | No | No |
| **Inventory** | Yes | Yes | Yes | Yes | Yes |

---

## 12. Cerebro Integration Quality Checklist

- [x] Zone detected automatically via `/zoneInformation`.
- [x] Tracking ID present in 100% of headers.
- [x] API User with Security Level "API-Only".
- [x] HTTP 429 Error Handler configured with logical retry.
- [x] `Secret Key` validation active in Webhooks.
- [x] Heartbeat monitored via `/Version` endpoint.
- [x] Local cache of PickLists (Status, Priority) to reduce redundant calls.

---

## 13. Unexpected Errors and Diagnostics

- **Error 400 (Bad Request):** Malformed filter or invalid JSON.
- **Error 401 (Unauthorized):** Incorrect Email or Password.
- **Error 403 (Forbidden):** Lack of permission in the Security Level.
- **Error 429 (Throttled):** Wait for the hourly reset (Hourly Quota).
- **Error 500 (Internal):** Critical failure on the Autotask server. Retry in 5 mins.


