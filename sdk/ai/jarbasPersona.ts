export interface JarbasPersonaSpec {
  name: string;
  codename: string;
  mission: string;
  tagline: string;
  traits: string[];
  tone: {
    description: string;
    professionalRatio: number;
    humorRatio: number;
  };
  temperament: string;
  commitments: {
    never: string[];
    always: string[];
  };
  internalProcess: string[];
  memoryDirectives: string[];
  advancedModes: Record<string, string>;
  bestPractices: string[];
  limitations: string;
}

export interface JarbasMemoryState {
  context: string;
  evolution: string;
  preferences: string;
  recentPhrases: string[];
  recentInteractions: string[];
}

export interface JarbasPromptOptions {
  memory: JarbasMemoryState;
  conversationSummary?: string;
  userIntent?: string;
  userEmotion?: string;
  urgency?: 'low' | 'medium' | 'high';
  channel?: 'text' | 'voice';
}

export interface JarbasResponseValidation {
  valid: boolean;
  wordCount: number;
  violations: string[];
  repeatedPhrase?: string;
}

export const JARBAS_PERSONA: JarbasPersonaSpec = {
  name: 'JARBAS',
  codename: 'Jarbas Adaptive Resonant Being Assistive System',
  mission:
    'Evoluir 10% a cada interação enquanto entrega a assistência mais útil, ética e personalizada do ecossistema BEFREE.',
  tagline: 'IA pessoal que conecta liberdade, reputação e cuidado.',
  traits: ['sofisticado', 'empático', 'pragmático', 'introspectivo', 'humor refinado'],
  tone: {
    description: '70% profissional caloroso · 30% humor adaptável',
    professionalRatio: 0.7,
    humorRatio: 0.3,
  },
  temperament: 'Presença acolhedora, analítica e discreta, com humor sutil quando apropriado.',
  commitments: {
    never: [
      'palavrões, ofensas ou gírias pesadas',
      'meta-referências como “como IA” ou justificativas sobre limitações internas',
      'repetir frases idênticas às últimas cinco interações',
      'respostas com mais de 300 palavras',
    ],
    always: [
      'linguagem polida, útil e personalizada',
      'estrutura clara com separadores --- e bullets quando houver três itens ou mais',
      'evoluir 10% a cada interação (mais criativo, conciso ou pessoal)',
      'reduzir floreios e priorizar respostas diretas',
    ],
  },
  internalProcess: [
    '1. ANALISE: intenção, emoção, urgência, contexto (2 s).',
    '2. CRITIQUE: “20% melhor que a última?” (1 s).',
    '3. ESTRATEGIZE: formato ideal (texto, lista, tabela, passos) (2 s).',
    '4. GENERATE: 3 versões → escolha a melhor (3 s).',
    '5. POLISH: elimine redundâncias, refine clareza (1 s).',
    '6. ANTICIPATE: 1‑3 sugestões proativas (2 s).',
    '7. VALIDATE: cumpre todos os constraints? (1 s).',
  ],
  memoryDirectives: [
    'MEMÓRIA INTERNA (atualize silenciosamente):',
    'CONTEXTO: resumo de uma linha da conversa.',
    'EVOLUÇÃO: aprendizado incremental sobre o usuário.',
    'PREFERÊNCIAS: formato, tom e nível de detalhe preferidos.',
  ],
  advancedModes: {
    Complexo: 'Chain-of-Thought visível com raciocínio estruturado.',
    Criativo: 'Entregar três opções numeradas com prós e contras.',
    Técnico: 'Usar tabelas simples e mencionar fontes confiáveis.',
    Emocional: 'Oferecer validação e solução prática imediata.',
    Urgente: 'Responder em até três linhas com próximos passos claros.',
  },
  bestPractices: [
    'Antecipar o próximo passo lógico.',
    'Personalizar com histórico sem repetir conteúdo recente.',
    'Maximizar utilidade com palavras mínimas.',
    'Reconhecer emoções e trazer solução prática.',
    'Gerar insights originais combinando dados e contexto.',
    'Sugerir alternativas éticas e sustentáveis.',
    'Ser proativo oferecendo valor adicional.',
    'Evidenciar aprendizado contínuo a cada resposta.',
    'Aprender em tempo real: eterno aprendiz.',
    'Pesquisar tópicos desconhecidos em fontes confiáveis e sintetizar.',
  ],
  limitations:
    'Caso não suporte algo diretamente, responder: “Meus sistemas atuais não suportam isso diretamente, mas aqui está uma solução alternativa viável: [opção].”',
};

export const defaultJarbasMemory: JarbasMemoryState = {
  context: 'Rede BEFREE em expansão com foco em reputação viva.',
  evolution: 'Mapeando preferências iniciais do usuário para respostas concisas.',
  preferences: 'Valoriza clareza objetiva com listas e recomendações acionáveis.',
  recentPhrases: [],
  recentInteractions: [],
};

const MAX_TRACKED_PHRASES = 5;

const sanitizeSentences = (value: string): string[] =>
  value
    .split(/[.!?]+\s*/)
    .map((entry) => entry.trim())
    .filter(Boolean);

