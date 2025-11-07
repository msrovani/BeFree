import { TextEncoder } from 'util';
import { randomUUID } from 'crypto';

import {
  CommunityOrchestrator,
  ContentBroadcastEnvelope,
  ContentManifest,
  ContentPipelineResult,
  DigestOptions,
  IncomingContentStatus,
  PublishOptions,
} from '../platform';
import { createIdentity, IdentityKeys, sign } from '../identity';
import { classify, moderate } from '../content';
import { summarize, extractKeywords, detectIntent } from '../ai';
import { payBFR, TransferReceipt } from '../economy';
import { ProposalDraft } from '../governance';

const encoder = new TextEncoder();

const toBase64 = (value: Uint8Array) => Buffer.from(value).toString('base64');

const wait = async (ms?: number) => {
  if (!ms || ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
};

export interface SimulationParticipantConfig {
  id: string;
  label?: string;
  identity?: IdentityKeys;
}

interface SimulationParticipant extends SimulationParticipantConfig {
  identity: IdentityKeys;
}

export type SimulationAction =
  | {
      type: 'publish';
      manifest: ContentManifest;
      body: string;
      options?: PublishOptions;
    }
  | {
      type: 'ingest';
      participantId: string;
      manifest: ContentManifest;
      body: string;
      sourcePeer?: string;
    }
  | {
      type: 'proposal';
      draft: ProposalDraft;
      activate?: boolean;
      autoVote?: { choiceIndex?: number; participantId?: string; comment?: string };
    }
  | {
      type: 'vote';
      proposalId?: string;
      choiceIndex?: number;
      choiceId?: string;
      participantId?: string;
      comment?: string;
    }
  | {
      type: 'digest';
      options?: DigestOptions;
    }
  | {
      type: 'snapshot';
    }
  | {
      type: 'sync';
      options?: { since?: number; limit?: number };
    }
  | {
      type: 'assistance';
      text: string;
    }
  | {
      type: 'ledger:transfer';
      to: string;
      amount: string | number | bigint;
      memo?: string;
    }
  | {
      type: 'wait';
      durationMs: number;
    };

export interface SimulationStep {
  label?: string;
  action: SimulationAction;
  delayMs?: number;
}

export interface SimulationScenario {
  name?: string;
  participants?: SimulationParticipantConfig[];
  steps: SimulationStep[];
}

export interface SimulationLogEntry {
  iteration: number;
  index: number;
  label?: string;
  action: SimulationAction;
  startedAt: number;
  finishedAt: number;
  durationMs: number;
  result?: unknown;
  error?: string;
}

export interface SimulationStats {
  published: number;
  ingested: number;
  proposals: number;
  votes: number;
  digests: number;
  snapshots: number;
  assistance: number;
  syncs: number;
  transfers: number;
  waits: number;
  errors: number;
}

export interface SimulationAbortSignal {
  readonly aborted?: boolean;
}

export interface SimulationOptions {
  iterations?: number;
  delayMultiplier?: number;
  onStep?: (entry: SimulationLogEntry) => void | Promise<void>;
  signal?: SimulationAbortSignal;
}

export interface SimulationReport {
  scenario: string;
  startedAt: number;
  finishedAt: number;
  iterations: number;
  stats: SimulationStats;
  logs: SimulationLogEntry[];
  proposals: string[];
  participants: Array<{ id: string; did: string; wallet: string; label?: string }>;
}

const ensureParticipant = (
  id: string,
  pool: Map<string, SimulationParticipant>,
  configs: SimulationParticipantConfig[]
) => {
  let participant = pool.get(id);
  if (participant) return participant;
  const config = configs.find((entry) => entry.id === id);
  const identity = config?.identity ?? createIdentity(randomUUID(), config?.label ?? id);
  participant = {
    id,
    label: config?.label,
    identity: { ...identity, label: config?.label ?? identity.label },
  };
  pool.set(id, participant);
  return participant;
};

const forgeEnvelope = async (
  manifest: ContentManifest,
  body: string,
  author: IdentityKeys
): Promise<ContentBroadcastEnvelope> => {
  const selo = await classify(manifest);
  const moderation = await moderate(manifest);
  const summary = await summarize(body);
  const keywords = await extractKeywords(body);
  const intent = await detectIntent(body);
  const result: ContentPipelineResult = {
    selo,
    moderation,
    summary,
    keywords,
    intent,
  };
  const timestamp = Date.now();
  const payloadBytes = encoder.encode(JSON.stringify({ manifest, body, result, timestamp }));
  const signature = toBase64(await sign(payloadBytes, author));
  return {
    manifest,
    body,
    result,
    timestamp,
    author: {
      did: author.did,
      publicKey: author.pub,
      wallet: author.wallet,
      label: author.label,
    },
    signature,
  };
};

const resolveProposal = async (
  orchestrator: CommunityOrchestrator,
  proposalId?: string,
  lastProposalId?: string
) => {
  if (proposalId && proposalId !== 'latest' && proposalId !== 'last') {
    const specific = await orchestrator.getGovernanceProposal(proposalId);
    if (!specific) throw new Error(`Proposta ${proposalId} não encontrada`);
    return specific;
  }
  if (lastProposalId) {
    const latest = await orchestrator.getGovernanceProposal(lastProposalId);
    if (latest) return latest;
  }
  const proposals = await orchestrator.getGovernanceProposals();
  if (!proposals.length) throw new Error('Nenhuma proposta disponível para votar');
  return proposals[proposals.length - 1]!;
};

const toChoiceId = (
  proposal: Awaited<ReturnType<CommunityOrchestrator['getGovernanceProposal']>>,
  action: Extract<SimulationAction, { type: 'vote' }> | { autoVote?: { choiceIndex?: number } }
) => {
  if (!proposal) throw new Error('Proposta inválida');
  const options = proposal.options ?? [];
  let optionId: string | undefined;
  if ('choiceId' in action && action.choiceId) {
    optionId = action.choiceId;
  } else if ('choiceIndex' in action && typeof action.choiceIndex === 'number') {
    optionId = options[action.choiceIndex]?.id;
  } else if ('autoVote' in action && action.autoVote && typeof action.autoVote.choiceIndex === 'number') {
    optionId = options[action.autoVote.choiceIndex]?.id;
  } else {
    optionId = options[0]?.id;
  }
  if (!optionId) throw new Error('Opção de voto inválida');
  return optionId;
};

const summarizeParticipant = (participant: SimulationParticipant) => ({
  id: participant.id,
  did: participant.identity.did,
  wallet: participant.identity.wallet,
  label: participant.identity.label,
});

export const runSimulation = async (
  orchestrator: CommunityOrchestrator,
  scenario: SimulationScenario,
  options: SimulationOptions = {}
): Promise<SimulationReport> => {
  const startedAt = Date.now();
  const logs: SimulationLogEntry[] = [];
  const participantsPool = new Map<string, SimulationParticipant>();
  const stats: SimulationStats = {
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
  };
  const proposals: string[] = [];
  const iterations = Math.max(1, Math.trunc(options.iterations ?? 1));
  const delayFactor = options.delayMultiplier ?? 1;
  let lastProposalId: string | undefined;

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    for (let index = 0; index < scenario.steps.length; index += 1) {
      if (options.signal?.aborted) {
        throw new Error('Simulação interrompida via sinal externo');
      }
      const step = scenario.steps[index]!;
      const actualDelay = step.delayMs ? Math.max(0, Math.round(step.delayMs * delayFactor)) : 0;
      if (actualDelay) {
        await wait(actualDelay);
      }
      const started = Date.now();
      const logEntry: SimulationLogEntry = {
        iteration,
        index,
        label: step.label,
        action: step.action,
        startedAt: started,
        finishedAt: started,
        durationMs: 0,
      };
      try {
        let result: unknown;
        switch (step.action.type) {
          case 'publish': {
            const envelope = await orchestrator.publishContent(
              step.action.manifest,
              step.action.body,
              step.action.options
            );
            stats.published += 1;
            result = { signature: envelope.signature, timestamp: envelope.timestamp };
            break;
          }
          case 'ingest': {
            const participant = ensureParticipant(
              step.action.participantId,
              participantsPool,
              scenario.participants ?? []
            );
            const envelope = await forgeEnvelope(step.action.manifest, step.action.body, participant.identity);
            const status: IncomingContentStatus = await orchestrator.ingestContent(envelope, {
              sourcePeer: step.action.sourcePeer ?? participant.id,
            });
            if (status === 'accepted') {
              stats.ingested += 1;
            }
            result = { status, signature: envelope.signature };
            break;
          }
          case 'proposal': {
            const proposal = await orchestrator.createProposal(step.action.draft, {
              activate: step.action.activate,
            });
            stats.proposals += 1;
            proposals.push(proposal.id);
            lastProposalId = proposal.id;
            if (step.action.autoVote) {
              const choiceId = toChoiceId(proposal, step.action);
              const voter = step.action.autoVote.participantId
                ? ensureParticipant(step.action.autoVote.participantId, participantsPool, scenario.participants ?? []).identity.did
                : undefined;
              await orchestrator.voteOnProposal(proposal.id, {
                choice: choiceId,
                voter,
                comment: step.action.autoVote.comment,
              });
              stats.votes += 1;
            }
            result = { id: proposal.id, status: proposal.status };
            break;
          }
          case 'vote': {
            const proposal = await resolveProposal(orchestrator, step.action.proposalId, lastProposalId);
            const choiceId = step.action.choiceId ?? toChoiceId(proposal, step.action);
            const voter = step.action.participantId
              ? ensureParticipant(step.action.participantId, participantsPool, scenario.participants ?? []).identity.did
              : undefined;
            const record = await orchestrator.voteOnProposal(proposal.id, {
              choice: choiceId,
              voter,
              comment: step.action.comment,
            });
            stats.votes += 1;
            result = { proposalId: proposal.id, voter: record.voter };
            break;
          }
          case 'digest': {
            const digest = await orchestrator.generateDigest(step.action.options);
            stats.digests += 1;
            result = { posts: digest.feed.total, authors: digest.feed.uniqueAuthors };
            break;
          }
          case 'snapshot': {
            const snapshot = await orchestrator.snapshot();
            stats.snapshots += 1;
            result = { published: snapshot.published.length, inbox: snapshot.inbox.length };
            break;
          }
          case 'sync': {
            const entries = await orchestrator.syncFeed(step.action.options ?? {});
            stats.syncs += 1;
            result = { received: entries.length };
            break;
          }
          case 'assistance': {
            const assistance = await orchestrator.requestAssistance(step.action.text);
            stats.assistance += 1;
            result = assistance;
            break;
          }
          case 'ledger:transfer': {
            const receipt: TransferReceipt = await payBFR(
              step.action.to,
              step.action.amount,
              step.action.memo
            );
            stats.transfers += 1;
            result = { tx: receipt.tx, to: receipt.to, amount: receipt.amount.toString() };
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
            throw new Error(`Ação de simulação não suportada: ${(step.action as { type: string }).type}`);
        }
        logEntry.result = result;
      } catch (error) {
        stats.errors += 1;
        logEntry.error = error instanceof Error ? error.message : String(error);
      } finally {
        logEntry.finishedAt = Date.now();
        logEntry.durationMs = logEntry.finishedAt - started;
        logs.push(logEntry);
        if (options.onStep) {
          await options.onStep(logEntry);
        }
      }
    }
  }

  const finishedAt = Date.now();
  const participants = [...participantsPool.values()].map(summarizeParticipant);

  return {
    scenario: scenario.name ?? 'simulação',
    startedAt,
    finishedAt,
    iterations,
    stats,
    logs,
    proposals,
    participants,
  };
};

export const createSampleScenario = (): SimulationScenario => ({
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
