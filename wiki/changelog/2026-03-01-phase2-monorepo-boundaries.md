# Refactoring Phase 2 — Monorepo Boundary Definition

## What changed

Criação de dois novos packages no workspace do monorepo:
- `packages/platform` — primitivas de plataforma (observability, policy, auth, tenant, errors, queues)
- `packages/integrations` — clients de integrações externas (Autotask, IT Glue, NinjaOne)

Os diretórios originais em `apps/api/src/` foram convertidos em **shims de re-export** para os novos packages, garantindo compatibilidade com zero alteração de imports existentes.

### Novos packages criados

**`@cerebro/platform`** (`packages/platform/`):
- 13 arquivos fonte migrados de `apps/api/src/platform/`
- `lib/tenantContext.ts` incluído (dep interna de `request-context` e `tenant-scope`)
- Import fixado: `request-context.ts` e `tenant-scope.ts` atualizados de `../lib/tenantContext.js` → `./lib/tenantContext.js`
- Deps: `@cerebro/types: workspace:*`, `express` (peer), `@types/express`, `@types/node`

**`@cerebro/integrations`** (`packages/integrations/`):
- 3 clients migrados de `apps/api/src/clients/`
- Sub-exports por integração: `./autotask`, `./itglue`, `./ninjaone`
- Deps: `@cerebro/types: workspace:*`, `@types/node`

### Shims de re-export
Todos os arquivos em `apps/api/src/platform/*.ts` e `apps/api/src/clients/*.ts` foram substituídos por:
```ts
// Shim: re-exported from @cerebro/platform
export * from '@cerebro/platform';
```

### Dependências adicionadas
`apps/api/package.json` agora inclui:
- `"@cerebro/platform": "workspace:*"`
- `"@cerebro/integrations": "workspace:*"`

## Why it changed

- `apps/api` concentrava código de plataforma e adapters que são reutilizáveis e devem ter boundaries claros
- A extração cria packages testáveis de forma independente e sem acoplamento com Express/DB da API
- Novos workers ou microsserviços podem consumir `@cerebro/platform` e `@cerebro/integrations` sem depender de `apps/api`

## Impact
- **UI**: Nenhum
- **Logic**: Nenhum — shims garantem que o runtime da API não mudou
- **Data**: Nenhum

## Verification
`pnpm typecheck`: PASS 5/5 packages (packages/types, packages/platform, packages/integrations, apps/api, apps/web)

## Files touched
- `packages/platform/package.json` (novo)
- `packages/platform/tsconfig.json` (novo)
- `packages/platform/src/*.ts` (13 arquivos + lib/tenantContext.ts)
- `packages/integrations/package.json` (novo)
- `packages/integrations/tsconfig.json` (novo)
- `packages/integrations/src/autotask/client.ts` (novo)
- `packages/integrations/src/itglue/client.ts` (novo)
- `packages/integrations/src/ninjaone/client.ts` (novo)
- `apps/api/src/platform/*.ts` (convertidos em shims)
- `apps/api/src/clients/*.ts` (convertidos em shims)
- `apps/api/package.json` (deps adicionadas)

## Date
2026-03-01
