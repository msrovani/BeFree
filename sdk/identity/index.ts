import { createHash, randomUUID, generateKeyPairSync, createPrivateKey, createPublicKey, sign, verify } from 'crypto';

export interface DID {
  did: string;
  pub: string;
  wallet: string;
}

export interface IdentityKeys extends DID {
  secret: string;
  createdAt: string;
  label?: string;
}

let activeIdentity: IdentityKeys | undefined;

const toDID = (publicKeyDerBase64: string) => {
  const fingerprint = createHash('sha256').update(publicKeyDerBase64).digest('hex');
  return `did:befree:${fingerprint.slice(0, 32)}`;
};

export const createIdentity = (wallet = randomUUID(), label?: string): IdentityKeys => {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const pubDer = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  const secretDer = privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64');
  const did = toDID(pubDer);

  const identity: IdentityKeys = {
    did,
    pub: pubDer,
    wallet,
    secret: secretDer,
    createdAt: new Date().toISOString(),
    label,
  };
  activeIdentity = identity;
  return identity;
};

export const setActiveIdentity = (identity: IdentityKeys) => {
  activeIdentity = identity;
};

export const getActiveIdentity = () => activeIdentity;

const resolveIdentity = (identity?: IdentityKeys) => {
  const resolved = identity ?? activeIdentity;
  if (!resolved) {
    throw new Error('No identity available: call createIdentity() or setActiveIdentity() first.');
  }
  return resolved;
};

export const signPayload = (payload: Uint8Array, identity: IdentityKeys) => {
  const key = createPrivateKey({ key: Buffer.from(identity.secret, 'base64'), format: 'der', type: 'pkcs8' });
  return sign(null, Buffer.from(payload), key);
};

export const signData = async (payload: Uint8Array, identity?: IdentityKeys) => {
  const resolved = resolveIdentity(identity);
  const signature = signPayload(payload, resolved);
  return new Uint8Array(signature);
};

export const verifySignature = (
  payload: Uint8Array,
  signature: Uint8Array,
  publicKeyBase64?: string
) => {
  const identity = resolveIdentity(publicKeyBase64 ? undefined : activeIdentity);
  const key = createPublicKey({ key: Buffer.from(publicKeyBase64 ?? identity.pub, 'base64'), format: 'der', type: 'spki' });
  return verify(null, Buffer.from(payload), key, Buffer.from(signature));
};

export const sign = async (payload: Uint8Array, identity?: IdentityKeys) => signData(payload, identity);

export const verify = async (
  payload: Uint8Array,
  signature: Uint8Array,
  publicKeyBase64?: string
) => verifySignature(payload, signature, publicKeyBase64);

export const exportIdentity = (identity = resolveIdentity()) => ({
  did: identity.did,
  publicKey: identity.pub,
  wallet: identity.wallet,
  createdAt: identity.createdAt,
  label: identity.label,
});

export const importIdentity = (payload: IdentityKeys) => {
  if (!payload.did || !payload.pub || !payload.secret) {
    throw new Error('Invalid identity payload');
  }
  activeIdentity = payload;
  return payload;
};

export const fingerprintFromPublicKey = (publicKeyBase64: string) =>
  createHash('sha256').update(publicKeyBase64).digest('hex');