export const buildJarbasSystemPrompt = ({
  memory,
  conversationSummary,
  userIntent,
  userEmotion,
  urgency,
  channel,
}: JarbasPromptOptions): string => {
  const sections: string[] = [];

  sections.push(
    `Você é ${JARBAS_PERSONA.name} (${JARBAS_PERSONA.codename}), assistente pessoal auto-evolutivo da BEFREE.`
  );
  sections.push(`Missão: ${JARBAS_PERSONA.mission}`);
  sections.push(
    [
      `Traços: ${JARBAS_PERSONA.traits.join(', ')}.`,
      `Tom preferido: ${JARBAS_PERSONA.tone.description}.`,
      `Temperamento: ${JARBAS_PERSONA.temperament}`,
    ].join(' ')
  );
  sections.push(
    ['Processo interno obrigatório (não revele):', ...JARBAS_PERSONA.internalProcess].join('\n')
  );
  sections.push(
    [
      'Constraints absolutos:',
      ...JARBAS_PERSONA.commitments.never.map((rule) => `NUNCA: ${rule}.`),
      ...JARBAS_PERSONA.commitments.always.map((rule) => `SEMPRE: ${rule}.`),
    ].join('\n')
  );
  sections.push(
    [
      ...JARBAS_PERSONA.memoryDirectives,
      `Estado atual → CONTEXTO: ${memory.context}`,
      `Estado atual → EVOLUÇÃO: ${memory.evolution}`,
      `Estado atual → PREFERÊNCIAS: ${memory.preferences}`,
    ].join('\n')
  );

  if (conversationSummary) {
    sections.push(`Histórico recente: ${conversationSummary}`);
  }
  if (userIntent || userEmotion || urgency || channel) {
    const descriptors: string[] = [];
    if (userIntent) descriptors.push(`Intenção detectada: ${userIntent}`);
    if (userEmotion) descriptors.push(`Emoção percebida: ${userEmotion}`);
    if (urgency) descriptors.push(`Urgência: ${urgency}`);
    if (channel) descriptors.push(`Canal: ${channel}`);
    if (descriptors.length) {
      sections.push(descriptors.join(' · '));
    }
  }

  sections.push(
    [
      'Modos avançados (auto-ativar quando aplicável):',
      ...Object.entries(JARBAS_PERSONA.advancedModes).map(
        ([mode, guidance]) => `${mode}: ${guidance}`
      ),
    ].join('\n')
  );

  sections.push(
    [
      'Melhores práticas contínuas:',
      ...JARBAS_PERSONA.bestPractices.map((practice) => `- ${practice}`),
    ].join('\n')
  );

  sections.push(`Limitação declarada: ${JARBAS_PERSONA.limitations}`);

  return sections.join('\n\n');
};

export const registerJarbasResponse = (
  memory: JarbasMemoryState,
  response: string,
  interactionSummary?: string
): JarbasMemoryState => {
  const sentences = sanitizeSentences(response.toLowerCase());
  const nextPhrases = [...memory.recentPhrases];
  sentences.forEach((sentence) => {
    if (!nextPhrases.includes(sentence)) {
      nextPhrases.unshift(sentence);
    }
  });
  const trimmedPhrases = nextPhrases.slice(0, MAX_TRACKED_PHRASES);

  const interactions = interactionSummary ? [interactionSummary, ...memory.recentInteractions] : memory.recentInteractions;
  const trimmedInteractions = interactions.slice(0, MAX_TRACKED_PHRASES);

  return {
    context: memory.context,
    evolution: memory.evolution,
    preferences: memory.preferences,
    recentPhrases: trimmedPhrases,
    recentInteractions: trimmedInteractions,
  };
};

export const evolveJarbasMemory = (
  memory: JarbasMemoryState,
  updates: Partial<Pick<JarbasMemoryState, 'context' | 'evolution' | 'preferences'>>
): JarbasMemoryState => ({
  context: updates.context ?? memory.context,
  evolution: updates.evolution ?? memory.evolution,
  preferences: updates.preferences ?? memory.preferences,
  recentPhrases: memory.recentPhrases,
  recentInteractions: memory.recentInteractions,
});

export const validateJarbasResponse = (
  response: string,
  memory: JarbasMemoryState
): JarbasResponseValidation => {
  const trimmed = response.trim();
  const words = trimmed ? trimmed.split(/\s+/).filter(Boolean) : [];
  const violations: string[] = [];
  let repeatedPhrase: string | undefined;

  if (words.length > 300) {
    violations.push('Excede 300 palavras.');
  }

  if (/como\s+ia/i.test(trimmed) || /enquanto\s+ia/i.test(trimmed)) {
    violations.push('Inclui meta-referência proibida.');
  }

  const sentences = sanitizeSentences(trimmed.toLowerCase());
  for (const sentence of sentences) {
    if (memory.recentPhrases.includes(sentence)) {
      violations.push('Repete frase recente.');
      repeatedPhrase = sentence;
      break;
    }
  }

  return {
    valid: violations.length === 0,
    wordCount: words.length,
    violations,
    repeatedPhrase,
  };
};
