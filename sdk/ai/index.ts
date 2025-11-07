const SENTENCE_DELIMITERS = /(?<=[.!?])\s+/g;
const STOPWORDS = new Set(
  'a,ao,aos,à,às,o,os,as,e,é,do,da,dos,das,de,em,um,uma,uns,umas,que,como,para,por,com,sem,se,na,no,nos,nas,os,das'.split(',')
);

const tokenize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-zà-ú0-9\s]/gi, ' ')
    .split(/\s+/)
    .filter(Boolean);

const sentenceScore = (sentence: string, keywords: Map<string, number>) => {
  const words = tokenize(sentence);
  if (words.length === 0) return 0;
  const score = words.reduce((acc, word) => acc + (keywords.get(word) ?? 0), 0);
  return score / words.length;
};

export const summarize = async (text: string, sentences = 3) => {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return '';

  const tokens = tokenize(normalized).filter((token) => !STOPWORDS.has(token));
  const frequencies = new Map<string, number>();
  tokens.forEach((token) => frequencies.set(token, (frequencies.get(token) ?? 0) + 1));

  const splitted = normalized.split(SENTENCE_DELIMITERS).filter(Boolean);
  const ranked = splitted
    .map((sentence) => ({ sentence, score: sentenceScore(sentence, frequencies) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, sentences)
    .sort((a, b) => normalized.indexOf(a.sentence) - normalized.indexOf(b.sentence))
    .map(({ sentence }) => sentence.trim());

  return ranked.join(' ');
};

export const extractKeywords = async (text: string, max = 8) => {
  const tokens = tokenize(text).filter((token) => !STOPWORDS.has(token));
  const frequencies = new Map<string, number>();
  tokens.forEach((token) => frequencies.set(token, (frequencies.get(token) ?? 0) + 1));
  const keywords = [...frequencies.entries()].sort((a, b) => b[1] - a[1]).slice(0, max).map(([word]) => word);
  return keywords;
};

export interface SemanticDocument {
  id: string;
  text: string;
  vector?: number[];
}

const l2 = (a: number[], b: number[]) => {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    sum += diff * diff;
  }
  return Math.sqrt(sum);
};

const hashEmbedding = (text: string, dimensions = 64) => {
  const tokens = tokenize(text);
  const vector = new Array<number>(dimensions).fill(0);
  tokens.forEach((token, index) => {
    const hash = [...token].reduce((acc, char) => acc + char.charCodeAt(0), index);
    const slot = hash % dimensions;
    vector[slot] += 1;
  });
  return vector.map((value) => value / (tokens.length || 1));
};

export const embedDocument = (doc: SemanticDocument, dimensions = 64): SemanticDocument => ({
  ...doc,
  vector: hashEmbedding(doc.text, dimensions),
});

export const semanticSearch = (query: string, documents: SemanticDocument[], topK = 5) => {
  const queryVector = hashEmbedding(query);
  const withVectors = documents.map((doc) => (doc.vector ? doc : embedDocument(doc)));
  return withVectors
    .map((doc) => ({ doc, distance: l2(queryVector, doc.vector ?? []) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, topK)
    .map(({ doc, distance }) => ({ id: doc.id, score: 1 / (1 + distance) }));
};

export const detectIntent = async (text: string) => {
  const lowered = text.toLowerCase();
  if (/(comprar|buy|purchase)/.test(lowered)) return 'commerce';
  if (/(ajuda|help|assist)/.test(lowered)) return 'support';
  if (/(oi|olá|hello|hey)/.test(lowered)) return 'greeting';
  if (/(denúncia|report|flag)/.test(lowered)) return 'moderation';
  return 'general';
};
