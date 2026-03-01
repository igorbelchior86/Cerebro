# Rebrand Playbook Brain To Cerebro
# What changed
- Replaced active codebase references from `Playbook Brain` / `playbook-brain` / `@playbook-brain/*` with `Cerebro` / `cerebro` / `@cerebro/*`.
- Updated the web UI to use the new shared `CerebroLogo` component backed by `apps/web/public/cerebro-logo.png`.
- Updated web metadata, package manifests, workspace imports, environment defaults, and operational docs to the new brand name.

# Why it changed
- The product brand changed and the repository needed a consistent rename across runtime surfaces, workspace identifiers, and active documentation.

# Impact (UI / logic / data)
- UI: Login, register, invite, main header, sidebar, settings/about, app metadata, and localized copy now show `Cerebro` and the new logo.
- Logic: Internal TypeScript imports and workspace package names now use the `@cerebro/*` scope; the chat system prompt and MFA issuer string now use `Cerebro`.
- Data: Default local Postgres database name changed from `playbook_brain` to `cerebro`; existing local environments using the old default need a DB rename or an explicit `DATABASE_URL`.

# Files touched
- `apps/web/src/app/*`, `apps/web/src/components/*`, `apps/web/messages/en.json`, `apps/web/public/cerebro-logo.png`
- `apps/api/package.json`, `apps/api/jest.config.js`, `apps/api/src/**/*`
- `packages/types/*`, `package.json`, `pnpm-lock.yaml`, `env.example`, `docker-compose.yml`, `ci.yml`
- `docs/**/*` (active docs only), `scripts/start.sh`, `Cerebro-Execution-Status.md`

# Date
- 2026-03-01
