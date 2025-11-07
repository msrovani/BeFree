import { promises as fs } from 'fs';
import { dirname } from 'path';
import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { TextEncoder } from 'util';

import { createIdentity, IdentityKeys, sign, verify, importIdentity } from '../identity';
import { Message, P2PNode, PeerInfo } from '../p2p';
import { summarize, extractKeywords, detectIntent } from '../ai';
import { classify, moderate, ContentManifest, ModerationFlag, Selo } from '../content';
import {
  payFREE,
  history as readLedgerHistory,
  TransferReceipt,
  exportLedgerState,
  importLedgerState,
  SerializedLedgerState,
  SerializedTransferReceipt,
} from '../economy';
import {
  leaderboard,
  recordEvent,
  scoreFor,
  exportReputationEvents,
  importReputationEvents,
  ReputationEvent,
} from '../reputation';
import {
  createProposal as createGovernanceProposal,
  activateProposal as activateGovernanceProposal,
  cancelProposal as cancelGovernanceProposal,
  closeProposal as closeGovernanceProposal,
  voteOnProposal as voteOnGovernanceProposal,
  listProposals as listGovernanceProposals,
  getProposalById as getGovernanceProposalById,
  exportGovernanceState,
  importGovernanceState,
  Proposal,
  ProposalDraft,
  ProposalOutcome,
  ProposalStatus,
  VoteRecord as GovernanceVoteRecord,
  VoteInput as GovernanceVoteInput,
  SerializedGovernanceState,
} from '../governance';
import { buildCommunityDigest } from '../analytics';
import type { DigestOptions, CommunityDigest } from '../analytics';
import {
  AutomationEngine,
  type AutomationTask,
  type AutomationTaskStatus,
  type AutomationJob,
  type RegisteredAutomationJob,
  type AutomationEvent,
} from '../automation';
import {
  TelemetryCollector,
  type TelemetryCollectorOptions,
  type TelemetrySnapshot,
} from '../telemetry';

const encoder = new TextEncoder();

const toBase64 = (value: Uint8Array) => Buffer.from(value).toString('base64');
const fromBase64 = (value: string) => new Uint8Array(Buffer.from(value, 'base64'));

const toNumberSafe = (value: bigint) => {
  const max = BigInt(Number.MAX_SAFE_INTEGER);
  if (value > max) return Number.MAX_SAFE_INTEGER;
  if (value < -max) return -Number.MAX_SAFE_INTEGER;
  return Number(value);
};

export interface OrchestratorOptions {
  identity?: IdentityKeys;
  label?: string;
  network?: string;
  multiaddrs?: string[];
  defaultReward?: string | number | bigint;
  rewardMemo?: string;
  storage?: OrchestratorStorageAdapter | string;
  autosaveIntervalMs?: number;
  telemetry?: TelemetryCollector;
  telemetryOptions?: TelemetryCollectorOptions;
}

export interface AuthorDescriptor {
  did: string;
  publicKey: string;
  wallet: string;
  label?: string;
}

export interface ContentPipelineResult {
  selo: Selo;
  moderation: ModerationFlag[];
  summary: string;
  keywords: string[];
  reward?: TransferReceipt;
  intent: string;
}

export interface ContentBroadcastEnvelope {
  manifest: ContentManifest;
  body: string;
  result: ContentPipelineResult;
  timestamp: number;
  author: AuthorDescriptor;
  signature: string;
}

export interface SerializableContentPipelineResult extends Omit<ContentPipelineResult, 'reward'> {
  reward?: SerializedTransferReceipt;
}

export interface SerializableContentBroadcastEnvelope extends Omit<ContentBroadcastEnvelope, 'result'> {
  result: SerializableContentPipelineResult;
}

export interface PublishOptions {
  rewardTo?: string;
  rewardAmount?: string | number | bigint;
  rewardMemo?: string;
}

export interface AssistanceResult {
  summary: string;
  keywords: string[];
  intent: string;
}

export type ProposalVoteOptions = Omit<GovernanceVoteInput, 'voter'> & {
  voter?: string;
};

interface FeedSyncRequestPayload {
  since?: number;
  limit?: number;
}

interface FeedSyncResponsePayload {
  entries: ContentBroadcastEnvelope[];
  lastTimestamp?: number;
}

