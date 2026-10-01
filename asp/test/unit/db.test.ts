import { beforeEach, describe, expect, it } from 'vitest';
import { openStore, type Store } from '../../src/db.ts';
import { DEFAULT_SETTINGS, ETH_POOL, STUDENT, TOKEN_POOL, deposit, txHash } from './fixtures.ts';

let store: Store;
beforeEach(() => {
  store = openStore(':memory:', DEFAULT_SETTINGS);
});

describe('deposits', () => {
  it('orders by (block, logIndex), filters by scope and ignores duplicates', () => {
    store.insertDeposit(deposit({ label: 3n, block: 201, logIndex: 0 }));
    store.insertDeposit(deposit({ label: 1n, block: 200, logIndex: 5 }));
    store.insertDeposit(deposit({ label: 2n, block: 200, logIndex: 9, scope: TOKEN_POOL.scope, pool: TOKEN_POOL.address }));
    store.insertDeposit(deposit({ label: 1n, block: 200, logIndex: 5, value: 1n }));
    expect(store.listDeposits().map((d) => d.label)).toEqual([1n, 2n, 3n]);
    expect(store.listDeposits(TOKEN_POOL.scope).map((d) => d.label)).toEqual([2n]);
    expect(store.getDeposit(1n)).toEqual(deposit({ label: 1n, block: 200, logIndex: 5 }));
    expect(store.getDeposit(99n)).toBeNull();
  });

  it('round-trips field-sized integers exactly', () => {
    const big = 21888242871839275222246405745257275088548364400416034343698204186575808495616n;
    store.insertDeposit(deposit({ label: big, commitment: big - 1n, precommitment: big - 2n, scope: big - 3n }));
    expect(store.getDeposit(big)).toEqual(deposit({ label: big, commitment: big - 1n, precommitment: big - 2n, scope: big - 3n }));
  });
});

describe('leaves, withdrawals and ragequits', () => {
  it('lists leaves per scope in index order', () => {
    store.insertLeaf({ scope: ETH_POOL.scope, index: 1, leaf: 20n, root: 2n, block: 201 });
    store.insertLeaf({ scope: ETH_POOL.scope, index: 0, leaf: 10n, root: 1n, block: 200 });
    store.insertLeaf({ scope: TOKEN_POOL.scope, index: 0, leaf: 99n, root: 9n, block: 200 });
    store.insertLeaf({ scope: ETH_POOL.scope, index: 0, leaf: 10n, root: 1n, block: 200 });
    expect(store.listLeaves(ETH_POOL.scope)).toEqual([10n, 20n]);
    expect(store.listLeaves(TOKEN_POOL.scope)).toEqual([99n]);
  });

  it('stores withdrawals and ragequits and reports exited labels', () => {
    const w = { scope: ETH_POOL.scope, processooor: STUDENT, value: 5n, spentNullifier: 6n, newCommitment: 7n, block: 300, logIndex: 1, txHash: txHash(300), timestamp: 3_000 } as const;
    store.insertWithdrawal(w);
    store.insertWithdrawal(w);
    const r = { label: 4n, scope: TOKEN_POOL.scope, ragequitter: STUDENT, commitment: 8n, value: 9n, block: 400, logIndex: 2, txHash: txHash(400), timestamp: 4_000 } as const;
    store.insertRagequit(r);
    expect(store.listWithdrawals()).toEqual([w]);
    expect(store.listWithdrawals(TOKEN_POOL.scope)).toEqual([]);
    expect(store.listRagequits(TOKEN_POOL.scope)).toEqual([r]);
    expect(store.exitedLabels()).toEqual(new Set(['4']));
  });
});

describe('cursors', () => {
  it('starts empty and remembers the last indexed block per pool', () => {
    expect(store.getCursor(ETH_POOL.address)).toBeNull();
    store.setCursor(ETH_POOL.address, 500);
    store.setCursor(ETH_POOL.address, 600);
    expect(store.getCursor(ETH_POOL.address)).toBe(600);
    expect(store.getCursor(TOKEN_POOL.address)).toBeNull();
  });
});

