# Task: Corrigir pipeline automático de geração de playbook
**Status**: completed
**Started**: 2026-02-20

## Plan
- [x] Step 1: Reproduzir fluxo e identificar quebra (trigger -> orchestrator -> playbook)
- [x] Step 2: Corrigir causa raiz com mínima mudança
- [x] Step 3: Validar geração automática / status de falha transparente
- [x] Step 4: Documentar resultado e comandos operacionais

## Open Questions
- Quota atual do Gemini no projeto pode bloquear geração contínua (429 RESOURCE_EXHAUSTED).

## Progress Notes
- Corrigido orquestrador para schema real do banco (`llm_outputs`, `validation_results`, `playbooks`).
- Adicionado polling automático de ingestão de e-mail no startup da API.
- Adicionado backfill automático de tickets já existentes sem playbook.
- Corrigido `/playbook/full-flow` para ler conteúdo final da tabela `playbooks` (não apenas metadado em `llm_outputs`).
- Ajustado reprocessamento de sessão `approved` sem playbook.
- Corrigido diagnóstico fallback para evitar estado inválido `approved + safe=false` por parse quebrado.
- Provider Gemini parametrizado por env (`GEMINI_MODEL`) com default `gemini-1.5-flash`.

## Review
- What worked:
  - Pipeline automático passou a ser disparado por polling/backfill sem ação manual.
  - Sessões inconsistentes agora entram em reprocessamento automático.
  - Falhas de LLM agora marcam sessão como `failed` de forma explícita.
- What was tricky:
  - Parte do código estava desalinhada com o schema atual do DB, gerando falhas silenciosas no fluxo automático.
  - Limite de quota do Gemini (429) impede geração contínua independentemente da correção de código.
- Time taken:
  - ~55 minutos
