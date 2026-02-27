# Title
Middle Column Single Feed with AI vs PSA/User Channel Toggle

# What changed
Implemented a single chronological feed model in the triage middle column with explicit message channeling between internal AI and external PSA/User communication.

Key additions:
- Added message-level channel metadata (`internal_ai` or `external_psa_user`) and external delivery state (`sending`, `sent`, `failed`, `retrying`).
- Added destination toggle in `ChatInput` (`AI` | `PSA/User`) and submit payload field `targetChannel`.
- Added channel badges and subtle channel-specific bubble styling in `ChatMessage` for both technician and assistant pipeline messages.
- Added external retry action directly in failed message bubbles.
- Added quick filter chips above the feed (`All`, `AI`, `PSA/User`) without changing the underlying chronological store.
- Persisted selected destination channel per ticket in local storage with fallback default `AI`.
- Wired external PSA/User sending through workflow command submission (`create_comment_note` with public visibility).
- Added frontend telemetry event dispatch for channel selection/send/failure/retry.

# Why it changed
The middle column needed to support two distinct conversation intents in one operational surface:
- internal technician ↔ AI reasoning
- external technician ↔ PSA/User communication

This update enables clear operator intent control and auditable external delivery status while preserving existing pipeline timeline semantics.

# Impact (UI / logic / data)
- UI:
  - New destination switch in composer.
  - Channel badges and channel-specific visual accents in bubbles.
  - External delivery status text and retry control in failed external messages.
  - Feed filter chips by channel.
- Logic:
  - Submit path now branches by `targetChannel`.
  - Internal channel keeps existing assistant processing behavior.
  - External channel writes public note through workflow command and updates delivery state.
  - Selected target channel is restored per ticket.
- Data:
  - No schema migration.
  - Frontend message model expanded with `channel` and optional `delivery` metadata.

# Files touched
- apps/web/src/components/ChatInput.tsx
- apps/web/src/components/ChatMessage.tsx
- apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx
- apps/web/src/app/[locale]/(chat)/triage/home/page.tsx
- tasks/todo.md
- wiki/features/2026-02-27-middle-column-feed-channel-toggle-ai-psa-user.md

# Date
2026-02-27
