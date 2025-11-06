# BEFREE OS

Rede Social P2P + IA pessoal (JARBAS) + Economia descentralizada (FREE Token)

Autoria: Marcelo Scapin Rovani & Comunidade BEFREE
Licença: AGPL v3 / Commons Clause

## Visão Geral
BEFREE OS é um ecossistema social descentralizado que integra:
- IA pessoal embarcada (JARBAS);
- Infraestrutura P2P (libp2p + IPFS + GunDB);
- Economia tokenizada (FREE);
- Identidade digital soberana (DID + wallet).

Este repositório traz uma implementação mínima funcional do SDK que permite testar a jornada básica de criação de identidade, troca de mensagens P2P em memória, reputação local e movimentação simbólica do token FREE.

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
│   ├── FREE.sol
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
- **Orquestração:** pipeline integrado que conecta identidade, reputação, economia e IA em transmissões P2P assinadas, com diário local de publicações e inbox sincronizável.

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

const orchestrator = createCommunityOrchestrator({ defaultReward: 5, rewardMemo: 'Curadoria diária' });

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

// Exportar instantâneo consolidado (autor, reputação, feed, inbox e ledger)
console.log(await orchestrator.snapshot());
```

## Desenvolvimento
```bash
pnpm i
pnpm -w build
pnpm -w dev
```

Testes locais podem ser construídos sobre os módulos TypeScript utilizando `ts-node` ou `vitest`. Consulte `docs/api-reference.md` para detalhes de cada módulo.

## Licença
AGPL v3 / Commons Clause.
