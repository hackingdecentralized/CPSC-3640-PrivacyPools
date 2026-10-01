import { beforeEach, describe, expect, it } from 'vitest';
import { openStore, type Store } from '../../src/db.ts';
import { PolicyError, approvedLabels, createPolicy, depositStatus, dueForAutoApproval } from '../../src/policy.ts';
import type { DecisionRow } from '../../src/types.ts';
import { DEFAULT_SETTINGS, STUDENT, TOKEN_POOL, deposit, txHash } from './fixtures.ts';

const decision = (label: bigint, status: DecisionRow['status']): DecisionRow => ({ label, status, source: 'auto', actor: null, at: 1 });
const ADMIN = '0x0000000000000000000000000000000000000ad1';

describe('depositStatus', () => {
  it('prefers exited, then the latest decision, else pending', () => {
    expect(depositStatus(undefined, false)).toBe('pending');
    expect(depositStatus(decision(1n, 'approved'), false)).toBe('approved');
    expect(depositStatus(decision(1n, 'declined'), false)).toBe('declined');
    expect(depositStatus(decision(1n, 'approved'), true)).toBe('exited');
  });
});

describe('dueForAutoApproval', () => {
  const deposits = [deposit({ label: 1n, timestamp: 1_000 }), deposit({ label: 2n, timestamp: 1_050 }), deposit({ label: 3n, timestamp: 900 }), deposit({ label: 4n, timestamp: 900 })];
  const decisions = new Map([['3', decision(3n, 'declined')]]);
  const exited = new Set(['4']);

  it('returns undecided, non-exited deposits whose delay has elapsed (boundary inclusive)', () => {
    expect(dueForAutoApproval(deposits, decisions, exited, 1_120, 120)).toEqual([1n]);
    expect(dueForAutoApproval(deposits, decisions, exited, 1_170, 120)).toEqual([1n, 2n]);
    expect(dueForAutoApproval(deposits, decisions, exited, 1_119, 120)).toEqual([]);
  });
});

describe('approvedLabels', () => {
  it('orders approved labels from all pools by (block, logIndex)', () => {
    const deposits = [
      deposit({ label: 30n, block: 300, logIndex: 0 }),
      deposit({ label: 10n, block: 100, logIndex: 7, scope: TOKEN_POOL.scope, pool: TOKEN_POOL.address }),
      deposit({ label: 11n, block: 100, logIndex: 2 }),
      deposit({ label: 20n, block: 200, logIndex: 0 }),
    ];
    const decisions = new Map([
      ['30', decision(30n, 'approved')],
      ['10', decision(10n, 'approved')],
      ['11', decision(11n, 'approved')],
      ['20', decision(20n, 'declined')],
    ]);
    expect(approvedLabels(deposits, decisions)).toEqual([11n, 10n, 30n]);
  });
});

describe('createPolicy', () => {
  let store: Store;
  let now: number;
  beforeEach(() => {
    store = openStore(':memory:', DEFAULT_SETTINGS);
    now = 1_000;
    store.insertDeposit(deposit({ label: 1n, timestamp: 1_000, block: 200, logIndex: 0 }));
    store.insertDeposit(deposit({ label: 2n, timestamp: 1_100, block: 201, logIndex: 0 }));
  });
  const policy = () => createPolicy(store, () => now);

  it('auto-approves due deposits once, honouring the stored delay', () => {
    now = 1_120;
    expect(policy().tick()).toBe(1);
    expect(policy().tick()).toBe(0);
    store.updateSettings({ autoApproveDelaySec: 10 });
    expect(policy().tick()).toBe(1);
    expect(store.decisionHistory(2n)).toEqual([{ label: 2n, status: 'approved', source: 'auto', actor: null, at: 1_120 }]);
  });

  it('lets an admin decline, re-approve and override auto-approval', () => {
    const p = policy();
    expect(p.decide(1n, 'declined', ADMIN)).toEqual({ label: 1n, status: 'declined', source: 'admin', actor: ADMIN, at: 1_000 });
    now = 5_000;
    expect(p.tick()).toBe(1);
    expect(p.statuses().get('1')).toBe('declined');
    expect(p.statuses().get('2')).toBe('approved');
    p.decide(1n, 'approved', ADMIN);
    p.decide(2n, 'declined', ADMIN);
    expect(Object.fromEntries(p.statuses())).toEqual({ '1': 'approved', '2': 'declined' });
  });

  it('rejects unknown and exited deposits', () => {
    store.insertRagequit({ label: 2n, scope: 111n, ragequitter: STUDENT, commitment: 1n, value: 1n, block: 300, logIndex: 0, txHash: txHash(300), timestamp: 3_000 });
    const p = policy();
    expect(() => p.decide(99n, 'declined', ADMIN)).toThrow(PolicyError);
    try {
      p.decide(2n, 'approved', ADMIN);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(PolicyError);
      expect((err as PolicyError).code).toBe('exited');
    }
    expect(p.statuses().get('2')).toBe('exited');
  });
});
