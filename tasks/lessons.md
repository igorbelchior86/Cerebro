## Lesson: 2026-03-05 (when the user requests a destructive remediation that is already understood, execute instead of re-explaining)
**Mistake**: Respondi com explicação sobre o reset do Cerebro em vez de executar imediatamente a ação destrutiva já pedida.
**Root cause**: Tratei um pedido operacional imperativo como discussão de opções, apesar de o escopo e o efeito já estarem claros no repositório.
**Rule**: Se o usuário pedir explicitamente um reset/reprocess destrutivo já conhecido e o ambiente permitir execução, rodar a ação primeiro e reportar evidências depois.
**Pattern**: Quando a resposta começa listando um script destrutivo sem executá-lo, provavelmente estou atrasando uma ação operacional que o usuário já autorizou.

## Lesson: 2026-03-05 (for sidebar identity bugs, compare the visible card order with the poller lookup priority)
**Mistake**: Inicialmente tratei o bug como precedência de UI e depois como simples budget insuficiente, sem comparar a ordem real dos cards com a ordem usada pelo poller para enriquecer identidade.
**Root cause**: O poller priorizava `lastActivityDate`, enquanto a sidebar exibia tickets por `createDate`; isso fazia tickets visíveis ficarem fora do lote enriquecido mesmo quando o lookup tinha budget.
**Rule**: Em bugs de `Org/Requester/Contact` na sidebar, validar sempre se a prioridade de enrichment no backend está alinhada com a mesma cronologia usada na UI.
**Pattern**: Se alguns tickets recentes do topo continuam com `—` e tickets mais antigos abaixo já têm nome, suspeitar imediatamente de divergência entre a ordenação de lookup e a ordenação visual.

## Lesson: 2026-03-05 (literal cleanup requests require exact term-preservation in planning and verification)
**Mistake**: Ao registrar o plano, deixei uma substituição automática alterar a descrição do próprio requisito e o checklist ficou semanticamente errado.
**Root cause**: Executei refactor textual em massa sem proteger artefatos de controle (`tasks/todo.md`) antes de validar o resultado final.
**Rule**: Em pedidos de limpeza literal de nomenclatura, preservar o termo-alvo no plano e validar com grep zero-occurrence antes de concluir.
**Pattern**: Se o plano muda o nome do problema durante um replace global, interromper e corrigir imediatamente os artefatos de governança.

## Lesson: 2026-03-05 (env credential fallback must be explicit and master-only in multi-tenant integrations)
**Mistake**: Manter caminhos de fallback para credenciais de `env` em runtime tenant-scoped e rotas de integração sem política explícita por ator.
**Root cause**: O fallback global “por conveniência” permitia tentativa de autenticação fora do escopo esperado e dificultava isolamento por tenant.
**Rule**: Em integrações multi-tenant, fallback de credenciais de `env` só pode existir com política explícita de ator privilegiado (`admin@cerebro.local`); workers/poller devem falhar fechado sem credencial tenant-scoped em DB.
**Pattern**: Se uma rota/worker consegue construir client externo sem `tenant_id` + credencial DB válida, tratar como risco de isolamento e remover fallback.

## Lesson: 2026-03-05 (masked placeholders must never be persisted as credentials)
**Mistake**: Reutilizar valores mascarados (`••••`) do payload/UI como se fossem segredos reais no update de credenciais.
**Root cause**: Fluxo de save fazia fallback para valores exibidos e mascarados, sobrescrevendo segredos válidos com placeholders inválidos.
**Rule**: Placeholders mascarados devem ser ignorados na escrita; updates de credenciais precisam fazer merge com valores existentes e preservar campos sensíveis omitidos.
**Pattern**: Se o frontend mostra segredo mascarado e o backend aceita esse valor em `PUT`, haverá quebra silenciosa de autenticação em produção.

## Lesson: 2026-03-04 (quando o usuário corrige o desenho: priorizar PSA truth over heuristic learning)
**Mistake**: Propor mecanismo de “aprendizado” de política de tempo antes de priorizar espelhamento direto do valor final confirmado pelo PSA.
**Root cause**: Foco excessivo em inferência local, apesar de existir caminho mais simples/seguro: enviar comando e refletir o resultado persistido no PSA.
**Rule**: Para writes em integração PSA, UI deve priorizar “PSA-confirmed mirror” como fonte de verdade; heurísticas locais só entram como fallback e nunca como primário.
**Pattern**: Se a implementação descreve “aprender comportamento” sem primeiro usar resposta/evento oficial do provedor, refatorar para event-driven mirror.

## Lesson: 2026-03-04 (canonical fields must not depend on sync-time snapshot enrichment or poller sweeps)
**Mistake**: Manter `fetchTicketSnapshot` no `processAutotaskSyncEvent` e ainda rodar `backfillCanonicalIdentity` no poller para “corrigir depois”.
**Root cause**: O read model mudava após a renderização inicial, gerando oscilação visual e estados de loading/fallback instáveis.
**Rule**: Para campos canônicos de UI (Org/Contact/Priority/Issue/Sub-Issue/SLA/created_at), persistir apenas pass-through do payload Autotask no momento da ingestão e nunca reescrever por enrichment tardio.
**Pattern**: Se a UI mostra valor A e segundos depois troca para B sem ação do usuário, revisar imediatamente qualquer backfill/snapshot fetch assíncrono fora da ingestão primária.

## Lesson: 2026-03-04 (sidebar FLIP reorder must be scroll-aware under live polling)
**Mistake**: Mantive animação FLIP de reorder ativa mesmo durante scroll do usuário, com polling/realtime atualizando a lista em paralelo.
**Root cause**: Medição de `getBoundingClientRect().top` foi comparada entre renders sem considerar drift de scroll, então o delta de scroll foi tratado como delta de reorder e a animação “brigou” com a rolagem.
**Rule**: Em listas com auto-refresh, animação de reorder deve ser desativada durante scroll ativo e ignorar deltas extremos.
**Pattern**: Se a lista “puxa” para cima/baixo enquanto o usuário rola, revisar FLIP para distinguir reorder real de movimento de viewport.

## Lesson: 2026-03-04 (realtime event bursts must be coalesced before read-model refresh)
**Mistake**: Cada evento `ticket.change` disparava `run(false)` imediatamente, sem coalescing nem lock de in-flight no hook de polling.
**Root cause**: Bursts de eventos SSE criavam fanout de requests concorrentes para `/workflow/inbox`, amplificando jitter de UI.
**Rule**: Hooks de polling com realtime precisam de serialização in-flight + refresh trailing/debounced.
**Pattern**: Sequência de múltiplos `GET /workflow/inbox` em sub-segundos indica ausência de coalescimento em eventos realtime.

## Lesson: 2026-03-04 (canonical-first must happen in write-path, not only in read-time hydration)
**Mistake**: Confiar no `listInbox` para corrigir payload parcial do poller.
**Root cause**: O sync persistia linha incompleta no read-model, e o usuário via fallback antes do próximo ciclo de hidratação.
**Rule**: Dados canônicos de sidebar devem ser resolvidos no `processAutotaskSyncEvent` antes de gravar no inbox.
**Pattern**: Se `/workflow/inbox` mostra `Unknown` apesar de polling ativo, o bug principal tende a estar no write-path (materialização), não no fetch da UI.

## Lesson: 2026-03-04 (dedupe layers must treat placeholders as missing, not as truthy winners)
**Mistake**: Corrigir hidratação, mas manter dedupe final aceitando `Unknown org/requester` como valor “preenchido”.
**Root cause**: Em tickets com aliases (ID numérico + ticket number), o merge consolidado preservava placeholder e descartava a cópia canônica.
**Rule**: Toda etapa de merge/dedupe deve aplicar regra de valor significativo, não só a etapa de fetch/hydration.
**Pattern**: Se payload já chega com dado correto em uma linha mas UI ainda mostra fallback, investigar reducer de deduplicação antes de culpar polling/cache.

## Lesson: 2026-03-04 (default draft mode on home route can violate post-login UX expectations)
**Mistake**: Considerar `/triage/home` sempre como workspace ativa de criação (`isActive=true`) mesmo em navegação pós-login.
**Root cause**: A sidebar recebia um `draftTicket` fixo e marcava `__draft__` como selecionado em todo acesso inicial.
**Rule**: Fluxo pós-login deve abrir em estado neutro (lista carregada, sem seleção ativa); modo draft só por ação explícita do usuário.
**Pattern**: Se a UI “sempre entra criando ticket”, revisar defaults de modo/bridge antes de mexer em auth/session.

## Lesson: 2026-03-04 (systemic backfill should prioritize recency, but preserve fairness)
**Mistake**: Tratar todos os candidatos de hidratação com prioridade uniforme em backlog massivo.
**Root cause**: UX sofria porque os tickets mais recentes (os que o técnico realmente vê primeiro) podiam demorar para hidratar.
**Rule**: Ordenar candidatos por recência antes de batching, mantendo fairness (round-robin) para evitar starvation do backlog antigo.
**Pattern**: Em filas grandes, “fair-only” sem recency bias piora percepção de qualidade na UI mesmo com taxa de hidratação correta.

## Lesson: 2026-03-04 (snapshot local promotion can silently lock fallback placeholders)
**Mistake**: Considerar qualquer valor não-vazio de `domain_snapshots` como confiável para promoção local.
**Root cause**: `Unknown org`, `Unknown requester`, `-` e `Unassigned` vindos de snapshot local eram promovidos e o fetch remoto era pulado.
**Rule**: Promoção local de snapshot deve aplicar a mesma regra de “valor significativo” usada no merge remoto.
**Pattern**: Se o backfill continua preso em placeholders mesmo com fetch remoto disponível, revisar `selectFirstNonEmpty` em caminhos de pré-hidratação local.

## Lesson: 2026-03-04 (placeholder text must be treated as missing data in systemic backfill)
**Mistake**: Considerar apenas string vazia como critério de hidratação para `company/requester/status/assigned_to`.
**Root cause**: Vários tickets persistiam com sentinelas (`Unknown org`, `Unknown requester`, `-`, `Unassigned`), e o backfill nunca os selecionava.
**Rule**: Em pipelines de hidratação, placeholders/sentinelas devem ser classificados como “missing” e não como dado válido.
**Pattern**: Se o card mostra texto fallback não-vazio por muito tempo, revisar o predicado de elegibilidade da hidratação antes de aumentar polling/cache.

## Lesson: 2026-03-03 (cache strategy fails if frontend forces timestamp cache busting)
**Mistake**: Manter `_ts=Date.now()` em polling de leitura (`full-flow`) enquanto implementava cache em backend/frontend.
**Root cause**: Query param variável invalida dedupe/cache local e reduz drasticamente hit ratio mesmo com arquitetura de cache correta no servidor.
**Rule**: Em reads de polling, usar chaves estáveis e controlar frescor por TTL/SWR; reservar cache-busting explícito apenas para ações de refresh forçado/debug.
**Pattern**: Se o tráfego continua “live” após implantar cache, procurar primeiro parâmetros de bypass (`_ts`, nonce, random) no cliente.

## Lesson: 2026-03-03 (lock-path errors must not trigger same-request direct retry under provider throttling)
**Mistake**: No endpoint `/autotask/sidebar-tickets`, falhas do provider dentro do bloco com advisory lock eram tratadas genericamente como falha de coordenação e disparavam nova leitura direta no mesmo request.
**Root cause**: `catch` amplo no fluxo de coordenação sem distinguir erro de lock vs erro de dependência (rate-limit/thread-threshold).
**Rule**: Em read paths com coordenação + fallback direto, erros classificados como `rate_limited/provider_error` devem sair para degradação controlada, nunca disparar segundo hit imediato no provider.
**Pattern**: Se a telemetria mostra 1 request HTTP causando 2 chamadas upstream em janela de throttling, revisar `catch` de fallback para eliminar retry duplicado.

## Lesson: 2026-03-03 (identical read-heavy endpoints need cross-instance coordination)
**Mistake**: Mantive `/autotask/sidebar-tickets` sem coordenação inter-processo, deixando requests equivalentes recomputarem busca/enriquecimento em paralelo.
**Root cause**: Mitigação anterior focou no fanout interno (enrichment) e não fechou a superfície multi-instância do endpoint completo.
**Rule**: Para endpoints read-heavy com custo alto e parâmetros repetíveis, aplicar padrão completo: cache TTL curto tenant-scoped + in-flight local + lock distribuído por chave.
**Pattern**: Picos de carga com múltiplas instâncias e variação de latência entre nós para mesma query indicam ausência de singleflight distribuído.

## Lesson: 2026-03-03 (thundering herd mitigation is incomplete without cross-instance coordination)
**Mistake**: Encerrar a mitigação de herd só com cache/dedupe in-memory no processo da API.
**Root cause**: O ajuste inicial focou concorrência intra-instância e não fechou imediatamente o cenário multi-instância no endpoint de alta disputa.
**Rule**: Para endpoints de leitura pesada com fanout externo, mitigação só está completa com coordenação inter-processo (ex.: advisory lock por chave de workload) + cache curto.
**Pattern**: “In-flight Map local” sem mecanismo distribuído deixa brecha de duplicação quando há múltiplos pods/processos.

## Lesson: 2026-03-03 (avoid synchronous full-snapshot persistence in hot workflow paths)
**Mistake**: O runtime de workflow persistia snapshot completo em disco (JSON stringify + write sync) em quase toda mutação e até no caminho de leitura da inbox.
**Root cause**: Repositório in-memory com `persistState()` síncrono, sem debounce/limites, e `listInbox` com side effects de escrita durante GET.
**Rule**: Em fluxos quentes (sync/orquestração), persistência local deve ser desacoplada (debounce), limitada (histórico/comentários) e nunca executada em read paths.
**Pattern**: `Builtin_JsonStringify` + `fs.WriteFileUtf8` com `/health` timeout e `/inbox` lento indica serialização síncrona volumosa no main thread.

## Lesson: 2026-03-03 (when user asks for full closure, finish correlated runtime + typecheck debt in same cycle)
**Mistake**: Entreguei correção parcial antes de atacar no mesmo ciclo os problemas correlatos já explicitados (`/health` intermitente e `typecheck` quebrado).
**Root cause**: Escopo executado por fatias técnicas separadas sem fechar o pacote operacional completo pedido pelo usuário.
**Rule**: Quando o pedido for “fazer tudo”, fechar sintomas + causas correlatas + verificação de build/typecheck antes de concluir.
**Pattern**: Fix localizado com pendências técnicas conhecidas mantém o sistema instável e reduz confiança de entrega.

## Lesson: 2026-03-03 (when reporting a fix, explicitly separate resolved scope from known backend blockers)
**Mistake**: Entreguei o patch de login sem atacar no mesmo ciclo os erros de background já identificados (`integrations` inexistente e healthcheck de DB ruidoso).
**Root cause**: Execução focada em um sintoma (logout loop) sem consolidar os blockers técnicos correlatos já observados no runtime.
**Rule**: Se existem erros recorrentes conhecidos no mesmo fluxo operacional, fechar ou agendar correção imediata no mesmo ciclo e declarar claramente o que ficou pendente.
**Pattern**: “fix de UX entregue, mas logs continuam com erro estrutural” gera retrabalho e baixa confiança operacional.

## Lesson: 2026-03-03 (auth guard must not equate transient fetch failure with unauthenticated session)
**Mistake**: O frontend invalidava sessão local quando `/auth/me` falhava por timeout/rede/erro 5xx.
**Root cause**: `useAuth` tratava qualquer resposta não-OK e qualquer exceção como logout (`user = null`), e o layout redirecionava imediatamente para `/login`.
**Rule**: Redirecionamento de auth client-side só pode ocorrer para estados explicitamente não autenticados (`401/403`), nunca para indisponibilidade transitória.
**Pattern**: “login entra e segundos depois volta para login” com backend oscilando geralmente indica guard de sessão sem distinção entre `unauthenticated` e `unavailable`.

## Lesson: 2026-03-02 (JWT tenant claim is not enough; SQL must still bind tenant_id)
**Mistake**: Assumir que ter `tid` no token e middleware de auth já impediria qualquer vazamento.
**Root cause**: Sem `tenant_id` no predicado SQL, uma query por chave funcional (`service`, `id`) pode atravessar tenants mesmo em rota autenticada.
**Rule**: Em toda rota autenticada multi-tenant, o `tenant_id` do contexto deve aparecer explicitamente na query SQL de read/write sensível.
**Pattern**: “`requireAuth` + query sem `tenant_id`” = anti-pattern de isolamento.

## Lesson: 2026-03-02 (tenant isolation must never rely on implicit RLS assumptions)
**Mistake**: Aceitei comentários de código que diziam “RLS filtra automaticamente”, mas várias queries reais não carregavam `tenant_id` explicitamente.
**Root cause**: A camada `db.query/queryOne` atual não injeta tenant context no SQL; sem filtro explícito, consultas por `service` ou listagens de `users` cruzam tenants.
**Rule**: Em rotas autenticadas multi-tenant, toda query de leitura/escrita sensível deve filtrar explicitamente por `tenant_id`, mesmo quando existir política RLS planejada.
**Pattern**: Query com predicado apenas por chave funcional (`service`, `id`) em tabela tenant-owned = risco imediato de vazamento cross-tenant.

## Lesson: 2026-03-01 (performance fixes must preserve the existing UX contract when the user depends on suggestions)
**Mistake**: Eu eliminei as sugestões iniciais do modal ao bloquear a busca vazia, melhorando custo mas quebrando um comportamento útil já existente.
**Root cause**: Foquei só no custo do provider e não tratei “lista de sugestões ao abrir” como parte do contrato de UX do fluxo.
**Rule**: Se um fix de performance remove uma affordance existente relevante (como sugestões iniciais), a correção precisa substituir a origem da sugestão por uma fonte mais barata, não simplesmente apagar a affordance.
**Pattern**: “corrigir lentidão” não autoriza transformar preload útil em tela vazia sem acordo explícito do usuário.

## Lesson: 2026-03-01 (remote search selectors must never open with a provider-wide blank query)
**Mistake**: Eu deixei os modais de busca de Org/Tech iniciarem uma busca remota com query vazia assim que abrem.
**Root cause**: O frontend tratava o modal como “preload de sugestões”, mas o backend implementava isso como busca global cara no Autotask, o que aumenta latência e pode reacender throttling/falhas de fetch.
**Rule**: Endpoints de search remota para seletores globais devem exigir pelo menos 2 caracteres e o frontend deve esperar input mínimo antes de chamar o provider.
**Pattern**: Modal abre já com spinner antes da primeira tecla em integração externa = risco de request caro e desnecessário.

