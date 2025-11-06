# API Reference

Este documento descreve a superfície inicial dos SDKs do BEFREE OS expostos no monorepo.

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
Manipulam o balanço local em FREE (inteiro com precisão de 1e-6).

### `payFREE(to, amount, memo?)`
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

## Reputação (`sdk/reputation`)

### `recordEvent(event)`
Registra um evento reputacional com decaimento exponencial configurado.

### `scoreFor(did, reference?)`
Calcula o score atual para um DID.

### `leaderboard(limit?)`
Retorna o ranking local de reputação.

## Orquestração (`sdk/platform`)

### `new CommunityOrchestrator(options?)`
Inicializa um orquestrador que conecta identidade, reputação, economia, IA e P2P. Aceita identidade pré-existente, rede lógica (`network`), multiaddrs e configuração de recompensa padrão.

### `orchestrator.publishContent(manifest, body, options?)`
Executa o pipeline completo (classificação, moderação, resumo, intenção, recompensa opcional) e transmite o envelope assinado via P2P. Emite eventos `content:published`, `content:received`, `content:invalid` e `content:error`.

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

### `orchestrator.syncFeed(options?)`
Dispara uma requisição P2P para recuperar novas publicações de outros orquestradores e preenche o inbox local. Retorna somente os envelopes inéditos recebidos.

### `orchestrator.snapshot()`
Gera um instantâneo consolidado com autor, feed publicado, inbox, histórico do ledger e reputação atual.

### `createCommunityOrchestrator(options?)`
Atalho que instancia o `CommunityOrchestrator` com as opções passadas.

## CLI (`packages/cli`)

Comando `befree` com subcomandos para criar/visualizar identidades e registrar transferências.
