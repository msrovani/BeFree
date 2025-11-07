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

  constructor(options: OrchestratorOptions = {}) {
    super();
    this.options = options;
    this.identity = options.identity ?? createIdentity(randomUUID(), options.label);
    this.network = options.network ?? 'befree';
    this.autosaveInterval = options.autosaveIntervalMs;
    importGovernanceState(undefined);
    if (typeof options.storage === 'string') {
      this.storage = createFileStorageAdapter(options.storage);
    } else {
      this.storage = options.storage;
    }
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
    if (this.restoredFromStorage) return;
    this.restoredFromStorage = true;
    if (!this.storage) {
      importIdentity(this.identity);
      importGovernanceState(undefined);
      return;
    }
    try {
      const state = await this.storage.load();
      if (!state) {
        importIdentity(this.identity);
        importGovernanceState(undefined);
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
      }
      try {
        importReputationEvents(state.reputationEvents);
      } catch (error) {
        this.emit('storage:error', error);
      }
      try {
        importGovernanceState(state.governance);
      } catch (error) {
        this.emit('storage:error', error);
      }
      this.emit('storage:restored', state);
    } catch (error) {
      this.emit('storage:error', error);
      importIdentity(this.identity);
      importGovernanceState(undefined);
    }
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
      try {
        await this.storage!.save(this.buildPersistedState());
        this.emit('storage:saved');
      } catch (error) {
        this.emit('storage:error', error);
      }
    };

    this.persisting = (this.persisting ?? Promise.resolve()).catch(() => {}).then(persist);
    return this.persisting;
  }

  private triggerPersist() {
    void this.persistState();
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
  }

  private clearAutosave() {
    if (this.autosaveHandle) {
      clearInterval(this.autosaveHandle);
      this.autosaveHandle = undefined;
    }
  }

  async start() {
    await this.ensureRestored();
    if (this.node) return this;
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
    this.node.on('peer:join', (info: PeerInfo) => this.emit('peer:join', info));
    this.node.on('peer:left', (peerId: string) => this.emit('peer:left', peerId));
    this.emit('ready', this.author);
    this.scheduleAutosave();
    return this;
  }

  async stop() {
    if (!this.node) return;
    await this.node.stop(this.network);
    this.node.removeAllListeners();
    this.node = undefined;
    this.clearAutosave();
    await this.persistState();
  }

  getPeers() {
    return this.node?.getPeers() ?? [];
  }

  async publishContent(manifest: ContentManifest, body: string, options: PublishOptions = {}) {
    await this.start();
    const selo = await classify(manifest);
    const moderation = await moderate(manifest);
    const summary = await summarize(body);
    const keywords = await extractKeywords(body);
    const intent = await detectIntent(body);

    const rewardAmount = options.rewardAmount ?? this.options.defaultReward;
    let reward: TransferReceipt | undefined;
    if (rewardAmount !== undefined) {
      reward = await payFREE(options.rewardTo ?? this.identity.did, rewardAmount, options.rewardMemo ?? this.options.rewardMemo);
    }

    const result: ContentPipelineResult = { selo, moderation, summary, keywords, reward, intent };
    const timestamp = Date.now();
    const payloadBytes = encoder.encode(JSON.stringify({ manifest, body, result, timestamp }));
    const signature = toBase64(await sign(payloadBytes, this.identity));

    recordEvent({
      did: this.identity.did,
      type: 'content',
      weight: 1 + (reward ? Math.max(0.25, toNumberSafe(reward.amount) / 1_000_000) : 0),
      timestamp,
      metadata: { selo, keywords },
    });
    if (reward) {
      recordEvent({
        did: options.rewardTo ?? this.identity.did,
        type: 'economy',
        weight: Math.max(0.5, toNumberSafe(reward.amount) / 1_000_000),
        timestamp,
        metadata: { tx: reward.tx },
      });
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
    await this.persistState();
    return envelope;
  }

  private async handleIncomingContent(envelope: ContentBroadcastEnvelope, sourcePeer?: string) {
    if (this.seenSignatures.has(envelope.signature)) {
      return;
    }
    const payloadBytes = encoder.encode(
      JSON.stringify({ manifest: envelope.manifest, body: envelope.body, result: envelope.result, timestamp: envelope.timestamp })
    );
    const valid = await verify(payloadBytes, fromBase64(envelope.signature), envelope.author.publicKey);
    if (!valid) {
      this.emit('content:invalid', envelope);
      return;
    }
    this.seenSignatures.add(envelope.signature);
    recordEvent({
      did: envelope.author.did,
      type: 'social',
      weight: 0.75,
      timestamp: Date.now(),
      metadata: { selo: envelope.result.selo },
    });
    this.inbox.push({ envelope, receivedAt: Date.now(), sourcePeer });
    this.lastSyncedAt = Math.max(this.lastSyncedAt, envelope.timestamp);
    this.emit('content:received', envelope);
    await this.persistState();
  }

  async requestAssistance(text: string): Promise<AssistanceResult> {
    const summary = await summarize(text, 2);
    const keywords = await extractKeywords(text);
    const intent = await detectIntent(text);
    return { summary, keywords, intent };
  }

  async reputationScore(did = this.identity.did) {
    return scoreFor(did);
  }

  reputationLeaders(limit = 10) {
    return leaderboard(limit);
  }

  ledgerHistory() {
    return readLedgerHistory();
  }

  getPublishedFeed(limit?: number) {
    const ordered = [...this.publishedFeed].sort((a, b) => a.timestamp - b.timestamp);
    if (typeof limit === 'number' && limit > 0) {
      return ordered.slice(-limit);
    }
    return ordered;
  }

  getInbox(options: { limit?: number; since?: number } = {}) {
    const { limit, since = 0 } = options;
    const filtered = this.inbox
      .filter((entry) => entry.envelope.timestamp > since)
      .sort((a, b) => a.envelope.timestamp - b.envelope.timestamp);
    if (typeof limit === 'number' && limit > 0) {
      return filtered.slice(-limit);
    }
    return filtered;
  }

  clearInbox(predicate?: (entry: InboxEntry) => boolean) {
    if (!predicate) {
      this.inbox.length = 0;
      this.triggerPersist();
      return;
    }
    for (let i = this.inbox.length - 1; i >= 0; i -= 1) {
      if (predicate(this.inbox[i]!)) {
        this.inbox.splice(i, 1);
      }
    }
    this.triggerPersist();
  }

  async createProposal(draft: ProposalDraft, options: { activate?: boolean } = {}) {
    await this.ensureRestored();
    const proposal = createGovernanceProposal(this.identity.did, draft);
    this.emit('governance:proposal:created', proposal);
    let finalProposal = proposal;
    if (options.activate && proposal.status !== 'active') {
      finalProposal = activateGovernanceProposal(proposal.id);
      this.emit('governance:proposal:activated', finalProposal);
    } else if (proposal.status === 'active') {
      this.emit('governance:proposal:activated', proposal);
    }
    this.triggerPersist();
    return finalProposal;
  }

  async activateProposal(proposalId: string) {
    await this.ensureRestored();
    const proposal = activateGovernanceProposal(proposalId);
    this.emit('governance:proposal:activated', proposal);
    this.triggerPersist();
    return proposal;
  }

  async cancelProposal(proposalId: string) {
    await this.ensureRestored();
    const proposal = cancelGovernanceProposal(proposalId);
    this.emit('governance:proposal:cancelled', proposal);
    this.triggerPersist();
    return proposal;
  }

  async closeProposal(proposalId: string) {
    await this.ensureRestored();
    const proposal = closeGovernanceProposal(proposalId);
    this.emit('governance:proposal:closed', proposal);
    this.triggerPersist();
    return proposal;
  }

  async voteOnProposal(proposalId: string, vote: ProposalVoteOptions) {
    await this.ensureRestored();
    const record = voteOnGovernanceProposal(proposalId, {
      ...vote,
      voter: vote.voter ?? this.identity.did,
    } as GovernanceVoteInput);
    this.emit('governance:proposal:voted', record);
    this.triggerPersist();
    return record;
  }

  async getGovernanceProposals(options: { status?: ProposalStatus } = {}) {
    await this.ensureRestored();
    return listGovernanceProposals(options);
  }

  async getGovernanceProposal(proposalId: string) {
    await this.ensureRestored();
    return getGovernanceProposalById(proposalId);
  }

  async syncFeed(options: { since?: number; limit?: number } = {}) {
    await this.start();
    if (!this.node) return [] as ContentBroadcastEnvelope[];
    const requestSince = options.since ?? this.lastSyncedAt;
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
      return fresh;
    } catch (error) {
      this.emit('content:error', error);
      return [];
    }
  }

  async generateDigest(options: DigestOptions = {}): Promise<CommunityDigest> {
    await this.ensureRestored();
    const digest = await buildCommunityDigest(this.getPublishedFeed(), this.getInbox(), {
      ...options,
      reputationResolver: options.reputationResolver ?? ((did: string) => scoreFor(did)),
    });
    this.emit('analytics:digest', digest);
    return digest;
  }

  async snapshot(): Promise<OrchestratorSnapshot> {
    await this.ensureRestored();
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
  }

  async saveState() {
    await this.persistState();
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
