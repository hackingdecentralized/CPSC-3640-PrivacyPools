import type { DepositRow, DepositStatus, PoolConfig, RagequitRow, WithdrawalRow } from '../types.ts';

const NATIVE_ASSET = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const DAY_SEC = 86_400;

export const iso = (sec: number): string => new Date(sec * 1000).toISOString();

/** Upstream reports the chain's native currency as the zero address. */
export const tokenAddr = (pool: PoolConfig): string => (pool.asset.toLowerCase() === NATIVE_ASSET ? ZERO_ADDRESS : pool.asset);

const sum = (values: bigint[]): bigint => values.reduce((a, b) => a + b, 0n);

/** The upstream `AllEventsResponse` event shape. */
export type PublicEvent = {
  type: 'deposit' | 'withdrawal' | 'exit';
  createdAt: string;
  amount: string;
  address: string;
  txHash: string;
  precommitmentHash: string;
  reviewStatus: string;
  timestamp: number;
};

export type ActivityItem = { block: number; logIndex: number; scope: bigint; label: bigint | null; event: PublicEvent };

/** Deposits, withdrawals and ragequits merged newest first. */
export function activity(
  deposits: DepositRow[],
  withdrawals: WithdrawalRow[],
  ragequits: RagequitRow[],
  statuses: Map<string, DepositStatus>,
): ActivityItem[] {
  const event = (type: PublicEvent['type'], row: { value: bigint; txHash: string; timestamp: number }, address: string, precommitmentHash: string, reviewStatus: string): PublicEvent => ({
    type,
    createdAt: iso(row.timestamp),
    amount: row.value.toString(),
    address,
    txHash: row.txHash,
    precommitmentHash,
    reviewStatus,
    timestamp: row.timestamp * 1000,
  });
  const items: ActivityItem[] = [
    ...deposits.map((d) => ({
      block: d.block,
      logIndex: d.logIndex,
      scope: d.scope,
      label: d.label,
      event: event('deposit', d, d.depositor, d.precommitment.toString(), statuses.get(d.label.toString()) ?? 'pending'),
    })),
    ...withdrawals.map((w) => ({ block: w.block, logIndex: w.logIndex, scope: w.scope, label: null, event: event('withdrawal', w, w.processooor, '', 'approved') })),
    ...ragequits.map((r) => ({ block: r.block, logIndex: r.logIndex, scope: r.scope, label: r.label, event: event('exit', r, r.ragequitter, '', 'exited') })),
  ];
  return items.sort((a, b) => b.block - a.block || b.logIndex - a.logIndex);
}

export function parsePaging(page: string | undefined, perPage: string | undefined): { page: number; perPage: number } {
  const p = Number(page ?? 1);
  const n = Number(perPage ?? 10);
  return {
    page: Number.isInteger(p) && p >= 1 ? p : 1,
    perPage: Number.isInteger(n) && n >= 1 ? Math.min(n, 100) : 10,
  };
}

export function paginate<T>(items: T[], page: number, perPage: number): { items: T[]; page: number; perPage: number; total: number } {
  return { items: items.slice((page - 1) * perPage, page * perPage), page, perPage, total: items.length };
}

export type PoolData = {
  deposits: DepositRow[];
  withdrawals: WithdrawalRow[];
  ragequits: RagequitRow[];
  statuses: Map<string, DepositStatus>;
};

export function poolStats(pool: PoolConfig, chainId: number, data: PoolData) {
  const withStatus = (s: DepositStatus) => data.deposits.filter((d) => data.statuses.get(d.label.toString()) === s);
  const accepted = withStatus('approved');
  const pending = withStatus('pending');
  const totalDeposits = sum(data.deposits.map((d) => d.value));
  const inPool = totalDeposits - sum(data.withdrawals.map((w) => w.value)) - sum(data.ragequits.map((r) => r.value));
  return {
    scope: pool.scope.toString(),
    chainId,
    totalInPoolValue: inPool.toString(),
    totalInPoolValueUsd: '0',
    totalDepositsValue: totalDeposits.toString(),
    totalDepositsValueUsd: '0',
    acceptedDepositsValue: sum(accepted.map((d) => d.value)).toString(),
    acceptedDepositsValueUsd: '0',
    totalDepositsCount: data.deposits.length,
    acceptedDepositsCount: accepted.length,
    pendingDepositsValue: sum(pending.map((d) => d.value)).toString(),
    pendingDepositsValueUsd: '0',
    pendingDepositsCount: pending.length,
    tokenSymbol: pool.symbol,
    tokenAddress: tokenAddr(pool),
    growth24h: null,
    pendingGrowth24h: null,
  };
}

/** Upstream `TimeBasedStats` for events at or after `sinceSec`; `tvl` is always the current pool value. */
export function timeStats(data: Pick<PoolData, 'deposits' | 'withdrawals'>, tvl: bigint, sinceSec: number) {
  const deposits = data.deposits.filter((d) => d.timestamp >= sinceSec);
  const withdrawals = data.withdrawals.filter((w) => w.timestamp >= sinceSec);
  const depositsValue = sum(deposits.map((d) => d.value));
  return {
    tvl: tvl.toString(),
    tvlUsd: '0',
    avgDepositSize: deposits.length ? (depositsValue / BigInt(deposits.length)).toString() : '0',
    avgDepositSizeUsd: '0',
    totalDepositsCount: deposits.length,
    totalDepositsValue: depositsValue.toString(),
    totalDepositsValueUsd: '0',
    totalWithdrawalsCount: withdrawals.length,
    totalWithdrawalsValue: sum(withdrawals.map((w) => w.value)).toString(),
    totalWithdrawalsValueUsd: '0',
  };
}

export const last24h = (now: number): number => now - DAY_SEC;
