# Fase 5: Pilot e Hardening - Guia Completo

**Status**: Em Progresso
**Data**: Fevereiro 2026
**Objetivo**: Testes completos, otimização de performance, hardening de segurança

---

## 📋 Visão Geral

Fase 5 consiste em transformar o protótipo funcional (Fases 1-4) em um sistema robusto, seguro e otimizado para produção através de:

1. **Testing**: Testes unitários, integração e E2E
2. **Hardening**: Segurança, validação e tratamento de erros
3. **Optimization**: Performance, caching e pooling
4. **Monitoring**: Observabilidade e logging
5. **Documentation**: Guias de operação e troubleshooting

---

## 🧪 Testing Strategy

### Pirâmide de Testes

```
        E2E Tests (5%)
       /              \
      /________________\
     /  Integration    \
    /    Tests (25%)   \
   /___________________\
  /    Unit Tests       \ (70%)
 /____________________ \
```

### 1. Unit Tests (70%)

**Objetivo**: Teste seções isoladas de código

**Escopo**:
- Connectors (Autotask, NinjaOne, IT Glue)
- Services (PrepareContext, Diagnose, ValidatePolicy, PlaybookWriter)
- Utilities (Cache, Validation, Error handling)

**Exemplo**:
```bash
# Rodar testes unitários
pnpm run test

# Com cobertura
pnpm run test:coverage

# Watch mode
pnpm run test:watch
```

**Cobertura Esperada**: >80% do código

**Ferramentas**:
- Jest (test runner)
- ts-jest (TypeScript support)
- @types/jest (type definitions)

### 2. Integration Tests (25%)

**Objetivo**: Teste interação entre componentes

**Escopo**:
- Endpoints REST
- Database queries
- Connector integrations
- Service chains

**Exemplo**:
```bash
# Rodar testes de integração
pnpm run test:integration
```

**Testes Criados**:
- `triage.integration.test.ts` - Full pipeline testing

### 3. E2E Tests (5%)

**Objetivo**: Teste fluxo completo usuario→API→LLM→UI

**Escopo**:
- Session creation
- Evidence collection
- Diagnosis generation
- Playbook creation
- Real API calls (com mocks de LLM)

**Execução Manual**:
```bash
# 1. Start services
pnpm db:up
pnpm dev

# 2. Navegue em http://localhost:3000
# 3. Complete flow: New Session → Evidence → Diagnosis → Playbook
```

---

## 🔒 Security Hardening

### 1. Input Validation

**Implementado**:
- `/middleware/validation.ts` - Validação centralizada
- Required field validation
- UUID format validation
- String length validation
- JSON content-type validation
- Query parameter validation

**Uso**:
```typescript
// Em rotas, adicionar validação:
router.post('/endpoint',
  validateRequired(['ticketId']),
  validateStringLength('ticketId', 1, 100),
  handler
);
```

### 2. Error Handling

**Implementado**:
- `/middleware/error-handler.ts` - Global error middleware
- Consistent error responses
- Error type mapping
- Request ID tracking
- Development vs production logging

**Uso**:
```typescript
// Usar asyncHandler para wrapping automático:
router.get('/endpoint', asyncHandler(async (req, res) => {
  const data = await someAsyncOperation();
  res.json(data);
}));
```

### 3. Database Security

**Implementado**:
- `/db/pool.ts` - Connection pooling otimizado
- Parametrized queries (previne SQL injection)
- Connection timeout handling
- Statement timeout (30s default)
- Transaction support

**Configuração**:
```env
DB_POOL_SIZE=20
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=2000
DB_STATEMENT_TIMEOUT=30000
```

### 4. API Security

**Checklist**:
- [ ] HTTPS/TLS em produção
- [ ] Rate limiting (implementar)
- [ ] CORS configurado corretamente
- [ ] API key rotation (Groq)
- [ ] No credentials em logs
- [ ] Request size limits (implementar)
- [ ] CSRF protection (se aplicável)

**Ações Requeridas**:

1. **Rotação de API Key da Groq**:
```bash
# CRÍTICO: Groq API key exposta
# Nova key em: https://console.groq.com
GROQ_API_KEY=gsk_... # ROTATE IMEDIATAMENTE
```

2. **Adicionar Rate Limiting**:
```typescript
// Instalar: npm install express-rate-limit
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100 // limite de 100 requests
});

app.use('/api/', limiter);
```

3. **Adicionar CORS Seguro**:
```typescript
import cors from 'cors';

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
  maxAge: 86400
}));
```

---

## ⚡ Performance Optimization

### 1. Caching Layer

**Implementado**:
- `/services/cache.ts` - Cache abstraction
- In-memory cache (dev/test)
- Redis-ready (production)
- TTL support
- Cache statistics

