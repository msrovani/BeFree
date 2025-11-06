export type Selo = 'proof_of_capture' | 'edited' | 'assisted_ai' | 'generated_ai' | 'remix' | 'unknown';

export interface ContentEvidence {
  cameraMake?: string;
  cameraModel?: string;
  hash?: string;
  creationUnix?: number;
  editUnix?: number;
  editSoftware?: string;
  transcript?: string;
  aiModel?: string;
  remixFrom?: string;
  voiceClone?: boolean;
}

export interface ContentManifest {
  title?: string;
  description?: string;
  tags?: string[];
  mimeType?: string;
  language?: string;
  sizeBytes?: number;
  cid?: string;
  evidence?: ContentEvidence;
}

const containsAIHints = (manifest: ContentManifest) => {
  const text = `${manifest.title ?? ''} ${manifest.description ?? ''}`.toLowerCase();
  const tags = (manifest.tags ?? []).map((tag) => tag.toLowerCase());
  const aiWords = ['ai', 'stable diffusion', 'midjourney', 'chatgpt', 'gpt', 'llm'];
  return aiWords.some((word) => text.includes(word) || tags.includes(word));
};

const hasEditingSoftware = (manifest: ContentManifest) => {
  const software = manifest.evidence?.editSoftware?.toLowerCase();
  if (!software) return false;
  return /(photoshop|premiere|final cut|after effects|davinci|audacity)/.test(software);
};

const hasRemixReference = (manifest: ContentManifest) => Boolean(manifest.evidence?.remixFrom);

const hasProofOfCapture = (manifest: ContentManifest) =>
  Boolean(manifest.evidence?.cameraMake && manifest.evidence?.cameraModel && manifest.evidence?.creationUnix);

export const classify = async (manifest: ContentManifest): Promise<Selo> => {
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

export interface ModerationFlag {
  reason: string;
  severity: 'low' | 'medium' | 'high';
  evidence?: string;
}

const SENSITIVE_WORDS = ['violência', 'hate', 'terrorismo', 'explosivos'];

export const moderate = async (manifest: ContentManifest): Promise<ModerationFlag[]> => {
  const issues: ModerationFlag[] = [];
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
