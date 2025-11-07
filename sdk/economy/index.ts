export interface TransferReceipt {
  tx: string;
  from: string;
  to: string;
  amount: bigint;
  memo?: string;
  timestamp: number;
}

export interface SerializedTransferReceipt extends Omit<TransferReceipt, 'amount'> {
  amount: string;
}

export interface SerializedLedgerState {
  ledger: SerializedTransferReceipt[];
  balances: Record<string, string>;
}

export type BalanceMap = Map<string, bigint>;

const ledger: TransferReceipt[] = [];
const balances: BalanceMap = new Map();

const toBigInt = (value: string | number | bigint) => {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return BigInt(Math.trunc(value));
  if (/^0x/i.test(value)) return BigInt(value);
  return BigInt(Math.round(Number(value) * 1e6)) / 1_000_000n;
};

const nextTx = () => `0x${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;

export const credit = (account: string, amount: string | number | bigint) => {
  const value = toBigInt(amount);
  balances.set(account, (balances.get(account) ?? 0n) + value);
};

export const debit = (account: string, amount: string | number | bigint) => {
  const value = toBigInt(amount);
  const current = balances.get(account) ?? 0n;
  if (current < value) throw new Error('Saldo insuficiente');
  balances.set(account, current - value);
};

export const balanceOf = (account: string) => balances.get(account) ?? 0n;

export const ensureTreasury = (amount: bigint) => {
  const current = balances.get('treasury') ?? 0n;
  if (current < amount) {
    credit('treasury', amount - current);
  }
};

export const payFREE = async (to: string, amount: string | number | bigint, memo?: string) => {
  const value = toBigInt(amount);
  ensureTreasury(value);
  debit('treasury', value);
  credit(to, value);
  const receipt: TransferReceipt = {
    tx: nextTx(),
    from: 'treasury',
    to,
    amount: value,
    memo,
    timestamp: Date.now(),
  };
  ledger.push(receipt);
  return receipt;
};

export const recordTransfer = (from: string, to: string, amount: string | number | bigint, memo?: string) => {
  const value = toBigInt(amount);
  debit(from, value);
  credit(to, value);
  const receipt: TransferReceipt = {
    tx: nextTx(),
    from,
    to,
    amount: value,
    memo,
    timestamp: Date.now(),
  };
  ledger.push(receipt);
  return receipt;
};

export const history = () => [...ledger];

export const resetLedger = () => {
  ledger.length = 0;
  balances.clear();
};

export const exportLedgerState = (): SerializedLedgerState => ({
  ledger: ledger.map(({ amount, ...rest }) => ({ ...rest, amount: amount.toString() })),
  balances: Object.fromEntries([...balances.entries()].map(([account, value]) => [account, value.toString()])),
});

export const importLedgerState = (state?: SerializedLedgerState) => {
  ledger.length = 0;
  balances.clear();
  if (!state) return;

  (state.ledger ?? []).forEach((entry) => {
    const receipt: TransferReceipt = {
      ...entry,
      amount: BigInt(entry.amount),
    };
    ledger.push(receipt);
  });

  Object.entries(state.balances ?? {}).forEach(([account, value]) => {
    try {
      balances.set(account, BigInt(value));
    } catch (error) {
      throw new Error(`Invalid balance value for ${account}`);
    }
  });
};
