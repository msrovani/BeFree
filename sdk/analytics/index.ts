import { summarize, extractKeywords } from '../ai';
import type { ContentBroadcastEnvelope, InboxEntry } from '../platform';

export interface TagTrend {
  tag: string;
  count: number;
  weight: number;
  lastTimestamp: number;
}

export interface AuthorPulse {
  did: string;
  label?: string;
  published: number;
  received: number;
  reputation?: number;
  lastActivity: number;
}

export interface DigestOptions {
  windowMs?: number;
  now?: number;
  topTags?: number;
  topAuthors?: number;
  includeInbox?: boolean;
  summarizer?: (text: string) => Promise<string>;
  keywordExtractor?: (text: string, max?: number) => Promise<string[]>;
  reputationResolver?: (did: string) => Promise<number> | number;
}

export interface CommunityDigest {
  timeframe: {
    from: number;
    to: number;
    windowMs: number;
  };
  totals: {
    published: number;
    inbox: number;
    uniqueAuthors: number;
  };
  tags: TagTrend[];
  authors: AuthorPulse[];
  highlights: {
    intents: Record<string, number>;
    keywords: string[];
    summary: string;
  };
}

interface NormalizedEntry {
  source: 'published' | 'inbox';
  timestamp: number;
  tags: string[];
  authorDid: string;
  authorLabel?: string;
  body: string;
  summary?: string;
  keywords: string[];
  intent?: string;
}

const DEFAULT_WINDOW = 1000 * 60 * 60 * 24; // 24h

const normalizeTags = (value: unknown): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((tag) => (typeof tag === 'string' ? tag.trim().toLowerCase() : undefined))
      .filter((tag): tag is string => Boolean(tag));
  }
  if (typeof value === 'string') {
    return value
      .split(/[,\s]+/)
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean);
  }
  return [];
};

const normalizeEntry = (
  envelope: ContentBroadcastEnvelope,
  source: 'published' | 'inbox'
): NormalizedEntry => ({
  source,
  timestamp: envelope.timestamp,
  tags: normalizeTags((envelope.manifest as { tags?: unknown })?.tags),
  authorDid: envelope.author.did,
  authorLabel: envelope.author.label,
  body: envelope.body,
  summary: envelope.result?.summary,
  keywords: envelope.result?.keywords ?? [],
  intent: envelope.result?.intent,
});

const decayWeight = (timestamp: number, now: number, windowMs: number) => {
  if (windowMs <= 0) return 1;
  const age = Math.max(0, now - timestamp);
  if (age === 0) return 1;
  const ratio = age / windowMs;
  return Math.exp(-ratio);
};

export const computeTagTrends = (
  feed: ContentBroadcastEnvelope[],
  inbox: ContentBroadcastEnvelope[] = [],
  options: DigestOptions = {}
): TagTrend[] => {
  const windowMs = options.windowMs ?? DEFAULT_WINDOW;
  const now = options.now ?? Date.now();
  const from = now - windowMs;
  const relevant = [...feed.map((entry) => normalizeEntry(entry, 'published')), ...inbox.map((entry) => normalizeEntry(entry, 'inbox'))]
    .filter((entry) => entry.timestamp >= from && entry.timestamp <= now);

  const trends = new Map<string, { count: number; weight: number; lastTimestamp: number }>();
  relevant.forEach((entry) => {
    const weight = decayWeight(entry.timestamp, now, windowMs);
    entry.tags.forEach((tag) => {
      const current = trends.get(tag) ?? { count: 0, weight: 0, lastTimestamp: 0 };
      trends.set(tag, {
        count: current.count + 1,
        weight: Number((current.weight + weight).toFixed(4)),
        lastTimestamp: Math.max(current.lastTimestamp, entry.timestamp),
      });
    });
  });

  return [...trends.entries()]
    .map(([tag, stats]) => ({ tag, ...stats }))
    .sort((a, b) => b.weight - a.weight || b.count - a.count || b.lastTimestamp - a.lastTimestamp)
    .slice(0, options.topTags ?? trends.size);
};

