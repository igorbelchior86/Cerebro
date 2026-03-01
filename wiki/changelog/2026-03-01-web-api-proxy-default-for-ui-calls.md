# Web API Proxy Default For UI Calls
# What changed
- The Next.js app now proxies `/api/:path*` to the backend target defined by `API_PROXY_TARGET`, with fallback to `http://localhost:3001`.
- Frontend API callers that previously fell back to `http://localhost:3001` now fall back to `/api`, so browser requests stay same-origin by default.
- Web environment defaults were updated so `NEXT_PUBLIC_API_URL` points to `/api` and local development keeps the backend target in `API_PROXY_TARGET`.

# Why it changed
- The UI was using `process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'` in multiple places.
- When that public env was missing or incorrect for the browser runtime, requests were sent to the user's own localhost, causing shared `Network Error` / `Failed to fetch` failures across ticket loading and editable selectors.
- Moving the default to a same-origin proxy removes that brittle browser-side localhost dependency.

# Impact (UI / logic / data)
- UI: Ticket loading, new ticket creation, auth flows, selectors, polling, and settings requests now resolve through the same origin by default, reducing connection failures.
- Logic: Request routing changed only at the transport/config layer; no business logic or field semantics changed.
- Data: No schema or payload shape changes. Existing backend routes remain unchanged.

# Files touched
- `apps/web/next.config.js`
- `apps/web/src/lib/p0-ui-client.ts`
- `apps/web/src/hooks/useAuth.ts`
- `apps/web/src/hooks/usePollingResource.ts`
- `apps/web/src/components/ChatSidebar.tsx`
- `apps/web/src/components/SettingsModal.tsx`
- `apps/web/src/app/[locale]/login/page.tsx`
- `apps/web/src/app/[locale]/register/page.tsx`
- `apps/web/src/app/[locale]/accept-invite/page.tsx`
- `apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`
- `apps/web/src/app/[locale]/(main)/triage/new/page.tsx`
- `apps/web/.env`
- `apps/web/.env.example`
- `.env`
- `tasks/todo.md`

# Date
- 2026-03-01
