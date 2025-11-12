# API Reference

Este documento descreve a superfície inicial dos SDKs do BEFREE expostos no monorepo.

> **Branding:** todas as APIs refletem o rebranding para o token `BFR`. O ticker antigo `FREE` segue aceito apenas como referência histórica em interfaces legadas.

## Identidade (`sdk/identity`)

### `createIdentity(wallet?, label?)`
Cria um DID Ed25519 local. Retorna um objeto com `did`, chaves pública/privada e metadados de criação.

### `sign(payload, identity?)`
Assina um `Uint8Array` com a identidade ativa (ou fornecida) e retorna a assinatura Ed25519.

### `verify(payload, signature, publicKey?)`
Verifica uma assinatura usando a chave pública associada ao DID.

## P2P (`sdk/p2p`)

### `new P2PNode(metadata?, multiaddrs?)`
Instancia um nó in-memory que simula a malha libp2p. Expõe eventos `peer:join`, `peer:left`, `message:in`, `message:<tipo>`.

### `node.start(network?)`
Conecta o nó a uma rede lógica (padrão `befree`).

### `node.broadcast(type, payload)`
Publica mensagens para todos os peers conectados.

### `node.request(type, payload, { timeout? })`
Envia uma requisição que espera resposta (`respond`) com timeout configurável.

## Economia (`sdk/economy`)

### `credit(account, amount)` / `debit(account, amount)`
Manipulam o balanço local em BFR (inteiro com precisão de 1e-6).

### `payBFR(to, amount, memo?)`
Simula um pagamento a partir do tesouro, com emissão automática caso necessário.

### `history()`
Retorna o histórico completo de transferências em memória.

## Conteúdo (`sdk/content`)

### `classify(manifest)`
Classifica um manifesto de mídia em selos (`proof_of_capture`, `remix`, `generated_ai`, etc.).

### `moderate(manifest)`
Retorna flags de moderação derivadas de texto, tamanho e metadados do manifesto.

## IA (`sdk/ai`)

### `summarize(text, sentences?)`
Gera um resumo extractivo simples baseado em frequência de termos.

### `extractKeywords(text, max?)`
Retorna as palavras-chave mais frequentes, desconsiderando stopwords.

### `semanticSearch(query, documents, topK?)`
Aplica busca semântica aproximada usando embeddings determinísticos hash-based.

### Persona JARBAS (`jarbasPersona`)
- `JARBAS_PERSONA`: objeto com missão, traços, compromissos “NUNCA/SEMPRE”, modos avançados e melhores práticas do assistente.
- `defaultJarbasMemory`: memória inicial com contexto da comunidade, evolução e preferências do usuário.
- `buildJarbasSystemPrompt({ memory, conversationSummary?, userIntent?, userEmotion?, urgency?, channel? })`: gera o prompt operacional completo seguindo o protocolo da persona.
- `evolveJarbasMemory(memory, updates)`: ajusta `context`, `evolution` e `preferences` preservando frases/interações recentes.
- `registerJarbasResponse(memory, response, interactionSummary?)`: registra frases utilizadas em uma resposta para evitar repetições nas próximas interações.
- `validateJarbasResponse(response, memory)`: verifica limites de 300 palavras, ausência de meta-referências e repetição de frases recentes, retornando violações quando existirem.

## Reputação (`sdk/reputation`)

### `recordEvent(event)`
Registra um evento reputacional com decaimento exponencial configurado.

### `scoreFor(did, reference?)`
Calcula o score atual para um DID.

### `leaderboard(limit?)`
Retorna o ranking local de reputação.

## Governança (`sdk/governance`)

### `createProposal(author, draft)`
Abre uma proposta comunitária com opções, quórum opcional e metadados livres. Retorna a proposta normalizada (IDs únicos para cada opção).

### `activateProposal(id)` / `cancelProposal(id)` / `closeProposal(id)`
Controlam o ciclo de vida da proposta, respeitando status válidos. `closeProposal` calcula resultado, quórum e eventuais empates antes de arquivar o desfecho.

