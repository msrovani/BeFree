const { randomUUID } = require('crypto');
const { TextEncoder } = require('util');

const { createIdentity, signPayloadBase64, verifySignature } = require('./lib/identity');
const { classify, moderate } = require('./lib/content');
const { summarize, extractKeywords, detectIntent } = require('./lib/ai');
const { buildCommunityDigest } = require('./lib/analytics');

const encoder = new TextEncoder();

const deepClone = (value) => (value == null ? value : JSON.parse(JSON.stringify(value)));

const wait = async (ms) => {
  if (!ms || ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
};

const cloneManifest = (manifest) => ({
  title: manifest.title,
  description: manifest.description,
  tags: manifest.tags ? [...manifest.tags] : undefined,
  mimeType: manifest.mimeType,
  language: manifest.language,
  sizeBytes: manifest.sizeBytes,
  cid: manifest.cid,
  evidence: manifest.evidence ? { ...manifest.evidence } : undefined,
});

class CommunitySimulator {
  constructor(options = {}) {
    this.identity = options.identity ?? createIdentity(options.label);
    this.published = [];
    this.inbox = [];
    this.seenSignatures = new Set();
    this.ledger = [];
    this.proposals = [];
    this.proposalCounter = 0;
    this.reputationEvents = [];

    if (options.state) {
      this.importState(options.state);
    }
  }

  get author() {
    return {
      did: this.identity.did,
      publicKey: this.identity.pub,
      wallet: this.identity.wallet,
      label: this.identity.label,
    };
  }

  async publish(manifest, body) {
    const selo = await classify(manifest);
    const moderation = await moderate(manifest);
    const summary = await summarize(body);
    const keywords = await extractKeywords(body);
    const intent = await detectIntent(body);
    const result = { selo, moderation, summary, keywords, intent };
    const timestamp = Date.now();
    const payloadBytes = encoder.encode(JSON.stringify({ manifest, body, result, timestamp }));
    const signature = signPayloadBase64(payloadBytes, this.identity);
    const envelope = {
      manifest: cloneManifest(manifest),
      body,
      result,
      timestamp,
      author: this.author,
      signature,
    };
    this.seenSignatures.add(signature);
    this.published.push(envelope);
    this.recordReputationEvent({ type: 'content', weight: 1, timestamp });
    return envelope;
  }

  async ingest(envelope, sourcePeer) {
    if (this.seenSignatures.has(envelope.signature)) {
      return 'duplicate';
    }
    const payloadBytes = encoder.encode(
      JSON.stringify({ manifest: envelope.manifest, body: envelope.body, result: envelope.result, timestamp: envelope.timestamp })
    );
    const valid = verifySignature(payloadBytes, envelope.signature, envelope.author.publicKey);
    if (!valid) {
      return 'invalid';
    }
    this.seenSignatures.add(envelope.signature);
    this.inbox.push({ envelope, receivedAt: Date.now(), sourcePeer });
    this.recordReputationEvent({ type: 'curation', weight: 0.5, timestamp: envelope.timestamp });
    return 'accepted';
  }

  createProposal(draft, options = {}) {
    const id = `proposal-${++this.proposalCounter}`;
    const createdAt = new Date().toISOString();
    const proposal = {
      id,
      title: draft.title,
      description: draft.description,
      options: (draft.options ?? []).map((option, index) => ({
        id: option.id ?? `option-${index + 1}`,
        label: option.label ?? `Opção ${index + 1}`,
        votes: 0,
      })),
      status: options.activate ? 'active' : 'draft',
      votes: [],
      createdAt,
      updatedAt: createdAt,
    };
    this.proposals.push(proposal);
    return proposal;
  }

  voteOnProposal(proposalId, input = {}) {
    const proposal = this.proposals.find((entry) => entry.id === proposalId);
    if (!proposal) {
      throw new Error(`Proposta ${proposalId} não encontrada`);
    }
    if (proposal.status === 'draft') {
      proposal.status = 'active';
    }
    const choiceId = input.choice ?? proposal.options[0]?.id;
    const option = proposal.options.find((entry) => entry.id === choiceId);
    if (!option) {
      throw new Error(`Opção ${choiceId} inválida para proposta ${proposalId}`);
    }
    option.votes += 1;
    const record = {
      voter: input.voter ?? this.identity.did,
      choice: option.id,
      comment: input.comment,
      timestamp: new Date().toISOString(),
    };
    proposal.votes.push(record);
    proposal.updatedAt = record.timestamp;
    return record;
  }

  async generateDigest(options = {}) {
    const digest = await buildCommunityDigest(
      this.published,
      this.inbox,
      options
    );
    const totalAmount = this.ledger.reduce((acc, tx) => acc + Number(tx.amount ?? 0), 0);
    return {
      ...digest,
      ledger: {
        totalTransfers: this.ledger.length,
        totalAmount,
      },
      proposals: {
        total: this.proposals.length,
        active: this.proposals.filter((entry) => entry.status === 'active').length,
      },
    };
  }

  snapshot() {
    return {
      author: deepClone(this.author),
      published: deepClone(this.published) ?? [],
      inbox: deepClone(this.inbox) ?? [],
      ledger: deepClone(this.ledger) ?? [],
      governance: deepClone(this.proposals) ?? [],
      reputation: this.reputationScore(),
      proposals: deepClone(this.proposals) ?? [],
    };
  }

  exportState() {
    return {
      identity: deepClone(this.identity),
      published: deepClone(this.published) ?? [],
      inbox: deepClone(this.inbox) ?? [],
      ledger: deepClone(this.ledger) ?? [],
      proposals: deepClone(this.proposals) ?? [],
      seenSignatures: [...this.seenSignatures],
      proposalCounter: this.proposalCounter,
      reputationEvents: deepClone(this.reputationEvents) ?? [],
    };
  }

  importState(state = {}) {
    if (state.identity) {
      this.identity = deepClone(state.identity);
    }
    this.published = Array.isArray(state.published) ? deepClone(state.published) : [];
    this.inbox = Array.isArray(state.inbox) ? deepClone(state.inbox) : [];
    this.ledger = Array.isArray(state.ledger) ? deepClone(state.ledger) : [];
    this.proposals = Array.isArray(state.proposals) ? deepClone(state.proposals) : [];
    this.seenSignatures = new Set(Array.isArray(state.seenSignatures) ? state.seenSignatures : []);
    this.proposalCounter = Number.isFinite(state.proposalCounter)
      ? Number(state.proposalCounter)
      : Math.max(0, this.proposals.length);
    this.reputationEvents = Array.isArray(state.reputationEvents) ? deepClone(state.reputationEvents) : [];
  }

  syncFeed(options = {}) {
    const since = typeof options.since === 'number' ? options.since : 0;
    const limit = typeof options.limit === 'number' && options.limit > 0 ? options.limit : undefined;
    const entries = [...this.published, ...this.inbox.map((entry) => entry.envelope)].filter(
      (entry) => entry.timestamp > since
    );
    if (limit) {
      return entries.slice(-limit);
    }
    return entries;
  }

  async requestAssistance(text) {
    const summary = await summarize(text, 2);
    const keywords = await extractKeywords(text);
    const intent = await detectIntent(text);
    return { summary, keywords, intent };
  }

  recordReputationEvent(event) {
    if (!event || typeof event !== 'object') return;
    const type = event.type;
    if (!['content', 'curation', 'economy', 'moderation', 'social'].includes(type)) return;
    const timestamp = Number.isFinite(event.timestamp) ? event.timestamp : Date.now();
    const weight = Number.isFinite(event.weight) ? Number(event.weight) : 0;
    this.reputationEvents.push({
      did: this.identity.did,
      type,
      weight,
      timestamp,
      metadata: event.metadata ? deepClone(event.metadata) : undefined,
    });
  }

  reputationScore(reference = Date.now()) {
    const DECAY_HALF_LIFE = 1000 * 60 * 60 * 24 * 30;
    const weights = {
      content: 1.2,
      curation: 1,
      economy: 1.5,
      moderation: 2,
      social: 0.8,
    };

    const decayFactor = (event) => {
      const age = reference - event.timestamp;
      if (age <= 0) return 1;
      const decay = Math.pow(0.5, age / DECAY_HALF_LIFE);
      return Math.max(0, Math.min(1, decay));
    };

    const score = this.reputationEvents.reduce(
      (acc, event) => acc + event.weight * (weights[event.type] ?? 1) * decayFactor(event),
      0
    );

    return Number(score.toFixed(4));
  }

  recordTransfer(to, amount, memo) {
    const normalized = typeof amount === 'bigint' ? Number(amount) : Number(amount);
    const receipt = {
      tx: `bfr-${randomUUID()}`,
      from: this.identity.wallet,
      to,
      amount: Number.isFinite(normalized) ? normalized : 0,
      memo,
      timestamp: new Date().toISOString(),
    };
    this.ledger.push(receipt);
    this.recordReputationEvent({
      type: 'economy',
      weight: Math.abs(receipt.amount) || 0.25,
      timestamp: Date.parse(receipt.timestamp) || Date.now(),
      metadata: { to },
    });
    return receipt;
  }
}

const ensureParticipant = (id, pool, configs = []) => {
  const existing = pool.get(id);
  if (existing) return existing;
  const config = configs.find((entry) => entry.id === id);
  const identity = config?.identity ?? createIdentity(config?.label ?? id);
  const participant = {
    id,
    label: config?.label ?? identity.label,
    identity,
  };
  pool.set(id, participant);
  return participant;
};

const forgeEnvelope = async (manifest, body, identity) => {
  const selo = await classify(manifest);
  const moderation = await moderate(manifest);
  const summary = await summarize(body);
  const keywords = await extractKeywords(body);
  const intent = await detectIntent(body);
  const result = { selo, moderation, summary, keywords, intent };
  const timestamp = Date.now();
  const payloadBytes = encoder.encode(JSON.stringify({ manifest, body, result, timestamp }));
  const signature = signPayloadBase64(payloadBytes, identity);
  return {
    manifest: cloneManifest(manifest),
    body,
    result,
    timestamp,
    author: {
      did: identity.did,
      publicKey: identity.pub,
      wallet: identity.wallet,
      label: identity.label,
    },
    signature,
  };
};

const defaultStats = () => ({
  published: 0,
  ingested: 0,
  proposals: 0,
  votes: 0,
  digests: 0,
  snapshots: 0,
  assistance: 0,
  syncs: 0,
  transfers: 0,
  waits: 0,
  errors: 0,
});

const runScenario = async (scenario, options = {}) => {
  const simulator = new CommunitySimulator(options.simulatorOptions);
  const participants = new Map();
  const stats = defaultStats();
  const logs = [];
  const proposals = [];
  const iterations = Math.max(1, Math.trunc(options.iterations ?? 1));
  const delayFactor = options.delayMultiplier ?? 1;
  const startedAt = Date.now();
  let lastProposalId;

  const logStep = options.onStep
    ? options.onStep
    : options.verbose
    ? (entry) => {
        // eslint-disable-next-line no-console
        console.log(
          JSON.stringify(
            {
              iteration: entry.iteration,
              step: entry.index,
              action: entry.action.type,
              label: entry.label,
              error: entry.error,
              durationMs: entry.durationMs,
            },
            null,
            2
          )
        );
      }
    : undefined;

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    for (let index = 0; index < scenario.steps.length; index += 1) {
      const step = scenario.steps[index];
      const actualDelay = step.delayMs ? Math.max(0, Math.round(step.delayMs * delayFactor)) : 0;
      if (actualDelay) {
        await wait(actualDelay);
      }
      const startedStep = Date.now();
      const logEntry = {
        iteration,
        index,
        label: step.label,
        action: step.action,
        startedAt: startedStep,
        finishedAt: startedStep,
        durationMs: 0,
      };
      try {
        let result;
        switch (step.action.type) {
          case 'publish': {
            const envelope = await simulator.publish(step.action.manifest, step.action.body);
            stats.published += 1;
            result = { signature: envelope.signature, timestamp: envelope.timestamp };
            break;
          }
          case 'ingest': {
            const participant = ensureParticipant(
              step.action.participantId,
              participants,
              scenario.participants
            );
            const envelope = await forgeEnvelope(step.action.manifest, step.action.body, participant.identity);
            const status = await simulator.ingest(envelope, step.action.sourcePeer ?? participant.id);
            if (status === 'accepted') {
              stats.ingested += 1;
            }
            result = { status, signature: envelope.signature };
            break;
          }
          case 'proposal': {
            const proposal = simulator.createProposal(step.action.draft, { activate: step.action.activate });
            stats.proposals += 1;
            proposals.push(proposal.id);
            lastProposalId = proposal.id;
            if (step.action.autoVote) {
              const targetOption = (() => {
                if (typeof step.action.autoVote.choiceIndex === 'number') {
                  return proposal.options[step.action.autoVote.choiceIndex]?.id;
                }
                return proposal.options[0]?.id;
              })();
              simulator.voteOnProposal(proposal.id, {
                choice: targetOption,
                voter: step.action.autoVote.participantId
                  ? ensureParticipant(step.action.autoVote.participantId, participants, scenario.participants).identity.did
                  : undefined,
                comment: step.action.autoVote.comment,
              });
              stats.votes += 1;
            }
            result = { id: proposal.id, status: proposal.status };
            break;
          }
          case 'vote': {
            const targetProposalId = (() => {
              if (step.action.proposalId && step.action.proposalId !== 'latest' && step.action.proposalId !== 'last') {
                return step.action.proposalId;
              }
              return lastProposalId;
            })();
            if (!targetProposalId) {
              throw new Error('Nenhuma proposta disponível para votar');
            }
            const proposal = simulator.proposals.find((entry) => entry.id === targetProposalId);
            if (!proposal) {
              throw new Error(`Proposta ${targetProposalId} não encontrada`);
            }
            const choiceId = step.action.choiceId
              ? step.action.choiceId
              : typeof step.action.choiceIndex === 'number'
              ? proposal.options[step.action.choiceIndex]?.id
              : proposal.options[0]?.id;
            const voterDid = step.action.participantId
              ? ensureParticipant(step.action.participantId, participants, scenario.participants).identity.did
              : undefined;
            const record = simulator.voteOnProposal(proposal.id, {
              choice: choiceId,
              voter: voterDid,
              comment: step.action.comment,
            });
            stats.votes += 1;
            result = { proposalId: proposal.id, voter: record.voter };
            break;
          }
          case 'digest': {
            const digest = await simulator.generateDigest(step.action.options ?? {});
            stats.digests += 1;
            result = { posts: digest.feed.total, authors: digest.feed.uniqueAuthors };
            break;
          }
          case 'snapshot': {
            const snapshot = simulator.snapshot();
            stats.snapshots += 1;
            result = { published: snapshot.published.length, inbox: snapshot.inbox.length };
            break;
          }
          case 'sync': {
            const entries = simulator.syncFeed(step.action.options ?? {});
            stats.syncs += 1;
            result = { received: entries.length };
            break;
          }
          case 'assistance': {
            const assistance = await simulator.requestAssistance(step.action.text);
            stats.assistance += 1;
            result = assistance;
            break;
          }
          case 'ledger:transfer': {
            const receipt = simulator.recordTransfer(step.action.to, step.action.amount, step.action.memo);
            stats.transfers += 1;
            result = { tx: receipt.tx, to: receipt.to, amount: receipt.amount };
            break;
          }
          case 'wait': {
            const waitMs = Math.max(0, Math.round(step.action.durationMs * delayFactor));
            await wait(waitMs);
            stats.waits += 1;
            result = { waitedMs: waitMs };
            break;
          }
          default:
            throw new Error(`Ação de simulação não suportada: ${step.action.type}`);
        }
        logEntry.result = result;
      } catch (error) {
        stats.errors += 1;
        logEntry.error = error instanceof Error ? error.message : String(error);
      } finally {
        logEntry.finishedAt = Date.now();
        logEntry.durationMs = logEntry.finishedAt - startedStep;
        logs.push(logEntry);
        if (logStep) {
          await logStep(logEntry);
        }
      }
    }
  }

  const finishedAt = Date.now();
  const participantsList = [...participants.values()].map((participant) => ({
    id: participant.id,
    did: participant.identity.did,
    wallet: participant.identity.wallet,
    label: participant.label,
  }));

  return {
    scenario: scenario.name ?? 'simulação',
    startedAt,
    finishedAt,
    iterations,
    stats,
    logs,
    proposals,
    participants: participantsList,
    snapshot: simulator.snapshot(),
    state: simulator.exportState(),
  };
};