const computeAuthorPulses = async (
  entries: NormalizedEntry[],
  options: DigestOptions
): Promise<AuthorPulse[]> => {
  const windowMs = options.windowMs ?? DEFAULT_WINDOW;
  const now = options.now ?? Date.now();
  const pulses = new Map<string, AuthorPulse>();
  entries.forEach((entry) => {
    const weight = decayWeight(entry.timestamp, now, windowMs);
    const current = pulses.get(entry.authorDid) ?? {
      did: entry.authorDid,
      label: entry.authorLabel,
      published: 0,
      received: 0,
      lastActivity: 0,
    };
    if (entry.source === 'published') {
      current.published += Number(weight.toFixed(4));
    } else {
      current.received += Number(weight.toFixed(4));
    }
    current.lastActivity = Math.max(current.lastActivity, entry.timestamp);
    pulses.set(entry.authorDid, current);
  });

  const resolver = options.reputationResolver;
  if (resolver) {
    await Promise.all(
      [...pulses.values()].map(async (pulse) => {
        const value = await resolver(pulse.did);
        pulse.reputation = Number((value ?? 0).toFixed(4));
      })
    );
  }

  return [...pulses.values()].sort(
    (a, b) =>
      (b.published + b.received) - (a.published + a.received) ||
      (b.reputation ?? 0) - (a.reputation ?? 0) ||
      b.lastActivity - a.lastActivity
  );
};

export const buildCommunityDigest = async (
  feed: ContentBroadcastEnvelope[],
  inboxEntries: (ContentBroadcastEnvelope | InboxEntry)[] = [],
  options: DigestOptions = {}
): Promise<CommunityDigest> => {
  const windowMs = options.windowMs ?? DEFAULT_WINDOW;
  const now = options.now ?? Date.now();
  const includeInbox = options.includeInbox ?? true;
  const inbox = includeInbox
    ? inboxEntries.map((entry) =>
        'envelope' in entry ? (entry as InboxEntry).envelope : (entry as ContentBroadcastEnvelope)
      )
    : [];

  const normalized = [
    ...feed.map((entry) => normalizeEntry(entry, 'published')),
    ...inbox.map((entry) => normalizeEntry(entry, 'inbox')),
  ].filter((entry) => entry.timestamp >= now - windowMs && entry.timestamp <= now);

  const intents: Record<string, number> = {};
  const keywordWeights = new Map<string, number>();
  const summaryCandidates = normalized
    .slice()
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 12);

  normalized.forEach((entry) => {
    const weight = decayWeight(entry.timestamp, now, windowMs);
    if (entry.intent) {
      intents[entry.intent] = Number(((intents[entry.intent] ?? 0) + weight).toFixed(4));
    }
    entry.keywords.forEach((keyword) => {
      const current = keywordWeights.get(keyword) ?? 0;
      keywordWeights.set(keyword, current + weight);
    });
  });

  const textCorpus = summaryCandidates.map((entry) => entry.summary || entry.body).join(' ');
  const summarizer = options.summarizer ?? ((text: string) => summarize(text, 3));
  const keywordExtractor = options.keywordExtractor ?? ((text: string, max = 10) => extractKeywords(text, max));

  let keywords = [...keywordWeights.entries()]
    .map(([keyword, weight]) => ({ keyword, weight: Number(weight.toFixed(4)) }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, options.topTags ?? 10)
    .map(({ keyword }) => keyword);

  if (!keywords.length && textCorpus.trim()) {
    keywords = await keywordExtractor(textCorpus, options.topTags ?? 10);
  }

  const summary = textCorpus.trim() ? await summarizer(textCorpus) : '';

  const authors = await computeAuthorPulses(normalized, options);

  const tags = computeTagTrends(feed, inbox, options);

  const uniqueAuthors = new Set(normalized.map((entry) => entry.authorDid)).size;
  const publishedCount = normalized.filter((entry) => entry.source === 'published').length;
  const inboxCount = normalized.filter((entry) => entry.source === 'inbox').length;

  return {
    timeframe: {
      from: now - windowMs,
      to: now,
      windowMs,
    },
    totals: {
      published: publishedCount,
      inbox: inboxCount,
      uniqueAuthors,
    },
    tags,
    authors: authors.slice(0, options.topAuthors ?? authors.length),
    highlights: {
      intents,
      keywords,
      summary,
    },
  };
};
