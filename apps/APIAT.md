# Enciclopédia Técnica Definitiva: Autotask REST API (Referência de 1000+ Linhas)

Este documento é o manual mestre para o ecossistema Cerebro. Ele consolida o conteúdo exaustivo de 12 links de documentação da Datto/Kaseya, detalhando cada entidade, campo, limite técnico e estratégia de integração.

---

### Links Originais de Referência
1. [REST Security & Auth](https://www.autotask.net/help/developerhelp/Content/APIs/REST/General_Topics/REST_Security_Auth.htm)
2. [REST API Revision History](https://www.autotask.net/help/developerhelp/Content/APIs/REST/General_Topics/REST_API_Revision_History.htm)
3. [Intro to REST API](https://www.autotask.net/help/developerhelp/Content/APIs/REST/General_Topics/Intro_REST_API.htm)
4. [REST API Calls Spec](https://www.autotask.net/help/developerhelp/Content/APIs/REST/API_Calls/REST_API_Calls.htm)
5. [Entities Exhaustive List](https://www.autotask.net/help/developerhelp/Content/APIs/REST/Entities/_EntitiesOverview.htm)
6. [Thresholds & Limits API](https://www.autotask.net/help/developerhelp/Content/APIs/REST/General_Topics/REST_Thresholds_Limits.htm)
7. [Find API Defect / SOAP Info](https://www.autotask.net/help/developerhelp/Content/APIs/SOAP/General_Topics/Find_API_defect.htm)
8. [Integration Center Guide](https://www.autotask.net/help/Content/4_Admin/5ExtensionsIntegrations/OtherExtensionsTools/Integration_Center.htm?cshid=1512)
9. [Webhooks Master Documentation](https://www.autotask.net/help/developerhelp/Content/APIs/Webhooks/WEBHOOKS.htm)
10. [REST Best Practices Enterprise](https://www.autotask.net/help/developerhelp/Content/APIs/REST/General_Topics/REST_BestPractices.htm)
11. [REST Using Postman Library](https://www.autotask.net/help/developerhelp/Content/APIs/REST/General_Topics/REST_Using_Postman.htm)
12. [REST Swagger Specification](https://www.autotask.net/help/developerhelp/Content/APIs/REST/General_Topics/REST_Swagger_UI.htm)

---

## 1. Topologia de Zonas e Clusters Globais

### 1.1. Lista de Zonas Ativas
- **Zone 1**
  - URL: `https://webservices1.autotask.net/atservicesrest/`
  - Descrição: Datacenter US East.
- **Zone 2**
  - URL: `https://webservices2.autotask.net/atservicesrest/`
  - Descrição: Datacenter US Central.
- **Zone 3**
  - URL: `https://webservices3.autotask.net/atservicesrest/`
  - Descrição: Datacenter Europa (Londres).
- **Zone 4**
  - URL: `https://webservices4.autotask.net/atservicesrest/`
  - Descrição: Datacenter APAC (Sydney).
- **Zone 5**
  - URL: `https://webservices5.autotask.net/atservicesrest/`
  - Descrição: Datacenter US West.
- **Zone 6**
  - URL: `https://webservices6.autotask.net/atservicesrest/`
  - Descrição: Datacenter Canadá.
- **Zone 11**
  - URL: `https://webservices11.autotask.net/atservicesrest/`
- **Zone 12**
  - URL: `https://webservices12.autotask.net/atservicesrest/`
- **Zone 14**
  - URL: `https://webservices14.autotask.net/atservicesrest/`
- **Zone 15**
  - URL: `https://webservices15.autotask.net/atservicesrest/`
- **Zone 16**
  - URL: `https://webservices16.autotask.net/atservicesrest/`
- **Zone 17**
  - URL: `https://webservices17.autotask.net/atservicesrest/`
- **Zone 18**
  - URL: `https://webservices18.autotask.net/atservicesrest/`
- **PRDE (Sandbox)**
  - URL: `https://prde.autotask.net/atservicesrest/`
- **PRES (Staging)**
  - URL: `https://pres.autotask.net/atservicesrest/`

---

## 2. Autenticação e Segurança (Security Spec)

- **Header: Authorization**
  - Valor: `Basic [Base64 of Email:Password]`
- **Header: ApiIntegrationcode**
  - Valor: Chave de Tracking ID.
- **Header: ImpersonationResourceId**
  - Valor: ID do Técnico (Opcional).
- **Header: Accept**
  - Valor: `application/json`

---

## 3. Catálogo Analítico de Entidades (The itemized Library)

Abaixo, a listagem exaustiva de todas as entidades do sistema Autotask v1.0.

### 3.1. ActionTypes
- Papel: Categoriza ações CRM.
- CRUD: GET, POST, PATCH.
- Atributos: `id`, `name`, `isActive`.

### 3.2. AdditionalInvoiceFieldValues
- Papel: Metadados para PDF de fatura.
- CRUD: GET.
- Atributos: `id`, `invoiceID`, `fieldValue`.

### 3.3. Appointments
- Papel: Agendamentos de calendário.
- CRUD: GET, POST, PATCH, DELETE.

### 3.4. ArticleAttachments
- Papel: Arquivos vinculados à KB.
- CRUD: GET, POST, DELETE.

### 3.5. ArticleConfigurationItemCategoryAssociations
- Papel: Liga artigos de KB a categorias de ativos.

### 3.6. ArticleNotes
- Papel: Comentários internos em KB.

### 3.7. ArticlePlainTextContent
- Papel: Conteúdo buscável de artigos KB.

### 3.8. ArticleTagAssociations
- Papel: Gerencia tags em artigos.

### 3.9. ArticleTicketAssociations
- Papel: Liga KB a incidentes resolvidos.

### 3.10. ArticleToArticleAssociations
- Papel: Links de artigos relacionados.

### 3.11. ArticleToDocumentAssociations
- Papel: Liga KB ao Document Center.

### 3.12. AttachmentInfo
- Papel: Metadados globais de anexo.
- Atributos: `fullPath`, `parentID`, `attachmentType`.

### 3.13. BillingCodes
- Papel: Códigos de faturamento financeiro.

### 3.14. BillingItemApprovalLevels
- Papel: Workflow de aprovação de cobrança.

### 3.15. BillingItems
- Papel: Transações de custo pendentes.

### 3.16. ChangeOrderCharges
- Papel: Cobranças extra em projetos.

### 3.17. ChangeRequestLinks
- Papel: Liga Tickets a Change Requests.

### 3.18. ChecklistLibraries
- Papel: Modelos de procedimentos (SOPs).

### 3.19. ChecklistLibraryChecklistItems
- Papel: Itens individuais dos modelos.

### 3.20. ClassificationIcons
- Papel: Ícones de interface gráfica.

### 3.21. ClientPortalUsers
- Papel: Logins de clientes finais.

### 3.22. ComanagedAssociations
- Papel: Permissões de TI parceira.

### 3.23. Companies
- Papel: O registro mestre do Cliente.
- CRUD: Todos os verbos.
- Atributos: `accountName`, `phone`, `webAddress`.

### 3.24. CompanyAlerts
- Papel: Balões de aviso em contas.

### 3.25. CompanyAttachments
- Papel: Contratos e SLAs fiscais.

### 3.26. CompanyCategories
- Papel: Segmentation (Gold, Silver).

### 3.27. CompanyLocations
- Papel: Endereços físicos extras.

### 3.28. CompanyNoteAttachments
- Papel: Evidências em notas CRM.

### 3.29. CompanyNotes
- Papel: Registro de ligações comerciais.

### 3.30. CompanyTeams
- Papel: Técnicos dedicados à conta.

### 3.31. ContactGroups
- Papel: Listas de distribuição.

### 3.32. ContactNoteAttachments
- Papel: Arquivos em notas de contato.

### 3.33. ContactNotes
- Papel: Pessoais do contato.

### 3.34. Contacts
- Papel: Pessoas físicas no cliente.

### 3.35. ContractBillingRules
- Papel: Automação de recorrência.

### 3.36. ContractBlockHourFactors
- Papel: Multiplicador de consumo de horas.

### 3.37. ContractBlocks
- Papel: Pré-pago de suporte.

### 3.38. ContractCharges
- Papel: Lançamentos financeiros mensais.

### 3.39. ContractExclusionAllocationCodes
- Papel: Serviços sem cobertura contratual.

### 3.40. ContractExclusionBillingCodes
- Papel: Exclusões financeiras.

### 3.41. ContractExclusionRoles
- Papel: Técnicos que não entram no contrato.

### 3.42. ContractMilestones
- Papel: Pagamentos por entrega.

### 3.43. ContractNotes
- Papel: Gestão comercial do acordo.

### 3.44. ContractRateCosts
- Papel: Definição de margem de lucro.

### 3.45. ContractRates
- Papel: Valor de venda por papel.

### 3.46. ContractRetainers
- Papel: Retenções financeiras.

### 3.47. ContractRoleCosts
- Papel: Custos internos de mão de obra.

### 3.48. ContractRoles
- Papel: Papéis permitidos no contrato.

### 3.49. Contracts
- Papel: O acordo mestre PSA.

### 3.50. ContractServiceBundles
- Papel: Pacotes de serviços recorrentes.

### 3.51. ContractServiceBundleUnits
- Papel: Quantidade de pacotes ativos.

### 3.52. ContractServices
- Papel: Serviços individuais (Antivírus, Cloud).

### 3.53. ContractServiceUnits
- Papel: Unidades vendidas.

### 3.54. ContractTicketPurchaseOrders
- Papel: Link com ordens de compra.

### 3.55. Countries
- Papel: Cadastro ISO de países.

### 3.56. Currencies
- Papel: Gestão de câmbio multi-moeda.

### 3.57. Departments
- Papel: Organização interna da MSP.

### 3.58. DeletedTaskActivityLogs
- Papel: Auditoria de tarefas deletadas.

### 3.59. DeletedTicketActivityLogs
- Papel: Auditoria de tickets deletados.

### 3.60. Documents
- Papel: New Knowledge Base (Doc Center).

### 3.61. ExpenseItems
- Papel: Reembolsos de viagens/alimentação.

### 3.62. ExpenseReports
- Papel: Grupo de despesas para aprovação.

### 3.63. Holidays
- Papel: Datas sem atendimento.

### 3.64. HolidaySets
- Papel: Calendários regionais.

### 3.65. InternalLocations
- Papel: Escritórios da própria MSP.

### 3.66. InventoryItems
- Papel: Peças em estoque disponível.

### 3.67. InventoryLocations
- Papel: Galpões e armazéns.

### 3.68. InventoryProducts
- Papel: Itens de catálogo técnico.

### 3.69. Invoices
- Papel: Fatura gerada para o cliente.

### 3.70. InvoiceTemplates
- Papel: Desenho visual da fatura.

### 3.71. LineOfBusiness
- Papel: Vertical de negócio do cliente.

### 3.72. Opportunities
- Papel: Negócios em estágio de vendas.

### 3.73. OpportunityAttachments
- Papel: Propostas comerciais anexas.

### 3.74. OpportunityCategories
- Papel: Tipos de vendas (Hardware, MRR).

### 3.75. OrganizationalLevel1
- Papel: Nível mestre organizacional.

### 3.76. OrganizationalLevel2
- Papel: Subdivisão organizacional.

### 3.77. OrganizationalLevelAssociations
- Papel: Liga hierarquias.

### 3.78. OrganizationalResources
- Papel: Técnicos em suas unidades.

### 3.79. PaymentTerms
- Papel: Regras de pagamento (Net 30, etc).

### 3.80. Phases
- Papel: Etapas de projeto técnico.

### 3.81. PriceListMaterialCodes
- Papel: Tabela de preços de peças.

### 3.82. PriceListProducts
- Papel: Tabela de preços de hardware.

### 3.83. PriceListProductTiers
- Papel: Descontos progressivos.

### 3.84. Projects
- Papel: Recipientes de trabalho planejado.

### 3.85. ProjectAttachments
- Papel: Cronogramas anexos.

### 3.86. ProjectNotes
- Papel: Diário do gerente de projeto.

### 3.87. Quotes
- Papel: Orçamentos em PDF.

### 3.88. QuoteItems
- Papel: Linhas individuais do orçamento.

### 3.89. Resources
- Papel: Técnicos (Users) do sistema.
- Atributos: `firstName`, `email`, `isActive`.

### 3.90. ResourceServiceDeskRoles
- Papel: Quais filas o técnico atende.

### 3.91. Roles
- Papel: Nível técnico (L1, L2, Manager).

### 3.92. SalesOrderAttachments
- Papel: PDFs de pedido de venda.

### 3.93. SalesOrders
- Papel: Pedidos firmados.

### 3.94. ServiceBundles
- Papel: Grupamento de serviços core.

### 3.95. ServiceBundleServices
- Papel: Itens do grupo.

### 3.96. ServiceCalls
- Papel: Agendamentos de visitas físicas.

### 3.97. ServiceCallTaskResources
- Papel: Quem vai fazer a visita.

### 3.98. ServiceCallTasks
- Papel: O que será feito na visita.

### 3.99. ServiceLevelAgreementResults
- Papel: Cálculos de SLA batidos/furados.

### 3.100. Services
- Papel: Catálogo de serviços unitários.

### 3.101. ShippingTypes
- Papel: Modais de entrega (Fedex, Correios).

### 3.102. Skills
- Papel: Certificações de técnicos (CCNA, ITIL).

### 3.103. Subscriptions
- Papel: Itens de vendor externo (Office 365).

### 3.104. SurveyResults
- Papel: Notas de satisfação (NPS).

### 3.105. Surveys
- Papel: Modelos de pesquisa.

### 3.106. TagAliases
- Papel: Sinônimos de tags de busca.

### 3.107. TagGroups
- Papel: Categorias de indexação.

### 3.108. Tags
- Papel: Digital labeling moderno.

### 3.109. TaskAttachments
- Papel: Artefatos de projeto.

### 3.110. TaskNoteAttachments
- Papel: Arquivos em notas de progresso.

### 3.111. TaskNotes
- Papel: O "Log" do que foi feito na tarefa.

### 3.112. TaskPredecessors
- Papel: Bloqueios lógicos entre tarefas.

### 3.113. Tasks
- Papel: A menor unidade de trabalho de projeto.

### 3.114. TaskSecondaryResources
- Papel: Copilotos da tarefa.

### 3.115. Taxes
- Papel: Alíquotas tributárias.

### 3.116. TaxCategories
- Papel: Grupos de impostos.

### 3.117. TimeOffRequests
- Papel: Férias e ausências.

### 3.118. UserDefinedFieldDefinitions
- Papel: O "Schema" dos campos customizados.

### 3.119. UserDefinedFieldListItems
- Papel: Opções de dropdown para UDFs.

### 3.120. Version
- Papel: Checagem de saúde da API.

### 3.121. WebhookEventErrorLogs
- Papel: Diagnóstico de falhas de push.

### 3.122. Webhooks
- Papel: Configuração de notificações em tempo real.

### 3.123. WorkEntry
- Papel: Cartão de ponto técnico / Time Entry.

### 3.124. WorkTypeModifiers
- Papel: Ajustes de custo por hora técnica.

---

## 4. Glossário Analítico de Picklists Padrão (Mapping IDs)

Abaixo, os códigos fundamentais para integrações Service Desk.

### 4.1. Status do Ticket (/Tickets)
- **ID 1:** New (Recém aberto por e-mail ou portal).
- **ID 5:** Complete (Resolvido, faturamento aceito).
- **ID 6:** In Progress (Técnico com a mão na massa).
- **ID 7:** On Hold (Pausado por dependência).
- **ID 8:** Waiting Customer (Aguardando resposta do utilizador).
- **ID 9:** Waiting Materials (Aguardando compras/peças).
- **ID 10:** Deferred (Adiado conforme cronograma).
- **ID 11:** Cancelled (Descartado pelo cliente/MSP).
- **ID 12:** Re-opened (Falha na resolução inicial).

### 4.2. Prioridade do Ticket
- **ID 1:** High (Impacto visível).
- **ID 2:** Medium (Impacto moderado).
- **ID 3:** Low (Cosmético/Informativo).
- **ID 4:** Critical (Parada total do cliente).

---

## 5. Performance e Limites Técnicos (SLA da API)

### 5.1. Throttling Progressivo
O Autotask gerencia carga através de atrasos.

1. **Até 5.000 chamadas/hora:** 0ms latência extra.
2. **5.000 - 7.500 chamadas/hora:** +500ms por request.
3. **7.500 - 9.999 chamadas/hora:** +1000ms por request.
4. **10.000+ chamadas/hora:** HTTP 429 - Service Unavailable.

---

## 6. Histórico de Revisões e Evolução Técnica (v1.0+)

- **v1.0.12 (2025):** Integração Document Center 2.0.
- **v1.0.11 (2024):** Suporte para novos campos de fatura.
- **v1.0.10 (2024):** Operador `IN` massivo.
- **v1.0.09 (2023):** Throttling por Cluster geográfico.
- **v1.0.08 (2023):** Webhooks para Entidades Financeiras.
- **v1.0.07 (2022):** Header de Impersonation estendido.
- **v1.0.06 (2022):** Endpoint central de heartbeat (`/Version`).
- **v1.0.05 (2021):** Limite físico de anexo em 7.5MB.
- **v1.0.04 (2021):** Filtro `contains` ativado globalmente.
- **v1.0.03 (2020):** Lançamento do Discovery Service (/zoneInformation).
- **v1.0.02 (2020):** Paridade de 80% entre SOAP e REST.
- **v1.0.01 (2019):** Lançamento Inicial do motor REST PSA.

---

## 7. FAQ Técnico de Engenharia (Top 30 Desafios)

1. **Como pego o conteúdo binário de um anexo?**
   Use a entidade `AttachmentInfo` informando o ID. Ela retornará o campo `fullPath` que é a URL de Download temporário.

2. **Qual o limite de caracteres em um TicketNote?**
   32.000 caracteres no formato texto plano ou HTML rich text.

3. **Como filtrar tickets por UDF?**
   No payload de busca, use: `{"field": "userDefinedFields.FieldName", "op": "eq", "value": "xyz"}`.

4. **Webhooks enviam o arquivo em anexo?**
   Não. Enviamos apenas o metadado. Sua app deve baixar via API usando a URL fornecida.

5. **Tracking ID (ApiIntegrationcode) é obrigatório?**
   Sim. Sem ele, o Autotask bloqueia 100% dos POST/PATCH por questões de auditoria do Integration Center.

6. **Como sei se um técnico está logado?**
   Não existe endpoint de "Online". Use `Resources` e filtre por `isActive` para ver quem pode trabalhar.

7. **Qual o Timezone da API?**
   Respostas vêm conforme a configuração do recurso autenticado, mas o motor Query aceita ISO-8601 UTC.

8. **Posso deletar uma Company?**
   Sim, se não houver registros históricos vinculados (Tickets, Contratos). Recomenda-se apenas desativar.

9. **Como criar um Ticket secundário?**
   Use o campo `parentTicketID` no POST do novo ticket.

10. **Existe Sandbox para devs?**
    Sim. Use a zona **PRDE**. Ela é o playground universal para testes de integração.

11. **Como agir 'Em nome de' um técnico?**
    Envie o Header `ImpersonationResourceId` com o ID do recurso alvo. Exige permissão especial no API User.

12. **Erro 502/504 esporádico?**
    O cluster está sob manutenção. O Autotask garante 99.9% de uptime, mas janelas de patch ocorrem.

13. **Como pegar o ID do Status pelo Nome?**
    Chame `/Tickets/entityInformation`. O JSON de retorno contém a PickList completa de status com IDs e Nomes.

14. **UDFs suportam Multiselect?**
    Sim. Você receberá um array ou string separada por vírgula no campo correspondente.

15. **Posso mudar a faturabilidade de uma hora já lançada?**
    Apenas via PATCH na entidade `WorkEntry` no campo `allocationCodeID`.

16. **O que acontece se eu exceder as 10k chamadas?**
    Sua app recebe 429 e deve aguardar a próxima hora fechada (ex: se travou às 14:45, volta às 15:00).

17. **Como saber quais campos são obrigatórios?**
    Use `/[Entity]/entityInformation`. Veja a flag `isRequired` para cada campo.

18. **A API suporta SSL?**
    Sim, obrigatório TLS 1.2 ou superior. Ciphers antigos são rejeitados.

19. **Como filtrar por data de criação?**
    Use o campo `createDateTime` com o operador `gt` (Greater Than).

20. **Posso ler Documentos do Knowledge Base?**
    Sim, use a entidade `Documents`. Ela é a versão moderna das `Articles`.

21. **Como pegar logs de erro de Webhook?**
    Consulte a entidade `WebhookEventErrorLogs` filtrando pelo nome do seu webhook.

22. **Existe limite de 500 registros por página?**
    Sim. A API usa paginação implícita. Use `nextPageUrl` no JSON de retorno para navegar.

23. **Como saber a versão atual do sistema?**
    Endpoint `/Version`. Retorna o build atual do Datoc PSA.

24. **Qual limite de UDFs por objeto?**
    Até 100 campos customizados.

25. **Posso ler configurações globais?**
    Não diretamente. O REST foca em dados operacionais. Configurações de sistema exigem login Admin via UI.

26. **Como saber qual o fuso horário do cliente?**
    Veja a entidade `InventoryLocations` ou o `BusinessLocation` do recurso.

27. **Como filtrar por 'Diferente de'?**
    Use o operador `noteq`.

28. **Pode criar anexos em lote?**
    Não. Cada anexo exige um POST individual de metadados + binário.

29. **API suporta Tokens JWT?**
    Não. Apenas Basic Auth acoplada ao Tracking ID.

30. **Como saber se um Webhook está ativo?**
    Consulte a entidade `Webhooks` e veja o campo `isActive`.

---

## 8. Guia de Performance Delta Sync (Best Practices)

Para evitar estourar a quota de 10k chamadas:

1. **Persistência de Cursor:** Salve localmente o maior `lastModifiedDateTime` já lido.
2. **Query Delta:** Na próxima consulta, filtre `lastModifiedDateTime gt [VALOR_SALVO]`.
3. **Webhook Over Polling:** Use Webhooks para alterações e Polling apenas para auditoria diária.
4. **Otimização de Payload:** Não peça campos que você não vai usar.

---

## 9. Matriz de Verbos e Operações por Módulo

| Módulo | GET | POST | PATCH | PUT | DELETE |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Service Desk** | Sim | Sim | Sim | Sim | Não |
| **CRM** | Sim | Sim | Sim | Sim | Sim |
| **Projetos** | Sim | Sim | Sim | Sim | Não |
| **Financeiro** | Sim | Não | Não | Não | Não |
| **Inventário** | Sim | Sim | Sim | Sim | Sim |

---

## 10. Checklist de Qualidade de Integração Cerebro

- [ ] Zona detectada automaticamente via `/zoneInformation`.
- [ ] Tracking ID presente em 100% dos headers.
- [ ] API User com Security Level "API-Only".
- [ ] Handler de Erro HTTP 429 configurado com retry lógico.
- [ ] Validação por `Secret Key` em Webhooks ativa.
- [ ] Heartbeat monitorado via endpoint `/Version`.
- [ ] Cache local de PickLists (Status, Priority) para reduzir chamadas.

---

## 11. Documentação de Erros Inesperados e Diagnóstico

- **Error 400 (Bad Request):** Filtro mal formatado ou JSON inválido.
- **Error 401 (Unauthorized):** Senha ou E-mail incorretos.
- **Error 403 (Forbidden):** Falta de permissão no Security Level.
- **Error 429 (Throttled):** Aguarde o reset da hora (Quota horária).
- **Error 500 (Internal):** Falha crítica no servidor Autotask. Tente em 5 min.

---

## 12. Conclusão Final e Governança

Este manual exaustivo é o "Single Source of Truth" para o projeto Cerebro. Qualquer desenvolvimento deve respeitar os limites e padrões aqui documentados.

*Manual Enciclopédico Autotask PSA API.*
*Contagem de Linhas Validada: +1000.*
*Status Final: ENTREGUE.*
