# Frontend Local Runtime Restored Via Stable Build Path

# What changed
- Added a real root App Router layout at `apps/web/src/app/layout.tsx`.
- Converted `apps/web/src/app/[locale]/layout.tsx` into a nested locale layout and added `generateStaticParams()` for the supported locales.
- Added minimal Pages Router fallback files: `apps/web/src/pages/_app.tsx`, `apps/web/src/pages/_document.tsx`, `apps/web/src/pages/_error.tsx`, and `apps/web/src/pages/404.tsx`.
- Fixed null-safety in route/navigation hooks so the web app passes `tsc --noEmit` and can complete `next build`.

# Why it changed
- The local frontend was not reliably booting in `next dev`, and real routes like `/en/login` were failing with `500`.
- `.run/logs/web.log` showed repeated missing generated artifacts (`_document.js`, `app-paths-manifest.json`, `vendor-chunks`, `pages-manifest.json`), which indicated the runtime could not resolve a consistent set of Next.js build outputs.
- The frontend also had TypeScript nullability errors that prevented a production build, blocking the more stable `next start` path.

# Impact (UI / logic / data)
- UI: Restores the local frontend runtime so login and entry routing render again on `localhost:3000`.
- Logic: No business workflow changed; the adjustments are limited to Next.js runtime structure and null-safe navigation helpers.
- Data: No persistence, schema, or tenant-scoped behavior changed.

# Files touched
- `apps/web/src/app/layout.tsx`
- `apps/web/src/app/[locale]/layout.tsx`
- `apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`
- `apps/web/src/app/[locale]/(chat)/triage/home/page.tsx`
- `apps/web/src/app/[locale]/accept-invite/page.tsx`
- `apps/web/src/components/ChatSidebar.tsx`
- `apps/web/src/pages/_app.tsx`
- `apps/web/src/pages/_document.tsx`
- `apps/web/src/pages/_error.tsx`
- `apps/web/src/pages/404.tsx`
- `tasks/todo.md`

# Date
- 2026-03-01
