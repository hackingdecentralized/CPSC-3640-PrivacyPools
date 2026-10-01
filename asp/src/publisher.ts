import { BaseError } from 'viem';
import type { RootChain } from './chain.ts';
import { cidOf, encodeSnapshotDocument } from './cid.ts';
import type { Store } from './db.ts';
import { approvedLabels } from './policy.ts';
import { treeRoot } from './tree.ts';
import type { Address, Clock } from './types.ts';

export type PublishResult = 'frozen' | 'waiting' | 'empty' | 'unchanged' | 'published' | 'failed';

export type PublisherDeps = {
  store: Store;
  chain: RootChain;
  chainId: number;
  entrypoint: Address;
  clock: Clock;
  log?: (message: string) => void;
};

const ROOT_CACHE_SEC = 5;

/** Message safe to persist and log: viem's shortMessage omits the request details (RPC URL, which may embed an API key). */
const errorMessage = (err: unknown): string => (err instanceof BaseError ? err.shortMessage : err instanceof Error ? err.message : String(err));

export function createPublisher({ store, chain, chainId, entrypoint, clock, log = console.log }: PublisherDeps) {
  /** A throwing logger must never change the outcome of a publish. */
  const say = (message: string): void => {
    try {
      log(message);
    } catch {
      // ignore
    }
  };
  let busy = false;
  let forceRepublish = false;
  let cached: { root: bigint | null; at: number } | null = null;

  async function onchainRoot(): Promise<bigint | null> {
    const now = clock();
    if (!cached || now - cached.at >= ROOT_CACHE_SEC) cached = { root: await chain.latestRoot(), at: now };
    return cached.root;
  }

  /** Settle snapshots left pending by a crash, then compare our record with the chain. */
  async function reconcile(): Promise<void> {
    for (const s of store.pendingSnapshots()) {
      if (!s.txHash) {
        store.markSnapshotFailed(s.id, 'not sent');
        continue;
      }
      const receipt = await chain.receiptStatus(s.txHash);
      if (receipt?.status === 'success') store.markSnapshotConfirmed(s.id, receipt.block, clock());
      else store.markSnapshotFailed(s.id, receipt ? 'reverted' : 'transaction not found');
    }
    cached = null;
    const onchain = await onchainRoot();
    const confirmed = store.latestConfirmedSnapshot()?.root ?? null;
    if (confirmed !== onchain) {
      forceRepublish = true;
      say(`reconcile: on-chain root ${onchain ?? 'none'} differs from last confirmed snapshot ${confirmed ?? 'none'}; republishing`);
    }
  }

  async function tick(): Promise<PublishResult> {
    if (busy) return 'waiting';
    const settings = store.getSettings();
    if (settings.freezeRoots) return 'frozen';
    const last = store.latestSnapshot();
    if (last && clock() - last.createdAt < settings.publishIntervalSec) return 'waiting';

    const labels = approvedLabels(store.listDeposits(), store.latestDecisions());
    if (labels.length === 0) return 'empty';
    const root = treeRoot(labels);
    // A reconcile mismatch skips only this check; the publish interval above still applies.
    if (!forceRepublish && store.latestConfirmedSnapshot()?.root === root) return 'unchanged';

    busy = true;
    let id: number | null = null;
    let summary = '';
    try {
      const createdAt = clock();
      const document = encodeSnapshotDocument({ chainId, entrypoint, root: root.toString(), labels: labels.map(String), createdAt });
      const cid = await cidOf(document);
      id = store.insertSnapshot({ root, cid, document, createdAt });
      const txHash = await chain.updateRoot(root, cid);
      store.markSnapshotSent(id, txHash);
      const receipt = await chain.waitForReceipt(txHash);
      if (receipt.status !== 'success') {
        store.markSnapshotFailed(id, 'reverted');
        return 'failed';
      }
      store.markSnapshotConfirmed(id, receipt.block, clock());
      forceRepublish = false;
      cached = null;
      summary = `published ASP root ${root} (${labels.length} labels, cid ${cid}, tx ${txHash})`;
    } catch (err) {
      const message = errorMessage(err);
      if (id !== null) store.markSnapshotFailed(id, message);
      else say(`publish failed before a snapshot was recorded: ${message}`);
      return 'failed';
    } finally {
      busy = false;
    }
    say(summary);
    return 'published';
  }

  return { tick, reconcile, onchainRoot };
}