### `voteOnProposal(id, vote)`
Registra ou atualiza o voto ponderado (`weight`) de um determinado DID na proposta ativa. A escolha deve existir nas opções cadastradas.

### `listProposals({ status? })`
Lista propostas com filtro opcional por status (`draft`, `active`, `closed`, `cancelled`).

### `getProposalById(id)`
Recupera uma proposta específica com votos e desfecho (quando encerrada).

### `exportGovernanceState()` / `importGovernanceState(state?)`
Serializam e restauram o estado completo de propostas, votos e resultados para persistência.

## Analytics (`sdk/analytics`)

### `computeTagTrends(feed, inbox?, options?)`
Calcula tendências de tags considerando o feed publicado e o inbox recebido dentro de uma janela temporal. Retorna lista com tag, contagem, peso decaído por recência e último timestamp observado.

### `buildCommunityDigest(feed, inbox?, options?)`
Gera um digest comunitário com totais de publicações, autores únicos, tendências de tags, pulsações de autores (com reputação opcional) e destaques (intenções dominantes, palavras-chave e resumo extraído dos conteúdos mais recentes). `options` aceita `windowMs`, `topTags`, `topAuthors`, `includeInbox`, além de injetar funções de resumo/palavras-chave personalizadas.

### `DigestOptions` / `CommunityDigest`
Interfaces que descrevem, respectivamente, as opções de cálculo de digest e o formato de retorno estruturado do relatório.

## Automação (`sdk/automation`)

### `new AutomationEngine(context?)`
Instancia o motor reativo responsável por coordenar tarefas e jobs. O `context` opcional injeta referências (como o orquestrador atual) e um `logger` assíncrono que recebe eventos `automation:log` com níveis `debug`, `info`, `warn` e `error`.

### `engine.registerTask(task)` / `engine.removeTask(id)` / `engine.listTasks()`
Gerencia tarefas reativas disparadas por eventos (`content:published`, `content:received`, `ledger:transfer`, `reputation:event`, `governance:proposal:*`, `analytics:digest`). Cada tarefa pode definir filtro assíncrono, cooldown, execução única (`once`) e mantém estatísticas de execuções.

### `engine.registerJob(job)` / `engine.cancelJob(id)` / `engine.listJobs()` / `engine.stopAllJobs()`
Agenda jobs recorrentes com intervalo fixo e execução assíncrona. `immediate: true` dispara a primeira execução imediatamente; `stopAllJobs` pausa intervalos sem descadastrar tarefas.

### `engine.clearState(key?)`
Remove estado interno associado a tarefas. Sem argumento, limpa o `Map` inteiro. O contexto exposto às tarefas oferece `getState`/`setState`/`deleteState` para persistir dados entre disparos.

### Tipos auxiliares
- `AutomationTask`: descreve gatilhos, handler, filtros, cooldown e execução única.
- `RegisteredAutomationJob`: inclui métricas `runs` e `lastRunAt` sobre jobs ativos.
- `AutomationEvent`: união tipada de todos os eventos suportados.

## Telemetria (`sdk/telemetry`)

### `new TelemetryCollector({ maxEvents? })`
Instancia um coletor de métricas em memória com suporte a contadores, gauges, histogramas e buffer circular de eventos (padrão de 200 itens).

### `collector.increment(name, delta?)`
Incrementa contadores numéricos identificados por `name` (aceita valores negativos) e atualiza o timestamp de alteração.

### `collector.setGauge(name, value)`
Registra valores instantâneos (como intervalos ou tamanhos atuais) associados a um identificador.

### `collector.observe(name, value)` / `collector.time(name, fn)`
Atualiza histogramas agregados manualmente (`observe`) ou cronometra execuções síncronas/assíncronas (`time`), registrando média, mínimos, máximos e o último valor observado. Falhas são reportadas em métricas com sufixo `:error`.

### `collector.recordEvent(name, payload?)`
Armazena eventos recentes com metadados opcionais, mantendo apenas os `maxEvents` mais novos.

### `collector.snapshot()` / `collector.reset()`
Exportam o estado completo (contadores, gauges, medições e eventos com timestamp de geração) ou limpam toda a memória acumulada.

