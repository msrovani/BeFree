const { createHash, randomUUID, generateKeyPairSync, createPrivateKey, createPublicKey, sign, verify } = require('crypto');

const toDID = (publicKeyDerBase64) => {
  const fingerprint = createHash('sha256').update(publicKeyDerBase64).digest('hex');
  return `did:befree:${fingerprint.slice(0, 32)}`;
};

const createIdentity = (label) => {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const pubDer = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  const secretDer = privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64');
  return {
    did: toDID(pubDer),
    pub: pubDer,
    wallet: randomUUID(),
    secret: secretDer,
    createdAt: new Date().toISOString(),
    label,
  };
};

const signPayloadBase64 = (payload, identity) => {
  const key = createPrivateKey({ key: Buffer.from(identity.secret, 'base64'), format: 'der', type: 'pkcs8' });
  const signature = sign(null, Buffer.from(payload), key);
  return Buffer.from(signature).toString('base64');
};

const verifySignature = (payload, signatureBase64, publicKeyBase64) => {
  const key = createPublicKey({ key: Buffer.from(publicKeyBase64, 'base64'), format: 'der', type: 'spki' });
  return verify(null, Buffer.from(payload), key, Buffer.from(signatureBase64, 'base64'));
};

module.exports = {
  createIdentity,
  toDID,
  signPayloadBase64,
  verifySignature,
};
