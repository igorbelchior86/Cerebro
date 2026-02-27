# Title
Sidebar right: edição de Org/User/Tech com busca Autotask

# What changed
- Adicionado pencil icon no canto superior direito interno dos cards `Org`, `User` e `Tech` no bloco `Context` da sidebar direita.
- Adicionado modal de busca/seleção para editar os três campos com dados vindos do Autotask.
- `User` agora é dependente de `Org`: a listagem de usuários usa filtro por `companyID` da org selecionada.
- Para `Tech`, a seleção dispara o workflow command existente (`update_assign`) usando `resource_id` real.
- Backend recebeu endpoints read-only para busca de companies/contacts/resources.

# Why it changed
- Permitir edição operacional rápida dos campos contextuais diretamente na sidebar direita, sem sair do fluxo de triagem.
- Garantir coerência de domínio entre organização e usuário (`user` scoped pela `org`).
- Reusar integração Autotask como fonte de dados para as escolhas de contexto.

# Impact (UI / logic / data)
- UI: novos botões de edição e modal de seleção em `Context`.
- Logic: estado local de override para `Org/User/Tech`, regra de dependência `User -> Org`, e submit automático de assignment para `Tech`.
- Data: leitura adicional em endpoints Autotask de busca; sem mudança de schema.

# Files touched
- `apps/web/src/components/PlaybookPanel.tsx`
- `apps/web/src/app/[locale]/(chat)/triage/[id]/page.tsx`
- `apps/web/src/lib/p0-ui-client.ts`
- `apps/api/src/routes/autotask.ts`
- `apps/api/src/clients/autotask.ts`

# Date
2026-02-27