export interface InboxEntry {
  envelope: ContentBroadcastEnvelope;
  receivedAt: number;
  sourcePeer?: string;
}

export interface SerializableInboxEntry extends Omit<InboxEntry, 'envelope'> {
  envelope: SerializableContentBroadcastEnvelope;
}

export interface OrchestratorSnapshot {
  author: AuthorDescriptor;
  published: ContentBroadcastEnvelope[];
  inbox: InboxEntry[];
  ledger: TransferReceipt[];
  reputation: number;
  governance: Proposal[];
}

export interface PersistedOrchestratorState {
  identity: IdentityKeys;
  publishedFeed: SerializableContentBroadcastEnvelope[];
  inbox: SerializableInboxEntry[];
  seenSignatures: string[];
  lastSyncedAt: number;
  ledger: SerializedLedgerState;
  reputationEvents: ReputationEvent[];
  governance: SerializedGovernanceState;
}

export interface OrchestratorStorageAdapter {
  load(): Promise<PersistedOrchestratorState | undefined>;
  save(state: PersistedOrchestratorState): Promise<void>;
}

export class CommunityOrchestrator extends EventEmitter {
  private identity: IdentityKeys;
  private node?: P2PNode;
  private readonly network: string;
  private readonly options: OrchestratorOptions;
  private readonly publishedFeed: ContentBroadcastEnvelope[] = [];
  private readonly inbox: InboxEntry[] = [];
  private readonly seenSignatures = new Set<string>();
  private lastSyncedAt = 0;
  private readonly storage?: OrchestratorStorageAdapter;
  private restoredFromStorage = false;
  private autosaveInterval?: number;
  private autosaveHandle?: NodeJS.Timeout;
  private persisting?: Promise<void>;
  private readonly automation: AutomationEngine;
  private readonly telemetry: TelemetryCollector;

  constructor(options: OrchestratorOptions = {}) {
    super();
    this.options = options;
    this.identity = options.identity ?? createIdentity(randomUUID(), options.label);
    this.network = options.network ?? 'befree';
    this.autosaveInterval = options.autosaveIntervalMs;
    this.telemetry = options.telemetry ?? new TelemetryCollector(options.telemetryOptions);
    this.telemetry.setGauge('orchestrator.autosave.interval_ms', this.autosaveInterval ?? 0);
    importGovernanceState(undefined);
    if (typeof options.storage === 'string') {
      this.storage = createFileStorageAdapter(options.storage);
    } else {
      this.storage = options.storage;
    }
    this.automation = new AutomationEngine({
      orchestrator: this,
      emit: (event, payload) => this.emit(event, payload),
      logger: async (event) => {
        this.emit('automation:log', event);
        if (event.level === 'error') {
          this.emit('automation:error', event);
        }
      },
      telemetry: this.telemetry,
    });
  }

  get author(): AuthorDescriptor {
    return {
      did: this.identity.did,
      publicKey: this.identity.pub,
      wallet: this.identity.wallet,
      label: this.identity.label,
    };
  }

  private async ensureRestored() {
    if (this.restoredFromStorage) {
      this.telemetry.increment('storage.restore.skipped');
      return;
    }
    this.restoredFromStorage = true;
    this.telemetry.increment('storage.restore.attempts');
    await this.telemetry.time('storage.restore.duration', async () => {
      if (!this.storage) {
        importIdentity(this.identity);
        importGovernanceState(undefined);
        this.telemetry.recordEvent('storage:restored', { mode: 'volatile' });
        return;
      }
      try {
        const state = await this.storage.load();
        if (!state) {
          importIdentity(this.identity);
          importGovernanceState(undefined);
          this.telemetry.recordEvent('storage:restored', { mode: 'empty' });
          return;
        }
        if (!this.options.identity) {
          this.identity = importIdentity(state.identity);
        } else {
          importIdentity(this.identity);
        }
        this.publishedFeed.length = 0;
        this.publishedFeed.push(...(state.publishedFeed ?? []).map((entry) => this.deserializeEnvelope(entry)));
        this.inbox.length = 0;
        this.inbox.push(...(state.inbox ?? []).map((entry) => this.deserializeInboxEntry(entry)));
        this.seenSignatures.clear();
        (state.seenSignatures ?? []).forEach((signature) => this.seenSignatures.add(signature));
        this.lastSyncedAt = state.lastSyncedAt ?? 0;
        try {
          importLedgerState(state.ledger);
        } catch (error) {
          this.emit('storage:error', error);
          this.telemetry.increment('storage.restore.ledger.errors');
        }
        try {
          importReputationEvents(state.reputationEvents);
        } catch (error) {
          this.emit('storage:error', error);
          this.telemetry.increment('storage.restore.reputation.errors');
        }
        try {
          importGovernanceState(state.governance);
        } catch (error) {
          this.emit('storage:error', error);
          this.telemetry.increment('storage.restore.governance.errors');
        }
        this.telemetry.recordEvent('storage:restored', {
          mode: 'persisted',
          published: state.publishedFeed?.length ?? 0,
          inbox: state.inbox?.length ?? 0,
        });
        this.emit('storage:restored', state);
      } catch (error) {
        this.emit('storage:error', error);
        this.telemetry.increment('storage.restore.errors');
        importIdentity(this.identity);
        importGovernanceState(undefined);
      }
    });
  }

