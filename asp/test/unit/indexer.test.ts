import { beforeEach, describe, expect, it } from 'vitest';
import type { LogSource, PoolLog } from '../../src/chain.ts';
import { openStore, type Store } from '../../src/db.ts';
import { createIndexer } from '../../src/indexer.ts';
import type { Address } from '../../src/types.ts';
import { DEFAULT_SETTINGS, ETH_POOL, STUDENT, TOKEN_POOL, txHash } from './fixtures.ts';

function fakeSource(state: { head: number; logs: Partial<Record<Address, PoolLog[]>> }) {
  const calls: [Address, number, number][] = [];
  const source: LogSource = {
    head: async () => state.head,
    poolLogs: async (pool, from, to) => {
      calls.push([pool, from, to]);
      return (state.logs[pool] ?? []).filter((l) => l.block >= from && l.block <= to);
    },
    blockTimestamp: async (block) => 1_000_000 + block,
  };
  return { source, calls };
}

const ethLogs: PoolLog[] = [
  { kind: 'deposit', block: 150, logIndex: 1, txHash: txHash(150), depositor: STUDENT, commitment: 1000n, label: 1n, value: 10n ** 15n, precommitment: 7n },
  { kind: 'leaf', block: 150, logIndex: 0, txHash: txHash(150), index: 0, leaf: 1000n, root: 1000n },
  { kind: 'withdrawal', block: 700, logIndex: 3, txHash: txHash(700), processooor: STUDENT, value: 5n, spentNullifier: 6n, newCommitment: 2000n },
  { kind: 'leaf', block: 700, logIndex: 4, txHash: txHash(700), index: 1, leaf: 2000n, root: 3000n },
];
const tokenLogs: PoolLog[] = [
  { kind: 'ragequit', block: 900, logIndex: 0, txHash: txHash(900), ragequitter: STUDENT, commitment: 9n, label: 2n, value: 10n },
];

let store: Store;
beforeEach(() => {
  store = openStore(':memory:', DEFAULT_SETTINGS);
});

describe('indexer', () => {
  it('scans from the deployment block to head - confirmations in chunks', async () => {
    const { source, calls } = fakeSource({ head: 1012, logs: { [ETH_POOL.address]: ethLogs, [TOKEN_POOL.address]: tokenLogs } });
    const indexer = createIndexer({ store, source, pools: [ETH_POOL, TOKEN_POOL], confirmations: 2, chunkSize: 500 });
    expect(await indexer.tick()).toBe(1010);
    expect(calls).toEqual([
      [ETH_POOL.address, 100, 599],
      [ETH_POOL.address, 600, 1010],
      [TOKEN_POOL.address, 100, 599],
      [TOKEN_POOL.address, 600, 1010],
    ]);
    expect(store.getCursor(ETH_POOL.address)).toBe(1010);
    expect(store.getCursor(TOKEN_POOL.address)).toBe(1010);
  });

  it('stores every log kind with its pool scope and block timestamp', async () => {
    const { source } = fakeSource({ head: 1012, logs: { [ETH_POOL.address]: ethLogs, [TOKEN_POOL.address]: tokenLogs } });
    await createIndexer({ store, source, pools: [ETH_POOL, TOKEN_POOL], confirmations: 2, chunkSize: 500 }).tick();
    expect(store.listDeposits()).toEqual([
      { label: 1n, scope: ETH_POOL.scope, pool: ETH_POOL.address, depositor: STUDENT, commitment: 1000n, value: 10n ** 15n, precommitment: 7n, block: 150, logIndex: 1, txHash: txHash(150), timestamp: 1_000_150 },
    ]);
    expect(store.listLeaves(ETH_POOL.scope)).toEqual([1000n, 2000n]);
    expect(store.listWithdrawals(ETH_POOL.scope)).toEqual([
      { scope: ETH_POOL.scope, processooor: STUDENT, value: 5n, spentNullifier: 6n, newCommitment: 2000n, block: 700, logIndex: 3, txHash: txHash(700), timestamp: 1_000_700 },
    ]);
    expect(store.listRagequits(TOKEN_POOL.scope)).toEqual([
      { label: 2n, scope: TOKEN_POOL.scope, ragequitter: STUDENT, commitment: 9n, value: 10n, block: 900, logIndex: 0, txHash: txHash(900), timestamp: 1_000_900 },
    ]);
  });

  it('resumes from the cursor and only scans new blocks', async () => {
    const state = { head: 1012, logs: { [ETH_POOL.address]: ethLogs } };
    const { source, calls } = fakeSource(state);
    const indexer = createIndexer({ store, source, pools: [ETH_POOL], confirmations: 2, chunkSize: 500 });
    await indexer.tick();
    calls.length = 0;
    await indexer.tick();
    expect(calls).toEqual([]);
    state.head = 1100;
    expect(await indexer.tick()).toBe(1098);
    expect(calls).toEqual([[ETH_POOL.address, 1011, 1098]]);
    expect(store.listDeposits()).toHaveLength(1);
  });

  it('does nothing until the deployment block is confirmed', async () => {
    const { source, calls } = fakeSource({ head: 101, logs: {} });
    await createIndexer({ store, source, pools: [ETH_POOL], confirmations: 2, chunkSize: 500 }).tick();
    expect(calls).toEqual([]);
    expect(store.getCursor(ETH_POOL.address)).toBeNull();
  });
});
