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

## Diagrama ASCII
```
                ┌───────────────────────────┐
                │        Usuário            │
                │  (voz, texto, mídia)      │
                └────────────┬──────────────┘
                             │
                      ┌──────▼──────┐
                      │   JARBAS    │ ←→ IA local (LLM, STT, TTS)
                      └──────┬──────┘
                             │ UCAN capabilities
               ┌─────────────┼─────────────────┐
               │             │                 │
        ┌──────▼──────┐┌─────▼─────┐   ┌──────▼──────┐
        │  P2P Layer  ││ Identity  │   │ Economy (FREE)│
        │ libp2p/IPFS ││  DID/SSI  │   │  Solidity/DAO │
        └──────┬──────┘└─────┬─────┘   └──────┬──────┘
               │ Proofs / Signatures          │ Burn / Mint
               ▼                              ▼
        ┌──────────────────────────────────────────┐
        │   Rede BEFREE OS (nós P2P + curadores)   │
        └──────────────────────────────────────────┘
```

## Scaffolding (Cursor/CLI)
```bash
pnpm i
pnpm -w build
pnpm -w dev
```

## Licença
AGPL v3 / Commons Clause.