  private buildPersistedState(): PersistedOrchestratorState {
    return {
      identity: this.identity,
      publishedFeed: this.publishedFeed.map((entry) => this.serializeEnvelope(entry)),
      inbox: this.inbox.map((entry) => this.serializeInboxEntry(entry)),
      seenSignatures: Array.from(this.seenSignatures),
      lastSyncedAt: this.lastSyncedAt,
      ledger: exportLedgerState(),
      reputationEvents: exportReputationEvents(),
      governance: exportGovernanceState(),
    };
  }

  private persistState() {
    if (!this.storage) return Promise.resolve();
    const persist = async () => {
      this.telemetry.increment('storage.persist.attempts');
      try {
        await this.telemetry.time('storage.persist.duration', async () => {
          await this.storage!.save(this.buildPersistedState());
        });
        this.telemetry.recordEvent('storage:saved');
        this.emit('storage:saved');
      } catch (error) {
        this.telemetry.increment('storage.persist.errors');
        this.emit('storage:error', error);
      }
    };

    this.persisting = (this.persisting ?? Promise.resolve()).catch(() => {}).then(persist);
    return this.persisting;
  }

  private triggerPersist() {
    this.telemetry.increment('storage.persist.requested');
    void this.persistState();
  }

  private dispatchAutomation(event: AutomationEvent) {
    this.telemetry.increment('automation.dispatches');
    this.telemetry.increment(`automation.dispatches.${event.type}`);
    this.telemetry.recordEvent('automation:dispatch', { type: event.type });
    void this.automation.handle(event);
  }

  private serializeEnvelope(envelope: ContentBroadcastEnvelope): SerializableContentBroadcastEnvelope {
    return {
      ...envelope,
      result: {
        ...envelope.result,
        reward: envelope.result.reward
          ? { ...envelope.result.reward, amount: envelope.result.reward.amount.toString() }
          : undefined,
      },
    };
  }

  private deserializeEnvelope(envelope: SerializableContentBroadcastEnvelope): ContentBroadcastEnvelope {
    return {
      ...envelope,
      result: {
        ...envelope.result,
        reward: envelope.result.reward
          ? { ...envelope.result.reward, amount: BigInt(envelope.result.reward.amount) }
          : undefined,
      },
    };
  }

  private serializeInboxEntry(entry: InboxEntry): SerializableInboxEntry {
    return {
      ...entry,
      envelope: this.serializeEnvelope(entry.envelope),
    };
  }

  private deserializeInboxEntry(entry: SerializableInboxEntry): InboxEntry {
    return {
      ...entry,
      envelope: this.deserializeEnvelope(entry.envelope),
    };
  }

  private scheduleAutosave() {
    if (!this.storage) return;
    if (!this.autosaveInterval || this.autosaveInterval <= 0) return;
    if (this.autosaveHandle) return;
    this.autosaveHandle = setInterval(() => {
      this.triggerPersist();
    }, this.autosaveInterval);
    this.telemetry.increment('orchestrator.autosave.enabled');
    this.telemetry.setGauge('orchestrator.autosave.interval_ms', this.autosaveInterval ?? 0);
    this.telemetry.recordEvent('orchestrator:autosave:enabled', { intervalMs: this.autosaveInterval });
  }