## Orquestração (`sdk/platform`)

### `new CommunityOrchestrator(options?)`
Inicializa um orquestrador que conecta identidade, reputação, economia, IA e P2P. Opções relevantes:

- `identity`: instância pré-existente de chaves (mantém segredo e metadados).
- `network`/`multiaddrs`: personalizam o nó P2P em memória.
- `defaultReward`/`rewardMemo`: recompensa simbólica automática para cada publicação.
- `storage`: adaptador com métodos `load()` e `save()` ou caminho de arquivo para persistir o estado consolidado (identidade, feed, inbox, reputação e ledger).
- `autosaveIntervalMs`: intervalo opcional para autosave periódico quando um adaptador de armazenamento é fornecido.
- `telemetry`: coletor externo `TelemetryCollector` ou `telemetryOptions` para customizar o buffer de eventos do coletor interno.

### `orchestrator.publishContent(manifest, body, options?)`
Executa o pipeline completo (classificação, moderação, resumo, intenção, recompensa opcional) e transmite o envelope assinado via P2P. Emite eventos `content:published`, `content:received`, `content:invalid` e `content:error`, além de disparar automações `reputation:event`, `ledger:transfer` (quando houver recompensa) e `content:published` para tarefas registradas.
Atualiza contadores (`content.publish.attempts/success/errors`), histogramas (`content.publish.duration`) e eventos recentes no coletor de telemetria associado.

### `orchestrator.requestAssistance(text)`
Retorna intenção, resumo curto e palavras-chave para um texto livre, reaproveitando os utilitários determinísticos de IA.

### `orchestrator.reputationScore(did?)`
Exponde o score atual para o DID informado (ou o próprio autor).

### `orchestrator.reputationLeaders(limit?)`
Lê o ranking local de reputação após os registros automáticos dos eventos de conteúdo/economia.

### `orchestrator.ledgerHistory()`
Disponibiliza o histórico de transferências realizadas pelo pipeline.

### `orchestrator.getPublishedFeed(limit?)`
Retorna as publicações emitidas localmente em ordem cronológica. Com `limit`, traz somente os itens mais recentes.

### `orchestrator.getInbox(options?)`
Entrega as publicações verificadas recebidas pela instância, com filtros opcionais (`since`, `limit`). Cada entrada inclui `receivedAt` e `sourcePeer`.

### `orchestrator.clearInbox(predicate?)`
Remove entradas do inbox. Sem argumentos limpa tudo, ou aceita um predicado para remoção seletiva.

### `orchestrator.createProposal(draft, { activate? })`
Abre uma proposta no módulo de governança com autor padrão sendo o DID do orquestrador. Define eventos `governance:proposal:created` e `governance:proposal:activated` quando apropriado e dispara automações homônimas para workflows reativos.

### `orchestrator.voteOnProposal(id, { choice, weight?, justification?, metadata?, voter? })`
Registra um voto ponderado para uma proposta ativa. O peso padrão é 1 e o `voter` assume o DID local quando omitido.

### `orchestrator.registerAutomationTask(task)` / `orchestrator.removeAutomationTask(id)` / `orchestrator.listAutomationTasks()`
Expõem o gerenciamento de tarefas do `AutomationEngine` interno. Tarefas recebem o evento disparador, acesso a `context.getState`/`setState` e podem ser inspecionadas quanto a execuções (`runs`, `lastRunAt`).

### `orchestrator.scheduleAutomationJob(job)` / `orchestrator.cancelAutomationJob(id)` / `orchestrator.listAutomationJobs()` / `orchestrator.stopAutomationJobs()`
Permitem agendar jobs recorrentes vinculados ao orquestrador (ideal para digests periódicos, limpeza de inbox, etc.). `stopAutomationJobs()` pausa temporariamente os intervalos sem descadastrar jobs nem tarefas.

### `orchestrator.clearAutomationState(key?)`
Remove valores persistidos pelas tarefas automatizadas, limpando um item específico ou todo o mapa de estado.

### `orchestrator.getAutomationEngine()`
Retorna a instância do `AutomationEngine` para cenários avançados (integração com adaptadores customizados ou inspeção manual).

