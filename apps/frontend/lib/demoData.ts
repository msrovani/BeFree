import {
  JARBAS_PERSONA,
  buildJarbasSystemPrompt,
  defaultJarbasMemory,
  type JarbasMemoryState,
} from '../../../sdk/ai/jarbasPersona';

export type PulseRole = 'guardian' | 'artesao' | 'oraculo' | 'explorador';

export interface Pulse {
  id: string;
  author: string;
  authorRole: PulseRole;
  reputation: number;
  energy: number;
  summary: string;
  tags: string[];
  aiAssisted?: boolean;
  capturedAt: string;
  sentiment: 'positivo' | 'neutro' | 'alerta';
  sourceDid?: string;
  origin?: 'published' | 'inbox';
}

export interface ParticipantProfile {
  id: string;
  displayName: string;
  reputation: number;
  auraColor: string;
  lastAction: string;
  earnedBFR: number;
  streak: number;
  highlight: string;
  did?: string;
}

export interface JarbasInsight {
  id: string;
  title: string;
  detail: string;
  action?: string;
  tone: 'calmo' | 'empolgado' | 'alerta';
}

export interface CircleSnapshot {
  id: string;
  title: string;
  trustLevel: number;
  members: number;
  isEncrypted: boolean;
  vibe: string;
}

export interface CommunitySummary {
  digestSummary: string;
  timeframe: {
    from: string;
    to: string;
    windowMs: number;
  };
  totals: {
    published: number;
    inbox: number;
    uniqueAuthors: number;
  };
  host: string;
}

export interface JarbasPersonaSnapshot {
  name: string;
  tagline: string;
  mission: string;
  tone: string;
  traits: string[];
  commitments: {
    never: string[];
    always: string[];
  };
  bestPractices: string[];
  advancedModes: Record<string, string>;
}

export interface LiveCommunityData {
  pulses: Pulse[];
  participants: ParticipantProfile[];
  insights: JarbasInsight[];
  circles: CircleSnapshot[];
  summary: CommunitySummary;
  persona: JarbasPersonaSnapshot;
  jarbasMemory: JarbasMemoryState;
  personaPrompt: string;
}

const now = new Date('2025-11-07T14:30:00Z');

const fallbackMemory: JarbasMemoryState = {
  ...defaultJarbasMemory,
  recentPhrases: [...defaultJarbasMemory.recentPhrases],
  recentInteractions: [...defaultJarbasMemory.recentInteractions],
};

const fallbackPersona: JarbasPersonaSnapshot = {
  name: JARBAS_PERSONA.name,
  tagline: JARBAS_PERSONA.tagline,
  mission: JARBAS_PERSONA.mission,
  tone: JARBAS_PERSONA.tone.description,
  traits: [...JARBAS_PERSONA.traits],
  commitments: {
    never: [...JARBAS_PERSONA.commitments.never],
    always: [...JARBAS_PERSONA.commitments.always],
  },
  bestPractices: [...JARBAS_PERSONA.bestPractices],
  advancedModes: { ...JARBAS_PERSONA.advancedModes },
};

const fallbackSummary: CommunitySummary = {
  digestSummary:
    'Jarbas registrou alta ressonância coletiva nas últimas 24h, com destaque para acolhimento e coordenação de círculos.',
  timeframe: {
    from: new Date(now.getTime() - 1000 * 60 * 60 * 24).toISOString(),
    to: now.toISOString(),
    windowMs: 1000 * 60 * 60 * 24,
  },
  totals: {
    published: 18,
    inbox: 6,
    uniqueAuthors: 9,
  },
  host: 'Lyra — Guardiã da Rede',
};