const createSampleScenario = () => ({
  name: 'Ciclo comunitário padrão',
  participants: [
    { id: 'mentora', label: 'Mentora Local' },
    { id: 'verificador', label: 'Verificador de Campo' },
  ],
  steps: [
    {
      label: 'Publicação inicial',
      action: {
        type: 'publish',
        manifest: {
          title: 'Relato de assembleia',
          tags: ['comunidade', 'assembleia'],
          evidence: { creationUnix: Date.now(), cameraMake: 'Fairphone', cameraModel: 'FP5', cid: randomUUID() },
        },
        body: 'Resumo colaborativo das decisões coletivas tomadas na assembleia semanal.',
      },
    },
    {
      label: 'Conteúdo recebido da mentora',
      action: {
        type: 'ingest',
        participantId: 'mentora',
        manifest: {
          title: 'Checklist de acolhimento',
          tags: ['mentoria', 'acolhimento'],
          evidence: { creationUnix: Date.now(), cid: randomUUID() },
        },
        body: 'Lista de passos para receber novos participantes e conectar com mentores.',
      },
    },
    {
      label: 'Registro de digest',
      action: {
        type: 'digest',
        options: { topTags: 3 },
      },
    },
    {
      label: 'Abertura de proposta',
      action: {
        type: 'proposal',
        draft: {
          title: 'Destinar 5% das recompensas para mentoria',
          description: 'Avaliar contribuição do tesouro para apoiar mentores ativos.',
          options: [{ label: 'Aprovar' }, { label: 'Reavaliar percentual' }],
        },
        activate: true,
        autoVote: { choiceIndex: 0 },
      },
    },
    {
      label: 'Voto do verificador',
      action: {
        type: 'vote',
        participantId: 'verificador',
        choiceIndex: 1,
      },
    },
    {
      label: 'Snapshot geral',
      action: { type: 'snapshot' },
    },
  ],
});

module.exports = {
  runScenario,
  createSampleScenario,
  CommunitySimulator,
};