  private clearAutosave() {
    if (this.autosaveHandle) {
      clearInterval(this.autosaveHandle);
      this.autosaveHandle = undefined;
      this.telemetry.increment('orchestrator.autosave.disabled');
      this.telemetry.setGauge('orchestrator.autosave.interval_ms', 0);
      this.telemetry.recordEvent('orchestrator:autosave:disabled');
    }
  }

  async start() {
    this.telemetry.increment('orchestrator.start.calls');
    await this.ensureRestored();
    if (this.node) {
      this.telemetry.increment('orchestrator.start.skipped');
      return this;
    }
    await this.telemetry.time('orchestrator.start.duration', async () => {
      this.node = await new P2PNode({ agent: 'befree-orchestrator', label: this.identity.label }, this.options.multiaddrs).start(
        this.network
      );
      this.node.on('message:content:new', (message: Message<ContentBroadcastEnvelope>) => {
        this.handleIncomingContent(message.payload, message.from).catch((error) => this.emit('content:error', error));
      });
      this.node.on('message:content:feed:request', (message: Message<FeedSyncRequestPayload>) => {
        const { since = 0, limit = 50 } = message.payload ?? {};
        const ordered = [...this.publishedFeed].sort((a, b) => a.timestamp - b.timestamp);
        const filtered = ordered.filter((entry) => entry.timestamp > since);
        const entries = limit > 0 ? filtered.slice(-limit) : filtered;
        this.node?.respond(message, {
          entries,
          lastTimestamp: entries.length ? entries[entries.length - 1].timestamp : since,
        });
      });
      this.node.on('peer:join', (info: PeerInfo) => {
        this.telemetry.increment('p2p.peer.joined');
        this.emit('peer:join', info);
      });
      this.node.on('peer:left', (peerId: string) => {
        this.telemetry.increment('p2p.peer.left');
        this.emit('peer:left', peerId);
      });
    });
    this.telemetry.recordEvent('orchestrator:started', {
      network: this.network,
      peers: this.getPeers().length,
    });
    this.emit('ready', this.author);
    this.scheduleAutosave();
    return this;
  }

  async stop() {
    if (!this.node) {
      this.telemetry.increment('orchestrator.stop.skipped');
      return;
    }
    this.telemetry.increment('orchestrator.stop.calls');
    await this.telemetry.time('orchestrator.stop.duration', async () => {
      await this.node?.stop(this.network);
      this.node?.removeAllListeners();
      this.node = undefined;
      this.clearAutosave();
      this.automation.stopAllJobs();
      await this.persistState();
    });
    this.telemetry.recordEvent('orchestrator:stopped');
  }

  getPeers() {
    return this.node?.getPeers() ?? [];
  }

