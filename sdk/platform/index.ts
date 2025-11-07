import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { TextEncoder } from 'util';

import { createIdentity, IdentityKeys, sign, verify } from '../identity';
import { Message, P2PNode, PeerInfo } from '../p2p';
import { summarize, extractKeywords, detectIntent } from '../ai';
import { classify, moderate, ContentManifest, ModerationFlag, Selo } from '../content';
import { payFREE, history as readLedgerHistory, TransferReceipt } from '../economy';
import { leaderboard, recordEvent, scoreFor } from '../reputation';

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

export interface OrchestratorSnapshot {
  author: AuthorDescriptor;
  published: ContentBroadcastEnvelope[];
  inbox: InboxEntry[];
  ledger: TransferReceipt[];
  reputation: number;
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

  constructor(options: OrchestratorOptions = {}) {
    super();
    this.options = options;
    this.identity = options.identity ?? createIdentity(randomUUID(), options.label);
    this.network = options.network ?? 'befree';
  }

  get author(): AuthorDescriptor {
    return {
      did: this.identity.did,
      publicKey: this.identity.pub,
      wallet: this.identity.wallet,
      label: this.identity.label,
    };
  }

  async start() {
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
    return this;
  }

  async stop() {
    if (!this.node) return;
    await this.node.stop(this.network);
    this.node.removeAllListeners();
    this.node = undefined;
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
      return;
    }
    for (let i = this.inbox.length - 1; i >= 0; i -= 1) {
      if (predicate(this.inbox[i]!)) {
        this.inbox.splice(i, 1);
      }
    }
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
      return fresh;
    } catch (error) {
      this.emit('content:error', error);
      return [];
    }
  }

  async snapshot(): Promise<OrchestratorSnapshot> {
    const reputation = await this.reputationScore();
    return {
      author: this.author,
      published: this.getPublishedFeed(),
      inbox: this.getInbox(),
      ledger: this.ledgerHistory(),
      reputation,
    };
  }
}

export const createCommunityOrchestrator = (options?: OrchestratorOptions) => new CommunityOrchestrator(options);