### `orchestrator.scheduleDigest({ intervalMs, digestOptions?, taskId?, immediate? })`
Atalho para agendar geração recorrente de digests com as mesmas opções aceitas por `generateDigest`. Emite `analytics:digest` a cada execução e um evento adicional `analytics:digest:scheduled` contendo o resultado calculado.

### `orchestrator.getGovernanceProposals({ status? })`
Retorna a visão atual das propostas, já considerando votos e resultados. Útil para dashboards ou instantâneos persistidos.

### `orchestrator.activateProposal(id)` / `orchestrator.cancelProposal(id)` / `orchestrator.closeProposal(id)`
Manipulam o status da proposta e emitem eventos específicos (`governance:proposal:cancelled`, `governance:proposal:closed`), além de alimentarem os gatilhos de automação correspondentes.

### `orchestrator.syncFeed(options?)`
Dispara uma requisição P2P para recuperar novas publicações de outros orquestradores e preenche o inbox local. Retorna somente os envelopes inéditos recebidos.

### `orchestrator.ingestContent(envelope, { sourcePeer? })`
Permite injetar manualmente envelopes assinados (ex.: integrações externas ou simulações) no inbox local sem depender do P2P. Retorna um status (`'accepted'`, `'duplicate'` ou `'invalid'`) conforme o envelope seja processado, ignorado ou rejeitado após a verificação da assinatura.

### `orchestrator.generateDigest(options?)`
Gera um digest estruturado das interações recentes, combinando feed publicado e inbox (quando habilitado). O resultado inclui tendências de tags, autores mais ativos com seus pulsos ponderados, intenções detectadas e um resumo sintético dos conteúdos destacados. Emite evento `analytics:digest` (que também alimenta automações cadastradas) após o cálculo.
Mede automaticamente a duração do processamento (`analytics.digests.duration`) e registra eventos `analytics:digest` com totais agregados na telemetria.

### `orchestrator.snapshot()`
Gera um instantâneo consolidado com autor, feed publicado, inbox, histórico do ledger, reputação atual e todas as propostas registradas (incluindo votos e desfecho quando houver).

### `orchestrator.saveState()`
Força a persistência imediata do estado completo usando o adaptador configurado (ou caminho de arquivo).

### `orchestrator.getTelemetry()` / `orchestrator.getTelemetrySnapshot()` / `orchestrator.resetTelemetry()`
Exibem o coletor interno, retornam uma visão serializada das métricas atuais (contadores, gauges, histogramas e eventos recentes) e limpam o histórico acumulado, respectivamente.

O orquestrador também emite eventos `storage:restored`, `storage:saved`, `storage:error`, `automation:log`, `automation:error`, `analytics:digest:scheduled` e uma família `governance:proposal:<evento>` para criação, ativação, voto, cancelamento e encerramento de propostas quando um adaptador está presente.

### `createCommunityOrchestrator(options?)`
Atalho que instancia o `CommunityOrchestrator` com as opções passadas.

### `createFileStorageAdapter(path)`
Cria um adaptador de armazenamento que serializa o estado consolidado do orquestrador em um arquivo JSON (criando diretórios automaticamente). Útil para habilitar persistência local rápida sem depender de bancos externos.

## Simulação (`sdk/simulation`)

### `runSimulation(orchestrator, scenario, options?)`
Executa um ou mais ciclos de um cenário roteirizado, coordenando publicações locais, ingestão de envelopes externos, geração de digest, governança, transferências simbólicas e comandos auxiliares (esperas artificiais, sincronização). Cada passo gera um log estruturado (`SimulationLogEntry`) com duração, resultado ou erro capturado.

### `createSampleScenario()`
Retorna um cenário de exemplo com publicações, ingestão simulada, geração de digest, abertura de proposta, voto externo e snapshot consolidado — ideal para validar o fluxo completo do orquestrador logo após a instalação.

