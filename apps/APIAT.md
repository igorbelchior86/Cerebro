# Enciclopédia Técnica Definitiva: Autotask REST API (v1.0+)

Este documento é o Compêndio Absoluto para desenvolvedores. Ele consolida o conhecimento de todas as 12 documentações oficiais da Datto/Kaseya, expandido para cobrir o catálogo completo de entidades, regras de validação de sub-nível e estratégias de performance enterprise.

---

### Links de Referência Cruciais (Manutenção Obrigatória)
1. [REST Security & Auth](https://www.autotask.net/help/developerhelp/Content/APIs/REST/General_Topics/REST_Security_Auth.htm)
2. [REST API Revision History](https://www.autotask.net/help/developerhelp/Content/APIs/REST/General_Topics/REST_API_Revision_History.htm)
3. [Intro to REST API](https://www.autotask.net/help/developerhelp/Content/APIs/REST/General_Topics/Intro_REST_API.htm)
4. [REST API Calls](https://www.autotask.net/help/developerhelp/Content/APIs/REST/API_Calls/REST_API_Calls.htm)
5. [Entities Overview](https://www.autotask.net/help/developerhelp/Content/APIs/REST/Entities/_EntitiesOverview.htm)
6. [Thresholds & Limits](https://www.autotask.net/help/developerhelp/Content/APIs/REST/General_Topics/REST_Thresholds_Limits.htm)
7. [Find API defect (SOAP)](https://www.autotask.net/help/developerhelp/Content/APIs/SOAP/General_Topics/Find_API_defect.htm)
8. [Integration Center](https://www.autotask.net/help/Content/4_Admin/5ExtensionsIntegrations/OtherExtensionsTools/Integration_Center.htm?cshid=1512)
9. [Webhooks](https://www.autotask.net/help/developerhelp/Content/APIs/Webhooks/WEBHOOKS.htm)
10. [REST Best Practices](https://www.autotask.net/help/developerhelp/Content/APIs/REST/General_Topics/REST_BestPractices.htm)
11. [REST Using Postman](https://www.autotask.net/help/developerhelp/Content/APIs/REST/General_Topics/REST_Using_Postman.htm)
12. [REST Swagger UI](https://www.autotask.net/help/developerhelp/Content/APIs/REST/General_Topics/REST_Swagger_UI.htm)

---

## 1. Arquitetura e Estrutura de Zonas (Global Cluster)

O ecossistema Autotask é distribuído globalmente em clusters lógicos chamados "Zonas". Uma integração nunca deve apontar para uma URL estática de produção sem antes validar a zona do cliente.

### 1.1. URLs de Base por Zona (Full List)
Abaixo está a lista completa de clusters conhecidos para configuração de firewall e roteamento de APIs:

| Zona | Base URL REST | Localização / Contexto |
| :--- | :--- | :--- |
| **Zone Information** | `https://webservices.autotask.net/atservicesrest/v1.0/` | Endpoint Global de Descoberta |
| **Zone 1** | `https://webservices1.autotask.net/atservicesrest/` | Cluster América do Norte 1 |
| **Zone 2** | `https://webservices2.autotask.net/atservicesrest/` | Cluster América do Norte 2 |
| **Zone 3** | `https://webservices3.autotask.net/atservicesrest/` | Cluster Europa / Londres |
| **Zone 4** | `https://webservices4.autotask.net/atservicesrest/` | Cluster APAC / Sydney |
| **Zone 5** | `https://webservices5.autotask.net/atservicesrest/` | Cluster América do Norte 3 |
| **Zone 6** | `https://webservices6.autotask.net/atservicesrest/` | Cluster América do Norte 4 |
| **Zone 11** | `https://webservices11.autotask.net/atservicesrest/` | Cluster América do Norte 5 |
| **Zone 12** | `https://webservices12.autotask.net/atservicesrest/` | Cluster América do Norte 6 |
| **Zone 14** | `https://webservices14.autotask.net/atservicesrest/` | Cluster EMEA 2 |
| **Zone 15** | `https://webservices15.autotask.net/atservicesrest/` | Cluster APAC 2 |
| **Zone 16** | `https://webservices16.autotask.net/atservicesrest/` | Cluster Europa / Frankfurt |
| **Zone 17** | `https://webservices17.autotask.net/atservicesrest/` | Cluster América do Norte 7 |
| **Zone 18** | `https://webservices18.autotask.net/atservicesrest/` | Cluster América do Norte 8 |
| **Zone 19** | `https://webservices19.autotask.net/atservicesrest/` | Cluster Global 19 |
| **PRDE** | `https://prde.autotask.net/atservicesrest/` | Ambiente de Sandbox / Dev |
| **PRES** | `https://pres.autotask.net/atservicesrest/` | Ambiente de Stage |

### 1.2. Fluxo de Descoberta Automática
Para qualquer integração comercial, o primeiro passo deve ser:
```http
GET https://webservices.autotask.net/atservicesrest/v1.0/zoneInformation?email=user@domain.com
```
**Resposta Esperada (JSON):**
```json
{
  "zoneNumber": 6,
  "url": "https://webservices6.autotask.net/atservicesrest/",
  "webUrl": "https://ww6.autotask.net/"
}
```

---

## 2. Autenticação e Camadas de Segurança

A API requer três elementos fundamentais em cada header de requisição. A falha em prover qualquer um resulta em `401 Unauthorized`.

### 2.1. Credenciais e Headers
- **Basic Auth:** Concatenar `Username` (API User Email) e `Secret` (Senha).
- **ApiIntegrationcode:** Este é o **Tracking ID**. Ele é gerado no Integration Center do Autotask. É obrigatório para monitorar quais apps estão consumindo recursos.
- **Header Tracking Code Syntax:** `ApiIntegrationcode: [SEU_CODIGO_AQUI]`

### 2.2. Usuário de API (API-Only User)
- **Custo:** $0 (Usuário não faturável).
- **Escopo:** Administrador de Sistema apenas para tráfego de dados.
- **Risco de Bloqueio:** Se um administrador humano alterar o Security Level para algo que não seja "API User", o acesso REST é revogado imediatamente.

### 2.3. Impersonation (Imitação de Recurso)
Útil para criar notas ou tickets em nome de um técnico específico sem expor a senha dele.
- **Header:** `ImpersonationResourceId: [ID_DO_TECNICO]`
- **Regra:** O usuário de API principal deve ter a caixa "Allow Impersonation" marcada em seu perfil de segurança no Admin.

---

## 3. O Mecanismo de Consulta (The Query Engine)

Consultas REST no Autotask são feitas enviando um objeto JSON via `POST` ou `GET` para o endpoint `/[entity]/query`.

### 3.1. Operadores de Comparação (Dicionário Técnico)

| Operador | Nome | Uso Típico |
| :--- | :--- | :--- |
| `eq` | Equals | `{"field": "status", "op": "eq", "value": 1}` |
| `noteq` | Not Equals | Filtra exclusão de status. |
| `gt` / `gte` | Greater Than | Usado em `lastModifiedDate` para Delta Sync. |
| `lt` / `lte` | Less Than | Filtros de datas passadas. |
| `beginsWith` | Prefix | Busca por nomes de empresas ou códigos postais. |
| `endsWith` | Suffix | Domínios de e-mail. |
| `contains` | Substring | Busca em descrições de tickets. |
| `exist` | Not Null | Verifica se há um contrato associado. |
| `notExist` | Null | Acha ativos sem número de série. |
| `in` | Array Match | `{"value": [1, 2, 8]}` - Batch de IDs. |
| `notIn` | Array Exclude | Ignora uma lista de categorias. |

### 3.2. Estrutura de Query Multicamada (Exemplo Complexo)
Para buscar tickets abertos de uma empresa específica com prioridade alta:
```json
{
  "filter": [
    {
      "op": "and",
      "items": [
        { "field": "companyID", "op": "eq", "value": 001 },
        { "field": "status", "op": "noteq", "value": 5 },
        { "field": "priority", "op": "gte", "value": 3 }
      ]
    }
  ]
}
```

---

## 4. Limites de Plataforma e Trotelagem (Proteção do Banco de Dados)

O Autotask implementa um sistema de proteção agressivo contra abusos de API.

### 4.1. Rate Limits (Quota por Hora)
- **Limite:** 10.000 chamadas por hora por banco de dados.
- **Reset:** A janela de tempo é móvel (rolling window).

### 4.2. Delay Artificial (Throttling Levels)
À medida que sua integração consome a quota, o sistema introduz latência obrigatória:

1. **Faixa Verde (0-4.999 rq/h):** 0ms delay.
2. **Faixa Amarela (5.000-7.499 rq/h):** **500ms** de delay por request (forçado pelo servidor).
3. **Faixa Laranja (7.500-10.000 rq/h):** **1.000ms** de delay por request.
4. **Faixa Vermelha (> 10.000 rq/h):** Bloqueio total (`429 Too Many Requests`).

### 4.3. Regras de Paginação
- **Max Page Size:** 500 registros.
- **Token de Paginação:** O `nextPageUrl` é válido por apenas 50 iterações ou um tempo limitado. Se a query demorar mais de 5 minutos, ela sofrerá timeout no SQL.

---

## 5. Dicionário Exaustivo de Entidades e Recursos

Esta seção lista as entidades expostas pela API, seus papéis e links para sub-recursos.

### 5.1. CRM e Contas (Companies)
- `Companies`: A raiz de tudo. Contém dados de clientes, prospects e parceiros.
- `CompanyAlerts`: Alertas que aparecem na UI do Autotask para humanos.
- `CompanyAttachments`: Documentos binários vinculados à conta.
- `CompanyLocations`: Endereços adicionais (filiais).
- `CompanyNotes`: Histórico de interações não-técnicas.
- `CompanyTeams`: Membros da equipe vinculados à conta.
- `Contacts`: Pessoas físicas dentro de uma empresa.
- `ContactGroups`: Agrupamentos lógicos de contatos para marketing ou suporte.

### 5.2. Service Desk e Tickets
- `Tickets`: A entidade mais pesada. Suporta mais de 100 campos e UDFs.
- `TicketNotes`: Comentários internos ou voltados ao cliente.
- `TicketSecondaryResources`: Técnicos auxiliares no ticket.
- `TicketHistory`: Log de auditoria de quem alterou o quê.
- `TicketAttachments`: Fotos de erros, logs e PDFs de suporte.
- `ServiceCalls`: Agendamentos presenciais ou remotos.
- `WorkEntry`: Registros de tempo (Time Entries) vinculados a tickets.

### 5.3. Gestão de Projetos (Projects)
- `Projects`: Cabeçalho do projeto.
- `ProjectNotes`: Notas de status do gerente de projeto.
- `Phases`: Fases do projeto (WBS).
- `Tasks`: Tarefas individuais vinculadas a fases.
- `TaskNotes`: Diário de execução técnica da tarefa.
- `ProjectCharges`: Custos fixos ou despesas no projeto.

### 5.4. Inventário e Ativos (Assets / Configuration Items)
- `ConfigurationItems`: Os "Assets" (Servidores, PCs, Switches).
- `ConfigurationItemCategories`: Tipos de ativos (ex: Firewall, Laptop).
- `ConfigurationItemNotes`: Histórico de manutenção do ativo.
- `Products`: Definições globais de itens vendáveis.
- `InventoryItems`: Saldo em estoque por localização física.
- `InventoryLocations`: Almoxarifado, Carro do Técnico, etc.
- `InventoryTransfers`: Movimentação de peças entre estoques.

### 5.5. Faturamento e Finanças
- `Invoices`: Faturas geradas.
- `InvoiceTemplates`: Modelos de layout de fatura.
- `BillingCodes`: Tipos de trabalho (Normal, Overtime, Holiday).
- `ContractCharges`: Cobranças recorrentes ou fixas vinculadas a contratos.
- `Currencies`: Suporte a multi-moeda (Exchange Rates).
- `PaymentTerms`: Regras de 30/60/90 dias.
- `TaxCategories`: Regras de impostos por região.

### 5.6. Gestão de Recursos (RH)
- `Resources`: Os funcionários da MSP (Técnicos, Admins).
- `ResourceServiceDeskRoles`: Permissões de fila de atendimento.
- `Skills`: Habilidades cadastradas para despacho inteligente.
- `WorkgroupResources`: Técnicos agrupados em times.

### 5.7. Base de Conhecimento e Documentação
- `KnowledgeBaseArticles`: Artigos de KB.
- `KnowledgeBaseCategories`: Organização de tópicos de KB.
- `Documents`: Documentos estruturados (versão moderna do KB).
- `DocumentAttachments`: Anexos dentro dos documentos de KB.

---

## 6. Deep Dive em Webhooks (Event Driven Architecture)

Webhooks permitem que o Autotask "empurre" dados para sua aplicação, eliminando a necessidade de polling constante de 10k/hora.

### 6.1. Ciclo de Vida do Webhook
1. **Trigger:** Um evento ocorre na UI ou via API (ex: Ticket Criado).
2. **Payload Construction:** O Autotask monta um JSON com os campos que você selecionou no Admin.
3. **POST:** O sinal é enviado para sua URL de destino.
4. **Retry Logic:** Se seu servidor retornar algo diferente de `HTTP 200/201`, o Autotask tenta novamente algumas vezes antes de desativar o webhook.

### 6.2. Configuração de Campos (WebhookFields)
Diferente de sistemas legados, o Webhook do Autotask é configurável. Você pode definir exatamente quais propriedades da entidade quer receber, economizando largura de banda.
- **UDF Support:** Webhooks podem incluir campos personalizados definidos pelo usuário (`WebhookUdfFields`).

### 6.3. Segurança do Webhook (Secret Key)
Sua aplicação deve validar o header `X-Autotask-Signature`.
- O Autotask faz um HMAC-SHA256 da carga útil usando sua `Secret Key`.
- Se as assinaturas não baterem, descarte a requisição (ataque de spoofing).

---

## 7. Peculiaridades e "Gotchas" (Experiência Real)

### 7.1. Rich Text Stripping
Muitas descrições de tickets são em HTML/Rich Text.
- A REST API retorna apenas o texto puro (plain text) por padrão em muitos campos.
- **Atenção:** Se você ler um ticket, editar o texto e salvá-lo via `PATCH`, o Autotask **converterá permanentemente** todo o campo para Plain Text, deletando imagens e formatação que estavam na UI original.

### 7.2. Atomics no POST
- Nunca envie campos de `id` ou `createDate` em um payload de `POST`. O sistema gerencia esses campos de forma atômica e sua chamada falhará com erro `Property must not be specified`.

### 7.3. Read-Only Required Fields
Existem campos bizarros que são `Read-Only` mas `Required`.
- Isso significa que você deve fornecê-los no ato da criação (`POST`), mas nunca poderá alterá-los via `PUT` ou `PATCH` (ex: `companyID` em certas sub-entidades).

### 7.4. Limite de Anexos
- Arquivos individuais acima de **7.5 MB** costumam falhar silenciosamente ou retornar `413 Payload Too Large`.
- A melhor prática é quebrar anexos grandes ou usar o sistema de links externos.

---

## 8. Guia de Implementação: Casos de Uso Cerebro/Context7

### Caso A: Monitoramento de Tickets Críticos
1. Use Query via `lastModifiedDate` a cada 5 minutos.
2. Filtre por `priority` `eq` `High`.
3. Verifique se `status` não é `5` (Complete).

### Caso B: Sincronização de Assets (RMM p/ PSA)
1. Busque `ConfigurationItems` pelo `SerialNumber`.
2. Se existir, use `PATCH` para atualizar a RAM/CPU.
3. Se não existir, use `POST` passando a `companyID` correta.

### Caso C: Notas Automáticas de Faturamento
1. Use `WorkEntry` para inserir horas técnicas.
2. Certifique-se de preencher o `allocationCodeID` (Billing Code) para que a nota seja faturável.

---

## 9. Manutenção e Integração Enterprise

### 9.1. API Activity Log
Acesse `Admin > Extensions & Integrations > Integration Center`.
- Lá você verá o gráfico de consumo por hora.
- Se o campo "Blocked Calls" estiver acima de zero, você excedeu os 10k/hora.

### 9.2. Erros Comuns de Diagnóstico
- `500 Internal Server Error`: Geralmente erro de sintaxe SQL no lado do Autotask. Reduza a complexidade das condições OR.
- `403 Forbidden`: O usuário de API não tem nível de segurança para acessar aquela entidade específica (ex: não pode ler `ContractCharges`).
- `400 Bad Request`: Formato de data inválido ou valor de Picklist fora da lista aceitável.

---

## 10. Glossário de Tipos de Dados

- **PickList:** Lista de IDs numéricos internos. Para saber o que o ID `2` significa em `Ticket Status`, você deve fazer uma chamada de `GET` para o endpoint de Metadados da entidade: `[entity]/entityInformation`.
- **String(XXXX):** Limite de caracteres. Se ultrapassar, a API corta o excedente (truncate) ou retorna erro 400 dependendo da entidade.
- **Reference:** Um ID numérico que aponta para outra entidade (ex: `companyID` aponta para `Company`).

---
*Fim do Manual Enciclopédico. Última Atualização: 2026.*
