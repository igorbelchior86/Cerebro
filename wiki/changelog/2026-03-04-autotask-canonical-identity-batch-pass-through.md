# Autotask canonical identity batch pass-through
# What changed
- O poller de Autotask passou a resolver identidade canônica (`company_name`, `requester/contact_name`, `contact_email`) em batch antes da emissão de `ticket.sync`.
- Foi adicionada resolução complementar por `companyID/contactID` via `getCompany`/`getContact` somente quando `searchTickets` não trouxer nome direto.
- O payload enviado ao workflow inbox agora inclui esses campos já prontos, mantendo o modelo canonical-first (sem hidratação no GET).

# Why it changed
- Após remover enriquecimento no read-path, tickets cujo payload de busca vinha sem `companyName/contactName` continuavam chegando no inbox com lacuna de identidade, levando a `—` no card da sidebar.

# Impact (UI / logic / data)
- UI: cards da sidebar voltam a exibir `Org` e `Requester` sem depender de hidratação tardia.
- Logic: ingestão do poller garante pass-through canônico completo para campos de identidade essenciais.
- Data: `domain_snapshots.tickets` recebe nomes de organização/contato já resolvidos no momento da escrita do evento.

# Files touched
- apps/api/src/services/adapters/autotask-polling.ts
- tasks/lessons.md

# Date
- 2026-03-04
