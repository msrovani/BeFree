import { randomUUID } from 'crypto';

import {
  CommunityOrchestrator,
  type ContentBroadcastEnvelope,
  type OrchestratorSnapshot,
} from '../../../sdk/platform';
import { runSimulation, createSampleScenario, type SimulationScenario } from '../../../sdk/simulation';
import { resetLedger } from '../../../sdk/economy';
import { clearEvents } from '../../../sdk/reputation';
import { resetGovernance } from '../../../sdk/governance';
import type { CommunityDigest } from '../../../sdk/analytics';

import {
  fallbackCommunityData,
  type CircleSnapshot,
  type CommunitySummary,
  type JarbasInsight,
  type LiveCommunityData,
  type ParticipantProfile,
  type Pulse,
  type PulseRole,
} from './demoData';
import {
  buildJarbasSystemPrompt,
  defaultJarbasMemory,
  evolveJarbasMemory,
  registerJarbasResponse,
  type JarbasMemoryState,
} from '../../../sdk/ai/jarbasPersona';

export interface CommunityBridgeOptions {
  scenario?: SimulationScenario;
  iterations?: number;
}

const ROLE_CYCLE: PulseRole[] = ['guardian', 'artesao', 'oraculo', 'explorador'];

const cloneCommunityData = (): LiveCommunityData => {
  const clone = (globalThis as { structuredClone?: <T>(value: T) => T }).structuredClone;
  if (typeof clone === 'function') {
    return clone(fallbackCommunityData);
  }
  return JSON.parse(JSON.stringify(fallbackCommunityData)) as LiveCommunityData;
};

const ROLE_KEYWORDS: Record<PulseRole, string[]> = {
  guardian: ['cuidado', 'acolhimento', 'ritual', 'saúde', 'cura', 'mentoria'],
  artesao: ['arte', 'nft', 'design', 'criativo', 'visual', 'co-criação', 'colaborativo'],
  oraculo: ['governança', 'dados', 'analise', 'digest', 'proposta', 'score', 'telemetria'],
  explorador: ['rede', 'p2p', 'sync', 'expedição', 'beta', 'nó', 'expansão'],
};

const ROLE_COLORS: Record<PulseRole, string> = {
  guardian: 'var(--pulse-guardian)',
  artesao: 'var(--pulse-artesao)',
  oraculo: 'var(--pulse-oraculo)',
  explorador: 'var(--pulse-explorador)',
};

interface ContributionContext {
  count: number;
  lastAction: string;
  lastTimestamp: number;
  role: PulseRole;
}

type PulseSource = { envelope: ContentBroadcastEnvelope; origin: 'published' | 'inbox'; };

const normalizeTags = (value: unknown): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === 'string' ? entry.toLowerCase() : undefined))
      .filter((tag): tag is string => Boolean(tag));
  }
  if (typeof value === 'string') {
    return value
      .split(/[\s,]+/g)
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean);
  }
  return [];
};

const inferRole = (tags: string[], fallbackIndex: number): PulseRole => {
  for (const [role, keywords] of Object.entries(ROLE_KEYWORDS) as Array<[PulseRole, string[]]>) {
    if (tags.some((tag) => keywords.some((keyword) => tag.includes(keyword)))) {
      return role;
    }
  }
  return ROLE_CYCLE[fallbackIndex % ROLE_CYCLE.length];
};

const inferSentiment = (tags: string[], intent?: string): Pulse['sentiment'] => {
  if (tags.some((tag) => /(alert|urgên|risco|prioridade)/i.test(tag))) {
    return 'alerta';
  }
  if (intent === 'support') {
    return 'positivo';
  }
  if (tags.some((tag) => /(celebra|arte|ritual|cuidado)/i.test(tag))) {
    return 'positivo';
  }
  return 'neutro';
};

const computeEnergy = (keywords: string[], reputation: number, origin: PulseSource['origin']): number => {
  const base = origin === 'published' ? 0.45 : 0.35;
  const keywordBoost = Math.min(0.35, keywords.length * 0.06);
  const reputationBoost = Math.min(0.2, reputation / 400);
  const energy = base + keywordBoost + reputationBoost;
  return Number(Math.max(0.25, Math.min(1, Number(energy.toFixed(2)))));
};

