import { beforeEach, describe, expect, it } from 'vitest';
import type { Receipt, RootChain } from '../../src/chain.ts';
import { cidOf } from '../../src/cid.ts';
import { openStore, type Store } from '../../src/db.ts';
import { createPublisher } from '../../src/publisher.ts';
import { treeRoot } from '../../src/tree.ts';
import type { Hash } from '../../src/types.ts';
import { DEFAULT_SETTINGS, ETH_POOL, deposit, txHash } from './fixtures.ts';

const ENTRYPOINT = '0x1000000000000000000000000000000000000004';

function fakeChain(initialRoot: bigint | null = null) {
  const state = {
    root: initialRoot,
    reads: 0,
    sent: [] as { root: bigint; cid: string }[],
    mode: 'ok' as 'ok' | 'revert' | 'throw',
    receipts: new Map<Hash, Receipt>(),
  };
  const chain: RootChain = {
    latestRoot: async () => {
      state.reads++;
      return state.root;
    },
    updateRoot: async (root, cid) => {
      if (state.mode === 'throw') throw new Error('rpc unavailable');
      state.sent.push({ root, cid });
      const hash = txHash(state.sent.length);
      const ok = state.mode === 'ok';
      if (ok) state.root = root;
      state.receipts.set(hash, { status: ok ? 'success' : 'reverted', block: 500 + state.sent.length });
      return hash;
    },
    waitForReceipt: async (hash) => state.receipts.get(hash) as Receipt,
    receiptStatus: async (hash) => state.receipts.get(hash) ?? null,
  };
  return { chain, state };
}

let store: Store;
let now: number;
const clock = () => now;
const silent = () => {};

function approve(...labels: bigint[]) {
  labels.forEach((label, i) => {
    store.insertDeposit(deposit({ label, block: 200 + i }));
    store.addDecision({ label, status: 'approved', source: 'auto', actor: null, at: now });
  });
}

beforeEach(() => {
  store = openStore(':memory:', { ...DEFAULT_SETTINGS, publishIntervalSec: 0 });
  now = 10_000;
});

const make = (chain: RootChain) => createPublisher({ store, chain, chainId: 11155111, entrypoint: ENTRYPOINT, clock, log: silent });

describe('publisher.tick', () => {
  it('reports empty when nothing is approved', async () => {
    const { chain, state } = fakeChain();
    expect(await make(chain).tick()).toBe('empty');
    expect(state.sent).toEqual([]);
  });

  it('publishes the approved set and records a confirmed snapshot', async () => {
    approve(1n, 2n);
    const { chain, state } = fakeChain();
    expect(await make(chain).tick()).toBe('published');
    const snapshot = store.latestConfirmedSnapshot();
    expect(state.sent).toEqual([{ root: treeRoot([1n, 2n]), cid: snapshot?.cid }]);
    expect(snapshot).toMatchObject({ root: treeRoot([1n, 2n]), labels: [1n, 2n], status: 'confirmed', txHash: txHash(1), block: 501, createdAt: 10_000 });
    expect(snapshot?.cid).toBe(await cidOf(snapshot?.document as string));
    expect(JSON.parse(snapshot?.document as string)).toEqual({ chainId: 11155111, entrypoint: ENTRYPOINT, root: treeRoot([1n, 2n]).toString(), labels: ['1', '2'], createdAt: 10_000 });
  });

  it('skips unchanged sets and declined labels', async () => {
    approve(1n, 2n);
    const { chain, state } = fakeChain();
    const publisher = make(chain);
    await publisher.tick();
    expect(await publisher.tick()).toBe('unchanged');
    store.addDecision({ label: 2n, status: 'declined', source: 'admin', actor: null, at: now });
    expect(await publisher.tick()).toBe('published');
    expect(state.sent.at(-1)?.root).toBe(treeRoot([1n]));
  });

  it('waits for the publish interval since the last attempt', async () => {
    store.updateSettings({ publishIntervalSec: 60 });
    approve(1n);
    const { chain } = fakeChain();
    const publisher = make(chain);
    expect(await publisher.tick()).toBe('published');
    approve(2n);
    now += 59;
    expect(await publisher.tick()).toBe('waiting');
    now += 1;
    expect(await publisher.tick()).toBe('published');
  });

  it('does nothing while roots are frozen', async () => {
    approve(1n);
    store.updateSettings({ freezeRoots: true });
    const { chain, state } = fakeChain();
    expect(await make(chain).tick()).toBe('frozen');
    expect(state.sent).toEqual([]);
  });

  it('records reverted and thrown publishes as failed', async () => {
    approve(1n);
    const { chain, state } = fakeChain();
    const publisher = make(chain);
    state.mode = 'revert';
    expect(await publisher.tick()).toBe('failed');
    expect(store.latestSnapshot()).toMatchObject({ status: 'failed', error: 'reverted' });
    state.mode = 'throw';
    expect(await publisher.tick()).toBe('failed');
    expect(store.latestSnapshot()).toMatchObject({ status: 'failed', error: 'rpc unavailable' });
    expect(store.latestConfirmedSnapshot()).toBeNull();
  });
});

describe('publisher.reconcile', () => {
  it('confirms a pending snapshot whose transaction was mined and fails unsent ones', async () => {
    const { chain, state } = fakeChain(7n);
    state.receipts.set(txHash(42), { status: 'success', block: 900 });
    const mined = store.insertSnapshot({ root: 7n, cid: 'c1', document: '{"labels":["1"]}', createdAt: 1 });
    store.markSnapshotSent(mined, txHash(42));
    const unsent = store.insertSnapshot({ root: 8n, cid: 'c2', document: '{"labels":["1","2"]}', createdAt: 2 });
    await make(chain).reconcile();
    expect(store.latestConfirmedSnapshot()).toMatchObject({ id: mined, block: 900 });
    expect(store.latestSnapshot()).toMatchObject({ id: unsent, status: 'failed', error: 'not sent' });
  });

  it('forces a republish when the chain root differs from the last confirmed snapshot', async () => {
    approve(1n);
    const first = fakeChain();
    await make(first.chain).tick();
    store.updateSettings({ publishIntervalSec: 3_600 });
    const fresh = fakeChain(null);
    const publisher = make(fresh.chain);
    await publisher.reconcile();
    expect(await publisher.tick()).toBe('published');
    expect(fresh.state.sent).toHaveLength(1);
    expect(await publisher.tick()).toBe('waiting');
  });

  it('leaves a consistent chain alone', async () => {
    approve(1n);
    const { chain, state } = fakeChain();
    const publisher = make(chain);
    await publisher.tick();
    await publisher.reconcile();
    expect(await publisher.tick()).toBe('unchanged');
    expect(state.sent).toHaveLength(1);
  });
});

describe('publisher.onchainRoot', () => {
  it('caches the chain root for five seconds', async () => {
    const { chain, state } = fakeChain(5n);
    const publisher = make(chain);
    expect(await publisher.onchainRoot()).toBe(5n);
    now += 4;
    await publisher.onchainRoot();
    expect(state.reads).toBe(1);
    now += 1;
    await publisher.onchainRoot();
    expect(state.reads).toBe(2);
  });
});
