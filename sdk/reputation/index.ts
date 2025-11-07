export interface ReputationEvent {
  did: string;
  type: 'content' | 'curation' | 'economy' | 'moderation' | 'social';
  weight: number;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

const DECAY_HALF_LIFE = 1000 * 60 * 60 * 24 * 30; // 30 days
const eventLog: ReputationEvent[] = [];

const decayFactor = (event: ReputationEvent, reference = Date.now()) => {
  const age = reference - event.timestamp;
  if (age <= 0) return 1;
  const decay = Math.pow(0.5, age / DECAY_HALF_LIFE);
  return Math.max(0, Math.min(1, decay));
};

const weights: Record<ReputationEvent['type'], number> = {
  content: 1.2,
  curation: 1,
  economy: 1.5,
  moderation: 2,
  social: 0.8,
};

export const recordEvent = (event: ReputationEvent) => {
  eventLog.push(event);
};

export const scoreFor = async (did: string, reference = Date.now()) => {
  const relevant = eventLog.filter((event) => event.did === did);
  const score = relevant.reduce((acc, event) => acc + event.weight * weights[event.type] * decayFactor(event, reference), 0);
  return Number(score.toFixed(4));
};

export const leaderboard = (limit = 10) => {
  const entries = new Map<string, number>();
  eventLog.forEach((event) => {
    const current = entries.get(event.did) ?? 0;
    entries.set(event.did, current + event.weight * weights[event.type] * decayFactor(event));
  });
  return [...entries.entries()]
    .map(([did, score]) => ({ did, score: Number(score.toFixed(4)) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
};

export const clearEvents = () => {
  eventLog.length = 0;
};

export const exportReputationEvents = () => [...eventLog];

export const importReputationEvents = (events: ReputationEvent[] = []) => {
  eventLog.length = 0;
  events.forEach((event) => eventLog.push(event));
};