### Tipos principais
- `SimulationScenario`: descreve o nome opcional, participantes e a lista ordenada de `SimulationStep` executados.
- `SimulationAction`: união tipada que cobre `publish`, `ingest`, `proposal`, `vote`, `digest`, `snapshot`, `sync`, `assistance`, `ledger:transfer` e `wait`.
- `SimulationReport`: resumo final com estatísticas agregadas (`SimulationStats`), logs de cada passo, propostas abertas e identidades utilizadas nas ingestões externas.
- `SimulationAbortSignal`: interface minimalista (`{ aborted?: boolean }`) aceita em `SimulationOptions.signal` para cancelar execuções em andamento.
- `IncomingContentStatus`: enumeração literal (`'accepted' | 'duplicate' | 'invalid'`) retornada por `ingestContent`.

## Frontend (`apps/frontend`)

Protótipo Next.js com foco na experiência sensorial descrita na nota de design. Os componentes expostos são pensados
para consumo direto em aplicações React/Next e podem ser reaproveitados em miniapps híbridos.

### `TopBar`
Renderiza a navegação principal com atalho de conexão de carteira (`useWallet`). Recebe `summary` (digest ativo, totais e host)
para exibir o estado recente do orquestrador em tempo real, além da marca BEFREE e status da rede lógica (`befree-holo-testnet`).
Aceita `onOpenPreferences` para expor o botão “Atmosfera”, integrando com o painel de personalização.

### `RadialFeed`
Organiza pulsos (`Pulse[]`) recebidos via `loadCommunitySnapshot()` em órbitas calculadas por `usePulseLayout`, destacando
reputação, energia e assistências do Jarbas. Utiliza `FeedOrb` para cada entrada.

### `JarbasPanel`
Painel do assistente pessoal com os insights do módulo `useJarbasPresence(insights)`. Além de humor/status
(escutando/respondendo), exibe missão, traços e compromissos “NUNCA/SEMPRE” da persona, memória ativa derivada
de `loadCommunitySnapshot`, modos avançados disponíveis e um botão para copiar o prompt operacional gerado via `personaPrompt`.

### `ReputationCard`
Recebe `participants` mapeados do orquestrador e apresenta métricas agregadas (`useReputationMetrics`) e destaques individuais
de reputação, streak e BFR acumulado.

### `CirclePanel`
Lista `circles` sintetizados a partir das tendências do digest, com nível de confiança, membros e estado de cifragem.

### `ActionDock`
Contém `VoiceInput`, botão de novo pulse, captura de prova viva, atalho para círculos fechados e o gatilho de personalização.
Recebe `onOpenPreferences` e `onPulse` para encadear feedback sensorial via `useSensoryBridge`.

### `PersonalizationPanel`
Overlay client-side que permite alternar tema (`neo`, `sol`, `noir`), intensidade de animação (`motion`), filtros do feed,
trilha/háptica, volume e TTS do Jarbas. Aceita `open`, `onClose` e `onPreviewTone(event)` para disparar tons de pré-escuta.

### `ExperienceShell`
Client wrapper que combina `PersonalizationProvider`, `SensoryBridgeProvider` e os componentes do feed radial. Recebe
`community: LiveCommunityData` e cuida de abrir/fechar o painel de personalização ao clicar em “Atmosfera”.

### Hooks utilitários
- `usePulseLayout(pulses)`: projeta conteúdo em órbitas (`angle`, `radius`) para efeitos radiais.
- `useJarbasPresence(insights)`: simula batimento de presença do Jarbas enquanto insights fornecidos são rotacionados.
- `useJarbasSensory(presence)`: liga trilha ambiente, TTS e vibração conforme o estado/mood do Jarbas e retorna `triggerEventTone`.
- `usePersonalization()`: expõe `preferences`, `setPreference` e `resetPreferences`, sincronizando atributos `data-*` no `body`.
- `useSensoryBridge()`: permite compartilhar `trigger(event)` e `register(handler)` entre o Jarbas e demais componentes.
- `useWallet()`: stub de conexão com WalletConnect, exibindo endereço e rede.
- `useReputationMetrics(participants)`: agrega reputação média, pico e piso a partir dos participantes recebidos.