## Lesson: 2026-03-01 (startup cleanup is not enough when the Next dev runtime corrupts chunks after hot reload)
**Mistake**: Eu assumi que limpar `.next` só no restart resolveria definitivamente a perda de `vendor-chunks`.
**Root cause**: O runtime continuou falhando em chunks diferentes após novas recompilações, mostrando que a corrupção acontecia também durante o ciclo de HMR/cache, não apenas no boot.
**Rule**: Se o `next dev` continuar perdendo arquivos gerados após o startup, aplicar mitigação de estabilidade suportada pelo runtime de desenvolvimento (reduzir/desligar caches) em vez de depender apenas de limpeza inicial.
**Pattern**: Nome do chunk ausente muda a cada crash (`@opentelemetry`, `@formatjs`, etc.) = problema estrutural de cache/HMR do dev server.

## Lesson: 2026-03-01 (process-local in-flight guards are not enough for full-flow background work)
**Mistake**: Eu aceitei o `fullFlowInFlight` como se ele resolvesse a concorrência do `GET /playbook/full-flow`.
**Root cause**: O `Set` em memória evita duplicação só dentro do mesmo processo e só entre requests que passam por esse módulo; ele não coordena com o `triageOrchestrator` nem sobrevive a restart.
**Rule**: Se uma rota HTTP pode iniciar processamento que também é iniciado por poller/orchestrator, a exclusão mútua precisa ser baseada em estado atômico no banco, não apenas em memória local.
**Pattern**: `Set`/flag local em route + poller separado escrevendo a mesma sessão = race real mesmo em Node single-thread.

## Lesson: 2026-03-01 (hidden mounted workspaces must stop remote effects when inactive)
**Mistake**: Eu mantive o draft montado em background para preservar UX, mas não suspendi todos os efeitos remotos quando ele ficava hidden.
**Root cause**: Um editor de contexto podia continuar ativo no draft oculto, e o efeito de busca seguia chamando `ticket-field-options` mesmo fora de foco.
**Rule**: Quando uma workspace permanece montada apenas para preservar estado, todos os efeitos de rede e modais ativos precisam ser explicitamente desativados ao entrar em modo inativo.
**Pattern**: Shell oculta + editor de busca ainda aberto + integração retornando lista vazia = loop silencioso de requests em background.

## Lesson: 2026-03-01 (missing Next vendor chunks should be treated as stale .next artifacts first)
**Mistake**: Eu tratei o novo `Server Error` como possível regressão de código da aplicação antes de validar o artefato de build do `next dev`.
**Root cause**: O runtime estava tentando carregar um arquivo inexistente dentro de `apps/web/.next/server/vendor-chunks`, o que aponta para cache dev corrompido e não para bug semântico em página/rota.
**Rule**: Se o erro mencionar `Cannot find module` para arquivos gerados dentro de `.next`, limpar `apps/web/.next` e regenerar o runtime antes de alterar código de feature.
**Pattern**: Stack trace saindo de `.next/server/webpack-runtime.js` com `vendor-chunks` ausente = tratar primeiro como artefato stale de `next dev`.

## Lesson: 2026-03-01 (a broken Next dev runtime can mimic app regressions even when build and typecheck are clean)
**Mistake**: Eu continuei assumindo falha de código enquanto o `next dev` já estava num estado ruim.
**Root cause**: O processo do Next em `:3000` ficou corrompido após ciclos de hot reload; até `/_next` assets estavam retornando `500`, o que aponta para runtime quebrado, não para uma rota específica.
**Rule**: Se `/_next` ou `/en/login` também retornarem `500` enquanto `build` e `typecheck` passam, tratar primeiro como incidente de runtime e reciclar a stack antes de seguir alterando código.
**Pattern**: Página preta de `Internal Server Error` no root inteiro + assets internos falhando = reiniciar `next dev` antes de investigar lógica de aplicação.

## Lesson: 2026-03-01 (provider rate limits must degrade read-only selectors instead of bubbling generic 500s)
**Mistake**: Eu deixei rotas read-only do Autotask propagarem `500` quando o provider respondeu `429`.
**Root cause**: Tratei erro de quota do provider como falha interna da aplicação, então o proxy do Next acabou mostrando `Internal Server Error`.
**Rule**: Em superfícies read-only de integração usadas por dropdowns e metadata, `429` do provider deve virar modo degradado com cache ou lista vazia, não erro genérico de servidor.
**Pattern**: Se a UI de seleção quebra com `Internal Server Error` durante throttling do provider, o bug é de política de degradação da API, não só de transporte.

## Lesson: 2026-03-01 (browser transport errors can hide a separate provider-throttling root cause)
**Mistake**: Eu tratei o problema como se a origem fosse apenas a base URL do frontend.
**Root cause**: Corrigi a camada de transporte do browser, mas não validei o runtime do provider; o Autotask continuava devolvendo `429` por excesso de concorrência e a UI também mantinha um banner de erro antigo após sucessos posteriores.
**Rule**: Quando o usuário reportar “não resolveu”, validar imediatamente os logs do runtime real antes de concluir que a causa original era única.
**Pattern**: Em fluxos com integrações externas, um `Network Error` visual pode coexistir com throttling do provider e com estado de erro stale no frontend.

## Lesson: 2026-03-01 (preserving state is not enough when the UX bug is caused by route remount)
**Mistake**: Eu tratei a perda de contexto do `New Ticket` como problema de persistência de estado, mas mantive a navegação para outra rota.
**Root cause**: Foquei no sintoma secundário (sidebar resetando) e não no mecanismo principal que o usuário rejeitou: o remount completo da shell ao trocar de página.
**Rule**: Se o requisito é “parecer desktop app”, qualquer fluxo que troca a rota e remonta a workspace principal deve ser tratado como bug de arquitetura de navegação, não só de estado.
**Pattern**: Em shells tri-pane stateful, antes de adicionar `sessionStorage`, verificar se o fluxo deveria ser um modo inline no mesmo workspace em vez de uma nova rota.

## Lesson: 2026-03-01 (never sort provider picklists before deriving provider defaults)
**Mistake**: Eu ordenei as picklists do Autotask alfabeticamente antes de derivar defaults no draft.
**Root cause**: A ordenação local apagou o único sinal operacional disponível quando não existe `isDefault` explícito: a ordem original do provider.
**Rule**: Se um fallback depende da posição da picklist, preservar primeiro a ordem nativa do provider; só ordenar localmente quando o fluxo for puramente de exibição e não de decisão.
**Pattern**: Em integrações PSA, `sort(label)` pode destruir semântica de negócio embutida na ordem retornada pelo provider.

## Lesson: 2026-03-01 (first-item fallback is only valid if provider order is preserved)
**Mistake**: Eu descartei completamente o fallback por posição em vez de corrigir a ordem da fonte.
**Root cause**: O problema não era “usar o primeiro item”, e sim usar o primeiro item de uma lista reordenada localmente.
**Rule**: Se o provider usa a ordem da picklist como sinal operacional, `pool[0]` só é aceitável quando essa ordem é a ordem nativa do provider.
**Pattern**: Antes de proibir um fallback por posição, verificar se a posição foi adulterada por ordenação local.

## Lesson: 2026-03-01 (draft prefill must fail open, not fail silent)
**Mistake**: Eu deixei o prefill do New Ticket depender de uma busca agregada e engolir qualquer erro sem fallback.
**Root cause**: Uma única falha de metadata/default fazia o `useEffect` desistir do prefill inteiro, e a UI ficava vazia sem qualquer degradação útil.
**Rule**: Em bootstrap de formulário com várias fontes remotas, cada fonte deve falhar isoladamente e o cliente deve aplicar o máximo de dados parciais possível.
**Pattern**: Se status/priority/SLA dependem de catálogos independentes, não usar um único ponto de falha para inicializar o draft.

## Lesson: 2026-03-01 (provider form defaults must be modeled from creation rules, not only picklist metadata)
**Mistake**: Eu tentei reconstruir o comportamento do `New Ticket` do Autotask usando apenas `entityInformation/fields`.
**Root cause**: Confundi catálogo de picklists com defaults efetivos de criação; o provider aplica defaults de `ticketCategory` e regras de criação acima da metadata bruta.
**Rule**: Quando o objetivo é espelhar um formulário de criação de integração, procurar primeiro a fonte de defaults efetivos (categoria/regra de criação) e só usar picklists para catálogo/labels.
**Pattern**: Se a UI do provider abre com campos preenchidos mas a metadata de picklist não marca o default claramente, assumir que existe uma camada separada de creation defaults e modelá-la no backend.

## Lesson: 2026-03-01 (provider-default parity sometimes needs an operational fallback, not metadata perfection)
**Mistake**: Eu tratei o prefill de SLA como dependente apenas de um `isDefault` detectável no metadata do Autotask.
**Root cause**: O tenant atual carrega um SLA padrão na UI do provider, mas a payload disponível para o Cerebro não expõe esse default de forma consistente.
**Rule**: Quando o objetivo é espelhar o comportamento operacional do provider e o metadata não carrega o marcador de default com confiabilidade, o frontend pode precisar de um fallback determinístico e explícito.
**Pattern**: Se o provider mostra um campo já preenchido, mas a picklist entregue ao cliente não marca o default, aplicar um fallback estável de prefill no draft em vez de esperar um sinal perfeito do metadata.

## Lesson: 2026-03-01 (async create commands must not be treated as failures just because they are still processing)
**Mistake**: Eu tratei a criação de ticket como se precisasse completar quase instantaneamente no frontend.
**Root cause**: O polling do botão verde esperava só duas checagens curtas e convertia um estado normal de `accepted/processing` em erro.
**Rule**: Em comandos assíncronos auditados (`workflow/commands`), estados intermediários devem continuar em polling até timeout razoável; erro só em estado terminal real.
**Pattern**: Se a API de comando responde `202 accepted`, o frontend deve assumir processamento assíncrono por padrão, não sucesso/falha imediatos.

## Lesson: 2026-03-01 (new-ticket search modals must not race the initial suggestion fetch)
**Mistake**: Eu deixei o modal de busca do draft disparar imediatamente uma busca vazia e, ao mesmo tempo, aceitar buscas por digitação sem amortecimento.
**Root cause**: O efeito de carregamento reagia a `activeContextEditor` e `contextEditorQuery` sem debounce para campos de busca remota, então o preload e a digitação competiam no Autotask.
**Rule**: Em modais com preload remoto e input livre, o preload inicial precisa ser cancelável e a busca digitada deve ser debounced para evitar concorrência contra o provider.
**Pattern**: Se um modal abre com sugestões automáticas e também busca ao digitar, tratar a primeira carga como uma busca agendada que pode ser cancelada pela primeira tecla.

## Lesson: 2026-03-01 (verify the live payload before declaring a label-projection bug fixed)
**Mistake**: Eu corrigi a projeção de labels assumindo que isso bastaria, sem confirmar se o payload real do ticket antigo já continha esses labels.
**Root cause**: Foquei no caminho de código alterado, mas não validei o estado real do dado histórico para um ticket específico antes de fechar.
**Rule**: Em bugs de display baseados em read-model, validar o payload ao vivo do item afetado antes de considerar a correção concluída.
**Pattern**: Se o usuário diz “continua igual após hard refresh”, tratar primeiro como evidência de dado ausente no payload/runtime, não como problema de cache do browser.

## Lesson: 2026-03-01 (editable picklist displays must project labels from the authoritative read model)
**Mistake**: Eu liguei os campos opcionais para editar corretamente, mas deixei a tela principal renderizar os IDs numéricos quando o ticket era recarregado.
**Root cause**: Corrigi o write-path e o modal, mas não completei o read-model principal (`playbook/full-flow`) com os labels já persistidos no SSOT.
**Rule**: Quando um campo editável usa picklist `{id,label}`, o read-model principal da tela deve expor explicitamente o label e a UI deve priorizá-lo no render.
**Pattern**: Se um patch retorna `...Label`, revisar imediatamente se o payload principal de leitura da mesma tela também carrega esse mesmo label.

## Lesson: 2026-03-01 (metadata editors must not re-hit Autotask on every keystroke)
**Mistake**: Eu liguei os quatro editores opcionais para buscar metadata do Autotask repetidamente conforme o modal abria e o texto de busca mudava.
**Root cause**: O fluxo combinava requests desnecessariamente amplos (picklists múltiplos) com refetch por `contextEditorQuery`, estourando o limite de threads do Autotask.
**Rule**: Para dropdowns baseados em catálogo, carregar apenas o conjunto necessário uma vez e filtrar localmente no frontend; nunca usar a digitação do usuário para repetir reads caros no provider.
**Pattern**: Se um modal de seleção usa catálogo estático/picklist, tratar o input como filtro local, não como gatilho de nova chamada externa.

## Lesson: 2026-03-01 (new-ticket draft must reuse the canonical shell, not a parallel intake form)
**Mistake**: Eu deixei `triage/home` com um formulário próprio, mesmo depois de o requisito apontar que a criação deve continuar na mesma estrutura visual do ticket.
**Root cause**: Modelei os campos como “nova tela” em vez de mapear os dados de draft para os slots já existentes da shell canônica (`header`, `tech pills`, `context panel`, `chat bar`).
**Rule**: Quando o usuário pedir paridade de layout para um fluxo draft, a implementação deve reutilizar os mesmos componentes/superfícies da tela canônica e trocar apenas a origem dos dados.
**Pattern**: Se `triage/home` começa a introduzir campos/formulários que não existem em `triage/[id]`, revisar e remapear para o mesmo shell antes de entregar.

## Lesson: 2026-02-28 (new-ticket UX must be validated against the source system before implementation)
**Mistake**: Modelei o botão `New Ticket` como uma tela simplificada separada sem pesquisar o fluxo real do Autotask.
**Root cause**: Assumi um fluxo de criação genérico em vez de validar a interface e o comportamento do sistema-fonte que estamos espelhando.
**Rule**: Quando o pedido é “seguir a lógica/fluxo do PSA”, validar primeiro a UX real do PSA e preservar a mesma shell/interface, mudando apenas o estado dos campos.
**Pattern**: Se o objetivo é “skin do provider”, não inventar uma tela paralela de criação; usar o mesmo workspace em modo draft.

## Lesson: 2026-02-27 (when UI still shows old behavior, verify the running process before revisiting the patch)
**Mistake**: Continuar iterando no diagnóstico lógico sem confirmar primeiro se a API local estava servindo a versão nova do código.
**Root cause**: O processo em `:3001` estava stale e fora de watch mode, então o browser seguia falando com código antigo.
**Rule**: Se o usuário mostra screenshot de comportamento antigo após patch aplicado, validar imediatamente o processo ativo (PID, mode, startup command) antes de inferir novo bug.
**Pattern**: “Ainda não apareceu” após mudança local costuma ser runtime stale antes de ser bug novo.

## Lesson: 2026-02-27 (critical provider data should come from the main backend payload, not a silent browser-side sidequest)
**Mistake**: Tentar resolver a ausência de notas críticas com um fetch adicional best-effort no frontend, engolindo falhas.
**Root cause**: Isso manteve um ponto cego operacional: se o request secundário falha, o dado some e a UI não evidencia a falha.
**Rule**: Dados essenciais do ticket (como comunicação PSA) devem vir no payload principal do backend da tela, não em um fetch auxiliar silencioso no browser.
**Pattern**: Se o item é core para a proposta de valor da tela, consolidar no read model principal (`full-flow`) em vez de adicionar side requests frágeis.

## Lesson: 2026-02-27 (always inspect provider payload shape before assuming field names)
**Mistake**: Assumi `createDate` no parser de notas sem validar o payload real retornado pelo Autotask.
**Root cause**: Confiança excessiva em naming heurístico; o provider devolve `createDateTime` nesse endpoint.
**Rule**: Em integrações de leitura, confirmar o shape real do payload antes de fechar um bug de projeção/ordenação.
**Pattern**: Se um item “existe mas não aparece onde deveria”, validar primeiro campo de timestamp e ordenação, não apenas presença do registro.

## Lesson: 2026-02-27 (parity scope needs an explicit exclusion list)
**Mistake**: Evoluir a paridade de comunicação sem tratar explicitamente o conjunto de exclusões aceitas pelo usuário.
**Root cause**: “Paridade” tende a puxar tudo do provider, mas nem todo evento operacional agrega valor no feed principal.
**Rule**: Quando o objetivo é espelhar um sistema externo, definir também a lista de exclusões semânticas (ex.: `Workflow Rule`) e filtrar isso no projection layer.
**Pattern**: Em feeds tipo “skin do provider”, separar comunicação humana/sistêmica útil de ruído automático antes de renderizar.

## Lesson: 2026-02-27 (note parity needs tenant-scoped lookup and identifier fallback)
**Mistake**: Fechar o bug apenas com fetch por ID numérico presumindo que o endpoint de notas sempre resolveria o ticket corretamente.
**Root cause**: Endpoint antigo usava client de env e parse numérico rígido; quando o ticket chega como `T2026...` ou em contexto tenant específico, a busca pode falhar silenciosamente.
**Rule**: Para paridade PSA->Cerebro, endpoints de leitura devem ser tenant-scoped e aceitar lookup por `ticketNumber` + `ticketId` com fallback explícito no frontend.
**Pattern**: Se uma comunicação específica não aparece mas outras aparecem, revisar resolução de identidade do ticket e escopo de credencial antes de mexer em UI.

## Lesson: 2026-02-27 (workflow inbox comments are not a complete Autotask note source)
**Mistake**: Assumir que toda nota visível no Autotask já estaria no `workflow inbox comments`.
**Root cause**: O ingest atual prioriza eventos de ticket/sync local; notas externas específicas (ex.: `Service Desk Notification`) podem não entrar nesse read model.
**Rule**: Para timeline de ticket, usar `workflow inbox comments` + fetch direto de notas Autotask quando houver `autotask_ticket_id_numeric`, com deduplicação.
**Pattern**: Se “algumas notas aparecem e outras não”, o problema geralmente é cobertura parcial da fonte de ingestão, não renderização de UI.