const fallbackPulses: Pulse[] = [
  {
    id: 'pulse-guardian-01',
    author: 'Lyra',
    authorRole: 'guardian',
    reputation: 92,
    energy: 0.88,
    summary: 'Novo protocolo de acolhimento para membrxs que chegam via convites comunitários.',
    tags: ['acolhimento', 'governança', 'pacto'],
    capturedAt: '2025-11-07T14:20:00Z',
    sentiment: 'positivo',
    origin: 'published',
  },
  {
    id: 'pulse-art-02',
    author: 'Miro',
    authorRole: 'artesao',
    reputation: 74,
    energy: 0.72,
    summary: 'NFT colaborativo ganhou selo de autenticidade híbrido com assinatura humana + IA.',
    tags: ['arte', 'proveniência', 'selo'],
    capturedAt: '2025-11-07T13:40:00Z',
    aiAssisted: true,
    sentiment: 'positivo',
    origin: 'published',
  },
  {
    id: 'pulse-oracle-03',
    author: 'Helio',
    authorRole: 'oraculo',
    reputation: 81,
    energy: 0.64,
    summary: 'Jarbas sugere revisar o módulo de reputação para refletir curadorias temáticas.',
    tags: ['ia', 'reputação', 'curadoria'],
    capturedAt: '2025-11-07T12:00:00Z',
    aiAssisted: true,
    sentiment: 'neutro',
    origin: 'published',
  },
  {
    id: 'pulse-explorer-04',
    author: 'Nara',
    authorRole: 'explorador',
    reputation: 58,
    energy: 0.48,
    summary: 'Teste com nó P2P externo revelou latência estável em 220ms, pronto para abrir beta.',
    tags: ['p2p', 'rede', 'beta'],
    capturedAt: '2025-11-07T11:30:00Z',
    sentiment: 'positivo',
    origin: 'published',
  },
  {
    id: 'pulse-guardian-05',
    author: 'Zion',
    authorRole: 'guardian',
    reputation: 67,
    energy: 0.38,
    summary: 'Solicitação de abertura de círculo íntimo para apoio emocional imediato.',
    tags: ['círculos', 'cuidado', 'prioridade'],
    capturedAt: '2025-11-07T10:45:00Z',
    sentiment: 'alerta',
    origin: 'published',
  },
];

const fallbackParticipants: ParticipantProfile[] = [
  {
    id: 'participant-lyra',
    displayName: 'Lyra',
    reputation: 92,
    auraColor: 'var(--pulse-guardian)',
    lastAction: 'Iniciou ritual de boas-vindas',
    earnedBFR: 32,
    streak: 12,
    highlight: 'Guardiã do Cuidado',
  },
  {
    id: 'participant-miro',
    displayName: 'Miro',
    reputation: 74,
    auraColor: 'var(--pulse-artesao)',
    lastAction: 'Lançou NFT colaborativo',
    earnedBFR: 18,
    streak: 9,
    highlight: 'Artesão da Proveniência',
  },
  {
    id: 'participant-helio',
    displayName: 'Helio',
    reputation: 81,
    auraColor: 'var(--pulse-oraculo)',
    lastAction: 'Propôs ajuste no score Jarbas',
    earnedBFR: 26,
    streak: 7,
    highlight: 'Oráculo Sistêmico',
  },
  {
    id: 'participant-nara',
    displayName: 'Nara',
    reputation: 58,
    auraColor: 'var(--pulse-explorador)',
    lastAction: 'Validou nó P2P cooperativo',
    earnedBFR: 9,
    streak: 3,
    highlight: 'Exploradora da Rede',
  },
];

const fallbackInsights: JarbasInsight[] = [
  {
    id: 'insight-1',
    title: 'Resonância Coletiva Alta',
    detail: 'Quatro círculos ativos mantêm a reputação média acima de 70. Sugestão: abrir slots de mentoria.',
    action: 'Agendar mentoria com guardiões',
    tone: 'calmo',
  },
  {
    id: 'insight-2',
    title: 'IA Assistida em Ascensão',
    detail: '32% dos conteúdos dessa manhã receberam suporte do Jarbas. Transparência visual atualizada.',
    tone: 'empolgado',
  },
  {
    id: 'insight-3',
    title: 'Círculo Íntimo em Alerta',
    detail: 'Sinalização de pedido urgente. Recomendo resposta em menos de 15 minutos.',
    action: 'Ativar protocolo de cuidado',
    tone: 'alerta',
  },
];

const fallbackCircles: CircleSnapshot[] = [
  {
    id: 'circle-guardian',
    title: 'Rituais de Cuidado',
    trustLevel: 0.92,
    members: 18,
    isEncrypted: true,
    vibe: 'Calor e presença',
  },
  {
    id: 'circle-art',
    title: 'Ateliê Onírico',
    trustLevel: 0.74,
    members: 24,
    isEncrypted: true,
    vibe: 'Imaginário coletivo vibrante',
  },
  {
    id: 'circle-labs',
    title: 'Labs P2P',
    trustLevel: 0.66,
    members: 11,
    isEncrypted: false,
    vibe: 'Exploração técnica contínua',
  },
];

export const fallbackCommunityData: LiveCommunityData = {
  pulses: fallbackPulses,
  participants: fallbackParticipants,
  insights: fallbackInsights,
  circles: fallbackCircles,
  summary: fallbackSummary,
  persona: fallbackPersona,
  jarbasMemory: fallbackMemory,
  personaPrompt: buildJarbasSystemPrompt({ memory: fallbackMemory }),
};

export const voicePrompts = [
  'Jarbas, quais círculos precisam de atenção agora?',
  'Registrar ritual como pulse cooperativo.',
  'Iniciar transmissão ao vivo para Ateliê Onírico.',
  'Ativar modo ético para todo conteúdo IA.',
];
