# Refactoring Phase 1 — Repository Hygiene

## What changed
Limpeza estrutural do repositório sem alteração de código de produto.

### Removido do tracking (git rm --cached)
- `.run/api.pid`, `.run/dev.pid`, `.run/web.pid` — PIDs de processo de dev
- `apps/api/.run/p0-rollout-control.json`, `apps/api/.run/p0-trust-store.json`, `apps/api/.run/p0-workflow-runtime.json` — estado de runtime
- 641 arquivos em `apps/web/.next.stale.*/` — 4 builds Next.js stale versionados
- `index.ts` (raiz) — duplicata de tipos de `packages/types`
- `org_name` — arquivo de configuração operacional sem contexto
- `patch.js` (raiz) — one-shot script de manipulação de texto para `ChatInput.tsx`, já aplicado e obsoleto

### Movido para `scripts/ops/`
11 scripts operacionais que estavam na raiz de `apps/api/`:
`fix-db.cjs`, `test-groq.js`, `tmp-autotask-ticket-shape.ts`, `tmp-check-summary.cjs`,
`tmp-force-approve-all.ts`, `tmp-force-approve-remaining.cjs`, `tmp-reprocess-failed.ts`,
`tmp-reset-and-reprocess-all.ts`, `tmp-reset-ticket-check.cjs`, `tmp-reset-ticket-delete.cjs`, `tmp-ticket-report.cjs`

### .gitignore fortalecido
Novos padrões adicionados:
- `.run/`, `apps/api/.run/`, `*.pid`
- `.DS_Store`, `Thumbs.db`
- `.next.stale*/`
- `apps/api/tmp-*`, `apps/api/fix-*.cjs`, `apps/api/test-*.js`
- `patch.js`, `index.ts`, `org_name`

### Criado
- `scripts/ops/README.md` — documenta propósito, risco e uso de cada script operacional

## Why it changed
O repositório acumulou artefatos de runtime, builds estáticos e scripts one-shot commitados juntos com código de produto. Isso:
- aumenta noise nos diffs de code review
- cria risco de vazar estado de ambiente em PRs
- confunde "source of truth" com "artefato gerado"

## Impact
- **UI**: Nenhum
- **Logic**: Nenhum — zero arquivos de código de produção alterados
- **Data**: Nenhum

## Files touched
- `.gitignore` (modificado)
- `scripts/ops/README.md` (criado)
- `scripts/ops/fix-db.cjs` (movido de `apps/api/`)
- `scripts/ops/test-groq.js` (movido de `apps/api/`)
- `scripts/ops/tmp-*.ts/.cjs` (10 arquivos movidos de `apps/api/`)
- 641 arquivos `.next.stale*` (desindexados, presentes em disco mas não no git)
- 6 arquivos `.run/*.json|.pid` (desindexados)
- `index.ts`, `org_name`, `patch.js` raiz (desindexados)

## Date
2026-03-01
