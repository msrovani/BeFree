const { summarize, extractKeywords } = require('./ai');

const DEFAULT_WINDOW = 1000 * 60 * 60 * 24; // 24h

const normalizeTags = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((tag) => (typeof tag === 'string' ? tag.trim().toLowerCase() : undefined))
      .filter((tag) => Boolean(tag));
  }
  if (typeof value === 'string') {
    return value
      .split(/[\s,]+/)
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean);
  }
  return [];
};

const decayWeight = (timestamp, now, windowMs) => {
  if (windowMs <= 0) return 1;
  const age = Math.max(0, now - timestamp);
  if (age === 0) return 1;
  const ratio = age / windowMs;
  return Math.exp(-ratio);
};

const normalizeEntry = (envelope, source) => ({
  source,
  timestamp: envelope.timestamp,
  tags: normalizeTags(envelope.manifest?.tags),
  authorDid: envelope.author?.did,
  authorLabel: envelope.author?.label,
  body: envelope.body ?? '',
  summary: envelope.result?.summary,
  keywords: envelope.result?.keywords ?? [],
  intent: envelope.result?.intent,
});

const computeTagTrends = (feed, inbox = [], options = {}) => {
  const windowMs = options.windowMs ?? DEFAULT_WINDOW;
  const now = options.now ?? Date.now();
  const from = now - windowMs;

  const relevant = [
    ...feed.map((entry) => normalizeEntry(entry, 'published')),
    ...inbox.map((entry) => normalizeEntry(entry, 'inbox')),
  ].filter((entry) => entry.timestamp >= from && entry.timestamp <= now);

  const trends = new Map();
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

  const topTags = options.topTags ?? trends.size;

  return [...trends.entries()]
    .map(([tag, stats]) => ({ tag, ...stats }))
    .sort((a, b) => b.weight - a.weight || b.count - a.count || b.lastTimestamp - a.lastTimestamp)
    .slice(0, topTags);
};

const computeAuthorPulses = async (entries, options) => {
  const windowMs = options.windowMs ?? DEFAULT_WINDOW;
  const now = options.now ?? Date.now();
  const pulses = new Map();

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
    current.lastActivity = Math.max(current.lastActivity, entry.timestamp ?? 0);
    pulses.set(entry.authorDid, current);
  });

  const resolver = options.reputationResolver;
  if (resolver) {
    await Promise.all(
      [...pulses.values()].map(async (pulse) => {
        try {
          const value = await resolver(pulse.did);
          pulse.reputation = Number((value ?? 0).toFixed(4));
        } catch (error) {
          pulse.reputation = 0;
        }
      })
    );
  }

  const limit = options.topAuthors ?? pulses.size;
  return [...pulses.values()]
    .sort(
      (a, b) =>
        b.published + b.received - (a.published + a.received) ||
        (b.reputation ?? 0) - (a.reputation ?? 0) ||
        (b.lastActivity ?? 0) - (a.lastActivity ?? 0)
    )
    .slice(0, limit);
};

const buildCommunityDigest = async (feed, inboxEntries = [], options = {}) => {
  const windowMs = options.windowMs ?? DEFAULT_WINDOW;
  const now = options.now ?? Date.now();
  const includeInbox = options.includeInbox ?? true;

  const inbox = includeInbox
    ? inboxEntries.map((entry) => ('envelope' in entry ? entry.envelope : entry))
    : [];

  const normalized = [
    ...feed.map((entry) => normalizeEntry(entry, 'published')),
    ...inbox.map((entry) => normalizeEntry(entry, 'inbox')),
  ].filter((entry) => entry.timestamp >= now - windowMs && entry.timestamp <= now);

  const intents = {};
  const keywordWeights = new Map();
  const summaryCandidates = normalized.slice().sort((a, b) => b.timestamp - a.timestamp).slice(0, 12);

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
  const summarizer = options.summarizer ?? ((text) => summarize(text, 3));
  const keywordExtractor = options.keywordExtractor ?? ((text, max = 10) => extractKeywords(text, max));

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
  const totalCount = publishedCount + (includeInbox ? inboxCount : 0);

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
    feed: {
      total: totalCount,
      uniqueAuthors,
      published: publishedCount,
      inbox: includeInbox ? inboxCount : 0,
    },
    tags,
    authors,
    highlights: {
      intents,
      keywords,
      summary,
    },
  };
};

module.exports = {
  computeTagTrends,
  buildCommunityDigest,
};