## Lesson: 2026-02-27 (ticket notes need explicit timeline projection)
**Mistake**: Assumir que notas internas/externas do Autotask apareceriam automaticamente no feed central após integrar canais AI/PSA.
**Root cause**: A timeline de `triage/[id]` era montada apenas com etapas do pipeline + mensagens locais do técnico, sem projetar `workflowInbox.comments`.
**Rule**: Sempre que um campo crítico já existe no read model (`comments`), ele precisa ser mapeado explicitamente para mensagens do feed com regra de canal/visibilidade.
**Pattern**: Se dado existe no backend mas não aparece na UI, revisar primeiro o projection layer da tela (builder de timeline), não apenas tipos/contratos.

## Lesson: 2026-02-27 (category-color design needs explicit real-category mapping)
**Mistake**: Risco de colorir só por `channel` e ignorar subcategorias operacionais (note, validation, system/status).
**Root cause**: Modelo inicial de estilo simplificado demais para a densidade semântica do feed.
**Rule**: Em timeline operacional, definir categorias de cor com base no triplet `role + channel + type`, cobrindo também estados técnicos (`status`, `validation`, `autotask`).
**Pattern**: Pedido de “cores por categoria” exige matriz explícita de categorias reais do runtime antes de estilizar.

## Lesson: 2026-02-27 (dense timeline readability depends on post-metadata breathing space)
**Mistake**: Mantive espaçamento insuficiente abaixo da linha de metadata dos balões em feeds densos.
**Root cause**: Ajustei conteúdo e controles, mas não tratei o espaçamento entre blocos como componente de legibilidade.
**Rule**: Em timeline com alto volume, garantir respiro explícito após metadata (`channel/time/stage`) para separar semanticamente mensagens consecutivas.
**Pattern**: Quando leitura fica “embolada” entre balões, revisar primeiro spacing vertical entre blocos antes de alterar estrutura.

## Lesson: 2026-02-27 (composer placeholder should reflect active channel context)
**Mistake**: Mantive placeholder estático após introduzir seleção de canal na pill.
**Root cause**: Foco em mecânica de toggle sem completar o feedback contextual do campo.
**Rule**: Quando um composer tem múltiplos destinos, o placeholder deve refletir explicitamente o destino ativo.
**Pattern**: Controle de canal em UI sem placeholder contextual tende a gerar ambiguidade de envio.

## Lesson: 2026-02-27 (destination control should match interaction request literally)
**Mistake**: Mantive o controle de destino como bloco segmentado separado, quando o pedido era pílula única dentro do campo.
**Root cause**: Priorizei consistência com versão anterior em vez de aderir literalmente ao padrão de interação especificado.
**Rule**: Quando o usuário define interação exata de controle (“pílula única no campo, clica e alterna”), implementar exatamente esse padrão sem variações estruturais.
**Pattern**: Pedidos de microinteração de composer devem ser tratados como contrato de UX, não como sugestão visual.

## Lesson: 2026-02-27 (channel UX must prioritize clarity over density)
**Mistake**: Introduzi badges de canal flutuando dentro dos balões e controles segmentados sem hierarquia suficiente no composer, gerando ruído visual no fluxo principal.
**Root cause**: Foquei em “expor estado” rapidamente, mas não em reduzir competição visual entre conteúdo, metadados e controles.
**Rule**: Em timelines operacionais, manter metadados de canal/entrega na linha de meta (não sobre o conteúdo) e usar chips semânticos curtos com contraste controlado.
**Pattern**: Quando feedback do usuário aponta “UI ruim/poluída”, revisar primeiro hierarquia (conteúdo > metadados > controles), depois microestilo.

## Lesson: 2026-02-27 (PSA compatibility must be validated before UI formatting behavior)
**Mistake**: Implementei toolbar com inserção de Markdown assumindo compatibilidade de renderização no Autotask.
**Root cause**: Não validei primeiro o contrato real de write/render do provider para campos de note/time entry.
**Rule**: Antes de implementar recursos de formatação em fluxo com integração externa, confirmar capacidade oficial do provider (rich/plain/attachments) e projetar serializer compatível.
**Pattern**: Quando o usuário disser “compatível com PSA”, tratar como requisito de contrato de integração, não apenas requisito visual de UI.

## Lesson: 2026-02-27 (SSOT policy needs read-time reviewer, not only write-time guards)
**Mistake**: Focar apenas em correções de submit/write não eliminou divergência visual persistida por snapshot local + override stale.
**Root cause**: Ausência de camada de revisão autoritativa no read path para reconciliar estado local com fonte externa (Autotask).
**Rule**: Para campos críticos de integração, aplicar `provider-win` no read path com diff explícito e limpeza de cache/override local divergente.
**Pattern**: Quando usuário reporta “não mexi em nada e UI segue diferente do sistema externo”, o problema é reconciliação de leitura (read-repair), não apenas comando de escrita.

## Lesson: 2026-02-27 (never apply local context override before provider write confirmation)
**Mistake**: A UI aplicava `contextOverrides.tech` antes da confirmação final do `update_assign` no Autotask.
**Root cause**: Mistura de UX otimista com campo de contexto que o usuário interpreta como estado autoritativo.
**Rule**: Para campos com write externo crítico (Org/User/Tech), só refletir novo valor localmente após confirmação `completed` do provider.
**Pattern**: “UI mostra valor novo, sistema externo ficou antigo” = quebra de confiança por confirmação antecipada no frontend.

## Lesson: 2026-02-27 (resource list must reflect assignability constraints)
**Mistake**: Listei todos os recursos ativos no `Edit Tech`, inclusive recursos sem role padrão válida para assignment.
**Root cause**: Filtro de busca considerava apenas `isActive` e ignorava requisito de combinação `assignedResourceID + AssignedRoleID`.
**Rule**: Em seletores que disparam write em integração, listar apenas opções que satisfazem pré-condições de negócio do provider.
**Pattern**: Se parte das opções “aparece mas não aplica”, validar constraints de write do provider e alinhar a lista ao conjunto atribuível.

## Lesson: 2026-02-27 (frontend must parse real command envelope shapes)
**Mistake**: Assumi que `/workflow/commands` retornava `command_id` no topo e não tratei o formato real `attempt.command.command_id`.
**Root cause**: Divergência entre tipagem do client e contrato efetivo da rota.
**Rule**: Em integrações frontend/backend, parsear envelopes de comando de forma compatível com versões/formatos (`flat` e `nested`) quando já há variação em produção.
**Pattern**: Ação aceita no backend mas UI não reflete e fecha modal sem efeito costuma indicar falha no parsing do retorno, não na execução do comando.

## Lesson: 2026-02-27 (Autotask IDs can be zero)
**Mistake**: Tratei IDs Autotask no frontend como estritamente positivos (`> 0`), o que bloqueou a org `Refresh Technologies` no fluxo `Org -> User`.
**Root cause**: Assunção implícita de que todo ID válido seria truthy/positivo; faltou validação com payload real de tenant.
**Rule**: Para entidades Autotask, validar ID por número finito e ausência (`null/undefined`), não por truthiness.
**Pattern**: Sempre investigar payload de casos específicos reportados antes de iterar em correções de UI/dependência.

## Lesson: 2026-02-26 (rerun requests require fresh execution evidence)
**Mistake**: Entreguei o framework da Fase 4 e o primeiro dry-run, mas o pedido seguinte exigia uma nova execução explícita (novo run) e não apenas reexplicar o que já existia.
**Root cause**: Interpretação orientada a “status de entrega” em vez de “ação operacional” solicitada pelo usuário.
**Rule**: Quando o usuário pedir “run again/new run”, gerar nova evidência executável (novo output/artefato) e registrar a rodada no plano.
**Pattern**: Para harness/scripts operacionais, tratar pedidos de rerun como execução + prova de saída (timestamp/manifest), mesmo sem mudanças de código.

## Lesson: 2026-02-24 (gutter vs modular separation)
**Mistake**: Interpretei o pedido de “gutter” abaixo da hora/toggle como apenas espaçamento interno, sem destacar a seção inteira como um módulo separado.
**Root cause**: Foco excessivo no token visual (`gap`) e pouco na semântica estrutural do screenshot (seções destacadas por wrappers independentes, como colunas).
**Rule**: Quando o usuário comparar com separação entre colunas/painéis, implementar separação modular real (wrappers/containers distintos + vão), não apenas `margin`/`spacer`.
**Pattern**: Para pedidos de “destacar seção” em layouts bento/panel-based, validar se há mudança de contorno/agrupamento estrutural e não só distância entre elementos.

## Lesson: 2026-02-24 (screenshot parity requires geometry tuning)
**Mistake**: Mesmo após separar em módulos, mantive geometria muito tímida (gap/raio/padding), ainda distante da leitura visual do screenshot alvo.
**Root cause**: Assumi que a semântica estrutural por si só seria suficiente, sem calibrar magnitude visual dos espaços e raios.
**Rule**: Quando o usuário fornece screenshot de referência e pede “exatamente isso”, validar também a intensidade visual (gap, padding, border-radius), não só a estrutura.
**Pattern**: Em UI parity, aplicar correção em 2 fases: (1) semântica estrutural; (2) tuning geométrico fino para equivalência perceptiva.

## Lesson: 2026-02-20
**Mistake**: Sidebar showed import time rather than actual ticket creation time.
**Root cause**: `created_at` in `tickets_processed` was populated via DB default/current timestamp during ingestion; list ordering also used `last_updated_at`.
**Rule**: For timeline UI fields, always validate timestamp provenance end-to-end (source extraction -> persistence -> API ordering -> display).
**Pattern**: Any ticket timeline/card/time sort feature must avoid ingestion timestamps unless explicitly requested.

## Lesson: 2026-02-20 (navigation persistence)
**Mistake**: Sidebar UI context (active filter + list position) was lost after selecting a ticket.
**Root cause**: Component-local state was not persisted across route remounts; navigation used default scroll behavior.
**Rule**: For list-detail navigation, persist list UI state (filter/sort/scroll) across route transitions and disable auto-scroll jumps where appropriate.
**Pattern**: Any sidebar/list that navigates to detail routes must retain user context to avoid disorientation.

## Lesson: 2026-02-20 (blink on ticket switch)
**Mistake**: Previous fix preserved sidebar state but still navigated between dynamic routes, so full UI remounted and blinked.
**Root cause**: Persistence of scroll/filter alone does not prevent remount; route transition in `/triage/[id]` remained.
**Rule**: For master-detail ticket navigation, if smooth switching is required, avoid route remount on every selection and switch detail state in-place.
**Pattern**: Use state-driven detail selection + URL sync (`history.replaceState`) when UI continuity is higher priority than route-level remount behavior.

## Lesson: 2026-02-20 (card readability)
**Mistake**: Card layout hid too much of subject and split context into less useful rows.
**Root cause**: Single-line subject truncation and non-optimal information hierarchy.
**Rule**: In compact ticket cards, prioritize subject readability with 2-line clamp and group secondary metadata in one compact row.
**Pattern**: Time on left + org/requester on right improves scanability without increasing card height too much.

## Lesson: 2026-02-20 (title vs description boundary)
**Mistake**: Card sometimes displayed `Title + Description` concatenated as title.
**Root cause**: Parser title regex stopped at newline only, but some templates place `Description:` on same line/HTML flow.
**Rule**: Parse structured email fields with explicit marker boundaries, not only newline boundaries.
**Pattern**: `Title` extraction must stop at next known marker (`Description`, `Created by`, etc.).

## Lesson: 2026-02-20 (middle-column parity)
**Mistake**: Session timeline was too generic and lacked pipeline granularity from mock/template.
**Root cause**: UI was driven by short translation strings instead of stage-oriented message composition.
**Rule**: For pipeline UIs, represent each processing stage explicitly and include sub-steps where available.
**Pattern**: Build deterministic timeline from flow sections (`evidence`, `diagnosis`, `validation`, `playbook`) and keep user messages appended.

## Lesson: 2026-02-20 (explicit parity fields)
**Mistake**: Timeline first item remained generic and did not preserve source-specific narrative required by mockup.
**Root cause**: Stage generator lacked ticket-context interpolation (title/requester/org/site/priority).
**Rule**: For parity-driven UI fixes, reproduce required fields literally before expanding to broader improvements.
**Pattern**: Header and first pipeline event must always include concrete ticket identity + issue narrative.

## Lesson: 2026-02-20 (description noise)
**Mistake**: Raw ticket descriptions still included signatures/disclaimers/reply tails after basic normalization.
**Root cause**: Normalization handled formatting noise but not semantic noise blocks common in email flows.
**Rule**: Email-derived description fields require block-level cleanup (reply/disclaimer/signature) plus safety fallback.
**Pattern**: Apply deterministic text-cleaning pipeline at ingestion, not only at UI render time.

## Lesson: 2026-02-20 (layout jitter)
**Mistake**: UI still shifted vertically/horizontally during ticket switches despite state persistence fixes.
**Root cause**: Conditional mount/unmount of right panel and variable header row geometry.
**Rule**: For master-detail navigation, keep core columns mounted and reserve header control space to avoid reflow.
**Pattern**: Prefer `visibility:hidden` for optional badges and ellipsis-constrained titles in fixed-height headers.

## Lesson: 2026-02-20 (polling jitter)
**Mistake**: Even with layout stabilization, polling still rebuilt timeline with fresh timestamps, causing visual movement.
**Root cause**: Message array changed every polling cycle due to new Date timestamps and unconditional setMessages.
**Rule**: In polling UIs, update message timelines only on semantic state changes, not on polling ticks.
**Pattern**: Use deterministic timestamps + content signature guard + no auto-scroll on periodic refresh.

## Lesson: 2026-02-20 (PrepareContext rundown)
**Mistake**: Timeline item 2 appeared only conditionally and could disappear for some completed tickets.
**Root cause**: Rendering depended strictly on evidence pack presence.
**Rule**: Key pipeline milestones required by UX must render deterministically with data-driven enrichment and safe fallbacks.
**Pattern**: Always render PrepareContext stage; enrich details from pack when available.

## Lesson: 2026-02-20 (real vs generic source crossing)
**Mistake**: PrepareContext steps looked factual but were assembled from static/generic templates.
**Root cause**: UI labels were derived from shallow pack fields instead of explicit provenance records per source.
**Rule**: If the UI claims data was crossed, pipeline must emit auditable source findings (`queried`, `matched`, and summary/details) from actual calls.
**Pattern**: Add a `source_findings` contract in evidence payload and let UI render it first, with legacy fallback only for old tickets.

## Lesson: 2026-02-20 (iterative crossing vs linear)
**Mistake**: Source crossing was effectively linear and did not revisit systems after enrichment.
**Root cause**: Pipeline aggregated one-pass outputs without explicit multi-round refinement model.
**Rule**: For triage correlation, model the flow as iterative rounds and store chronology (`round`) in provenance records.
**Pattern**: Intake anchors -> source pass -> enriched terms -> historical pass -> refinement pass, then UI reflects the same sequence.

## Lesson: 2026-02-20 (history source regression)
**Mistake**: Sidebar history endpoint was narrowed to one table and dropped legacy session data from the UI.
**Root cause**: List API coupled to ingestion source (`tickets_processed`) instead of canonical session history.
**Rule**: Ticket list endpoints must aggregate all authoritative history sources and dedupe by ticket identity.
**Pattern**: Merge + normalize + sort strategy in API before rendering list-based navigation UIs.

## Lesson: 2026-02-20 (home route auth fetch)
**Mistake**: Same endpoint behaved differently across pages because one route omitted credentials.
**Root cause**: Inconsistent fetch options between triage detail and triage home implementations.
**Rule**: Any session-protected API call must always include `credentials: include` on frontend.
**Pattern**: Centralize or standardize fetch config for shared endpoints to prevent silent empty states.

## Lesson: 2026-02-20 (schema drift + stale process)
**Mistake**: Introduced query dependency on new column without guaranteeing migration rollout across all running DBs/processes.
**Root cause**: Mixed schema versions + detached API process still running old code path.
**Rule**: For evolving schemas, make read paths backward-compatible and always verify against live running process after deploy/restart.
**Pattern**: `information_schema` capability check + explicit stack restart + live endpoint assertion.

## Lesson: 2026-02-20 (best-source precedence for historical payloads)
**Mistake**: Sidebar read model preferred stale/low-quality fields from legacy evidence payload over cleaner processed ticket data.
**Root cause**: No data-quality precedence policy in merge layer.
**Rule**: In merged read models, prioritize highest-quality parsed source and fallback only when missing.
**Pattern**: processed ticket fields > sanitized pack fields > hard fallback.

## Lesson: 2026-02-20 (fallback precedence bug)
**Mistake**: Added raw fallback source but forgot to include it in title precedence.
**Root cause**: Merge policy implemented partially across fields.
**Rule**: When introducing a new fallback source, apply it consistently to every displayed field.
**Pattern**: validate by asserting a known edge pair (valid session-only ticket vs noisy one).

## Lesson: 2026-02-20 (requester semantics)
**Mistake**: Mapped requester to ticket creator (`Created by`) even when text clearly identified a different affected user.
**Root cause**: Extraction logic optimized for metadata field, not business meaning.
**Rule**: For requester in UI, prioritize requested-for/affected user from ticket narrative before creator metadata.
**Pattern**: `request from X` > salutation name > `Created by` fallback.

## Lesson: 2026-02-20 (playbook pipeline blocked by schema drift)
**Mistake**: PrepareContext and ingestion persistence assumed `tickets_processed.company` exists, breaking pipeline when DB migration wasn't applied.
**Root cause**: Read/write paths were not equally backward-compatible across evolving schema.
**Rule**: Any schema extension must include compatibility guards in all critical pipeline stages (ingest + prepare + list).
**Pattern**: Runtime column capability check + fallback projection/query branch.

## Lesson: 2026-02-20 (integration split-brain + evidence drift)
**Mistake**: Integration health UI used workspace credentials from DB, but PrepareContext runtime used process env credentials; diagnosis/playbook also over-weighted weak priors and missing-data failures.
**Root cause**: Credential source paths were not unified across runtime stages; LLM prompts lacked strict grounding constraints against high-risk inference drift.
**Rule**: For every external integration, all runtime consumers must read from the same tenant/workspace credential source as the health endpoint; missing integration data must stay as data gap unless ticket-scoped evidence says otherwise.
**Pattern**: Shared credential resolver + evidence guardrail checks (diagnosis/playbook) with deterministic fallback when unsupported narratives appear.

