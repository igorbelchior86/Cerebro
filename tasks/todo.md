# Task: Separar Preferências de Usuário vs. Configurações de Workspace
**Status**: done
**Started**: 2026-02-19T19:17

## Plan
- [x] Step 1: Criar migration `006_workspace_settings.sql`
- [x] Step 2: Rodar migration no banco local
- [x] Step 3: Remover `ensureTable()` e adicionar `tenant_id` nos INSERT/UPSERT em `integrations.ts`
- [x] Step 4: Criar endpoints `GET/PATCH /auth/workspace/settings` em `auth.ts`
- [x] Step 5: Reorganizar sidebar do `SettingsModal` em dois grupos (My Preferences / Workspace)
- [x] Step 6: Mover polling interval e LLM settings para workspace-level
- [x] Step 7: TypeScript check (`tsc --noEmit`) — API clean, Web clean (2 pre-existing ChatMessage errors only)
- [x] Step 8: Verificação visual no browser — confirmado
