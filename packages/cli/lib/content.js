const containsAIHints = (manifest) => {
  const text = `${manifest.title ?? ''} ${manifest.description ?? ''}`.toLowerCase();
  const tags = (manifest.tags ?? []).map((tag) => tag.toLowerCase());
  const aiWords = ['ai', 'stable diffusion', 'midjourney', 'chatgpt', 'gpt', 'llm'];
  return aiWords.some((word) => text.includes(word) || tags.includes(word));
};

const hasEditingSoftware = (manifest) => {
  const software = manifest.evidence?.editSoftware?.toLowerCase();
  if (!software) return false;
  return /(photoshop|premiere|final cut|after effects|davinci|audacity)/.test(software);
};

const hasRemixReference = (manifest) => Boolean(manifest.evidence?.remixFrom);

const hasProofOfCapture = (manifest) =>
  Boolean(manifest.evidence?.cameraMake && manifest.evidence?.cameraModel && manifest.evidence?.creationUnix);

const classify = async (manifest) => {
  if (hasProofOfCapture(manifest)) return 'proof_of_capture';
  if (hasRemixReference(manifest)) return 'remix';
  if (manifest.evidence?.aiModel || containsAIHints(manifest)) {
    if (manifest.evidence?.editUnix && manifest.evidence.editUnix !== manifest.evidence.creationUnix) {
      return 'assisted_ai';
    }
    return 'generated_ai';
  }
  if (hasEditingSoftware(manifest)) return 'edited';
  return 'unknown';
};

const SENSITIVE_WORDS = ['violência', 'hate', 'terrorismo', 'explosivos'];

const moderate = async (manifest) => {
  const issues = [];
  const haystack = `${manifest.title ?? ''} ${manifest.description ?? ''}`.toLowerCase();
  SENSITIVE_WORDS.forEach((word) => {
    if (haystack.includes(word)) {
      issues.push({
        reason: `Conteúdo potencialmente sensível detectado: ${word}`,
        severity: 'medium',
      });
    }
  });
  if (manifest.sizeBytes && manifest.sizeBytes > 1_000_000_000) {
    issues.push({ reason: 'Arquivo muito grande para replicação rápida', severity: 'low' });
  }
  if (!manifest.cid) {
    issues.push({ reason: 'CID/IPFS ausente', severity: 'high' });
  }
  return issues;
};

module.exports = {
  classify,
  moderate,
};
