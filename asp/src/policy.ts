import type { Store } from './db.ts';
import type { Address, Clock, DecisionRow, DecisionStatus, DepositRow, DepositStatus } from './types.ts';

export function depositStatus(decision: DecisionRow | undefined, exited: boolean): DepositStatus {
  if (exited) return 'exited';
  return decision?.status ?? 'pending';
}

/** Undecided, non-exited deposits whose block time + delay has passed. */
export function dueForAutoApproval(
  deposits: DepositRow[],
  decisions: Map<string, DecisionRow>,
  exited: Set<string>,
  now: number,
  delaySec: number,
): bigint[] {
  return deposits
    .filter((d) => {
      const key = d.label.toString();
      return !decisions.has(key) && !exited.has(key) && d.timestamp + delaySec <= now;
    })
    .map((d) => d.label);
}

/** The Association Set: approved labels from every pool, in (block, logIndex) order. */
export function approvedLabels(deposits: DepositRow[], decisions: Map<string, DecisionRow>): bigint[] {
  return [...deposits]
    .sort((a, b) => a.block - b.block || a.logIndex - b.logIndex)
    .filter((d) => decisions.get(d.label.toString())?.status === 'approved')
    .map((d) => d.label);
}

export class PolicyError extends Error {
  code: 'not_found' | 'exited';
  constructor(code: 'not_found' | 'exited', message: string) {
    super(message);
    this.code = code;
  }
}

export type Policy = ReturnType<typeof createPolicy>;

export function createPolicy(store: Store, clock: Clock) {
  return {
    /** Auto-approve every due deposit. Returns how many were approved. */
    tick(): number {
      const now = clock();
      const due = dueForAutoApproval(
        store.listDeposits(),
        store.latestDecisions(),
        store.exitedLabels(),
        now,
        store.getSettings().autoApproveDelaySec,
      );
      store.transaction(() => {
        for (const label of due) store.addDecision({ label, status: 'approved', source: 'auto', actor: null, at: now });
      });
      return due.length;
    },

    /** A teacher decision. Allowed for any deposit that has not exited. */
    decide(label: bigint, status: DecisionStatus, actor: Address): DecisionRow {
      if (!store.getDeposit(label)) throw new PolicyError('not_found', `unknown deposit label ${label}`);
      if (store.exitedLabels().has(label.toString())) throw new PolicyError('exited', `deposit ${label} has already exited`);
      const row: DecisionRow = { label, status, source: 'admin', actor, at: clock() };
      store.addDecision(row);
      return row;
    },

    /** Current status of every indexed deposit, keyed by decimal label. */
    statuses(): Map<string, DepositStatus> {
      const decisions = store.latestDecisions();
      const exited = store.exitedLabels();
      return new Map(
        store.listDeposits().map((d) => {
          const key = d.label.toString();
          return [key, depositStatus(decisions.get(key), exited.has(key))];
        }),
      );
    },
  };
}