## Lesson: 2026-02-20 (partial capability vs total failure in IT Glue)
**Mistake**: Treated IT Glue runbooks endpoint `404` as total IT Glue outage in PrepareContext.
**Root cause**: Single-call failure in one IT Glue capability (`/documents`) was mapped to whole-stage failure.
**Rule**: Integration collection must degrade gracefully per capability (runbooks/docs/configs/contacts), not fail-all on one endpoint.
**Pattern**: classify endpoint-specific errors, continue with remaining data sources, and emit granular `source_findings` instead of broad `missing_data` failure.
## Lesson: 2026-02-20 (tooling freeze on direct shell DB path)
**Mistake**: Attempted operational DB cleanup using `psql` + `source .env`, which failed/hung in this environment.
**Root cause**: Assumed `psql` availability and `.env` shell-safe formatting; both assumptions were false.
**Rule**: For this repo, prefer project-native Node/TS scripts (`tsx` + existing DB module) over direct shell DB tooling unless availability is confirmed first.
**Pattern**: Before DB ops, validate tool availability (`which psql`) or skip directly to app-native query path.
## Lesson: 2026-02-20 (zero-score device fallback contamination)
**Mistake**: Device resolver accepted `ninjaOrgDevices[0]` even when correlation score was zero.
**Root cause**: Fallback policy optimized for continuity, not evidentiary correctness.
**Rule**: Candidate resolution must never promote a zero-confidence fallback into confirmed evidence.
**Pattern**: If top score < minimum threshold, persist explicit unresolved state (`missing_data`) and stop propagation to digest/playbook.
## Lesson: 2026-02-20 (do not ask for confirmation when user reports concrete bug)
**Mistake**: I offered "if you want, I can fix now" after a direct bug report.
**Root cause**: Communication default slipped into optional mode instead of autonomous execution mode.
**Rule**: When user reports a concrete defect, execute fix immediately and only report progress/outcome.
**Pattern**: Bug report -> root cause -> patch -> verify -> report. No confirmation prompt in-between.

## Lesson: 2026-02-20 (manual reprocess without env causes fallback homogenization)
**Mistake**: Reprocessed tickets with a standalone script that did not load `.env`, forcing diagnose/playbook to `rules-fallback` and producing near-identical outputs.
**Root cause**: Operational script bypassed API bootstrap/runtime environment loading assumptions.
**Rule**: Any manual/offline reprocess path must explicitly load production-equivalent env and record model provenance per step.
**Pattern**: If multiple tickets suddenly share generic playbooks, verify `llm_outputs.model` before analyzing prompt quality.

## Lesson: 2026-02-20 (provider contract must be explicit during manual reprocess)
**Mistake**: Reprocessed tickets with provider drift (Groq) while operational expectation was Gemini.
**Root cause**: Manual script relied on ambient env/default provider instead of explicit provider override per run.
**Rule**: For manual ticket reprocessing, always force `LLM_PROVIDER` explicitly and verify persisted `llm_outputs.model` afterward.
**Pattern**: Any mismatch between expected and observed playbook style should trigger immediate provider provenance check.

## Lesson: 2026-02-20 (target file precision under user pressure)
**Mistake**: Validei paridade no `new.html` em vez do componente real do projeto (`apps/web`).
**Root cause**: Assumi o arquivo citado anteriormente como fonte de verdade sem reconfirmar o alvo de implementação no app.
**Rule**: Em tarefas de paridade visual, sempre validar primeiro o componente renderizado na rota real antes de usar arquivos de referência estáticos.
**Pattern**: "mock/reference file" != "runtime component"; localizar binding real (`page` -> `component`) antes de concluir análise.

## Lesson: 2026-02-20 (resizable right pane blocked by child fixed width)
**Mistake**: Painel direito parecia não redimensionar dinamicamente.
**Root cause**: O filho (`PlaybookPanel`) tinha largura fixa (`360px`), sobrescrevendo a largura do container redimensionável.
**Rule**: Em colunas resizables, componentes filhos devem usar `width: 100%` e respeitar constraints do parent.
**Pattern**: `fixed child width` dentro de pane resizable gera falsa sensação de resize quebrado.

## Lesson: 2026-02-20 (scope under-reported: issue affected all 3 panes)
**Mistake**: Foquei inicialmente na sidebar esquerda, mas o padrão de reconstrução estava no ciclo de polling da página inteira (left/main/right).
**Root cause**: Diagnóstico inicial ficou local (componente) e não no fluxo completo (route polling + backend trigger loop).
**Rule**: Para sintomas de reconstrução frequente, auditar sempre o pipeline end-to-end (frontend polling + endpoint behavior + merge rules), não só o componente visível.
**Pattern**: Re-render em múltiplas seções geralmente indica fonte de dados/polling compartilhada, não bug isolado de UI.

## Lesson: 2026-02-20 (meaningful != stable)
**Mistake**: Gate only blocked `Unknown` regressions but still allowed swapping between two meaningful variants (raw noisy vs normalized clean).
**Root cause**: Merge logic lacked quality ranking/tie-breakers for semantically equivalent fields.
**Rule**: SSOT merge must be monotonic by field quality, not only by non-empty checks.
**Pattern**: For polled multi-source ticket fields, use deterministic quality scoring + tie-breaks to prevent text flapping.

## Lesson: 2026-02-21 (fix local isolado não resolve split-brain de payload)
**Mistake**: Corrigi sintomas em partes (ordenação/lista/snapshot) sem eliminar completamente o caminho concorrente de metadados entre sidebar e center.
**Root cause**: O center continuava derivando campos críticos da lista da sidebar em vez de um payload canônico único do backend para o ticket atual.
**Rule**: Em bugs de oscilação por polling, só considerar resolvido quando houver uma única fonte canônica por etapa (`ticket > pipeline > llm > ui > cache`) sem caminhos paralelos para os mesmos campos.
**Pattern**: Se duas seções mostram o mesmo dado e divergem por segundos, existe split-brain de leitura; corrigir no contrato de resposta e no consumidor, não apenas no render.

## Lesson: 2026-02-21 (pipeline-ou-nada must fail fast end-to-end)
**Mistake**: Kept residual fallback-oriented runtime helpers/tests after the user explicitly mandated "pipeline ou nada".
**Root cause**: Partial migration to fail-fast left legacy fallback artifacts in code paths and naming, creating ambiguity and regression risk.
**Rule**: Under explicit no-fallback policy, all diagnose/playbook stages must either produce provider-backed outputs or set session `failed` with explicit error provenance.
**Pattern**: If `llm_outputs.model` can still contain `*fallback*`, contract is violated; audit services + tests + runtime reprocess path immediately.

## Lesson: 2026-02-21 (bulk reprocess scripts must load production-equivalent env)
**Mistake**: First bulk reprocess run executed without dotenv bootstrap, causing false-negative pipeline failures (`GEMINI_API_KEY not set`).
**Root cause**: Ad-hoc operational script imported orchestrator directly without app bootstrap environment loading.
**Rule**: Any direct TSX orchestration script must load `.env` (or run through already bootstrapped API runtime) before invoking pipeline services.
**Pattern**: Bulk reset/reprocess => bootstrap env first, then audit status/model for each ticket.

## Lesson: 2026-02-21 (quota/rate-limit is retriable, not terminal)
**Mistake**: Transient LLM provider failures (quota 429 / limiter) were marked as `failed` terminal sessions.
**Root cause**: Pipeline catch blocks classified all exceptions as terminal.
**Rule**: Provider transient failures must map to retriable status (`blocked`), while keeping `pipeline ou nada` (no fallback artifacts).
**Pattern**: `RESOURCE_EXHAUSTED`/`429`/limiter/timeout => `blocked`; deterministic validation/logic errors => `failed`.

## Lesson: 2026-02-21
**Mistake**: Checklist generation was not explicitly bound to all material hypotheses, causing action plans to drift to generic H1-only steps.
**Root cause**: Prompt contract between diagnosis and playbook lacked mandatory mapping and no post-generation alignment gate.
**Rule**: When model output depends on ranked hypotheses, enforce explicit hypothesis tags and validate coverage before accepting output.
**Pattern**: Any `top_hypotheses` -> procedural plan flow needs deterministic coverage checks.

## Lesson: 2026-02-21
**Mistake**: Assumed Gemma 3 27B usage via Groq without confirming the actual provider path in this deployment.
**Root cause**: Provider/model mapping was inferred from code defaults instead of explicitly aligning with user runtime setup.
**Rule**: When user names model + platform (e.g. Gemma in AI Studio), configure the exact provider path first, then tune limiter on that path.
**Pattern**: Multi-provider adapters require explicit provider confirmation before quota/rate-limit changes.

## Lesson: 2026-02-23 (assumed DB access)
**Mistake**: Requested user to provide DB access details even though the project has a default connection string.
**Root cause**: I tried to query with a missing/invalid `DATABASE_URL` instead of falling back to the built-in default.
**Rule**: If the repo includes a default DB connection string, use it before asking the user for access.
**Pattern**: When `DATABASE_URL` causes auth errors, retry with the repo default and only ask if that fails.

## Lesson: 2026-02-24 (table detection vs table perception)
**Mistake**: Declared "table detection/rendering fixed" before validating how it looked in the actual UI screenshot.
**Root cause**: I verified formatter logic in isolation but underweighted two real-world factors: over-splitting on roster role phrases (`Business Development`, `Williams Marketing`) and missing explicit table styling in `MarkdownRenderer`.
**Rule**: For formatting/rendering fixes, verify both the generated markdown structure and the visual presentation layer (`renderer + CSS`) against a real ticket screenshot before marking done.
**Pattern**: "Rendered data structure exists" != "user perceives correct UI"; always validate perception-critical changes end-to-end.

## Lesson: 2026-02-24 (clean display semantics vs pipeline semantics)
**Mistake**: Initially treated `text_clean` as both pipeline-clean text and UI-formatted output.
**Root cause**: I optimized for reusing the existing field instead of separating concerns between machine-parsable normalization and technician-facing presentation.
**Rule**: When the UI requires rich formatting (especially LLM-authored markdown), persist a dedicated display field/format flag and keep pipeline-clean text semantically plain.
**Pattern**: Canonical parsing text and display markdown should be separate artifacts (`canonical` vs `display`), with explicit format metadata.

## Lesson: 2026-02-24 (LLM formatter guard should recover before degrading UX)
**Mistake**: A first pass at blocking LLM paraphrase risk could over-degrade `Clean` back to plain text.
**Root cause**: Validation existed, but there was no intermediate strict-retry formatting step to preserve formatting quality while enforcing verbatim text.
**Rule**: For LLM formatting transforms, implement `candidate -> validate -> strict retry -> validate -> plain fallback`.
**Pattern**: If user feedback says "formatting was good, only text changed", keep the formatting path and tighten the wording contract instead of collapsing to plain fallback.

## Lesson: 2026-02-24 (verbatim guard must tolerate formatting labels)
**Mistake**: The verbatim guard still rejected good rich formatting because it expected near-exact text after markdown stripping.
**Root cause**: Rich formatting can legitimately add a small number of structural words (headers/labels), which looked like drift to a strict equality-style validator.
**Rule**: For rich-format validation, use high source-token coverage + low novel-token ratio (with a formatting-word allowlist), not near-exact equality.
**Pattern**: Guard false negatives show up as "no formatting at all" because the system silently falls back to plain text.

## Lesson: 2026-02-24 (separate LLM tasks by intent)
**Mistake**: I asked one normalization prompt to both reinterpret (`description_ui`) and produce verbatim-rich formatting (`description_display_markdown`).
**Root cause**: Mixed objectives in the same LLM response increased the chance of semantic bleed/paraphrase in the display field.
**Rule**: When two outputs have conflicting transformation goals (reinterpret vs format-only), use separate LLM calls with dedicated prompts.
**Pattern**: `canonical cleanup` and `display formatting` are distinct tasks; coupling them creates avoidable drift.

## Lesson: 2026-02-24 (format-only prompt can still over-constrain formatting)
**Mistake**: The strict formatter prompt prohibited adding any labels/headings, which prevented the simple rich formatting the user actually wanted.
**Root cause**: I optimized for verbatim preservation but accidentally removed the model's ability to add minimal structure (`Request`, `Signature`).
**Rule**: For format-only prompts, allow minimal generic structural labels while forbidding semantic rewrites.
**Pattern**: "No new words" is too strict for rich formatting; prefer "no new facts / no paraphrase" plus minimal structural labels.

## Lesson: 2026-02-24 (prompt needs explicit consistency rules for repeated structures)
**Mistake**: Similar onboarding tickets (Phase 1 vs Phase 2) produced inconsistent formatting because the prompt did not strongly prefer tables for repeated person rosters.
**Root cause**: I relied on generic "use tables when helpful" language instead of encoding a concrete trigger and fallback behavior.
**Rule**: For recurring ticket shapes (e.g. onboarding user rosters), specify an explicit formatting trigger (`3+ person-like rows => table`) and an ambiguity-safe fallback (`Name | Details`) in the prompt.
**Pattern**: If one example formats correctly and another similar one does not, the prompt lacks deterministic structure guidance.

## Lesson: 2026-02-23 (refresh must be hard reset, not UI-only)
**Mistake**: Implemented refresh that reset UI/session artifacts but still allowed org-level caches to repopulate pipeline outputs.
**Root cause**: Hard refresh semantics were incomplete (did not clear IT Glue org caches) and button UX did not match expectation.
**Rule**: Any user-facing 'refresh pipeline' action must explicitly define and enforce cache invalidation scope needed for true pipeline restart.
**Pattern**: If pipeline output reappears immediately after refresh, audit upstream caches (`*_snapshot`, `*_enriched`) and invalidate at ticket/org scope.

## Lesson: 2026-02-23 (manual refresh restart needs race guards + UI cache invalidation)
**Mistake**: Even after creating a new triage session on refresh, stale data still reappeared in the UI.
**Root cause**: Two surviving cache/race paths remained: (1) older background sessions could still repersist ticket-level artifacts (`ticket_ssot` / ticket artifacts), and (2) frontend local snapshot/poll responses were not invalidated during hard refresh.
**Rule**: For manual pipeline restart, protect ticket-scoped artifact persistence against superseded sessions and explicitly invalidate frontend local caches/in-flight polling responses.
**Pattern**: If refresh creates a new session but old data returns, check both async writer races (old session persisting global-by-ticket artifacts) and client-side memo/snapshot state.

## Lesson: 2026-02-23
**Mistake**: Considerei o fluxo atual como aderente sem validar o contrato detalhado do Prepare Context (2a..2f).
**Root cause**: Auditoria orientada por semelhança narrativa, não por especificação funcional exata.
**Rule**: Quando o usuário define contrato operacional detalhado, validar aderência item a item antes de concluir “ok”.
**Pattern**: Pipeline multi-fonte com LLM exige checagem por artefato persistido (snapshot, enriched, SSOT UI), não só por nomes de serviços.

## Lesson: 2026-02-23 (fix aplicado no código, mas runtime não recarregado)
**Mistake**: Declarei o toggle `Clean` como corrigido sem confirmar que o frontend em execução estava servindo o bundle atualizado.
**Root cause**: Validei source + typecheck, mas não validei runtime process/hot-reload para a tela real usada pelo usuário.
**Rule**: Em bug de UI “continua igual”, após patch e typecheck, verificar processo runtime (`:3000`) e reiniciar antes de marcar como resolvido.
**Pattern**: `code fixed + data exists + user still sees old UI` => checar bundle/runtime stale (Next dev/prod process) antes de reabrir backend investigação.

## Lesson: 2026-02-23 (reframed summary can invert ticket roles)
**Mistake**: Aceitei uma reinterpretação que atribuiu o nome do requester ao affected user em um ticket de "new employee".
**Root cause**: A normalização 2a priorizava resumo curto, mas sem guard explícito de papéis (requester vs affected user) quando o ticket fala de terceiro não nomeado.
**Rule**: Em `description_ui`, nunca usar `requester_name` como affected user sem evidência explícita; em onboarding/third-party requests, manter o affected user como "name not provided" quando ausente.
**Pattern**: Frases como "we have a new employee... he will need..." + assinatura do requester exigem guard de role assignment pós-LLM.

## Lesson: 2026-02-23 (history without scope pollutes Prepare Context)
**Mistake**: O 2e retornou casos históricos de outras empresas quando `org` ficou `unknown`.
**Root cause**: A busca ampla de histórico fazia fallback no tenant inteiro sem exigir boundary de escopo (org/company) e o filtro posterior de org não protegia quando o alvo também era `unknown`.
**Rule**: Histórico só pode retornar related cases com escopo confiável (`orgId` ou `companyName`); sem escopo, bloquear a correlação e registrar o motivo.
**Pattern**: `org=unknown` + `related_cases > 0` em ambiente multi-tenant quase sempre indica contaminação cross-company.

## Lesson: 2026-02-23 (SSOT cannot regress known intake fields)
**Mistake**: O SSOT final saiu com `company=unknown` e outros campos básicos degradados, apesar de a sidebar (intake) já possuir valores corretos.
**Root cause**: O builder do SSOT aceitava `sections.*` finais como fonte única, sem merge protetivo contra regressão para `unknown`.
**Rule**: Campos conhecidos no intake (empresa, requester, título, descrição, created_at, emails) são baseline; SSOT pode enriquecer, mas não degradar para `unknown`.
**Pattern**: Se sidebar/raw mostra valor e center/right (SSOT) mostra `unknown`, existe regressão de merge no pipeline final.

## Lesson: 2026-02-23 (normalization can remove org clues before org inference)
**Mistake**: A inferência de empresa continuou falhando mesmo com regex melhor, porque o pipeline limpava `rawBody` antes de inferir `company`.
**Root cause**: A ordem das etapas usava narrativa pós-normalização para inferir org/company, perdendo boilerplate útil como “ticket created for <company>”.
**Rule**: Inferência de org/company deve considerar a narrativa original (pré-normalização) além da narrativa limpa.
**Pattern**: Se `text_original` contém empresa e `company=unknown`, verificar mutação prematura do `rawBody`/narrative.

