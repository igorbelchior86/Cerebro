# Title
ChatInput Attachments: Inline Cerebro Preview + Autotask Ticket Attachment Upload

# What changed
Implemented attachment flow in the chat composer area: removed inline image toolbar action, wired attachment picker to backend API, rendered attachments inline in Cerebro user messages, and uploaded selected files to Autotask as regular ticket attachments.

# Why it changed
Technician workflow requires sending files to end users through Autotask-supported attachment channels while keeping a rich inline visualization inside Cerebro.

# Impact (UI / logic / data)
- UI:
  - Removed `inline pic` toolbar button.
  - Added attachment picker and inline draft preview in ChatInput.
  - Added inline rendering for sent attachments in user chat messages:
    - image as image preview,
    - document as rectangle card with file extension icon + file name + format.
- Logic:
  - Session chat submit now uploads selected attachments to Autotask ticket attachment endpoint.
  - Attachment upload errors are surfaced back into assistant feedback message context.
- Data:
  - New API route for `POST /autotask/ticket/:ticketId/attachments`.
  - Uses `TicketAttachments` write path (regular attachment, not inline rich text body).

# Files touched
- apps/web/src/components/ChatInput.tsx
- apps/web/src/components/ChatMessage.tsx
- apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx
- apps/web/src/app/[locale]/(chat)/triage/home/page.tsx
- apps/web/src/lib/p0-ui-client.ts
- apps/api/src/clients/autotask.ts
- apps/api/src/routes/autotask.ts
- apps/api/src/index.ts
- apps/api/src/__tests__/clients/autotask.test.ts
- tasks/todo.md
- wiki/features/2026-02-27-attachments-chatinput-to-autotask-ticket.md

# Date
2026-02-27
