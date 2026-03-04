# Form fields id/name accessibility fix
# What changed
- Added explicit `id` and `name` attributes to hidden file input in chat attachments.
- Added explicit `id` and `name` attributes to profile modal fields (avatar upload, display name, job title).
- Added explicit `id` and `name` attributes to sidebar status search input.

# Why it changed
- Browser/DevTools accessibility audit flagged form fields without `id` or `name`, which can break autofill and tooling.

# Impact (UI / logic / data)
- UI: no visual change; improved form semantics and autofill compatibility.
- Logic: unchanged.
- Data: unchanged.

# Files touched
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/components/ChatInput.tsx`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/components/ProfileModal.tsx`
- `/Users/igorbelchior/Documents/Github/Cerebro/apps/web/src/features/chat/sidebar/StatusEditorModal.tsx`

# Date
- 2026-03-04