## Lesson: 2026-02-23 (broader extraction problem > client-specific fix)
**Mistake**: A tentação inicial foi corrigir a ausência de ISP/firewall/WiFi olhando um caso específico (CAT) em vez de melhorar a modelagem genérica da extração do IT Glue.
**Root cause**: Foco excessivo em output de um ticket sem formalizar classes de evidência reutilizáveis (WAN assets, password metadata, docs relevantes, alias de org).
**Rule**: Quando um ticket revela dados claros em IT Glue mas SSOT sai `unknown`, corrigir primeiro a capacidade genérica de extrair/normalizar/classificar evidências por tipo — nunca hardcode por org.
**Pattern**: `screenshots show rich ITG data` + `round2 counts zero/unknown` => revisar org resolver + extractors genéricos (WAN/password metadata/doc ranking), não valores específicos do cliente.

## Lesson: 2026-02-23 (false-positive org match can silently nullify enrichment)
**Mistake**: Considerei a extração IT Glue como principal culpada, mas o pipeline estava consultando a org errada (`Composite Resources, Inc.`) para um ticket de `CAT Resources, LLC`.
**Root cause**: Resolver de org usava `find()` sobre lista parcial (`getOrganizations()` default 100) com matching permissivo/fallback por domínio com ruído, permitindo falso positivo por similaridade corporativa.
**Rule**: Resolução de org multi-tenant deve usar inventário amplo (`page[size]=1000` quando suportado), ranking por score (não primeiro match booleano) e penalidade para overlap só em tokens genéricos.
**Pattern**: `SSOT.company correto` + `round2 org match nome diferente` + `ITG passwords/docs/assets = 0` => bug no org resolver, não (apenas) no extractor.

## Lesson: 2026-02-23 (schema assumptions in SQL filters must be runtime-verified)
**Mistake**: O filtro de histórico broad por empresa foi implementado usando `tickets_processed.company`, mas a coluna não existe no schema real.
**Root cause**: Assumi que o campo `company` estava persistido em `tickets_processed` sem confirmar `information_schema`/migrations locais.
**Rule**: Toda nova query SQL que depende de coluna recém-assumida deve ser validada contra o schema real (ou usar fonte já confirmada, ex.: `ticket_ssot.payload`).
**Pattern**: Se `typecheck` passa e o runtime falha com `42703`, revisar suposições de schema imediatamente antes de depurar lógica de negócio.

## Lesson: 2026-02-23 (IT Glue parent org can be valid while UI screenshots come from child org)
**Mistake**: Marquei o match `Composite Resources, Inc.` como incorreto sem validar a relação parent/child no IT Glue.
**Root cause**: Interpretei o nome exibido no snapshot como mismatch, mas o tenant usa `Composite` (parent) e `CAT Resources` (child) com dados distribuídos por recursos diferentes.
**Rule**: Em IT Glue, validar a árvore de organizações (`parent-id` / `ancestor-ids`) antes de concluir que um match é “errado”; screenshots de UI podem estar no child org enquanto o pipeline resolveu o parent.
**Pattern**: `org snapshot name != company display name` + endereços/configs batem => investigar parent/child split e onde cada tipo de dado (passwords/docs/WAN) está armazenado.

## Lesson: 2026-02-24 (IT Glue tenant endpoints and attribute naming must be runtime-probed)
**Mistake**: Tratei `documents_raw: 0` e `passwords: 0` como ausência de dados antes de validar endpoint behavior e shape real do tenant.
**Root cause**: O tenant retornava `404` no endpoint global `/documents` filtrado por org (mas o nested funcionava), e parte da extração lia attrs em `snake_case` enquanto a API devolvia `kebab-case`; além disso erros viravam `[]` em alguns paths.
**Rule**: Em troubleshooting de IT Glue, sempre confirmar endpoint (global vs nested), permissões e naming (`kebab/snake`) com probe real antes de concluir “sem dados”.
**Pattern**: UI mostra dados + snapshot API mostra zeros => verificar primeiro `404/403 masked`, rota nested, e parser de atributos.

## Lesson: 2026-02-24 (multi-scope collection can silently blow API quota without per-round budgets)
**Mistake**: Ampliei a coleta IT Glue para parent+child orgs e flexible assets, mas sem guardrails explícitos de volume por ticket.
**Root cause**: O loop `scope_orgs x flexible_asset_types` multiplicou chamadas rapidamente (centenas por ticket), e a expansão de attachments/related items adicionou mais fan-out.
**Rule**: Toda coleta multi-scope/multi-endpoint precisa de budget por round (request cap), limites de escopo, limites de fan-out e priorização de endpoints/tipos por relevância.
**Pattern**: Se um fix melhora cobertura mas o tenant começa a retornar 429/quota exceeded, revisar imediatamente loops de cartesian product e adicionar request budgets auditáveis no `source_findings`.

## Lesson: 2026-02-24 (LLM fusion output must be schema-valid AND evidence-grounded)
**Mistake**: O pipeline aceitou uma inferência LLM inventada (`internal_hr_system`) e gravou `Alex Hall` no `SSOT` como affected user sem evidência real no ticket/IT Glue/Ninja.
**Root cause**: A sanitização do `fusion` validava formato/schema, mas não validava grounding (`evidence_refs`/`inference_refs`) contra os candidatos/links/inferences realmente gerados pelo pipeline.
**Rule**: Em fusão multi-fonte, saída da LLM só é válida se estiver ancorada em evidências e inferências previamente geradas pelo pipeline; `schema-valid` não basta.
**Pattern**: Se `fusion_audit` menciona sistemas/fatos não presentes nos candidates (`internal_hr_system`, etc.), a validação pós-LLM está frouxa.

## Lesson: 2026-02-24 (UI consistency requires shared SSOT-derived display semantics, not just shared payload)
**Mistake**: Sidebar e center/right consumiam dados do mesmo ticket, mas exibiam “User” com semânticas diferentes (`requester` vs `affected_user`), criando split-brain visual.
**Root cause**: Cada superfície tinha sua própria precedence/fallback para o campo exibido, sem uma regra comum derivada do SSOT.
**Rule**: Se a UI diz usar SSOT, cada rótulo visual (ex.: `User`) precisa de uma regra única e compartilhada de derivação a partir do SSOT.
**Pattern**: `sidebar user != right panel user` pode ser bug de semântica/fallback mesmo quando ambos “usam SSOT” parcialmente.

## Lesson: 2026-02-24 (contamination guards need domain-safe allowability, not broad keyword bans)
**Mistake**: O `PlaybookWriter` bloqueava playbooks legítimos de troubleshooting por regex ampla (`debug`, `api response`) no contamination guard.
**Root cause**: Os padrões foram escritos para bloquear vazamento meta de LLM/engine, mas sem considerar que termos como `API response` e `debug logs` são comuns em playbooks operacionais.
**Rule**: Guards anti-contaminação devem bloquear contexto meta explícito (`LLM/model/prompt/json response`) e evitar palavras genéricas usadas em troubleshooting técnico.
**Pattern**: Falha consistente no `PlaybookWriter` com `Validation=approved` e `last_error=contamination guard blocked` => verificar regex overbroad antes de culpar PrepareContext/Diagnose.

## Lesson: 2026-02-24 (SSOT anti-regression must preserve display-critical intake formatting, not only non-unknown semantics)
**Mistake**: O `company` do ticket regrediu visualmente após processamento (ex.: nome colapsado/normalizado) porque o merge do SSOT só bloqueava `unknown`, não versões “significativas” porém piores que o intake.
**Root cause**: `applyIntakeAntiRegressionToSSOT` usava `pickBetter` baseado apenas em `unknown`, permitindo que variantes processadas do mesmo nome substituíssem a forma canônica do intake.
**Rule**: Campos de display críticos vindos do intake (`company`, `requester`) devem preservar a forma bruta canônica quando disponível; anti-regressão precisa proteger também contra regressão de formatação/qualidade, não só `unknown`.
**Pattern**: UI correta logo após reset e piora após `Prepare Context` => verificar se o SSOT está sobrescrevendo valor de intake com variante semântica degradada.

## Lesson: 2026-02-24 (company extraction from HTML emails must decode entities before regex matching)
**Mistake**: A inferência de empresa caiu para fallback de domínio (`Garmonandcompany`) mesmo com a frase correta “created for GARMON & CO. INC.” presente no email do Autotask.
**Root cause**: O parser aplicava regex no HTML cru com entidades (`&amp;`), e os padrões de empresa não toleravam a sequência codificada; isso quebrava a captura e ativava o fallback por domínio.
**Rule**: Sempre decodificar entidades HTML básicas antes de regex semânticos em texto de email (`company`, `requester`, etc.).
**Pattern**: Empresa correta visível em email HTML + SSOT mostra versão derivada do domínio => suspeitar de `&amp;`/entities quebrando regex de extração.

## Lesson: 2026-02-24 (background pipeline failures must persist last_error, not only status)
**Mistake**: `/playbook/full-flow` background processing marcava sessões como `failed`/`pending` sem salvar `last_error`, deixando a UI mostrar `FAILED` sem causa.
**Root cause**: O catch de `triggerBackgroundProcessing()` atualizava apenas `status` e `updated_at`.
**Rule**: Todo path que muda `triage_sessions.status` para erro/retry deve persistir a mensagem em `last_error`.
**Pattern**: Ticket em `FAILED` após refresh com `triage_sessions.last_error = null` => verificar catch/background route fora do orquestrador principal.

## Lesson: 2026-02-24 (playbook evidence guardrails should block assertive unsupported drift, not incidental mentions)
**Mistake**: O playbook de um ticket de WiFi foi bloqueado por `unsupported inference` mesmo com `Prepare Context`, `Diagnose` e `Validation` corretos.
**Root cause**: `shouldBlockPlaybookOutput` tratava qualquer menção a termos high-risk (ex.: `malware`) sem evidência como bloqueante, inclusive quando apareciam de forma incidental/defensiva no texto.
**Rule**: Guardrail de playbook deve bloquear deriva **assertiva/perigosa** (root cause/compromise/remediação de incidente) sem evidência, não menções incidentais que não redefinem o caso.
**Pattern**: `last_error = Playbook guardrail blocked unsupported inference` em tickets operacionais/rede => revisar heurística de "high-risk drift" para contexto/assertividade.

## Lesson: 2026-02-24 (don’t over-prescribe rollout strategy in a non-production codebase)
**Mistake**: Propus rollout paralelo/gradual como se houvesse ambiente de produção ativo para a Fase 3.
**Root cause**: Assumi restrições de deploy típicas sem validar o estágio real do produto (ainda em desenvolvimento).
**Rule**: Antes de recomendar estratégia de rollout, confirmar se o app está em produção; em ambiente de desenvolvimento, priorizar implementação direta + validação em tickets reais.
**Pattern**: Usuário corrige “sem produção” => reduzir overhead de rollout e acelerar implementação.
## Lesson: 2026-02-24 (UI Unknown with timeline-known value is often SSOT completeness breach, not a UI fallback issue)
**Mistake**: Diagnostiquei o card `Phone Provider = Unknown` como problema de fallback/binding da UI para fontes diferentes, mesmo após o usuário reforçar que a UI deve consumir exclusivamente SSOT.
**Root cause**: Eu foquei no sintoma visual (timeline mostra valor, card não) e propus mitigação na UI antes de validar o contrato arquitetural: se o pipeline sabe o dado, ele deve ser promovido ao SSOT.
**Rule**: Em campos de UI de contexto (`user/company/provider/device`), discrepância entre superfícies não deve ser corrigida com fallback na UI; primeiro tratar como falha de promoção/completude do SSOT.
**Pattern**: Timeline/evento operacional menciona valor inferido e card SSOT mostra `Unknown` => investigar `PrepareContext`/merge para SSOT, não adicionar fallback em `page.tsx`.

## Lesson: 2026-02-24 (intake classification must be queue-actionability-first, not semantic-label-first)
**Mistake**: Eu inicialmente classifiquei os exemplos por semântica (`bounce`, `marketing`, `digest`) como se isso resolvesse a triagem, mas para a fila todos eram noise/gibberish.
**Root cause**: Modelei o problema como taxonomia de conteúdo bruto, não como gate de acionabilidade operacional da fila.
**Rule**: No Playbook Brain intake, a primeira classificação deve ser `actionable vs non-actionable (gibberish)`; subtipos semânticos só entram como camada secundária para auditoria/UX.
**Pattern**: Se a pergunta do usuário menciona economia de API e medo de falso positivo, priorizar `queue-actionability` + `abstenção`, não taxonomia semântica de email.

## Lesson: 2026-02-24 (UI controls need visual QA after functional delivery)
**Mistake**: Entreguei o botão de filtro/supressão funcionalmente correto, mas não fiz uma segunda passada de polish visual suficiente para o ícone/controle no contexto real da UI.
**Root cause**: Foco excessivo em comportamento e segurança operacional (`Suppress > Delete`) sem revisar o acabamento visual dos controles de ação no header.
**Rule**: Após mudanças de UI com ícones/botões compactos, sempre fazer uma passada de QA visual (proporção, peso do traço, padding, contraste) antes de considerar “done”.
**Pattern**: Feedback curto do usuário tipo “esse ícone está horrível” normalmente aponta para proporção/legibilidade, não para fluxo/arquitetura.

## Lesson: 2026-02-24 (visual feedback requests require clearly perceptible changes, not subtle polish)
**Mistake**: Interpretei "esse ícone está horrível" como pedido de polish incremental e entreguei uma mudança visual sutil demais, que o usuário percebeu como "zero mudanças".
**Root cause**: Não calibrei a severidade do feedback visual; para crítica forte de UI, o usuário espera uma alteração claramente perceptível no elemento central (glyph), não apenas container/hover.
**Rule**: Quando o usuário rejeitar um ícone explicitamente, trocar o glyph de forma evidente primeiro; depois ajustar acabamento.
**Pattern**: Feedback "zero mudanças" após UI polish = o problema principal continua no símbolo/forma, não nos detalhes de borda/sombra.

## Lesson: 2026-02-24 (diagnose metadata consumers must treat missing fields as legacy-compatible)
**Mistake**: No `ValidatePolicyService`, tratei `playbook_anchor_eligible` ausente como `false`, fazendo diagnósticos antigos parecerem "sem âncora" e degradando status/validação sem motivo.
**Root cause**: Assumi presença universal de metadata nova da Fase 3, ignorando compatibilidade com payloads legados e fixtures de teste.
**Rule**: Ao integrar campos opcionais novos no pipeline (`Diagnose -> Validate -> Playbook`), ausência do campo deve ter comportamento compatível explícito (ex.: `anchorEligible = true` por default para legado).
**Pattern**: Introdução de metadata opcional + queda inesperada de testes "happy path" => revisar defaults de compatibilidade antes de mexer em thresholds.

## Lesson: 2026-02-24 (risk gates need real-world destructive verb coverage, not only abstract patterns)
**Mistake**: O novo gate de ação destrutiva não bloqueou o caso de teste “Factory reset the firewall...” porque o matcher não incluía `factory reset`.
**Root cause**: Cobertura de regex focada em verbos genéricos (`delete`, `disable`, `wipe`) sem considerar frases operacionais comuns de MSP/network.
**Rule**: Ao implementar guardrails de remediação destrutiva, incluir vocabulário operacional concreto (`factory reset`, `reset firewall`, etc.) e validar com exemplos reais de linguagem de técnico.
**Pattern**: Teste de risco falha com `status=approved` quando deveria bloquear => antes de mexer em lógica de status, revisar cobertura lexical do matcher.

## Lesson: 2026-02-24 (prompt-only contracts are not real contracts)
**Mistake**: O `PlaybookWriter` já descrevia uma boa estrutura no prompt, mas o validador de estrutura só dava `warn`, então a Fase 5 podia sair sem `Escalation`/`Checklist`/`Hypotheses` consistentes.
**Root cause**: Dependência excessiva na obediência da LLM ao prompt, sem gate determinístico pós-geração.
**Rule**: Quando o usuário define um contrato de saída (ex.: seções do playbook), transformar em validação determinística + repair automático antes de aceitar o output.
**Pattern**: “A seção está no prompt mas não é garantida” => adicionar validator que falha/testa o contrato, não só instrução textual.

## Lesson: 2026-02-24 (numbered references must be anchored to the same list)
**Mistake**: Interpretei "now 3 and 4" como referência aos "next steps" mais recentes em vez de aos findings numerados da auditoria, apesar do contexto imediato ainda estar ancorado na lista de findings.
**Root cause**: Eu não confirmei explicitamente qual lista numerada estava ativa quando havia múltiplas listas numeradas no contexto recente (findings, next steps, plan steps).
**Rule**: Quando o usuário usa referências numéricas curtas ("1 and 2", "3 and 4"), mapear primeiro para a última lista explicitamente discutida; se houver ambiguidade real, citar as opções antes de assumir.
**Pattern**: Conversa com múltiplas listas numeradas + resposta curta do usuário => responder com mapeamento explícito ("you mean findings X/Y") antes de propor novo trabalho.

## Lesson: 2026-02-24 (UI wording can hide code-scope requirements)
**Mistake**: Interpretei "remove the reframed" como remoção apenas da opção visual do toggle, quando o usuário queria remover o conceito/campo do código-base.
**Root cause**: Eu ancorei na screenshot/UI e executei o menor patch visual sem validar se "entirely from the codebase" era o escopo real do termo.
**Rule**: Quando o usuário pede remover algo nomeado (ex.: `Reframed`) e mostra UI, confirmar/remover também o modelo de dados/campos associados, não só o controle visual.
**Pattern**: Solicitação de UI + termo de domínio/campo explícito => procurar referências globais (`rg`) antes de limitar o patch ao componente.
## Lesson: 2026-02-24 (display anti-regression can freeze low-quality intake fallbacks if provenance is ignored)
**Mistake**: A correção anterior de anti-regressão para `company` preservava `ticket.company` de forma incondicional quando não era `unknown`, mantendo nomes degradados derivados de domínio na UI.
**Root cause**: O anti-regressão tratava todo valor de intake como canônico sem distinguir valor real de empresa vs fallback heurístico de domínio.
**Rule**: Campos de display críticos devem preservar intake somente quando o intake for de alta qualidade; se o valor tiver padrão de fallback por domínio, ele deve poder ser substituído por nome inferido/display-ready.
**Pattern**: `company` continua com string colada tipo `Garmonandcompany` após correção de SSOT => verificar anti-regressão/proveniência, não apenas extração HTML.