const isAiAssisted = (tags: string[], keywords: string[]): boolean => {
  return tags.some((tag) => tag.includes('ia')) || keywords.some((keyword) => keyword.includes('ia'));
};

const formatAuthor = (did: string, label?: string) => {
  if (label) return label;
  const fragment = did.replace(/^did:[^:]+:/, '');
  return fragment.slice(0, 8);
};

const toParticipantId = (did: string, fallback?: string) => {
  const slug = did
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (slug) return `participant-${slug}`;
  if (fallback) {
    return `participant-${fallback.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  }
  return `participant-${randomUUID()}`;
};

const formatAction = (summary?: string, tags: string[] = []) => {
  if (summary && summary.trim()) return summary.trim();
  if (tags.length) {
    return `Energia focada em ${tags.slice(0, 2).join(' · ')}`;
  }
  return 'Atividade registrada na rede';
};

const buildPulseSources = (snapshot: OrchestratorSnapshot): PulseSource[] => {
  const published = snapshot.published.map((envelope) => ({ envelope, origin: 'published' as const }));
  const inbox = snapshot.inbox.map((entry) => ({ envelope: entry.envelope, origin: 'inbox' as const }));
  return [...published, ...inbox].sort((a, b) => b.envelope.timestamp - a.envelope.timestamp);
};

const buildPulses = async (
  orchestrator: CommunityOrchestrator,
  snapshot: OrchestratorSnapshot
): Promise<{ pulses: Pulse[]; contributions: Map<string, ContributionContext> }> => {
  const contributions = new Map<string, ContributionContext>();
  const pulses: Pulse[] = [];
  const sources = buildPulseSources(snapshot);

  for (let index = 0; index < sources.length; index += 1) {
    const source = sources[index]!;
    const { envelope } = source;
    const tags = normalizeTags((envelope.manifest as { tags?: unknown })?.tags);
    const keywords = envelope.result?.keywords ?? [];
    const role = inferRole(tags, index);
    const reputation = Math.round(await orchestrator.reputationScore(envelope.author.did));
    const pulse: Pulse = {
      id: envelope.signature ?? `${envelope.author.did}-${envelope.timestamp}`,
      author: formatAuthor(envelope.author.did, envelope.author.label),
      authorRole: role,
      reputation,
      energy: computeEnergy(keywords, reputation, source.origin),
      summary: envelope.result?.summary ?? envelope.body,
      tags,
      aiAssisted: isAiAssisted(tags, keywords),
      capturedAt: new Date(envelope.timestamp).toISOString(),
      sentiment: inferSentiment(tags, envelope.result?.intent),
      sourceDid: envelope.author.did,
      origin: source.origin,
    };
    pulses.push(pulse);

    const existing = contributions.get(envelope.author.did);
    const lastAction = formatAction(envelope.result?.summary, tags);
    if (existing) {
      contributions.set(envelope.author.did, {
        count: existing.count + 1,
        lastAction,
        lastTimestamp: Math.max(existing.lastTimestamp, envelope.timestamp),
        role,
      });
    } else {
      contributions.set(envelope.author.did, {
        count: 1,
        lastAction,
        lastTimestamp: envelope.timestamp,
        role,
      });
    }
  }

  return { pulses, contributions };
};

const highlightForRole = (role: PulseRole, published: number, received: number) => {
  switch (role) {
    case 'guardian':
      return published > received ? 'Guardiã do Cuidado Vivo' : 'Guardião das trocas seguras';
    case 'artesao':
      return published >= received ? 'Artesão da Proveniência' : 'Artífice colaborativo';
    case 'oraculo':
      return 'Oráculo Sistêmico';
    case 'explorador':
    default:
      return 'Explorador da Rede';
  }
};

const mapLedgerTotals = (snapshot: OrchestratorSnapshot) => {
  const totals = new Map<string, number>();
  snapshot.ledger.forEach((receipt) => {
    const current = totals.get(receipt.to) ?? 0;
    totals.set(receipt.to, current + Number(receipt.amount));
  });
  return totals;
};

const buildParticipants = async (
  orchestrator: CommunityOrchestrator,
  snapshot: OrchestratorSnapshot,
  digest: CommunityDigest,
  contributions: Map<string, ContributionContext>
): Promise<ParticipantProfile[]> => {
  const ledgerTotals = mapLedgerTotals(snapshot);
  const participants: ParticipantProfile[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < digest.authors.length; index += 1) {
    const author = digest.authors[index]!;
    const contribution = contributions.get(author.did);
    const role = contribution?.role ?? ROLE_CYCLE[index % ROLE_CYCLE.length];
    const reputation = Math.round(author.reputation ?? (await orchestrator.reputationScore(author.did)));
    const earned = ledgerTotals.get(author.did) ?? 0;
    const streak = contribution?.count ?? Math.max(1, author.published);
    const lastAction = contribution?.lastAction ?? 'Fluxo sincronizado com Jarbas';
    const profile: ParticipantProfile = {
      id: toParticipantId(author.did, author.label),
      displayName: formatAuthor(author.did, author.label),
      reputation,
      auraColor: ROLE_COLORS[role],
      lastAction,
      earnedBFR: Number(earned.toFixed(2)),
      streak,
      highlight: highlightForRole(role, author.published, author.received),
      did: author.did,
    };
    participants.push(profile);
    seen.add(author.did);
  }

  const hostDid = snapshot.author.did;
  if (!seen.has(hostDid)) {
    const hostContribution = contributions.get(hostDid);
    const hostReputation = Math.round(await orchestrator.reputationScore(hostDid));
    participants.unshift({
      id: toParticipantId(hostDid, snapshot.author.label),
      displayName: formatAuthor(hostDid, snapshot.author.label),
      reputation: hostReputation,
      auraColor: ROLE_COLORS[hostContribution?.role ?? 'guardian'],
      lastAction: hostContribution?.lastAction ?? 'Publicação direta do orquestrador',
      earnedBFR: Number((ledgerTotals.get(hostDid) ?? 0).toFixed(2)),
      streak: hostContribution?.count ?? 1,
      highlight: highlightForRole(hostContribution?.role ?? 'guardian', 1, 0),
      did: hostDid,
    });
  }

  return participants.sort((a, b) => b.reputation - a.reputation);
};

const formatDigestSummary = (digest: CommunityDigest): string => {
  if (digest.highlights.summary) return digest.highlights.summary;
  const hours = Math.max(1, Math.round(digest.timeframe.windowMs / (1000 * 60 * 60)));
  return `Jarbas acompanhou ${digest.totals.published} pulses e ${digest.totals.inbox} relatos nos últimos ${hours}h.`;
};

const buildSummary = (digest: CommunityDigest, snapshot: OrchestratorSnapshot): CommunitySummary => ({
  digestSummary: formatDigestSummary(digest),
  timeframe: {
    from: new Date(digest.timeframe.from).toISOString(),
    to: new Date(digest.timeframe.to).toISOString(),
    windowMs: digest.timeframe.windowMs,
  },
  totals: {
    published: digest.totals.published,
    inbox: digest.totals.inbox,
    uniqueAuthors: digest.totals.uniqueAuthors,
  },
  host: snapshot.author.label ?? formatAuthor(snapshot.author.did),
});

const buildCircles = (digest: CommunityDigest): CircleSnapshot[] => {
  const circles: CircleSnapshot[] = digest.tags.slice(0, 4).map((tag, index) => {
    const trustBase = 0.55 + Math.min(0.35, tag.weight);
    const members = 6 + tag.count * 3 + index * 2;
    return {
      id: `circle-${tag.tag}`,
      title: tag.tag.replace(/^(\w)/, (match) => match.toUpperCase()),
      trustLevel: Number(Math.min(0.98, trustBase).toFixed(2)),
      members,
      isEncrypted: index !== digest.tags.length - 1,
      vibe: `Energia concentrada em ${tag.tag} (${tag.count} pulsos recentes)`,
    };
  });

  if (circles.length >= 3) return circles;

  return [...circles, ...fallbackCommunityData.circles].slice(0, 3);
};

const buildInsights = (digest: CommunityDigest, snapshot: OrchestratorSnapshot): JarbasInsight[] => {
  const insights: JarbasInsight[] = [
    {
      id: 'insight-digest',
      title: 'Digest ativo',
      detail: formatDigestSummary(digest),
      tone: 'calmo',
    },
  ];

  if (digest.tags.length) {
    const topTags = digest.tags.slice(0, 2).map((tag) => `#${tag.tag}`).join(' · ');
    insights.push({
      id: 'insight-trends',
      title: 'Tags em ascensão',
      detail: `Os círculos vibram com ${topTags}. Recomendo facilitar rituais focados nesses temas.`,
      tone: 'empolgado',
      action: 'Abrir painel de círculos',
    });
  }

  const activeProposals = snapshot.governance.filter((proposal) => proposal.status === 'active');
  if (activeProposals.length) {
    insights.push({
      id: 'insight-governance',
      title: 'Governança em votação',
      detail: `${activeProposals.length} proposta(s) aguardam votos. Priorize o círculo de decisão agora.`,
      tone: 'alerta',
      action: 'Votar com BFR',
    });
  }

  return insights;
};