  async publishContent(manifest: ContentManifest, body: string, options: PublishOptions = {}) {
    await this.start();
    this.telemetry.increment('content.publish.attempts');
    try {
      const envelope = await this.telemetry.time('content.publish.duration', async () => {
        const selo = await classify(manifest);
        const moderation = await moderate(manifest);
        const summary = await summarize(body);
        const keywords = await extractKeywords(body);
        const intent = await detectIntent(body);

        const rewardAmount = options.rewardAmount ?? this.options.defaultReward;
        let reward: TransferReceipt | undefined;
        if (rewardAmount !== undefined) {
          reward = await payFREE(
            options.rewardTo ?? this.identity.did,
            rewardAmount,
            options.rewardMemo ?? this.options.rewardMemo
          );
        }

        const result: ContentPipelineResult = { selo, moderation, summary, keywords, reward, intent };
        const timestamp = Date.now();
        const payloadBytes = encoder.encode(JSON.stringify({ manifest, body, result, timestamp }));
        const signature = toBase64(await sign(payloadBytes, this.identity));

        const contentEvent: ReputationEvent = {
          did: this.identity.did,
          type: 'content',
          weight: 1 + (reward ? Math.max(0.25, toNumberSafe(reward.amount) / 1_000_000) : 0),
          timestamp,
          metadata: { selo, keywords },
        };
        recordEvent(contentEvent);
        this.dispatchAutomation({ type: 'reputation:event', event: contentEvent });
        if (reward) {
          const economyEvent: ReputationEvent = {
            did: options.rewardTo ?? this.identity.did,
            type: 'economy',
            weight: Math.max(0.5, toNumberSafe(reward.amount) / 1_000_000),
            timestamp,
            metadata: { tx: reward.tx },
          };
          recordEvent(economyEvent);
          this.dispatchAutomation({ type: 'reputation:event', event: economyEvent });
          this.dispatchAutomation({ type: 'ledger:transfer', receipt: reward });
        }

        const envelope: ContentBroadcastEnvelope = {
          manifest,
          body,
          result,
          timestamp,
          author: this.author,
          signature,
        };

        this.seenSignatures.add(signature);
        this.publishedFeed.push(envelope);

        this.node?.broadcast('content:new', envelope);
        this.emit('content:published', envelope);
        this.dispatchAutomation({ type: 'content:published', envelope });
        await this.persistState();
        return envelope;
      });
      this.telemetry.increment('content.publish.success');
      this.telemetry.recordEvent('content:published', {
        selo: envelope.result.selo,
        reward: envelope.result.reward?.amount?.toString(),
        tags: manifest.tags?.length ?? 0,
      });
      return envelope;
    } catch (error) {
      this.telemetry.increment('content.publish.errors');
      this.telemetry.recordEvent('content:publish:error', {
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async handleIncomingContent(envelope: ContentBroadcastEnvelope, sourcePeer?: string) {
    this.telemetry.increment('content.receive.attempts');
    if (this.seenSignatures.has(envelope.signature)) {
      this.telemetry.increment('content.receive.duplicates');
      return;
    }
    const started = Date.now();
    const payloadBytes = encoder.encode(
      JSON.stringify({ manifest: envelope.manifest, body: envelope.body, result: envelope.result, timestamp: envelope.timestamp })
    );
    const valid = await verify(payloadBytes, fromBase64(envelope.signature), envelope.author.publicKey);
    if (!valid) {
      this.emit('content:invalid', envelope);
      this.dispatchAutomation({ type: 'content:invalid', envelope });
      this.telemetry.increment('content.receive.invalid');
      this.telemetry.recordEvent('content:invalid', { author: envelope.author.did });
      this.telemetry.observe('content.receive.duration', Date.now() - started);
      return;
    }
    this.seenSignatures.add(envelope.signature);
    const socialEvent: ReputationEvent = {
      did: envelope.author.did,
      type: 'social',
      weight: 0.75,
      timestamp: Date.now(),
      metadata: { selo: envelope.result.selo },
    };
    recordEvent(socialEvent);
    this.dispatchAutomation({ type: 'reputation:event', event: socialEvent });
    this.inbox.push({ envelope, receivedAt: Date.now(), sourcePeer });
    this.lastSyncedAt = Math.max(this.lastSyncedAt, envelope.timestamp);
    this.emit('content:received', envelope);
    this.dispatchAutomation({ type: 'content:received', envelope, sourcePeer });
    this.telemetry.increment('content.receive.success');
    this.telemetry.recordEvent('content:received', {
      author: envelope.author.did,
      selo: envelope.result.selo,
      sourcePeer,
    });
    await this.persistState();
    this.telemetry.observe('content.receive.duration', Date.now() - started);
  }

  async requestAssistance(text: string): Promise<AssistanceResult> {
    this.telemetry.increment('ai.assistance.requests');
    const result = await this.telemetry.time('ai.assistance.duration', async () => {
      const summary = await summarize(text, 2);
      const keywords = await extractKeywords(text);
      const intent = await detectIntent(text);
      return { summary, keywords, intent };
    });
    this.telemetry.recordEvent('ai:assistance', {
      keywords: result.keywords.length,
      summaryLength: result.summary.length,
    });
    return result;
  }

  async reputationScore(did = this.identity.did) {
    this.telemetry.increment('reputation.score.lookups');
    const value = await scoreFor(did);
    this.telemetry.recordEvent('reputation:score', { did, score: value });
    return value;
  }

  reputationLeaders(limit = 10) {
    this.telemetry.increment('reputation.leaderboard.lookups');
    const leaders = leaderboard(limit);
    this.telemetry.recordEvent('reputation:leaderboard', { total: leaders.length });
    return leaders;
  }

  ledgerHistory() {
    this.telemetry.increment('ledger.history.lookups');
    const history = readLedgerHistory();
    this.telemetry.recordEvent('ledger:history', { total: history.length });
    return history;
  }

  getPublishedFeed(limit?: number) {
    this.telemetry.increment('content.feed.reads');
    const ordered = [...this.publishedFeed].sort((a, b) => a.timestamp - b.timestamp);
    if (typeof limit === 'number' && limit > 0) {
      const result = ordered.slice(-limit);
      this.telemetry.recordEvent('content:feed:read', { total: result.length, limit });
      return result;
    }
    this.telemetry.recordEvent('content:feed:read', { total: ordered.length });
    return ordered;
  }

  getInbox(options: { limit?: number; since?: number } = {}) {
    this.telemetry.increment('content.inbox.reads');
    const { limit, since = 0 } = options;
    const filtered = this.inbox
      .filter((entry) => entry.envelope.timestamp > since)
      .sort((a, b) => a.envelope.timestamp - b.envelope.timestamp);
    if (typeof limit === 'number' && limit > 0) {
      const result = filtered.slice(-limit);
      this.telemetry.recordEvent('content:inbox:read', { total: result.length, limit, since });
      return result;
    }
    this.telemetry.recordEvent('content:inbox:read', { total: filtered.length, since });
    return filtered;
  }

  clearInbox(predicate?: (entry: InboxEntry) => boolean) {
    const before = this.inbox.length;
    if (!predicate) {
      this.inbox.length = 0;
      this.triggerPersist();
      this.telemetry.increment('content.inbox.cleared');
      this.telemetry.recordEvent('content:inbox:cleared', { removed: before });
      return;
    }
    for (let i = this.inbox.length - 1; i >= 0; i -= 1) {
      if (predicate(this.inbox[i]!)) {
        this.inbox.splice(i, 1);
      }
    }
    this.triggerPersist();
    const removed = before - this.inbox.length;
    this.telemetry.increment('content.inbox.cleared');
    this.telemetry.recordEvent('content:inbox:cleared', { removed });
  }

  async createProposal(draft: ProposalDraft, options: { activate?: boolean } = {}) {
    await this.ensureRestored();
    this.telemetry.increment('governance.proposals.create.attempts');
    const finalProposal = await this.telemetry.time('governance.proposals.create.duration', async () => {
      const proposal = createGovernanceProposal(this.identity.did, draft);
      this.emit('governance:proposal:created', proposal);
      this.dispatchAutomation({ type: 'governance:proposal:created', proposal });
      let updatedProposal = proposal;
      if (options.activate && proposal.status !== 'active') {
        updatedProposal = activateGovernanceProposal(proposal.id);
        this.emit('governance:proposal:activated', updatedProposal);
        this.dispatchAutomation({ type: 'governance:proposal:activated', proposal: updatedProposal });
      } else if (proposal.status === 'active') {
        this.emit('governance:proposal:activated', proposal);
        this.dispatchAutomation({ type: 'governance:proposal:activated', proposal });
      }
      this.triggerPersist();
      return updatedProposal;
    });
    this.telemetry.increment('governance.proposals.create.success');
    this.telemetry.recordEvent('governance:proposal:created', {
      id: finalProposal.id,
      status: finalProposal.status,
    });
    return finalProposal;
  }

  async activateProposal(proposalId: string) {
    await this.ensureRestored();
    this.telemetry.increment('governance.proposals.activate.attempts');
    const proposal = await this.telemetry.time('governance.proposals.activate.duration', async () => {
      const activated = activateGovernanceProposal(proposalId);
      this.emit('governance:proposal:activated', activated);
      this.dispatchAutomation({ type: 'governance:proposal:activated', proposal: activated });
      this.triggerPersist();
      return activated;
    });
    this.telemetry.increment('governance.proposals.activate.success');
    this.telemetry.recordEvent('governance:proposal:activated', { id: proposal.id });
    return proposal;
  }

  async cancelProposal(proposalId: string) {
    await this.ensureRestored();
    this.telemetry.increment('governance.proposals.cancel.attempts');
    const proposal = await this.telemetry.time('governance.proposals.cancel.duration', async () => {
      const cancelled = cancelGovernanceProposal(proposalId);
      this.emit('governance:proposal:cancelled', cancelled);
      this.dispatchAutomation({ type: 'governance:proposal:cancelled', proposal: cancelled });
      this.triggerPersist();
      return cancelled;
    });
    this.telemetry.increment('governance.proposals.cancel.success');
    this.telemetry.recordEvent('governance:proposal:cancelled', { id: proposal.id });
    return proposal;
  }

  async closeProposal(proposalId: string) {
    await this.ensureRestored();
    this.telemetry.increment('governance.proposals.close.attempts');
    const proposal = await this.telemetry.time('governance.proposals.close.duration', async () => {
      const closed = closeGovernanceProposal(proposalId);
      this.emit('governance:proposal:closed', closed);
      this.dispatchAutomation({ type: 'governance:proposal:closed', proposal: closed });
      this.triggerPersist();
      return closed;
    });
    this.telemetry.increment('governance.proposals.close.success');
    this.telemetry.recordEvent('governance:proposal:closed', {
      id: proposal.id,
      outcome: proposal.outcome,
    });
    return proposal;
  }

  async voteOnProposal(proposalId: string, vote: ProposalVoteOptions) {
    await this.ensureRestored();
    this.telemetry.increment('governance.votes.attempts');
    const record = await this.telemetry.time('governance.votes.duration', async () => {
      const voteRecord = voteOnGovernanceProposal(proposalId, {
        ...vote,
        voter: vote.voter ?? this.identity.did,
      } as GovernanceVoteInput);
      this.emit('governance:proposal:voted', voteRecord);
      this.dispatchAutomation({ type: 'governance:proposal:voted', vote: voteRecord });
      this.triggerPersist();
      return voteRecord;
    });
    this.telemetry.increment('governance.votes.success');
    this.telemetry.recordEvent('governance:proposal:voted', {
      proposalId,
      voter: record.voter,
    });
    return record;
  }

  registerAutomationTask(task: AutomationTask) {
    return this.automation.registerTask(task);
  }

  removeAutomationTask(taskId: string) {
    return this.automation.removeTask(taskId);
  }

  listAutomationTasks(): AutomationTaskStatus[] {
    return this.automation.listTasks();
  }

  scheduleAutomationJob(job: AutomationJob) {
    return this.automation.registerJob(job);
  }

  cancelAutomationJob(jobId: string) {
    return this.automation.cancelJob(jobId);
  }

  listAutomationJobs(): RegisteredAutomationJob[] {
    return this.automation.listJobs();
  }

  stopAutomationJobs() {
    this.automation.stopAllJobs();
  }

  clearAutomationState(key?: string) {
    this.automation.clearState(key);
  }

  getAutomationEngine() {
    return this.automation;
  }

  getTelemetry() {
    return this.telemetry;
  }

  getTelemetrySnapshot(): TelemetrySnapshot {
    return this.telemetry.snapshot();
  }

  resetTelemetry() {
    this.telemetry.reset();
  }

  scheduleDigest(options: { intervalMs: number; digestOptions?: DigestOptions; taskId?: string; immediate?: boolean }) {
    this.telemetry.increment('analytics.digests.scheduled');
    this.telemetry.recordEvent('analytics:digest:scheduled', {
      intervalMs: options.intervalMs,
      taskId: options.taskId,
    });
    const jobId = this.scheduleAutomationJob({
      id: options.taskId,
      description: 'scheduled-digest',
      intervalMs: options.intervalMs,
      immediate: options.immediate ?? true,
      run: async () => {
        const digest = await this.generateDigest(options.digestOptions ?? {});
        this.emit('analytics:digest:scheduled', digest);
      },
    });
    return jobId;
  }

  async getGovernanceProposals(options: { status?: ProposalStatus } = {}) {
    await this.ensureRestored();
    this.telemetry.increment('governance.proposals.list');
    const proposals = listGovernanceProposals(options);
    this.telemetry.recordEvent('governance:proposals:list', {
      total: proposals.length,
      status: options.status,
    });
    return proposals;
  }

  async getGovernanceProposal(proposalId: string) {
    await this.ensureRestored();
    this.telemetry.increment('governance.proposals.get');
    const proposal = getGovernanceProposalById(proposalId);
    this.telemetry.recordEvent('governance:proposal:get', {
      id: proposal?.id ?? proposalId,
      status: proposal?.status,
    });
    return proposal;
  }

  async syncFeed(options: { since?: number; limit?: number } = {}) {
    await this.start();
    if (!this.node) return [] as ContentBroadcastEnvelope[];
    const requestSince = options.since ?? this.lastSyncedAt;
    this.telemetry.increment('content.sync.attempts');
    const started = Date.now();
    try {
      const response = await this.node.request<FeedSyncRequestPayload>('content:feed:request', {
        since: requestSince,
        limit: options.limit,
      });
      const payload = response.payload as FeedSyncResponsePayload;
      const entries = (payload?.entries ?? []).filter((entry) => entry.author.did !== this.identity.did);
      const fresh: ContentBroadcastEnvelope[] = [];
      for (const entry of entries) {
        if (this.seenSignatures.has(entry.signature)) continue;
        await this.handleIncomingContent(entry);
        fresh.push(entry);
      }
      if (payload?.lastTimestamp) {
        this.lastSyncedAt = Math.max(this.lastSyncedAt, payload.lastTimestamp);
      }
      await this.persistState();
      this.telemetry.increment('content.sync.success');
      this.telemetry.recordEvent('content:sync', {
        received: fresh.length,
        since: requestSince,
      });
      this.telemetry.observe('content.sync.duration', Date.now() - started);
      return fresh;
    } catch (error) {
      this.emit('content:error', error);
      this.telemetry.increment('content.sync.errors');
      this.telemetry.recordEvent('content:sync:error', {
        message: error instanceof Error ? error.message : String(error),
      });
      this.telemetry.observe('content.sync.duration', Date.now() - started);
      return [];
    }
  }

  async generateDigest(options: DigestOptions = {}): Promise<CommunityDigest> {
    await this.ensureRestored();
    this.telemetry.increment('analytics.digests.generated');
    const digest = await this.telemetry.time('analytics.digests.duration', async () =>
      buildCommunityDigest(this.getPublishedFeed(), this.getInbox(), {
        ...options,
        reputationResolver: options.reputationResolver ?? ((did: string) => scoreFor(did)),
      })
    );
    this.emit('analytics:digest', digest);
    this.dispatchAutomation({ type: 'analytics:digest', digest });
    this.telemetry.recordEvent('analytics:digest', {
      posts: digest.feed.total,
      authors: digest.feed.uniqueAuthors,
    });
    return digest;
  }

  async snapshot(): Promise<OrchestratorSnapshot> {
    await this.ensureRestored();
    this.telemetry.increment('orchestrator.snapshot.requests');
    const snapshot = await this.telemetry.time('orchestrator.snapshot.duration', async () => {
      const reputation = await this.reputationScore();
      const governance = await this.getGovernanceProposals();
      return {
        author: this.author,
        published: this.getPublishedFeed(),
        inbox: this.getInbox(),
        ledger: this.ledgerHistory(),
        reputation,
        governance,
      };
    });
    this.telemetry.recordEvent('orchestrator:snapshot', {
      published: snapshot.published.length,
      inbox: snapshot.inbox.length,
      governance: snapshot.governance.length,
    });
    return snapshot;
  }

  async saveState() {
    this.telemetry.increment('storage.persist.manual');
    await this.persistState();
    this.telemetry.recordEvent('storage:saved:manual');
  }
}

export const createCommunityOrchestrator = (options?: OrchestratorOptions) => new CommunityOrchestrator(options);

export type {
  Proposal,
  ProposalOutcome,
  ProposalStatus,
  GovernanceVoteRecord as ProposalVoteRecord,
} from '../governance';
export type { CommunityDigest, DigestOptions, TagTrend, AuthorPulse } from '../analytics';
export type {
  AutomationTask,
  AutomationTaskStatus,
  AutomationJob,
  RegisteredAutomationJob,
  AutomationEvent,
} from '../automation';
export { TelemetryCollector } from '../telemetry';
export type { TelemetrySnapshot, TelemetryCollectorOptions } from '../telemetry';

const ensureDirectory = async (filePath: string) => {
  await fs.mkdir(dirname(filePath), { recursive: true });
};

export const createFileStorageAdapter = (filePath: string): OrchestratorStorageAdapter => ({
  async load() {
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(raw) as PersistedOrchestratorState;
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err?.code === 'ENOENT') return undefined;
      throw error;
    }
  },
  async save(state) {
    await ensureDirectory(filePath);
    await fs.writeFile(filePath, JSON.stringify(state, null, 2), 'utf-8');
  },
});
