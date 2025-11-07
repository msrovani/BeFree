#!/usr/bin/env node
const { mkdirSync, readFileSync, writeFileSync, existsSync } = require('fs');
const { join } = require('path');
const { createHash, randomUUID, generateKeyPairSync } = require('crypto');

const DATA_DIR = join(process.env.HOME ?? process.cwd(), '.befree');
const IDENTITY_FILE = join(DATA_DIR, 'identity.json');
const LEDGER_FILE = join(DATA_DIR, 'ledger.json');

const ensureDataDir = () => {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
};

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

const loadIdentity = () => {
  if (!existsSync(IDENTITY_FILE)) return undefined;
  return JSON.parse(readFileSync(IDENTITY_FILE, 'utf-8'));
};

const saveIdentity = (identity) => {
  ensureDataDir();
  writeFileSync(IDENTITY_FILE, JSON.stringify(identity, null, 2));
};

const loadLedger = () => {
  if (!existsSync(LEDGER_FILE)) return [];
  return JSON.parse(readFileSync(LEDGER_FILE, 'utf-8'));
};

const saveLedger = (ledger) => {
  ensureDataDir();
  writeFileSync(LEDGER_FILE, JSON.stringify(ledger, null, 2));
};

const recordTransfer = (from, to, amount, memo) => {
  const ledger = loadLedger();
  ledger.push({
    tx: `0x${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`,
    from,
    to,
    amount: Number(amount),
    memo,
    timestamp: new Date().toISOString(),
  });
  saveLedger(ledger);
  return ledger[ledger.length - 1];
};

const command = process.argv[2];
const args = process.argv.slice(3);

const format = (value) => JSON.stringify(value, null, 2);

const commands = {
  'identity:create': () => {
    const label = args[0];
    const identity = createIdentity(label);
    saveIdentity(identity);
    console.log(format({ message: 'Identidade criada', identity }));
  },
  'identity:show': () => {
    const identity = loadIdentity();
    if (!identity) {
      console.error('Nenhuma identidade encontrada. Rode `befree identity:create`.');
      process.exit(1);
    }
    console.log(format(identity));
  },
  'ledger:transfer': () => {
    const [from, to, amount, memo] = args;
    if (!from || !to || !amount) {
      console.error('Uso: befree ledger:transfer <from> <to> <amount> [memo]');
      process.exit(1);
    }
    const receipt = recordTransfer(from, to, amount, memo);
    console.log(format({ message: 'Transferência registrada', receipt }));
  },
  'ledger:history': () => {
    const ledger = loadLedger();
    console.log(format({ total: ledger.length, entries: ledger }));
  },
  help: () => {
    console.log(`BEFREE CLI\n\nComandos disponíveis:\n  befree identity:create [label]   Cria e salva uma identidade DID local\n  befree identity:show              Mostra a identidade ativa\n  befree ledger:transfer ...        Registra uma transferência manual\n  befree ledger:history             Lista as transferências registradas\n`);
  },
};

if (!command || !commands[command]) {
  commands.help();
  process.exit(command ? 1 : 0);
}

Promise.resolve(commands[command]())
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
