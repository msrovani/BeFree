const test = require('node:test');
const assert = require('node:assert/strict');
const { TextEncoder } = require('util');

const { CommunitySimulator } = require('../packages/cli/simulator');
const { createIdentity, signPayloadBase64 } = require('../packages/cli/lib/identity');
const { classify, moderate } = require('../packages/cli/lib/content');
const { summarize, extractKeywords, detectIntent } = require('../packages/cli/lib/ai');

const encoder = new TextEncoder();

const forgeEnvelope = async (identity) => {
  const manifest = {
    title: 'Checklist de acolhimento',
    tags: ['acolhimento', 'mentoria'],
    evidence: { creationUnix: Date.now(), cid: 'cid-checklist' },
  };
  const body = 'Oi comunidade! Precisamos de ajuda para guiar noves integrantes e revisar passos.';
  const result = {
    selo: await classify(manifest),
    moderation: await moderate(manifest),
    summary: await summarize(body),
    keywords: await extractKeywords(body),
    intent: await detectIntent(body),
  };
  const timestamp = Date.now();
  const payloadBytes = encoder.encode(JSON.stringify({ manifest, body, result, timestamp }));
  const signature = signPayloadBase64(payloadBytes, identity);
  return {
    manifest,
    body,
    result,
    timestamp,
    author: {
      did: identity.did,
      publicKey: identity.pub,
      wallet: identity.wallet,
      label: identity.label,
    },
    signature,
  };
};

test('ingest aceita envelope válido e rejeita duplicados e inválidos', async () => {
  const simulator = new CommunitySimulator();
  const identity = createIdentity('Observadora Externa');
  const envelope = await forgeEnvelope(identity);

  const accepted = await simulator.ingest(envelope, 'peer-sul');
  assert.equal(accepted, 'accepted');
  assert.ok(simulator.reputationScore() > 0);

  const duplicate = await simulator.ingest(envelope, 'peer-sul');
  assert.equal(duplicate, 'duplicate');

  const corrupted = Buffer.from(envelope.signature, 'base64');
  if (corrupted.length > 0) {
    corrupted[0] = corrupted[0] ^ 0xff;
  }
  const invalidEnvelope = { ...envelope, signature: Buffer.from(corrupted).toString('base64'), timestamp: envelope.timestamp + 1 };
  const invalid = await simulator.ingest(invalidEnvelope, 'peer-sul');
  assert.equal(invalid, 'invalid');
});
