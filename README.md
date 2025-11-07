# BEFREE

Rede Social P2P + IA pessoal (JARBAS) + Economia descentralizada (BFR Token)

Autoria: Marcelo Scapin Rovani & Comunidade BEFREE
Licença: AGPL v3 / Commons Clause

## Visão Geral
BEFREE é um ecossistema social descentralizado que integra:
- IA pessoal embarcada (JARBAS);
- Infraestrutura P2P (libp2p + IPFS + GunDB);
- Economia tokenizada (BFR);
- Identidade digital soberana (DID + wallet).

Este repositório traz uma implementação mínima funcional do SDK que permite testar a jornada básica de criação de identidade, troca de mensagens P2P em memória, reputação local e movimentação simbólica do token BFR.

> **Atualização de marca:** o ecossistema adota oficialmente o nome BEFREE e o token nativo `BFR`. Interfaces podem referenciar "free credits" de forma coloquial, mas toda a documentação, governança e integrações on-chain utilizam o ticker `BFR` para evitar colisões de mercado com ativos existentes.

## Estrutura do Monorepo
```
befree-os/
├── apps/
│   ├── mobile/
│   ├── desktop/
│   └── bootstrap/
├── sdk/
│   ├── p2p/
│   ├── ai/
│   ├── identity/
│   ├── economy/
│   ├── content/
│   └── reputation/
├── contracts/
│   ├── BFR.sol
│   ├── ElasticIssuance.sol
│   ├── Treasury.sol
│   ├── FlagRegistry.sol
│   └── ReputationEscrow.sol
├── docs/
│   ├── whitepaper.md
│   ├── manifesto.md
│   └── api-reference.md
├── packages/
│   ├── cli/
│   └── schemas/
└── infra/
    ├── docker/
    └── tests/
```

## SDK Highlights
- **Identidade:** geração de DIDs Ed25519 e assinatura/verificação de payloads.
- **P2P:** nó em memória com broadcast, request/response e eventos de presença.
- **Economia:** livro razão local com emissões simuladas do tesouro e transferências.
- **IA:** sumarização, extração de palavras-chave e busca semântica determinística.
- **Conteúdo:** classificação de selos e checagens básicas de moderação.
- **Reputação:** registro de eventos com decaimento exponencial e ranking local.
- **Orquestração:** pipeline integrado que conecta identidade, reputação, economia e IA em transmissões P2P assinadas, com diário local de publicações, inbox sincronizável e persistência opcional em disco.
- **Governança:** propostas colaborativas, votação ponderada, cálculo de quórum e arquivamento automático das decisões no snapshot do orquestrador.
- **Analytics:** digest diário das publicações com tendências de tags, pulsações de autores, intenções dominantes e palavras-chave destacadas.
- **Automação:** engine de tarefas reativas e jobs recorrentes que disparam ações a partir de publicações, votos, reputação, ledger e digest analíticos.
- **Telemetria:** coletor em memória com contadores, gauges, histogramas e eventos recentes para inspecionar o desempenho dos pipelines, sincronia de feeds, governança e automações.
- **Simulação:** cenários roteirizados que combinam publicações, ingestão de conteúdo externo, governança, digest analítico e transferências simbólicas para testar fluxos da comunidade em ciclos rápidos.

## CLI
Instale dependências e linke o CLI:

```bash
pnpm i
pnpm -w exec chmod +x packages/cli/index.js
pnpm -w exec npm link ./packages/cli
```

Uso rápido:

```bash
# Criar identidade
befree identity:create "Minha Wallet"

# Mostrar identidade ativa
befree identity:show

# Registrar transferência simbólica
befree ledger:transfer treasury did:befree:alice 42 "Recompensa de curadoria"

# Ver histórico
befree ledger:history
```

## Orquestração rápida

