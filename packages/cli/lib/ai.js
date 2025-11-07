const SENTENCE_DELIMITERS = /(?<=[.!?])\s+/g;
const STOPWORDS = new Set(
  'a,ao,aos,à,às,o,os,as,e,é,do,da,dos,das,de,em,um,uma,uns,umas,que,como,para,por,com,sem,se,na,no,nos,nas,os,das'.split(',')
);

const tokenize = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-zà-ú0-9\s]/gi, ' ')
    .split(/\s+/)
    .filter(Boolean);

const sentenceScore = (sentence, keywords) => {
  const words = tokenize(sentence);
  if (words.length === 0) return 0;
  const score = words.reduce((acc, word) => acc + (keywords.get(word) ?? 0), 0);
  return score / words.length;
};

const summarize = async (text, sentences = 3) => {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return '';

  const tokens = tokenize(normalized).filter((token) => !STOPWORDS.has(token));
  const frequencies = new Map();
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

const extractKeywords = async (text, max = 8) => {
  const tokens = tokenize(text).filter((token) => !STOPWORDS.has(token));
  const frequencies = new Map();
  tokens.forEach((token) => frequencies.set(token, (frequencies.get(token) ?? 0) + 1));
  const keywords = [...frequencies.entries()].sort((a, b) => b[1] - a[1]).slice(0, max).map(([word]) => word);
  return keywords;
};

const detectIntent = async (text) => {
  const lowered = text.toLowerCase();
  if (/(comprar|buy|purchase)/.test(lowered)) return 'commerce';
  if (/(ajuda|help|assist)/.test(lowered)) return 'support';
  if (/(oi|olá|hello|hey)/.test(lowered)) return 'greeting';
  if (/(denúncia|report|flag)/.test(lowered)) return 'moderation';
  return 'general';
};

module.exports = {
  summarize,
  extractKeywords,
  detectIntent,
};