## Lesson: 2026-02-24 (prefer local UI override when backend semantics are derived-only)
**Mistake**: Na primeira proposta para "incluir manualmente nos filtrados", eu puxei a solução para um modelo de filtro + overrides mais amplo do que o pedido imediato.
**Root cause**: Foquei na semântica de produto antes de otimizar por menor impacto técnico/UX para o caso real do usuário.
**Rule**: Quando o backend fornece um estado derivado (ex.: supressão automática calculada) e o usuário pede um controle manual pontual, avaliar primeiro um override local e explícito na UI antes de redesenhar o modelo.
**Pattern**: Usuário responde com "tenho uma ideia mais simples" => reduzir escopo, reaproveitar fluxo existente e evitar acoplamento desnecessário com backend.

## Lesson: 2026-02-24 (manual suppression is operational control, not only UI categorization)
**Mistake**: Entreguei supressão manual como MVP frontend-only, tratando o pedido como categorização visual e não como controle operacional de pipeline.
**Root cause**: Não alinhei a intenção econômica/operacional implícita (evitar processamento e gasto de token) com a semântica de "suprimido".
**Rule**: Quando um estado afeta triagem/processamento (ex.: `suppressed`), assumir persistência backend + enforcement de execução por padrão, a menos que o usuário peça explicitamente algo apenas visual.
**Pattern**: Usuário questiona "não deveria evitar pipeline/token?" => faltou guardar/checar estado no backend e adicionar guard no worker/orchestrator.

## Lesson: 2026-02-24 (sidebar list queries must anchor on source-of-truth inbox table, not processing sessions)
**Mistake**: A lista `/ticket-intake/list` ancorava em `triage_sessions`, então tickets manualmente suprimidos antes de qualquer sessão desapareciam totalmente da sidebar (inclusive do contador de suprimidos).
**Root cause**: Modelei a sidebar como "tickets com sessão" em vez de "tickets do inbox", mas o novo fluxo de supressão manual atua em `tickets_processed` e pode ocorrer antes do pipeline.
**Rule**: Se a UI representa o inbox de tickets, a query deve ancorar em `tickets_processed`; dados de pipeline (`triage_sessions`, `evidence_packs`, `ticket_ssot`) entram como joins opcionais.
**Pattern**: Filtro toggle não revela itens e contador não bate após ação backend em ticket ainda não processado => verificar se a query base exclui itens sem sessão/artefatos.

## Lesson: 2026-02-24 (don’t render high-confidence UI structures from low-confidence text parsing)
**Mistake**: Transformei linhas heurísticas de onboarding em cards visuais “bonitos”, mas o parsing ainda era impreciso; a UI passou sensação de estrutura confiável com dados errados/ambíguos.
**Root cause**: Priorizei impacto visual antes de calibrar confiança semântica da extração local.
**Rule**: Quando a extração é heurística e parcial, usar disclosure + tabela compacta + sinalização explícita de “heuristic parse”, mantendo o texto limpo como fonte principal.
**Pattern**: Feedback “ficou horrível/confusing” em UI derivada de texto => reduzir ornamentação, diminuir peso visual e rebaixar a extração para camada secundária.

## Lesson: 2026-02-24 (when UX trust breaks, prefer simple readable formatting over clever parsing UI)
**Mistake**: Mesmo após simplificar para disclosure/tabela, eu ainda mantive uma camada de parsing heurístico visível em um contexto onde o usuário queria apenas legibilidade de email body.
**Root cause**: Continuei tentando “salvar” a ideia de extração visual em vez de aceitar o pedido real: formatting simples e previsível.
**Rule**: Se o usuário pedir explicitamente “simples email body formatting”, remover parsing visual/estruturas derivadas e focar em parágrafos + listas + assinatura.
**Pattern**: Reação forte negativa a iterações de UI (“tudo isso uma merda”) => reset para baseline simples e confiável antes de qualquer refinamento.

## Lesson: 2026-02-25 (when user invokes a workflow skill, apply the workflow artifacts immediately)
**Mistake**: Eu continuei a execução do bugfix sem entrar formalmente no fluxo do `workflow-orchestrator` (plan em `tasks/todo.md`) após o usuário pedir explicitamente a skill.
**Root cause**: Foquei na correção técnica já diagnosticada e tratei o pedido da skill como detalhe de processo em vez de requisito operacional do turno.
**Rule**: Se o usuário nomear uma skill de workflow/processo, aplicar primeiro os artefatos/processos obrigatórios dela (ex.: plan tracking) antes de continuar a implementação.
**Pattern**: Usuário cita `$workflow-orchestrator` em bugfix não trivial => criar/atualizar `tasks/todo.md` imediatamente e manter status/review até o fim.

## Lesson: 2026-02-25 (when user asks source purity, remove fallback behavior entirely)
**Mistake**: Eu mantive email como fallback mesmo após o usuário reforçar que queria pipeline único e fontes configuráveis pela UI.
**Root cause**: Priorização excessiva de resiliência operacional (fallback) acima do requisito explícito de arquitetura/fonte de verdade.
**Rule**: Quando o usuário pede eliminar uma fonte/caminho (“single pipeline”, “remover completamente”), remover também fallbacks ativos no runtime, não só repriorizar.
**Pattern**: Requisito de unificação de fonte + fallback ainda presente em logs/comentários => revisar startup services, routes e intake branches.

## Lesson: 2026-02-25 (generic phase errors can hide source-specific client construction bugs)
**Mistake**: Após remover o email fallback, eu inicialmente tratei `Cannot prepare context without valid ticket from Autotask` como possível parse/endpoint issue, sem comparar a construção do `AutotaskClient` entre poller e `PrepareContext`.
**Root cause**: O poller e o `PrepareContext` usavam caminhos diferentes para montar o cliente; `PrepareContext` herdava `AUTOTASK_ZONE_URL` do env (placeholder) mesmo com credencial válida da UI/DB.
**Rule**: Quando dois componentes chamam a mesma API e apenas um falha, comparar imediatamente a construção/configuração do client (headers, base URL, zone, timeouts), não só payload/parse.
**Pattern**: Poller “finds tickets” mas `PrepareContext` falha ao buscar ticket => investigar divergência de config entre clients antes de mudar lógica de domínio.

## Lesson: 2026-02-25 (promoting IDs to SSOT is not enough when UI renders display names)
**Mistake**: Declarei a promoção de campos manuais do Autotask ao SSOT como completa, mas mantive apenas `company_id` canônico sem resolver o nome da empresa para os pontos da UI que exibem `org/company`.
**Root cause**: Confundi “campo autoritativo para correlação” (ID) com “campo autoritativo para display” (nome), e não validei a tela final onde o usuário consome `org`.
**Rule**: Quando um campo é promovido ao SSOT para alimentar UI, validar tanto identificadores (`*_id`) quanto valores de display efetivamente renderizados (ex.: `company`/`org`).
**Pattern**: SSOT contém IDs corretos mas UI ainda mostra `unknown` => falta lookup de entidade relacionada e/ou priorização do nome canônico no payload.

## Lesson: 2026-02-25
**Mistake**: Interpretei “slider” como segmented toggle e depois como switch, entregando um controle visual diferente do solicitado.
**Root cause**: Eu tratei o requisito como equivalência funcional (“alterna entre 2 estados”) em vez de equivalência de componente visual.
**Rule**: Em pedidos de UI com nome explícito de componente (slider, dropdown, sheet, etc.), implementar o componente visual pedido antes de propor variantes.
**Pattern**: Requisitos de UI que descrevem forma/interação (ex.: slider vs toggle) não podem ser normalizados para controles semanticamente parecidos.

## Lesson: 2026-02-25 (do not reintroduce removed ingestion paths during UI integration)
**Mistake**: Ao planejar a integração de queues reais para o modo Global, considerei voltar a mexer em `/ticket-intake/list`, apesar do usuário já ter sinalizado que esse caminho não é mais a base correta.
**Root cause**: Eu tentei otimizar o impacto visual imediato reutilizando um endpoint antigo, em vez de seguir estritamente o boundary atual da integração Autotask.
**Rule**: Quando o usuário corrige que um fluxo foi descontinuado, não reintroduzir esse fluxo nem como atalho de UI; integrar diretamente no boundary atual.
**Pattern**: Pedido de integração nova + endpoint legado “conveniente” => confirmar o boundary de verdade e evitar atalhos regressivos.

## Lesson: 2026-02-25 (catalog metadata is not the same as row metadata)
**Mistake**: Usei o catálogo real de queues para decidir se o filtro `Global` podia ser aplicado, mesmo quando os tickets da lista ainda não tinham `queue_id/queue_name` preenchidos.
**Root cause**: Confundi “catálogo de opções do dropdown” com “metadata disponível nas linhas que serão filtradas”.
**Rule**: Em filtros de UI, separar sempre disponibilidade de catálogo (options) da disponibilidade de metadata por item (rows); só aplicar filtro estrito se os rows tiverem dados para comparação.
**Pattern**: Dropdown populado + lista vazia após seleção => verificar se a coluna usada no filtro existe nos itens renderizados, não apenas no catálogo.

## Lesson: 2026-02-25 (never compare row labels to option IDs)
**Mistake**: No filtro `Global`, usei `selectedGlobalQueue` (ID interno da option, ex. `queue:123`) como fallback de comparação com `queue_name` do ticket.
**Root cause**: Misturei identificador técnico da option (`id`) com valor semântico de display (`label`) na mesma comparação.
**Rule**: Em filtros por dropdown, comparar rows com `option.value/id` apenas se o row tiver o mesmo tipo de chave; caso contrário, usar o campo semântico correspondente (`label`) da option.
**Pattern**: Seleção específica zera tudo enquanto `All` funciona => checar mismatch `option.id` vs `row.displayLabel`.

## Lesson: 2026-02-25 (placeholder values can masquerade as metadata and break filters)
**Mistake**: Tentei corrigir o filtro `Global` só no matching da UI antes de verificar se o backend estava promovendo placeholders (`Unknown`) como queue metadata real.
**Root cause**: Não percorri o pipeline completo (API docs -> connector shape -> PrepareContext -> list payload -> UI filter) logo no início.
**Rule**: Quando um filtro parece “não funcionar”, validar primeiro o shape/documentação da fonte e depois rastrear o valor até a UI para detectar placeholders/normalizações indevidas.
**Pattern**: `All` funciona e filtros específicos zeram tudo => possível metadata fake (`Unknown`, `N/A`, etc.) tratada como valor real.

## Lesson: 2026-02-25 (inspect payload before iterating UI filter fixes)
**Mistake**: Eu iterei no filtro `Global` várias vezes antes de olhar o payload real da sidebar.
**Root cause**: Assumi que o problema era apenas comparação de IDs/labels na UI, quando o payload nem tinha queue metadata real (só pseudo-queue `Ticket Intake`).
**Rule**: Em bugs de filtro/lista, inspecionar o payload real recebido pela UI nas primeiras etapas, antes de múltiplos ajustes de comparação.
**Pattern**: `All` funciona e filtros específicos falham repetidamente => dump do payload real imediatamente (`curl`/Network tab) para validar campos e valores.

## Lesson: 2026-02-25 (defined helper != active behavior)
**Mistake**: Eu conclui que a hidratação on-demand de queues estava em jogo porque a função existia no arquivo, sem confirmar se a rota `/ticket-intake/list` realmente a invocava.
**Root cause**: Verifiquei presença de código auxiliar e assumi ligação funcional, em vez de rastrear o fluxo até o `res.json`.
**Rule**: Ao depurar bugs de integração interna, sempre confirmar o wiring completo (definição -> chamada -> efeito no payload), não apenas a existência da função.
**Pattern**: Função/helper sofisticado já presente mas comportamento inalterado => procurar ausência de chamada no caminho principal antes de alterar lógica.

## Lesson: 2026-02-25 (Autotask ticket identifier in UI payload may be `ticketNumber`, not entity `id`)
**Mistake**: A hidratação de queue assumia que `item.ticket_id` da sidebar era sempre o `id` interno do Autotask e chamava apenas `GET /tickets/{id}`.
**Root cause**: No payload da sidebar, o identificador exibido/transportado pode ser o `ticketNumber` (ex.: `T20260225.0013`), que exige lookup por query (`ticketNumber`) e não por rota de entidade.
**Rule**: Em integrações Autotask, tratar `id` (entity id) e `ticketNumber` como identificadores distintos; quando o payload UI usa `ticket_id` string, detectar formato e escolher o método de lookup apropriado.
**Pattern**: `GET /tickets/{id}` retorna 404 para itens visíveis no Autotask, mas query por `ticketNumber` resolve => mismatch entre `id` interno e `ticketNumber` no pipeline/UI.

## Lesson: 2026-02-25 (display identifier must match operator-facing Autotask ticket number)
**Mistake**: A sidebar estava exibindo o `id` interno numérico do Autotask (ex.: `132777`) em vez do `ticketNumber` (`T20260225.0035`) que os técnicos usam no dia a dia.
**Root cause**: O payload reutilizava `row.ticket_id`/ID interno como campo de display sem priorizar `autotask_authoritative.ticket_number`.
**Rule**: Para UI operacional, exibir sempre o identificador canônico do produto externo (aqui: Autotask `ticketNumber`) e preservar IDs internos separadamente para chave/seleção/integração.
**Pattern**: Operador compara UI com ferramenta externa e “não reconhece” o ID => revisar separação entre `display_id` e `entity_id`.

## Lesson: 2026-02-26 (EN-US translation quality overclaim)
**Mistake**: Claimed the EN-US documents were clean while they still contained mixed PT-BR content and translation artifacts.
**Root cause**: I relied too much on automated replacements and did not complete a strict residual-language verification pass before reporting.
**Rule**: Never call a translated document "clean" until verified with residue scans (accented chars + common source-language keywords) and spot checks in high-density sections.
**Pattern**: Large mixed-language docs require section-by-section manual QA after automation, especially matrices, NFRs, and appendix blocks.
## Lesson: 2026-02-26 (rerun after multi-agent baseline moved)
**Mistake**: Concluí a primeira passada do Agent F com evidência de typecheck vermelho sem reexecutar após a integração das mudanças do Agent D no mesmo branch.
**Root cause**: Validação foi correta para aquele snapshot, mas eu não tratei a tarefa como "moving target" em branch compartilhada de múltiplos agentes.
**Rule**: Em execuções de readiness em branch multi-agente, sempre fazer uma segunda checagem rápida de verificação crítica (typecheck/smoke) antes de considerar o pacote final estável.
**Pattern**: Se a tarefa depende de outputs de outros agentes (D/E), rodar um "revalidation pass" e atualizar evidência/riscos.

## Lesson: 2026-02-26 (remove deprecated paths immediately when user says zero references)
**Mistake**: Mantive fallback/merge com um caminho legado (`ticket-intake`) após o usuário já ter definido que esse fluxo foi removido e não deveria ter nenhuma referência.
**Root cause**: Eu priorizei continuidade de metadata/UX local acima de uma restrição arquitetural explícita e repetida pelo usuário.
**Rule**: Quando o usuário disser que um fluxo legado foi removido e quer zero referência, eliminar completamente chamadas, fallbacks, comentários e docs relacionados naquele path antes de qualquer refinamento.
**Pattern**: Integração UI em boundary novo + fonte legado “conveniente” => risco de violar regra de arquitetura se eu tentar mesclar por conveniência.

## Lesson: 2026-02-26 (re-scan latest untracked validation follow-up bundles before final signoff)
**Mistake**: Finalizei um pacote de signoff da Fase 4 usando apenas o bundle live do Agent H e declarei ausência de remediação, mas o follow-up do Agent J já existia como artefato não rastreado no workspace.
**Root cause**: No primeiro passe, o scan de "latest evidence" não tratou diretórios `docs/validation/runs/followup-*` não rastreados como candidatos de mesma prioridade.
**Rule**: Em tarefas de signoff/readiness com múltiplos agentes, sempre reescanear `docs/validation/runs/` (incluindo bundles `followup-*` não rastreados) imediatamente antes de consolidar a decisão final.
**Pattern**: Pacote final cita "remediation not found" enquanto existem novos arquivos `followup-*` no `git status` => rerun obrigatório do consolidation pass.

## Lesson: 2026-02-27 (Prompt B scope must cover full Prompt A exclusion set, not only safe-write subset)
**Mistake**: Eu havia convergido para cobertura apenas do subset safe-write/legacy do gateway, sem tratar toda a superfície de operações previamente excluídas definida no Prompt A.
**Root cause**: Interpretação parcial do escopo técnico ao priorizar continuidade do fluxo existente em vez da lista contratual completa (`AUTOTASK_PHASE1_EXCLUSION_IMPLEMENTATION_CONTRACTS`).
**Rule**: Em prompts encadeados A->B, usar o artefato de saída de A como checklist fechado e implementar 100% das operações listadas antes de considerar B completo.
**Pattern**: Quando o usuário cita “newly unblocked operations”, validar explicitamente cada `domain.operation` do contrato de burn-down e marcar cobertura 1:1 em código/testes.

## Lesson: 2026-02-27 (strict gate criteria must be reflected exactly, no inferred relaxations)
**Mistake**: I reported Phase 1 as `MET` under a broader interpretation while excluded matrix rows still existed.
**Root cause**: I applied the prior gate framing instead of enforcing the stricter explicit acceptance the user required for integrated closure.
**Rule**: For gate closure tasks, map acceptance criteria 1:1 into machine-checked checklist assertions; if any required zero-threshold metric is non-zero, force `NOT MET`.
**Pattern**: If user states hard numeric gate conditions (`X=0`), never infer equivalence from compensating evidence in other dimensions.

## Lesson: 2026-02-27 (Autotask query routes must use structured filters, never raw DSL strings)
**Mistake**: Implementei `/autotask/*/search` enviando filtros textuais (`"isActive eq true ..."`) para o client, assumindo que seriam parseados corretamente.
**Root cause**: O `AutotaskClient.buildSearchParam` faz fallback para `title contains <raw_string>` quando recebe string não-JSON; isso quebrou `companies` com erro 500 (`title` inexistente) e degradou `resources/contacts`.
**Rule**: Em chamadas `*/query` do Autotask via client compartilhado, sempre enviar `search` estruturado JSON (`{ MaxRecords, filter: [...] }`) para evitar fallback implícito.
**Pattern**: Erro do tipo `Unable to find title in the <Entity> Entity` após adicionar rota de busca indica fallback indevido para `title contains`.

