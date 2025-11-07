export interface Pulse {
  id: string;
  author: string;
  authorRole: 'guardian' | 'artesao' | 'oraculo' | 'explorador';
  reputation: number;
  energy: number;
  summary: string;
  tags: string[];
  aiAssisted?: boolean;
  capturedAt: string;
  sentiment: 'positivo' | 'neutro' | 'alerta';
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

export const pulses: Pulse[] = [
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
  },
];

export const participants: ParticipantProfile[] = [
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

export const insights: JarbasInsight[] = [
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

export const circles: CircleSnapshot[] = [
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

export const voicePrompts = [
  'Jarbas, quais círculos precisam de atenção agora?',
  'Registrar ritual como pulse cooperativo.',
  'Iniciar transmissão ao vivo para Ateliê Onírico.',
  'Ativar modo ético para todo conteúdo IA.',
];
