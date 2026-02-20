# Contrato de execução (UI Engineer)

## O que pode ser alterado
- Tokens de design (cores, spacing, typography) quando existirem
- Estilos/Componentes reutilizáveis (preferência)
- Views específicas apenas quando necessário

## O que NÃO pode acontecer
- Remover funcionalidades ou fluxos
- Refatorações grandes por “limpeza”
- Mudanças de arquitetura
- Introduzir novas dependências sem necessidade

## Ordem recomendada
1. Resolver tokens e componentes compartilhados
2. Ajustar telas específicas
3. Garantir consistência global

## Quando bloquear
Bloquear (não executar) se:
- Finding depende de dados ausentes (`insufficient_data` ou falta de confirmação no código)
- Mudança exigiria re-arquitetura
- Risco de regressão alto sem testes disponíveis

Bloqueio deve ser registrado em IMPLEMENTATION_REPORT.md com:
- rule_id
- motivo
- o que falta para destravar