describe('decisions', () => {
  it('returns the latest decision per label and the full history', () => {
    store.addDecision({ label: 1n, status: 'approved', source: 'auto', actor: null, at: 10 });
    store.addDecision({ label: 2n, status: 'approved', source: 'auto', actor: null, at: 11 });
    store.addDecision({ label: 1n, status: 'declined', source: 'admin', actor: STUDENT, at: 12 });
    const latest = store.latestDecisions();
    expect(latest.get('1')).toEqual({ label: 1n, status: 'declined', source: 'admin', actor: STUDENT, at: 12 });
    expect(latest.get('2')?.status).toBe('approved');
    expect(store.decisionHistory(1n).map((d) => d.status)).toEqual(['approved', 'declined']);
  });
});

describe('snapshots', () => {
  const doc = (labels: string[]) => JSON.stringify({ chainId: 1, entrypoint: '0x1', root: '5', labels, createdAt: 1 });

  it('moves through pending -> sent -> confirmed and parses labels from the document', () => {
    const id = store.insertSnapshot({ root: 5n, cid: 'bafkreia', document: doc(['1', '2']), createdAt: 100 });
    expect(store.latestSnapshot()?.status).toBe('pending');
    expect(store.pendingSnapshots().map((s) => s.id)).toEqual([id]);
    store.markSnapshotSent(id, txHash(1));
    store.markSnapshotConfirmed(id, 777, 105);
    const confirmed = store.latestConfirmedSnapshot();
    expect(confirmed).toMatchObject({ id, root: 5n, cid: 'bafkreia', labels: [1n, 2n], status: 'confirmed', txHash: txHash(1), block: 777, confirmedAt: 105, error: null });
    expect(store.pendingSnapshots()).toEqual([]);
    expect(store.snapshotByCid('bafkreia')?.id).toBe(id);
    expect(store.snapshotByCid('nope')).toBeNull();
  });

  it('records failures without touching the latest confirmed snapshot', () => {
    const ok = store.insertSnapshot({ root: 5n, cid: 'c1', document: doc(['1']), createdAt: 100 });
    store.markSnapshotConfirmed(ok, 1, 101);
    const bad = store.insertSnapshot({ root: 6n, cid: 'c2', document: doc(['1', '2']), createdAt: 200 });
    store.markSnapshotFailed(bad, 'reverted');
    expect(store.latestConfirmedSnapshot()?.id).toBe(ok);
    expect(store.latestSnapshot()).toMatchObject({ id: bad, status: 'failed', error: 'reverted' });
    expect(store.listSnapshots(10).map((s) => s.id)).toEqual([bad, ok]);
    expect(store.listSnapshots(1).map((s) => s.id)).toEqual([bad]);
  });
});

describe('settings', () => {
  it('returns defaults and persists only overrides', () => {
    expect(store.getSettings()).toEqual(DEFAULT_SETTINGS);
    expect(store.updateSettings({ freezeRoots: true })).toEqual({ ...DEFAULT_SETTINGS, freezeRoots: true });
    expect(store.updateSettings({ autoApproveDelaySec: 5 })).toEqual({ ...DEFAULT_SETTINGS, freezeRoots: true, autoApproveDelaySec: 5 });
    expect(store.getSettings()).toEqual({ ...DEFAULT_SETTINGS, freezeRoots: true, autoApproveDelaySec: 5 });
  });
});

describe('nonces', () => {
  it('can be consumed once, only before expiry', () => {
    store.createNonce('n1', 100);
    store.createNonce('n2', 100);
    expect(store.consumeNonce('n1', 150, 300)).toBe(true);
    expect(store.consumeNonce('n1', 150, 300)).toBe(false);
    expect(store.consumeNonce('n2', 401, 300)).toBe(false);
    expect(store.consumeNonce('unknown', 150, 300)).toBe(false);
  });
});

describe('transaction', () => {
  it('rolls back every write when the callback throws', () => {
    expect(() =>
      store.transaction(() => {
        store.insertDeposit(deposit({ label: 1n }));
        throw new Error('boom');
      }),
    ).toThrow('boom');
    expect(store.listDeposits()).toEqual([]);
  });
});
