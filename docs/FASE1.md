# Fase 1: Conectores Read-Only para Autotask, NinjaOne e IT Glue

## ✅ Concluído

A Fase 1 implementa conectores **read-only** para integração com três ferramentas principais:

### 📦 Estrutura do Projeto

```
Cerebro/
├── packages/
│   └── types/               # Tipos compartilhados
│       ├── src/index.ts     # Definição de tipos
│       ├── package.json
│       └── tsconfig.json
├── apps/
│   └── api/                 # Servidor Express com conectores
│       ├── src/
│       │   ├── index.ts     # Servidor principal
│       │   ├── clients/     # Conectores para APIs
│       │   │   ├── autotask.ts
│       │   │   ├── ninjaone.ts
│       │   │   ├── itglue.ts
│       │   │   └── index.ts
│       │   └── routes/      # Endpoints HTTP
│       │       ├── autotask.ts
│       │       ├── ninjaone.ts
│       │       └── itglue.ts
│       ├── package.json
│       └── tsconfig.json
└── pnpm-workspace.yaml      # Configuração monorepo
```

### 🔌 Conectores Implementados

#### 1. **AutotaskClient**
- ✅ Autenticação via API Key
- ✅ Buscar ticket por ID
- ✅ Pesquisar tickets
- ✅ Buscar informações de dispositivos
- ✅ Obter notas de ticket

**Endpoints HTTP:**
```
GET  /autotask/ticket/:id
GET  /autotask/tickets/search?filter=<query>
GET  /autotask/device/:id
GET  /autotask/company/:companyId/devices
GET  /autotask/ticket/:id/notes
```

#### 2. **NinjaOneClient**
- ✅ Autenticação OAuth 2.0 (client credentials flow)
- ✅ Token refresh automático
- ✅ Buscar dispositivo por ID
- ✅ Listar todos os dispositivos
- ✅ Listar dispositivos por organização
- ✅ Obter health checks de dispositivos
- ✅ Obter detalhes do dispositivo

**Endpoints HTTP:**
```
GET  /ninjaone/device/:id
GET  /ninjaone/devices?limit=<n>&after=<cursor>
GET  /ninjaone/organization/:organizationId/devices?limit=<n>
GET  /ninjaone/device/:id/checks
GET  /ninjaone/device/:id/details
```

#### 3. **ITGlueClient**
- ✅ Autenticação via API Key
- ✅ Pesquisar documentos
- ✅ Buscar documento por ID
- ✅ Listar documentos por organização
- ✅ Filtrar documentos por tipo
- ✅ Buscar runbooks
- ✅ Obter tipos de flexible assets
- ✅ Obter flexible assets

**Endpoints HTTP:**
```
GET  /itglue/documents/search?q=<query>&org=<orgId>
GET  /itglue/document/:id
GET  /itglue/organization/:organizationId/documents
GET  /itglue/documents/by-type?type=<type>&org=<orgId>
GET  /itglue/runbooks?org=<orgId>
GET  /itglue/flexible-asset-types
GET  /itglue/flexible-assets/:assetTypeId?org=<orgId>
```

### 🔐 Variáveis de Ambiente Necessárias

```bash
# Autotask
AUTOTASK_API_KEY=your_api_key

# NinjaOne
NINJAONE_CLIENT_ID=your_client_id
NINJAONE_CLIENT_SECRET=your_client_secret

# IT Glue
ITGLUE_API_KEY=your_api_key

# API
PORT=3000
```

### 🚀 Como Usar

1. **Instalar dependências:**
   ```bash
   pnpm install
   ```

2. **Preparar ambiente:**
   ```bash
   cp env.example .env
   # Editar .env com as chaves de API
   ```

3. **Iniciar servidor:**
   ```bash
   pnpm --filter @playbook-brain/api dev
   ```

4. **Testar conexão:**
   ```bash
   curl http://localhost:3000/health
   ```

### 📝 Exemplos de Requisições

**Buscar um ticket no Autotask:**
```bash
curl http://localhost:3000/autotask/ticket/12345
```

**Listar dispositivos do NinjaOne:**
```bash
curl http://localhost:3000/ninjaone/devices?limit=10
```

**Pesquisar documentos no IT Glue:**
```bash
curl "http://localhost:3000/itglue/documents/search?q=password%20policy"
```

### ✨ Características

- ✅ **Read-Only**: Todos os conectores apenas consultam dados, sem modificações
- ✅ **Tipadas**: Tipos TypeScript completos para todas as respostas
- ✅ **Monorepo**: Estrutura escalável com pnpm workspaces
- ✅ **Modulares**: Cada conector pode ser usado independentemente
- ✅ **Validação**: Verificação de tipos em tempo de compilação
- ✅ **Error Handling**: Mensagens de erro claras e tratamento robusto

### 📋 Próximos Passos (Fase 2)

- [ ] Implementar `PrepareContext` para agregar dados dos conectores
- [ ] Criar `Evidence Pack` com dados de múltiplas fontes
- [ ] Armazenar dados em banco PostgreSQL
- [ ] Implementar cache com Redis