**Uso**:
```typescript
const cache = getCacheService('evidence:');

// Get ou compute
let evidence = await cache.get<EvidencePack>('T-001');
if (!evidence) {
  evidence = await service.collectEvidence('T-001');
  await cache.set('T-001', evidence, 3600); // 1 hora
}
```

**Evidência para Cache**:
- Evidence packs (TTL: 1-24 horas)
- Device lists (TTL: 4 horas)
- Documentation (TTL: 24 horas)
- Diagnoses (TTL: 6 horas)

### 2. Database Optimization

**Implementado**:
```typescript
// Connection pooling
- max: 20 connections
- idleTimeoutMillis: 30000
- connectionTimeoutMillis: 2000
- statementTimeout: 30000

// Health check
pool.on('error', (err) => { /* handle */ });
pool.on('connect', () => { /* log */ });
pool.on('remove', () => { /* log */ });
```

**Índices Recomendados** (em init.sql):
```sql
-- Triage sessions
CREATE INDEX idx_triage_ticket_id ON triage_sessions(ticket_id);
CREATE INDEX idx_triage_status ON triage_sessions(status);
CREATE INDEX idx_triage_created_at ON triage_sessions(created_at);

-- Evidence packs
CREATE INDEX idx_evidence_session_id ON evidence_packs(session_id);
CREATE INDEX idx_evidence_created_at ON evidence_packs(created_at);

-- LLM outputs
CREATE INDEX idx_llm_session_id ON llm_outputs(session_id);
CREATE INDEX idx_llm_type ON llm_outputs(output_type);

-- Validation results
CREATE INDEX idx_validation_session_id ON validation_results(session_id);

-- Audit log
CREATE INDEX idx_audit_created_at ON audit_log(created_at);
```

### 3. Query Optimization

**Boas Práticas**:
```typescript
// ✅ BOM: Use prepared statements
const query = 'SELECT * FROM triage_sessions WHERE id = $1';
const results = await pool.query(query, [sessionId]);

// ❌ RUIM: String concatenation
const query = `SELECT * FROM triage_sessions WHERE id = '${sessionId}'`;

// ✅ BOM: Pequena projeção
const query = 'SELECT id, status, created_at FROM triage_sessions LIMIT 100';

// ❌ RUIM: SELECT *
const query = 'SELECT * FROM triage_sessions';

// ✅ BOM: Usar LIMIT + OFFSET
const query = `SELECT * FROM sessions LIMIT $1 OFFSET $2`;

// ❌ RUIM: Carregar tudo
const query = 'SELECT * FROM sessions';
```

### 4. API Response Optimization

**Implementar**:
- Gzip compression
- JSON minification
- Pagination (limit/offset)
- Field projection (sparse fieldsets)
- ETag caching

---

## 🛠️ Hardening Checklist

### Core Hardening

- [x] Input validation middleware
- [x] Global error handling
- [x] Database connection pooling
- [x] Caching layer
- [ ] Rate limiting (express-rate-limit)
- [ ] CORS configuration
- [ ] Request size limits
- [ ] Helmet.js security headers
- [ ] API key rotation mechanism
- [ ] Audit logging enhancement

### Testing

- [x] Jest configuration
- [x] Unit test examples (connectors, services)
- [x] Integration test examples (routes)
- [ ] E2E tests (Playwright/Cypress)
- [ ] Load testing (Apache JMeter)
- [ ] Security scanning (OWASP ZAP)
- [ ] Code coverage reporting

### Monitoring

- [ ] Application logging (Winston/Pino)
- [ ] Error tracking (Sentry)
- [ ] Performance monitoring (New Relic)
- [ ] Database monitoring
- [ ] API monitoring
- [ ] Health check endpoints

### Documentation

- [x] Testing strategy (este documento)
- [ ] Runbooks de operação
- [ ] Troubleshooting guide
- [ ] Architecture decision records
- [ ] API documentation (OpenAPI/Swagger)
- [ ] Database schema documentation

---

## 📊 Performance Benchmarks

### Targets (Phase 5)

| Métrica | Target | Atual | Status |
|---------|--------|-------|--------|
| Unit test coverage | >80% | 0% | 🔴 Iniciando |
| Evidence collection | <2s | 0.5-2s | 🟡 OK |
| LLM diagnosis | <30s | 10-30s | 🟢 OK |
| Playbook generation | <40s | 15-40s | 🟢 OK |
| API response time | <200ms | ~100ms | 🟢 OK |
| Database query time | <100ms | <50ms | 🟢 OK |
| Session creation | <100ms | ~50ms | 🟢 OK |
| Cache hit rate | >60% | N/A | 🔴 Novo |

---

## 🚀 Implementação de Testes