```ts
import { createCommunityOrchestrator } from '../sdk/platform';

const orchestrator = createCommunityOrchestrator({
  defaultReward: 5,
  rewardMemo: 'Curadoria diária',
  storage: './.befree/orchestrator.json',
  autosaveIntervalMs: 10_000,
});

await orchestrator.start();
await orchestrator.publishContent(
  {
    title: 'Relato comunitário',
    tags: ['befree', 'comunidade'],
    evidence: { creationUnix: Date.now(), cameraMake: 'Fairphone', cameraModel: 'FP5' },
  },
  'Resumo da reunião da célula local com as próximas ações colaborativas.'
);

console.log(await orchestrator.reputationScore());
console.log(orchestrator.ledgerHistory());

// Sincronizar novas publicações de outros nós
const fresh = await orchestrator.syncFeed();
console.log(`Novos conteúdos recebidos: ${fresh.length}`);

// Acessar feeds locais
console.log(orchestrator.getPublishedFeed());
console.log(orchestrator.getInbox());

// Abrir uma proposta comunitária e votar nela
const proposal = await orchestrator.createProposal(
  {
    title: 'Priorizar recompensas para mentores',
    description: 'Definir se o tesouro deve reservar 10% das emissões para mentores comunitários.',
    options: [{ label: 'Aprovar' }, { label: 'Revisar percentuais' }],
    metadata: { categoria: 'tesouro' },
  },
  { activate: true }
);

await orchestrator.voteOnProposal(proposal.id, { choice: proposal.options[0].id });

console.log(await orchestrator.getGovernanceProposals());

// Exportar instantâneo consolidado (autor, reputação, feed, inbox, ledger e governança)
console.log(await orchestrator.snapshot());

// Gerar digest analítico (tendências de tags, autores ativos, intenções e resumo)
console.log(await orchestrator.generateDigest({ windowMs: 1000 * 60 * 60 * 12 }));

// Automatizar rotinas: reagir a publicações e agendar digest periódicos
orchestrator.registerAutomationTask({
  description: 'Saudação para novos conteúdos',
  triggers: 'content:published',
  run: async ({ envelope }) => {
    console.log(`Novo post de ${envelope.author.label ?? envelope.author.did}: ${envelope.manifest.title}`);
  },
});

orchestrator.scheduleDigest({
  intervalMs: 1000 * 60 * 60 * 6,
  digestOptions: { topTags: 3 },
  taskId: 'digest:6h',
});

// Consultar métricas de execução e resetar o coletor quando necessário
console.log(orchestrator.getTelemetrySnapshot());
orchestrator.resetTelemetry();

// Persistir estado sob demanda (além do autosave)
await orchestrator.saveState();
```

O campo `storage` aceita um caminho para arquivo (usando o adaptador de disco padrão) ou um adaptador customizado que implemente `load()`/`save()`. Com `autosaveIntervalMs` definido, o orquestrador grava o estado consolidado em intervalos regulares e também após publicações, recebimentos ou limpezas de inbox.

Para ingestões manuais (conteúdos assinados vindos de integrações externas ou simulações), utilize `orchestrator.ingestContent(envelope)` — o retorno indica se o envelope foi aceito, duplicado ou rejeitado.

### Observando métricas em tempo real

O orquestrador expõe um coletor de telemetria interno (`getTelemetry()`) e snapshots serializáveis (`getTelemetrySnapshot()`) que incluem:

- Contadores agregados (`content.publish.success`, `governance.votes.attempts`, `storage.persist.errors`, etc.).
- Gauges instantâneos como o intervalo de autosave (`orchestrator.autosave.interval_ms`).
- Histogramas com duração de pipelines (`content.publish.duration`, `analytics.digests.duration`).
- Eventos recentes (últimas operações em `storage`, `automation`, `analytics`, `content`, entre outros).

Esses dados podem ser usados para dashboards ou alertas rápidos enquanto jobs e automações estão ativos.

Tarefas cadastradas com `registerAutomationTask` recebem o evento disparador (como `content:published`, `governance:proposal:closed` ou `analytics:digest`) e podem manter estado interno via `context.setState`. Jobs recorrentes criados por `scheduleAutomationJob` ou `scheduleDigest` executam funções assíncronas em intervalos configuráveis, emitindo eventos `automation:log` a cada execução ou falha.

## Simulação comunitária

Teste fluxos completos da comunidade sem depender de usuários reais utilizando o módulo `sdk/simulation`. O utilitário `runSimulation` recebe o orquestrador e um cenário com passos roteirizados (publicações locais, ingestão de conteúdos externos, governança, digest e transferências simbólicas):

```ts
import { createCommunityOrchestrator } from '../sdk/platform';
import { runSimulation, createSampleScenario } from '../sdk/simulation';

const orchestrator = createCommunityOrchestrator({
  defaultReward: 3,
  rewardMemo: 'Teste de fluxo',
});

const report = await runSimulation(orchestrator, createSampleScenario(), {
  iterations: 2,
  onStep: (step) => {
    const label = step.label ?? step.action.type;
    console.log(`[${step.iteration}] ${label}`, step.error ?? step.result);
  },
});

console.log(report.stats);
console.log(report.proposals);
console.table(report.participants);
```

Personalize os cenários adicionando passos com `type: 'ingest'` (para simular publicações assinadas por identidades fictícias), `type: 'vote'` (votos de participantes externos) ou `type: 'ledger:transfer'` (emissões do tesouro). Ajuste `iterations` e `delayMultiplier` para repetir ciclos com pausas artificiais.

## Desenvolvimento
```bash
pnpm i
pnpm -w build
pnpm -w dev
```

Testes locais podem ser construídos sobre os módulos TypeScript utilizando `ts-node` ou `vitest`. Consulte `docs/api-reference.md` para detalhes de cada módulo.

## Licença
AGPL v3 / Commons Clause.