## Lesson: 2026-02-27 (when user expects integration-side effect, local UI override is insufficient)
**Mistake**: Entreguei edição de `Org/User` apenas como override local no frontend, sem write no Autotask nem persistência server-side.
**Root cause**: Assumi um modo "safe/read-only" para reduzir risco sem validar explicitamente a expectativa funcional de efeito persistente na fonte externa.
**Rule**: Para ações de edição em campos de entidade integrada (ex.: ticket org/user), confirmar o comportamento esperado de persistência e implementar write+persistence quando a expectativa for efeito real.
**Pattern**: Sintoma "muda na UI mas volta após refresh" indica override local sem persistência na origem/SSOT.

## Lesson: 2026-02-27 (company switch in Autotask ticket must clear dependent location/contact links)
**Mistake**: Ao atualizar `companyID` do ticket, eu não limpei vínculos dependentes já existentes (`companyLocationID` e contato legado), causando erro 500 de validação da entidade.
**Root cause**: O ticket mantinha `companyLocationID` da empresa anterior; Autotask valida consistência de associação e rejeita a troca de org.
**Rule**: Em mudança de company no ticket Autotask, enviar atualização atômica que neutralize `companyLocationID` e limpe `contactID` quando contato novo não for fornecido.
**Pattern**: Erro `companyLocationID cannot be associated with the Ticket` após trocar empresa indica dependências legadas não saneadas no patch.

## Lesson: 2026-02-27 (Org-scoped user listing must not depend on optional active flags in Contacts)
**Mistake**: Na listagem de usuários por org, usei filtro `isActive eq true` junto com `companyID`, o que pode zerar resultados em tenants onde Contacts não expõe/normaliza esse campo da mesma forma.
**Root cause**: Assumi simetria de campos entre entidades Autotask (Company/Resource/Contact), mas Contacts tem variância de schema/semântica por ambiente.
**Rule**: Para listagem user-by-org, usar `companyID` como filtro canônico e aplicar refinamento textual no backend; evitar depender de flags opcionais da entidade Contacts para gate principal.
**Pattern**: Org selecionada corretamente + User vazio sem erro => revisar filtros opcionais de entidade antes de concluir que não há dados.

## Lesson: 2026-02-27 (active-only org policies may need explicit owner-tenant exception)
**Mistake**: Tratei a política de Org ativa como rígida para todos os casos e não contemplei o cenário de org proprietária do MSP que precisa permanecer selecionável.
**Root cause**: Regra técnica foi aplicada sem camada de exceção de negócio explicitada pelo usuário.
**Rule**: Em políticas de catálogo (`active-only`), manter regra base mas prever exceções explícitas de negócio (ex.: org proprietária) quando requerido.
**Pattern**: Usuário pede “manter dependência/política, mas exceção X” => implementar filtro composto (`base_policy OR business_exception`).

## Lesson: 2026-02-27 (empty-search UX needs explicit default query strategy)
**Mistake**: Na rota de org search, deixei `q` vazio gerar filtro vazio para Autotask, quebrando o estado inicial de sugestões do modal.
**Root cause**: Assumi que query sem filtro retornaria catálogo útil, mas o endpoint não garante isso.
**Rule**: Para modais com sugestões iniciais, tratar busca vazia como modo próprio com estratégia explícita (queries default + merge), nunca depender de filtro vazio implícito.
**Pattern**: UI mostra "No options found" apenas no open inicial e volta a funcionar ao digitar => falta estratégia de seed para `q=''`.

## Lesson: 2026-02-27 (never coerce nullable IDs with Number() in selection gates)
**Mistake**: Usei `Number(company_id)` para decidir org ativa; `null` virou `0` e contaminou a lógica de "org selecionada" no modal.
**Root cause**: Coerção numérica implícita sem validação de domínio (`id > 0`) em fluxo de gate de UI.
**Rule**: Em IDs de entidade, usar normalizador explícito para ID positivo e tratar `null/undefined/0/NaN` como ausente.
**Pattern**: Mensagem "Select X first" mesmo após seleção aparente pode indicar ID inválido derivado de coerção silenciosa.

## Lesson: 2026-02-27 (User-by-Org flows need name-to-id fallback when backend payload is partially denormalized)
**Mistake**: Assumi que `company_id` estaria sempre disponível no momento de abrir o modal de usuários.
**Root cause**: O fluxo pode carregar nome da org sem o ID correspondente materializado em todos os estados intermediários.
**Rule**: Em flows dependentes de ID (`User -> Org`), se houver nome canônico e ID ausente, aplicar resolução automática nome->ID antes de bloquear UX.
**Pattern**: Mensagem "Select an Org first" com org visível na UI indica ausência de resolução ID e não ausência real de seleção.

## Lesson: 2026-02-27 (Org->User dependency should not be blocked by intermediate integration write failures)
**Mistake**: Condicionei o avanço do fluxo de seleção de User ao sucesso imediato do write de Org no Autotask.
**Root cause**: Acoplamento excessivo entre persistência externa e estado local de dependência de UI.
**Rule**: Em fluxos multi-etapa dependentes (`Org -> User`), aplicar estado local otimista para continuidade operacional e tratar write externo como best-effort com feedback explícito.
**Pattern**: Caso específico de tenant/org com validação mais restritiva no provider externo deve degradar para warning, não bloquear seleção subsequente necessária ao próprio reparo (escolher User).
## Lesson: 2026-03-01 (Bound long-running checks and diagnose locally before retrying)
**Mistake**: A execução anterior ficou presa em comandos de terminal sem fechar o diagnóstico, o que alongou a refatoração e obscureceu a causa real.
**Root cause**: O fluxo tentou “esperar o terminal terminar” em vez de primeiro reconstruir o estado local e rodar checks curtos/bounded para identificar o ponto exato da quebra.
**Rule**: Em refatorações quebradas, começar por inspeção local + checks de duração controlada (`typecheck`, `rg`, leituras direcionadas) antes de qualquer comando potencialmente longo.
**Pattern**: Se o relato é “travou” e a árvore já contém código parcial, tratar como problema de consistência do código, não como problema de aguardar mais tempo.
## Lesson: 2026-03-01 (interactive card containers must not wrap secondary action buttons)
**Mistake**: Eu deixei o card inteiro do ticket como `<button>` e depois inseri um botão secundário de editar status dentro dele.
**Root cause**: A mudança adicionou uma ação inline nova sem revalidar a semântica HTML do container clicável já existente.
**Rule**: Se um card precisa conter ações secundárias interativas, o wrapper não pode ser um `<button>`; usar container com `role="button"` + teclado, ou separar hit areas.
**Pattern**: Sempre que adicionar ícones/ações dentro de um card clicável, revisar imediatamente se o elemento pai já é interativo nativo.
## Lesson: 2026-03-01 (draft shells must keep memo dependencies aligned with editable fields)
**Mistake**: Eu deixei o draft atualizar o state de `Issue/Sub-Issue/Priority/SLA`, mas o painel lateral continuou preso em valores antigos.
**Root cause**: O `useMemo` que monta o `PlaybookPanel` do draft não dependia desses campos editáveis, então a UI parecia “não salvar” apesar do state mudar.
**Rule**: Sempre que um draft/context panel renderiza campos editáveis via `useMemo`, a lista de dependências deve cobrir todos os campos que a UI exibe.
**Pattern**: Se o modal fecha com sucesso e o valor não muda visualmente, revisar primeiro memoization/stale derived data antes de culpar persistência.
## Lesson: 2026-03-01 (provider defaults may live on field metadata, not on each picklist entry)
**Mistake**: Eu assumi que o default do Autotask viria marcado em cada item da picklist.
**Root cause**: O parser só olhava flags booleanas por item (`isDefault`, etc.) e ignorava `defaultValue`/equivalentes no próprio field metadata.
**Rule**: Em metadados de picklist de providers, validar tanto o nível do item quanto o nível do campo para detectar defaults reais.
**Pattern**: Se a UI recebe as opções corretas mas o default não aparece, revisar primeiro se o provider publica o default como `field.defaultValue` em vez de `option.isDefault`.
## Lesson: 2026-03-01 (typed Autotask selectors must never render an empty blank-state when suggestions are required)
**Mistake**: Eu deixei `Org`/`Primary`/`Secondary` continuarem devolvendo lista vazia ao abrir em estado frio.
**Root cause**: O frontend fazia short-circuit em `query < 2` para usar apenas cache local, mas esse cache nasce vazio antes do primeiro preload/search bem-sucedido.
**Rule**: Em seletores tipados que precisam mostrar sugestões ao abrir, o estado vazio deve usar sugestões default pré-carregadas ou um fetch barato de fallback; nunca retornar vazio apenas porque a query está em branco.
**Pattern**: Modal com input renderizado e sem lista logo na abertura indica que o blank-state foi tratado como “aguardar digitação”, não como “mostrar catálogo inicial”.
## Lesson: 2026-03-01 (do not claim full selector coverage when only a subset was pre-warmed)
**Mistake**: Eu reportei a melhoria como se cobrisse toda a lista de campos solicitada, mas a parte de pre-warm imediato ainda estava parcial no ticket detail.
**Root cause**: Eu tratei a redução de latência dos seletores tipados como suficiente e não revalidei explicitamente todos os campos enumerados pelo usuário.
**Rule**: Quando o usuário fornecer uma lista fechada de superfícies, confirmar cobertura item a item antes de declarar a tarefa completa.
**Pattern**: Se a resposta fala “X agora faz preload” mas o requisito original é uma lista extensa, revisar a cobertura completa em vez de inferir equivalência.
## Lesson: 2026-03-01 (operational root-cause answers must trace autonomous backend loops, not just the obvious failing call)
**Mistake**: Eu respondi ao 429 olhando só o poller imediato e não fui fundo o suficiente no que mais roda sozinho no backend.
**Root cause**: Eu foquei na chamada que falhou (`searchTickets`) antes de mapear todos os loops automáticos disparados no boot e sem interação da UI.
**Rule**: Em incidentes de rate limit, sempre mapear explicitamente todos os produtores automáticos de tráfego (pollers, retries, bootstraps, reprocessamentos) antes de concluir a causa.
**Pattern**: Se o usuário diz “eu não cliquei em nada”, a investigação deve migrar imediatamente da UI para jobs/background services e startup hooks.
## Lesson: 2026-03-01 (when the user rejects 'shared external usage', drop that branch immediately and prove local callers)
**Mistake**: Eu continuei insistindo na hipótese de uso externo/ambiente paralelo mesmo após o usuário negar explicitamente essa premissa.
**Root cause**: Eu tratei uma hipótese plausível como explicação suficiente sem validá-la contra o contexto operacional fornecido pelo usuário.
**Rule**: Se o usuário invalida uma premissa operacional crítica ("não existe outro ambiente"), remover essa hipótese e focar apenas em evidência local verificável.
**Pattern**: Em incidentes de quota/rate limit, evitar atribuir causa a "outro ambiente" sem prova local de credencial compartilhada.
## Lesson: 2026-03-01
**Mistake**: Entreguei a correção da lista de techs baseada em análise estática + typecheck sem reproduzir o fluxo HTTP real.
**Root cause**: Eu assumi que a mudança no handler e no modal era segura porque compilava, mas não validei o endpoint/runtime após alterar a lógica de busca.
**Rule**: Em bug fixes que tocam rotas usadas pela UI, sempre reproduzir o request HTTP real (ou inspecionar logs ativos) antes de declarar concluído.
**Pattern**: Alterações em rotas read-only de integração podem compilar e ainda falhar em runtime por payload/limites/comportamento do provider.

## Lesson: 2026-03-02 (typed selector hydration must not monopolize loading state when local suggestions exist)
**Mistake**: Eu mantive o `Primary/Secondary` em modo de hidratação remota com `contextEditorLoading` ativo mesmo já tendo sugestões locais renderizáveis.
**Root cause**: O efeito priorizava o fetch completo e exibia spinner durante quase todo o ciclo, enquanto mudanças frequentes de dependências/timer causavam pisca da lista.
**Rule**: Em seletores tipados com cache local, exibir sugestões locais imediatamente e fazer hidratação remota em background sem dominar o estado visual de loading.
**Pattern**: “Lista aparece por um instante e volta para spinner” em modal de busca indica acoplamento excessivo entre background refresh e loading foreground.

## Lesson: 2026-03-02 (never put non-memoized derived arrays into effect dependencies in hot UI loops)
**Mistake**: Eu deixei `localContextEditorSuggestions` e `localContactEditorSuggestions` como arrays derivados não memoizados e os usei no dependency array do efeito de busca.
**Root cause**: Esses arrays eram recriados a cada render (identidade nova), então o efeito reexecutava continuamente mesmo sem mudança semântica.
**Rule**: Qualquer objeto/array derivado usado como dependência de `useEffect` precisa ser memoizado (`useMemo`) ou removido do dependency array por redesign.
**Pattern**: Spinner persistente + lista piscando com requests repetidos em modal costuma indicar dependency churn por referência instável.

## Lesson: 2026-03-02 (UI spinner bugs need deterministic in-flight/completed request guards, not only dependency tuning)
**Mistake**: Eu tentei resolver o loop de spinner apenas com ajustes de dependência/memoização, sem travar explicitamente refetch repetido para a mesma chave de busca.
**Root cause**: Em efeitos complexos de modal, pequenas mudanças de estado ainda podem religar o mesmo fetch e manter loading quase contínuo.
**Rule**: Para seletores remotos de modal, implementar deduplicação determinística por chave (`editor+scope+query`) com guard de in-flight/completed.
**Pattern**: Mesmo após estabilizar deps, se spinner persiste com consultas idênticas, falta guard de idempotência no cliente.

## Lesson: 2026-03-02 (when user gives a known-good commit, anchor to that exact functional lineage immediately)
**Mistake**: Eu continuei iterando patches no HEAD sem primeiro reconstruir o estado funcional baseado no commit de referência informado pelo usuário.
**Root cause**: Falta de comparação histórica imediata entre o commit de referência e o arquivo real do fluxo problemático.
**Rule**: Em regressão com commit conhecido, comparar primeiro o histórico exato do arquivo afetado e, se houver mismatch, restaurar da última versão comprovadamente funcional antes de novas hipóteses.
**Pattern**: Múltiplas tentativas sem convergência geralmente indicam ausência de baseline histórico confiável.

## Lesson: 2026-03-02 (when user asks to inspect a specific commit, extract and replicate its exact fetch pattern)
**Mistake**: Eu tentei resolver por hipótese no `triage/home` sem replicar fielmente o padrão de fetch do commit de referência que o usuário exigiu investigar.
**Root cause**: Priorizei ajustes incrementais em vez de usar o commit indicado como baseline comportamental do fetch.
**Rule**: Se o usuário exige "investigar commit X", primeiro extrair o fluxo concreto desse commit (deps, loading, chamadas) e replicar 1:1 no fluxo quebrado antes de qualquer otimização.
**Pattern**: Regressão persistente após múltiplos patches costuma exigir rollback de estratégia para baseline comportamental comprovada.

## Lesson: 2026-03-02 (resource assignment writes must include role coupling required by provider contract)
**Mistake**: O fluxo de assignment/create enviava `assignedResourceID` sem garantir `assignedResourceRoleID`.
**Root cause**: O gateway aceitava ID de técnico, mas não resolvia automaticamente o role default exigido pelo Autotask.
**Rule**: Em writes de assignment para Autotask, sempre enviar `assignedResourceID` e `assignedResourceRoleID` juntos (explicitamente ou por resolução via metadata do resource).
**Pattern**: Erro `Data violation ... must assign both assignedResourceID and assignedResourceRoleID` indica quebra de acoplamento obrigatório de campos no provider.

## Lesson: 2026-03-02 (create endpoints may return identifier-only payloads)
**Mistake**: Eu assumi que `POST /tickets` sempre retornaria `item/items/records` completos do ticket.
**Root cause**: O parser de `createTicket` tratava ausência de coleção como erro terminal, sem fallback para respostas de confirmação com `itemId/id`.
**Rule**: Em integrações REST de create, aceitar resposta identifier-only e fazer fetch de hidratação por ID antes de falhar.
**Pattern**: Erro "createX returned no X" com create aparentemente aceito indica payload de confirmação reduzido do provider.

## Lesson: 2026-03-02 (post-create identity must prioritize external ticket number and requester projection)
**Mistake**: O core de workflow priorizava `external_ticket_id` numérico para `ticket_id` local/realtime e não propagava requester/contact do snapshot de criação.
**Root cause**: Projeção local pós-comando estava centrada no ID interno e ignorava campos semânticos canônicos (`ticket_number`, `contact_name`).
**Rule**: Em `kind: created`, sempre priorizar `external_ticket_number` para identidade de ticket e projetar requester/contact do snapshot para preservar UX e contexto.
**Pattern**: Ticket muda de `T...` para numérico + contato vira `Unknown user` após create indica projeção local pós-comando incompleta.

## Lesson: 2026-03-03 (auth regressions must include middleware/public-route and unauth shell fallback checks)
**Mistake**: Entreguei o fluxo de reset/login sem validar se a nova rota era pública no middleware e sem garantir fallback de redirecionamento quando `auth/me` falha na shell.
**Root cause**: Foquei no backend de autenticação e na UI de formulário, mas não fechei a validação fim-a-fim do route guard + shell auth state.
**Rule**: Em qualquer mudança de auth web, validar obrigatoriamente: (1) `PUBLIC_PATHS` no middleware, (2) comportamento de logout real com backend correto, (3) redirecionamento para `/login` quando `auth/me` retorna não-OK.
**Pattern**: Sintoma "bypass login" + "stuck in triage shell" geralmente indica sessão/cookie stale aceita no edge ou ausência de fallback de redirect no shell após falha de `auth/me`.

## Lesson: 2026-03-03 (AT parity requires canonical ticket identity and deletion reconciliation)
**Mistake**: Assumi que backfill temporal sozinho garantiria paridade, sem unificar identidade de ticket entre `external_id` e `ticket_number` nem tratar exclusões no provider.
**Root cause**: O core aceitava `ticket_id` variável por evento (`numeric id` vs `T...`) e não tinha rotina para remover entidades apagadas no AT.
**Rule**: Para paridade provider↔read-model, sempre implementar (1) chave canônica/alias merge, (2) dedupe de legado persistido, (3) purge/reconcile de deletados.
**Pattern**: Sintoma "ticket duplicado com ID numérico + ticket number" + "ticket deletado no provider continua no app" indica divergência de identidade canônica e ausência de tombstone reconciliation.