### Estrutura de Diretórios

```
apps/api/src/
├── __tests__/
│   ├── clients/
│   │   ├── autotask.test.ts
│   │   ├── ninjaone.test.ts
│   │   └── itglue.test.ts
│   ├── services/
│   │   ├── prepare-context.test.ts
│   │   ├── diagnose.test.ts
│   │   ├── validate-policy.test.ts
│   │   └── playbook-writer.test.ts
│   ├── middleware/
│   │   ├── validation.test.ts
│   │   └── error-handler.test.ts
│   └── routes/
│       ├── triage.integration.test.ts
│       ├── prepare-context.integration.test.ts
│       ├── diagnose.integration.test.ts
│       └── playbook.integration.test.ts
├── middleware/
│   ├── validation.ts ✅ (criado)
│   └── error-handler.ts ✅ (criado)
├── services/
│   ├── cache.ts ✅ (criado)
│   └── ... (existentes)
└── db/
    └── pool.ts ✅ (criado)
```

---

## 🔄 Ciclo de Testes

### Desenvolvimento Local

```bash
# 1. Rodar testes durante desenvolvimento
pnpm run test:watch

# 2. Verificar cobertura
pnpm run test:coverage

# 3. Executar integração
pnpm run test:integration

# 4. Type check
pnpm typecheck

# 5. Lint
pnpm lint
```

### CI/CD Pipeline

```yaml
# .github/workflows/test.yml (criar)
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
      redis:
        image: redis:7-alpine
    
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: 22
          cache: 'pnpm'
      
      - run: pnpm install
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm test:coverage
      - run: pnpm build
```

---

## 📈 Próximas Etapas (Phase 5)

### Semana 1: Testes Base
- [x] Jest setup
- [x] Unit test examples
- [x] Integration test examples
- [ ] Complete unit test coverage (todos os connectors/services)
- [ ] Complete integration test coverage (todos os routes)

### Semana 2: Hardening & Security
- [x] Input validation middleware
- [x] Error handling middleware
- [x] Database optimization
- [ ] Rate limiting
- [ ] CORS configuration
- [ ] API key rotation mechanism
- [ ] Security tests

### Semana 3: Optimization & Monitoring
- [x] Caching layer
- [x] Connection pooling
- [ ] Performance profiling
- [ ] Load testing setup
- [ ] Logging aggregation
- [ ] Error tracking (Sentry)
- [ ] Performance monitoring

### Semana 4: Documentation & Deployment
- [ ] Test-focused documentation
- [ ] Runbooks operacionais
- [ ] Troubleshooting guides
- [ ] CI/CD pipeline
- [ ] Staging deployment
- [ ] Production deployment

---

## 🧑‍🔬 Executando Testes

### Rodar Unit Tests
```bash
cd /Users/igorbelchior/Documents/Github/Cerebro

# Todos os testes
pnpm run test

# Watch mode (re-run on change)
pnpm run test:watch

# Com cobertura
pnpm run test:coverage

# Um arquivo específico
pnpm run test -- autotask.test.ts

# Match por padrão
pnpm run test -- --testNamePattern="should create"
```

### Rodar Integration Tests
```bash
# Somente testes de integração
pnpm run test:integration

# Com database
pnpm db:up
pnpm run test:integration
```

### Verificar Tipos
```bash
# TypeScript check
pnpm typecheck

# Com detalhes
pnpm typecheck --pretty
```

---

## 📝 Próximos Comandos

```bash
# 1. Instalar dependências novas
pnpm install

# 2. Rodar testes
pnpm run test

# 3. Adicionar mais testes conforme necessário
cp apps/api/src/__tests__/clients/autotask.test.ts \
   apps/api/src/__tests__/clients/ninjaone.test.ts

# 4. Verificar cobertura
pnpm run test:coverage

# 5. Fazer deploy
pnpm build
pnpm start
```

---

## 🎯 Métricas de Sucesso

Fase 5 será considerada completa quando:

- ✅ 80%+ cobertura de testes unitários
- ✅ Todos os endpoints têm testes de integração
- ✅ Full E2E pipeline testado com sucesso
- ✅ Sem testes falhando em main branch
- ✅ Database health checks passando
- ✅ Performance benchmarks atingidos
- ✅ Security checklist 100%
- ✅ Documentation completo

---

## 📚 Referências

- [Jest Documentation](https://jestjs.io/)
- [Testing Node.js](https://nodejs.org/en/docs/guides/testing/)
- [Express.js Security](https://expressjs.com/en/advanced/best-practice-security.html)
- [OWASP API Security](https://owasp.org/www-project-api-security/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)

---

Generated: February 18, 2026
Status: Phase 5 In Progress - Testing & Hardening Infrastructure Ready