### Manifesto e Service Worker
- `app/manifest.ts`: implementa `MetadataRoute.Manifest` com nome/ticker BEFREE/BFR, cores do tema e ícones SVG (inclui variant maskable).
- `public/sw.js`: service worker com cache básico (`CACHE_NAME = 'befree-shell-v1'`) instalado via `ServiceWorkerRegister`.
- `ServiceWorkerRegister`: componente client que registra `/sw.js` quando `navigator.serviceWorker` está disponível.

### `loadCommunitySnapshot(options?)`
Função assíncrona localizada em `apps/frontend/lib/liveCommunity.ts` que instancia o `CommunityOrchestrator`, executa o cenário
padrão via `runSimulation`, gera digest, mapeia pulsos, participantes, círculos e insights, retornando um objeto
`LiveCommunityData`. Aceita `options.scenario` (para customizar o roteiro) e `options.iterations`. Em caso de erro, retorna o
`fallbackCommunityData` definido em `lib/demoData`.

### Dados de demonstração
O módulo `lib/demoData` fornece tipos, prompts de voz e o `fallbackCommunityData`, utilizado como reserva quando
`loadCommunitySnapshot()` não consegue executar o orquestrador (ex.: ambientes sem `ts-node`). O fallback agora
inclui `persona`, `jarbasMemory` e `personaPrompt`, alinhados ao protocolo comportamental definido em `sdk/ai/jarbasPersona`.

## CLI (`packages/cli`)

Comando `befree` com subcomandos para criar/visualizar identidades, registrar transferências e orquestrar
simulações roteirizadas conectadas ao diretório local `~/.befree`.

### `simulation:run`

Executa cenários JSON (ou módulos JS/TS) com suporte a múltiplas iterações, delays customizados, presets embutidos
e logs verbosos. O runner restaura automaticamente o último estado salvo em `~/.befree/simulation-state.json` para
permitir continuidade entre execuções e grava um novo snapshot ao final.

| Flag | Descrição |
| ---- | --------- |
| `--iterations <n>` | Define quantas vezes o cenário será repetido antes de gerar o relatório final. |
| `--delay <fator>` | Multiplica todos os `delayMs` do cenário para acelerar ou desacelerar a simulação. |
| `--json` | Imprime o relatório completo (logs, estatísticas, snapshot e metadados de persistência) em JSON. |
| `--verbose` | Escreve cada passo executado no stdout conforme o runner avança. |
| `--state <arquivo>` | Usa um arquivo de estado específico (absoluto ou relativo) em vez do padrão em `~/.befree`. |
| `--reset` | Ignora o estado persistido e inicializa o runner com buffers vazios. |
| `--no-persist` | Evita gravar o snapshot atualizado ao término da execução. |
| `--preset <nome>` | Carrega um preset embutido (`sample`, `community-sprint`, `p2p-sync`) sem precisar informar o arquivo. |
| `--list-presets` | Lista os presets disponíveis e encerra o comando imediatamente. |
| `--verify` | Executa o orquestrador TypeScript em paralelo e compara métricas, contagens e participantes. |
| `--participants a,b` | Gera destaques para ids/DIDs/rótulos informados no relatório (útil para auditorias focadas). |
| `--log-file <path>` | Exporta todos os logs (`SimulationLogEntry[]`) para JSON e cria diretórios automaticamente. |

Além das estatísticas globais (`stats`), o relatório inclui `actors`: lista com o anfitrião e cada participante.
Cada entrada registra contadores de publicações, ingestões, votos, digests, snapshots, sincronizações, assistências,
transferências e erros associados. O array `logs` também adiciona o campo `actor` com o responsável pelo passo.
Por fim, `snapshot` (feeds, inbox, ledger, propostas) e `state` (identidade, assinaturas conhecidas e buffers)
seguem disponíveis para serialização em bancos de dados, IPFS ou replicação multi-máquina. Quando `--verify` é utilizado,
o JSON também fornece `orchestrator` (relatório, snapshot e telemetria do orquestrador TypeScript) e `parity`, destacando
se todas as métricas permaneceram alinhadas ou se há divergências a investigar. Instale `ts-node` e `typescript`
(`pnpm add -D ts-node typescript`) para habilitar a execução paralela do orquestrador completo.
