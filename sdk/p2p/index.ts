import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

export interface PeerMetadata {
  device?: string;
  region?: string;
  [key: string]: string | undefined;
}

export interface PeerInfo {
  id: string;
  multiaddrs: string[];
  metadata: PeerMetadata;
}

export interface Message<T = unknown> {
  id: string;
  from: string;
  type: string;
  payload: T;
  timestamp: number;
}

type RequestResolver = (value: Message | PromiseLike<Message>) => void;
type RequestRejecter = (reason?: unknown) => void;

const inMemoryNetworks = new Map<string, Set<P2PNode>>();

export class P2PNode extends EventEmitter {
  public readonly id: string;
  public readonly metadata: PeerMetadata;
  private readonly multiaddrs: string[];
  private started = false;
  private knownPeers = new Map<string, PeerInfo>();
  private pending = new Map<string, { resolve: RequestResolver; reject: RequestRejecter; timeout: NodeJS.Timeout }>();

  constructor(metadata: PeerMetadata = {}, multiaddrs: string[] = []) {
    super();
    this.id = randomUUID();
    this.metadata = metadata;
    this.multiaddrs = multiaddrs;
  }

  async start(network = 'befree') {
    if (this.started) return this;
    this.started = true;

    if (!inMemoryNetworks.has(network)) {
      inMemoryNetworks.set(network, new Set());
    }
    const peers = inMemoryNetworks.get(network)!;
    peers.add(this);

    peers.forEach((peer) => {
      if (peer === this) return;
      const info = peer.getPeerInfo();
      this.knownPeers.set(info.id, info);
      peer.knownPeers.set(this.id, this.getPeerInfo());
      peer.emit('peer:join', this.getPeerInfo());
    });

    this.emit('started', this.getPeerInfo());
    return this;
  }

  async stop(network = 'befree') {
    if (!this.started) return;
    this.started = false;
    const peers = inMemoryNetworks.get(network);
    peers?.delete(this);
    peers?.forEach((peer) => {
      peer.knownPeers.delete(this.id);
      peer.emit('peer:left', this.id);
    });
    this.knownPeers.clear();
    this.pending.forEach(({ reject, timeout }, id) => {
      clearTimeout(timeout);
      reject(new Error(`Node stopped before request ${id} resolved`));
    });
    this.pending.clear();
    this.emit('stopped', this.id);
  }

  getPeerInfo(): PeerInfo {
    return {
      id: this.id,
      multiaddrs: [...this.multiaddrs],
      metadata: { ...this.metadata },
    };
  }

  getPeers(): PeerInfo[] {
    return [...this.knownPeers.values()].map((peer) => ({
      id: peer.id,
      multiaddrs: [...peer.multiaddrs],
      metadata: { ...peer.metadata },
    }));
  }

  broadcast<T = unknown>(type: string, payload: T) {
    const message: Message<T> = {
      id: randomUUID(),
      from: this.id,
      type,
      payload,
      timestamp: Date.now(),
    };
    this.emit('message:out', message);
    this.knownPeers.forEach((_, peerId) => {
      this.dispatchToPeer(peerId, message);
    });
  }

  request<T = unknown>(type: string, payload: T, { timeout = 5_000 } = {}) {
    const message: Message<T> = {
      id: randomUUID(),
      from: this.id,
      type,
      payload,
      timestamp: Date.now(),
    };
    this.emit('message:out', message);
    const peers = [...this.knownPeers.keys()];
    if (peers.length === 0) {
      return Promise.reject(new Error('No peers available to fulfill request'));
    }
    const targetId = peers[Math.floor(Math.random() * peers.length)];
    this.dispatchToPeer(targetId, message);

    return new Promise<Message>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(message.id);
        reject(new Error(`Request ${message.id} timed out after ${timeout}ms`));
      }, timeout);
      this.pending.set(message.id, { resolve, reject, timeout: timer });
    });
  }

  respond<T = unknown>(request: Message<T>, payload: unknown) {
    const reply: Message = {
      id: request.id,
      from: this.id,
      type: `${request.type}:response`,
      payload,
      timestamp: Date.now(),
    };
    this.dispatchToPeer(request.from, reply);
  }

  private dispatchToPeer(peerId: string, message: Message) {
    const peer = [...inMemoryNetworks.values()].flatMap((set) => [...set]).find((p) => p.id === peerId);
    if (!peer) return;
    process.nextTick(() => peer.handleIncoming(message));
  }

  private handleIncoming(message: Message) {
    if (this.pending.has(message.id)) {
      const pending = this.pending.get(message.id)!;
      clearTimeout(pending.timeout);
      pending.resolve(message);
      this.pending.delete(message.id);
      return;
    }
    this.emit('message:in', message);
    this.emit(`message:${message.type}`, message);
  }
}

export const connect = async (metadata?: PeerMetadata, multiaddrs?: string[]) =>
  new P2PNode(metadata, multiaddrs).start();