## Lesson: 2026-03-03 (optional parity paths must fail-open and never block primary sync)
**Mistake**: Introduzi queue snapshot de paridade no poller sem garantir compatibilidade com clientes/mocks que não implementam `getTicketQueues`.
**Root cause**: Assumi capability uniforme no client e deixei exceção da trilha opcional interromper o ciclo principal de polling.
**Rule**: Caminhos opcionais de reconciliação/paridade devem ser capability-checked e isolados por `try/catch`; o fluxo principal de ingestão nunca pode parar por falha auxiliar.
**Pattern**: Feature de paridade opcional que roda antes do core loop sem guard explícito = risco de regressão de sincronização.

## Lesson: 2026-03-03 (parity scope must be explicit: active vs historical)
**Mistake**: Interpretei “paridade de tickets” como reconciliação histórica completa por padrão.
**Root cause**: Falta de delimitação explícita de escopo operacional no intake inicial (ativo vs histórico).
**Rule**: Para paridade com providers grandes, definir escopo temporal/operacional explícito no início; default deve priorizar tickets ativos e backfill histórico deve ser opt-in.
**Pattern**: Backfill começando em datas antigas (`2000...`) com janelas contínuas indica escopo mal calibrado para objetivo operacional atual.

## Lesson: 2026-03-03 ("active" must be encoded with explicit business rule, not inferred)
**Mistake**: Implementei "active-only" inicialmente como recorte de ingestão (sem histórico) sem codificar o critério de negócio pedido: excluir queue `Complete`.
**Root cause**: Interpretação incompleta do termo "ativo" antes de mapear para uma regra operacional explícita no provider.
**Rule**: Sempre traduzir termos de produto (ex.: ativo) para predicado técnico explícito na origem (`queue != Complete` ou status-set definido) antes de fechar patch.
**Pattern**: Quando o usuário precisa corrigir semântica após entrega, faltou contrato de critério no código/configuração.

## Lesson: 2026-03-03 (hardcoded identity fallbacks can masquerade as auth/session bugs)
**Mistake**: Eu assumi inicialmente risco de sessão presa sem validar primeiro se o nome exibido era fallback de UI.
**Root cause**: Existia string fixa (`John Technician`) para `user.name` ausente, o que simula usuário incorreto mesmo com sessão válida.
**Rule**: Em bugs de identidade exibida, auditar projeção de fallback de UI antes de alterar lógica de autenticação/cookie.
**Pattern**: Nome fixo recorrente em contas diferentes indica fallback hardcoded, não necessariamente sessão compartilhada.

## Lesson: 2026-03-03 (auth UX must timeout network-bound session bootstrap)
**Mistake**: Deixei login/bootstrap de sessão dependentes de fetch sem timeout explícito.
**Root cause**: Em falhas de proxy/API (socket hang up), requests podem ficar pendentes tempo demais e parecer loading infinito para o usuário.
**Rule**: Toda tela de auth e bootstrap de sessão (`/auth/me`) deve ter timeout + fallback de erro para não bloquear UI indefinidamente.
**Pattern**: "Please wait" eterno durante incidente de backend é geralmente ausência de timeout no cliente.

## Lesson: 2026-03-03 (new sidebar controls must be verified visually in light theme before handoff)
**Mistake**: Entreguei o filtro global funcional sem validar legibilidade real do popover no tema claro.
**Root cause**: Validação focada em typecheck/fluxo funcional, mas sem checagem visual pós-build no mesmo ambiente do usuário.
**Rule**: Toda mudança de controle visual na sidebar deve passar por validação explícita de contraste e legibilidade em `light` e `dark` antes de concluir.
**Pattern**: Popover com fundo translúcido sobre cards claros tende a ficar ilegível mesmo com lógica correta.

## Lesson: 2026-03-03 (popover layering must be validated against sibling stacking contexts)
**Mistake**: Assumi que aumentar `z-index` do popover seria suficiente sem elevar o `z-index` do container pai no mesmo nível de stacking.
**Root cause**: O `ticket list` e o `filter bar` estavam em siblings com `z-index` equivalente; o sibling posterior (cards) ficava na frente.
**Rule**: Para overlays ancorados em toolbar acima de listas, ajustar o `z-index` da toolbar (stacking context pai), não só do overlay filho.
**Pattern**: Popover “por trás” de cards mesmo com `z-index` alto no filho indica limite de stacking context do pai.

## Lesson: 2026-03-03 (when user confirms intent emphatically, execute immediately without offering optional next patch)
**Mistake**: Respondi com proposta condicional de próximo patch para `Unknown org/requester` em vez de executar correção completa imediatamente.
**Root cause**: Mantive modo consultivo em problema já diagnosticado e com impacto visível no fluxo principal.
**Rule**: Quando a causa raiz já está clara e o usuário pede correção, implementar diretamente no mesmo ciclo sem pedir confirmação adicional.
**Pattern**: “Se você quiser, no próximo patch...” após bug confirmado aumenta fricção e retrabalho.
## Lesson: 2026-03-03T16:22:00-05:00
**Mistake**: Declarei correção de `Unknown org/requester` antes de validar o estado real do runtime inbox ativo.
**Root cause**: O patch anterior cobria propagação futura, mas não resolvia tickets já ativos sem dados canônicos e o dedupe ainda podia descartar `company/requester`.
**Rule**: Para bugs de paridade de dados, sempre verificar snapshot runtime de produção local e validar caminho retroativo (dados já existentes), não só ingestão futura.
**Pattern**: Fluxos com alias/dedupe devem preservar campos de identidade (`company/requester`) no merge e ter hidratação limitada para backlog ativo.

## Lesson: 2026-03-03 (do not reset deterministic queue selection on transient option drift)
**Mistake**: A seleção global de fila era resetada para `all` quando `queueOptions` mudava e removia temporariamente a opção selecionada.
**Root cause**: Efeito de validação tratava ausência transitória da option como estado inválido definitivo.
**Rule**: Para seleções determinísticas (`queue:<id>`), preservar estado e só aplicar fallback quando a seleção for realmente inválida e não determinística.
**Pattern**: Mudança assíncrona de catálogo/opções + `setSelected(...'all')` em `useEffect` pode alternar fonte de dados no meio do fluxo.

## Lesson: 2026-03-03 (stability fixes need bounded recovery for permanently invalid selections)
**Mistake**: Após estabilizar `queue:<id>` contra oscilações transitórias, deixei sem estratégia de recuperação para fila removida permanentemente.
**Root cause**: O critério de preservação da seleção determinística não tinha condição temporal de expiração quando catálogo autoritativo confirmava ausência contínua.
**Rule**: Seleções preservadas por estabilidade assíncrona devem ter fallback bounded quando o estado inválido persiste sob fonte autoritativa.
**Pattern**: `synthetic option + no expiry` em seleção persistida pode gerar estado órfão indefinido.
## Lesson: 2026-03-03T16:58:00-05:00
**Mistake**: Primeira auditoria de concorrência da queue Global ficou inconclusiva por falta de carga autenticada.
**Root cause**: Teste inicial foi executado sem sessão (401), então não exercitou o caminho crítico real do endpoint protegido.
**Rule**: Em auditoria de concorrência de rota protegida, sempre validar sessão/cookie primeiro e só então medir burst.
**Pattern**: “Resultado limpo com 401” é falso positivo para estabilidade; é obrigatório reproduzir no path autenticado.

## Lesson: 2026-03-03
**Mistake**: aceitar coordenação parcial em rota de alta concorrência sem validar caminho de fallback quando lock não é adquirido.
**Root cause**: foco em deduplicação intra-processo (`inFlight`) sem cobrir explicitamente competição inter-processo após timeout de espera de cache.
**Rule**: para operações upstream caras, evitar fetch direto fora do mecanismo de coordenação por chave; re-tentar coordenação antes de qualquer degradação.
**Pattern**: `try-lock -> wait cache timeout -> direct upstream fetch` pode reintroduzir fanout em concorrência real.

## Lesson: 2026-03-03 (read-only sidebar route must degrade on provider 429 instead of returning 500)
**Mistake**: Mantive `/autotask/sidebar-tickets` propagando exceções do provider para middleware global, causando `500` em rajadas concorrentes.
**Root cause**: Tratamento de erro da rota não diferenciava falha transitória de dependência (Autotask 429/thread-threshold) de falha interna da aplicação.
**Rule**: Endpoints read-only dependentes de integração externa devem responder em modo degradado para `RATE_LIMIT/TIMEOUT/DEPENDENCY`, preservando `500` apenas para falhas internas/inesperadas.
**Pattern**: Se burst concorrente retorna `500` massivo com logs `Autotask API error: 429`, falta política de degradação no handler da rota.

## Lesson: 2026-03-03 (backfill coverage for identity fields must match backlog size)
**Mistake**: Corrigi a propagação futura de `company/requester`, mas mantive hidratação retroativa com limite fixo de 25 tickets por chamada.
**Root cause**: O limite hardcoded foi adequado para mitigação inicial, porém insuficiente para backlog real de milhares de tickets sem `org/requester`.
**Rule**: Quando bug envolve backlog acumulado, limites de backfill devem ser configuráveis e compatíveis com a ordem de grandeza observada em runtime.
**Pattern**: `source of truth correto` + `Unknown em massa contínuo` normalmente indica cobertura de hidratação/backfill abaixo do volume pendente.

## Lesson: 2026-03-03 (read-path hydration must be bounded to protect inbox latency)
**Mistake**: Aumentei cobertura de hidratação no `listInbox` sem separar custo local de custo remoto no mesmo path síncrono.
**Root cause**: O read-path passou a executar round-trips externos demais por request sob backlog, elevando latência e empurrando UI para fallback.
**Rule**: Em rotas críticas de leitura, hidratação remota deve ser bounded (batch + timeout) e dados locais persistidos devem ter prioridade.
**Pattern**: “Após backfill em massa, tudo cai no fallback” sinaliza regressão de latência no caminho síncrono de leitura.

## Lesson: 2026-03-04 (não misturar timestamp de criação com timestamp de evento no mesmo campo de UI)
**Mistake**: Permiti que `created_at` do card recebesse valor de fontes com semântica diferente (ex.: `updated_at` / evento de comentário) durante polls concorrentes.
**Root cause**: Faltava regra determinística de precedência temporal entre writers assíncronos (`full-flow` 3s e `workflow inbox` 10s), então o valor “mais recente” visualmente alternava.
**Rule**: Campo de horário exibido no card deve usar somente tempo canônico de criação do ticket; quando houver múltiplas fontes, aplicar merge determinístico (earliest válido) e bloquear fallback de campos operacionais.
**Pattern**: Oscilação entre “hora antiga” e “hora recente de evento” em polling indica mistura de semântica temporal e write contention no estado da sidebar.

## Lesson: 2026-03-04 (não inferir horário de criação a partir de ticket number)
**Mistake**: Mantive fallback de `created_at` derivado de `ticket_number` (`TYYYYMMDD.*`), gerando horário sintético (`12:00Z` -> `7:00 AM` ET) que não corresponde ao Autotask.
**Root cause**: Fallback heurístico foi útil para ordenação histórica, mas conflita com requisito de fonte canônica do horário.
**Rule**: Para `ticket created time`, usar exclusivamente dados explícitos do provider canônico (`createDateTime/createDate` no AT); na ausência, deixar vazio em vez de inventar horário.
**Pattern**: Quando horário exibido é “consistente, porém errado”, normalmente existe fallback heurístico semânticamente incorreto.

## Lesson: 2026-03-04 (backfill em lote precisa de fairness para não travar em subconjunto)
**Mistake**: A hidratação do inbox selecionava sempre a primeira fatia de candidatos incompletos.
**Root cause**: Em presença de falhas recorrentes de snapshot para alguns tickets iniciais, os mesmos itens eram revisitados continuamente e o restante do backlog ficava sem hidratação.
**Rule**: Processos de backfill incremental devem usar estratégia de fairness (ex.: round-robin por tenant) para garantir progresso sobre todo o conjunto.
**Pattern**: “Só corrige quando abre ticket” + “milhares continuam Unknown” indica starvation no algoritmo de seleção de batch.

## Lesson: 2026-03-04 (não usar skeleton por campo para dados canônicos em lista viva)
**Mistake**: Mantive skeleton/shimmer em campos individuais (`company/requester`) do card enquanto o ticket já estava renderizado.
**Root cause**: O estado `canonical_pending` permitia loading parcial indefinido para campos que não vinham em todos os snapshots, quebrando o contrato binary-state (dados completos vs loading explícito).
**Rule**: Em lista de tickets com read model canônico, não usar shimmer por campo; usar apenas loading de lista inteira (skeleton explícito) ou valor estável (`—`) quando o campo não existe.
**Pattern**: “Shimmer eterno” em parte do card indica estado intermediário não-bounded no cliente.

## Lesson: 2026-03-04 (componentes ocultos não devem manter polling ativo)
**Mistake**: O `NewTicketHomePage` permanecia montado oculto e continuava fazendo polling de inbox fora do modo draft.
**Root cause**: `useEffect` de polling sem guarda por `isActive`.
**Rule**: Todo polling em subárvore de modo/overlay deve ser condicionado ao estado ativo visível.
**Pattern**: Muitos `GET /workflow/inbox` sem interação direta geralmente indicam loops em componentes ocultos.

## Lesson: 2026-03-04 (gating de polling por modo draft não pode bloquear rota standalone)
**Mistake**: Condicionei o fetch da sidebar a `isActive` e acabei bloqueando `GET /workflow/inbox` no `/triage/home` normal.
**Root cause**: `isActive` representava estado de compose/draft, não elegibilidade de carregamento da fila na rota standalone.
**Rule**: Para páginas que existem em dois contextos (standalone e embutido), separar explicitamente `isEmbedded` de `isActive` antes de aplicar guard de polling.
**Pattern**: “zero requests no Network em rota principal” após hardening de loops indica guarda de ativação aplicada no escopo errado.

## Lesson: 2026-03-04 (canonical-first exige pass-through de identidade completo no poller)
**Mistake**: Removi hidratação no GET (`/workflow/inbox`) sem garantir que o payload de polling sempre trouxesse `company_name/requester` resolvidos.
**Root cause**: `searchTickets` pode retornar linhas sem `companyName/contactName`; sem enriquecimento síncrono de leitura, o inbox persistia lacunas de identidade.
**Rule**: Em canonical-first, todo campo essencial de sidebar deve ser resolvido no pipeline de ingestão antes de persistir no read model.
**Pattern**: `status/priority` corretos + `org/requester` em `—` indica payload parcial de identidade na origem de ingestão.

## Lesson: 2026-03-04 (paridade de backlog não pode competir com cobertura do dia atual)
**Mistake**: Mantive polling com janela recente curta (1h) e snapshot por fila sem prioridade global de recência.
**Root cause**: O pipeline podia ingerir backlog antigo antes de completar tickets recentes do mesmo dia, quebrando expectativa operacional.
**Rule**: Em paridade de tickets abertos, ingestão deve ser recency-first e garantir cobertura dos mais recentes antes de avançar para histórico.
**Pattern**: Se UI mostra tickets de 2021/2023 enquanto tickets de hoje faltam, o algoritmo de hidratação está priorizando backlog errado.

## Lesson: 2026-03-04 (frontend integration calls must be connector-gated by tenant capability)
**Mistake**: Permitir que componentes UI chamem endpoints de integração (ex.: `/autotask/*`) sem validar se o conector está ativo no tenant.
**Root cause**: Gate de conectividade existia só em pontos isolados (Settings), não no client HTTP compartilhado.
**Rule**: Toda chamada para rota de integração deve passar por um guard central que consulte capacidades do tenant e bloqueie conectores inativos.
**Pattern**: `503` recorrente em endpoints de um conector desconectado indica ausência de gate de capability no cliente.

## Lesson: 2026-03-05 (auth lockout guards must be shared across all Autotask call paths)
**Mistake**: Tratar lockout apenas no poller e deixar endpoints de leitura/UI continuarem tentando autenticar com credencial já inválida/lockada.
**Root cause**: Controle de retry/cooldown estava implementado por componente (poller), não no cliente compartilhado da integração.
**Rule**: Para credenciais de integração, lockout/auth-failure backoff deve existir na camada comum de client adapter, aplicando para rotas, workers e qualquer consumidor.
**Pattern**: Se existe cooldown em apenas um caminho (ex.: poller) e outros caminhos continuam batendo no provider, haverá lock recorrente apesar de “fix” parcial.

## Lesson: 2026-03-05 (auth cooldown keying must account for credential rotation)
**Mistake**: Chavear cooldown de auth só por `username + integration code`, mantendo bloqueio ativo após rotação de secret válida.
**Root cause**: O mecanismo de proteção não diferenciava credencial antiga (inválida) de credencial nova (válida) para o mesmo principal.
**Rule**: Cooldown de lockout deve considerar material credencial rotacionável (ex.: hash do secret) e/ou ser explicitamente limpo ao salvar nova credencial.
**Pattern**: Se usuário rotaciona secret e continua recebendo 503 imediato sem nova tentativa ao provider, revisar chave/ciclo de vida do cooldown.

## Lesson: 2026-03-05 (Flow A consistency gates must be enforced at render boundary, not just computed backend-side)
**Mistake**: Permitir renderização de card com fallback `—` mesmo quando `block_consistency.core_state` indicava `resolving`.
**Root cause**: O frontend não consumia o gate de consistência como contrato de UI obrigatório; tratava ausência de dados como estado normal de visualização.
**Rule**: Se o backend expõe estado de bloco (`core_state`), a UI deve condicionar render final a esse estado e mostrar estado explícito de resolução/degradação.
**Pattern**: Se campos de Bloco A aparecem vazios com placeholders em vez de estado de pipeline, existe quebra entre contrato de consistência e política de render.

## Lesson: 2026-03-05 (identity enrichment must not sit on the critical path before workflow ingest)
**Mistake**: Resolver company/contact em lote grande e sem budget antes de publicar sync no workflow inbox.
**Root cause**: Lookup de identidade foi implementado com `Promise.all` amplo, sujeito a latência/rate-limit do PSA, bloqueando ciclo do poller.
**Rule**: Enriquecimento auxiliar deve ser bounded (timeout por chamada + budget por rodada + limite de cardinalidade) e nunca bloquear ingestão canônica.
**Pattern**: Se `show` congela enquanto integração externa oscila, procurar N+1 lookup no caminho crítico de polling/intake.