export const loadCommunitySnapshot = async (
  options: CommunityBridgeOptions = {}
): Promise<LiveCommunityData> => {
  resetLedger();
  clearEvents();
  resetGovernance();

  try {
    const orchestrator = new CommunityOrchestrator({
      label: 'Frontend Bridge',
      autosaveIntervalMs: 0,
      defaultReward: 1,
      rewardMemo: 'Frontend simulation',
    });
    const scenario = options.scenario ?? createSampleScenario();
    const iterations = Math.max(1, Math.trunc(options.iterations ?? 1));

    await runSimulation(orchestrator, scenario, { iterations });

    const snapshot = await orchestrator.snapshot();
    const digest = await orchestrator.generateDigest({ topTags: 6, includeInbox: true });
    const { pulses, contributions } = await buildPulses(orchestrator, snapshot);
    const participants = await buildParticipants(orchestrator, snapshot, digest, contributions);
    const circles = buildCircles(digest);
    const insights = buildInsights(digest, snapshot);
    const summary = buildSummary(digest, snapshot);

    const baseMemory: JarbasMemoryState = {
      ...defaultJarbasMemory,
      recentPhrases: [...defaultJarbasMemory.recentPhrases],
      recentInteractions: [...defaultJarbasMemory.recentInteractions],
    };

    const topTag = digest.tags[0];
    const evolvedMemory = evolveJarbasMemory(baseMemory, {
      context: `Digest com ${summary.totals.published} pulsos e ${summary.totals.uniqueAuthors} autores ativos.`,
      evolution: topTag
        ? `Aprendizado: foco emergente em #${topTag.tag} com ${topTag.count} pulsos recentes.`
        : 'Aprendizado: manter vigilância sobre círculos ativos sem tendência dominante.',
      preferences: 'Usuário aprecia visão radial com bullets e recomendações acionáveis.',
    });

    const insightsSummary = insights.map((insight) => `${insight.title}: ${insight.detail}`).join('. ');
    const memory = registerJarbasResponse(evolvedMemory, insightsSummary, summary.digestSummary);
    const personaPrompt = buildJarbasSystemPrompt({
      memory,
      conversationSummary: summary.digestSummary,
      userIntent: 'community-overview',
      userEmotion: digest.totals.published >= digest.totals.inbox ? 'confiante' : 'atento',
      urgency: digest.totals.inbox > digest.totals.published / 2 ? 'medium' : 'low',
      channel: 'text',
    });

    const persona = {
      ...fallbackCommunityData.persona,
      traits: [...fallbackCommunityData.persona.traits],
      commitments: {
        never: [...fallbackCommunityData.persona.commitments.never],
        always: [...fallbackCommunityData.persona.commitments.always],
      },
      bestPractices: [...fallbackCommunityData.persona.bestPractices],
      advancedModes: { ...fallbackCommunityData.persona.advancedModes },
    };

    return { pulses, participants, circles, insights, summary, persona, jarbasMemory: memory, personaPrompt };
  } catch (error) {
    console.error('Falha ao carregar snapshot vivo, usando dados de fallback.', error);
    return cloneCommunityData();
  } finally {
    resetLedger();
    clearEvents();
    resetGovernance();
  }
};
