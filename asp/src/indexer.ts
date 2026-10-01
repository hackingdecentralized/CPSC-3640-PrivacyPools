import type { LogSource, PoolLog } from './chain.ts';
import type { Store } from './db.ts';
import type { PoolConfig } from './types.ts';

export type IndexerDeps = {
  store: Store;
  source: LogSource;
  pools: PoolConfig[];
  confirmations: number;
  chunkSize: number;
};

export function createIndexer({ store, source, pools, confirmations, chunkSize }: IndexerDeps) {
  return {
    /** Index every confirmed block not yet seen, per pool, in chunks. Returns the confirmed head. */
    async tick(): Promise<number> {
      const safe = (await source.head()) - confirmations;
      for (const pool of pools) {
        let from = (store.getCursor(pool.address) ?? pool.deploymentBlock - 1) + 1;
        while (from <= safe) {
          const to = Math.min(from + chunkSize - 1, safe);
          const logs = await source.poolLogs(pool.address, from, to);
          const timestamps = new Map<number, number>();
          for (const block of new Set(logs.map((l) => l.block))) timestamps.set(block, await source.blockTimestamp(block));
          store.transaction(() => {
            for (const log of logs) applyLog(store, pool, log, timestamps.get(log.block) as number);
            store.setCursor(pool.address, to);
          });
          from = to + 1;
        }
      }
      return safe;
    },
  };
}

function applyLog(store: Store, pool: PoolConfig, log: PoolLog, timestamp: number): void {
  const at = { block: log.block, logIndex: log.logIndex, txHash: log.txHash, timestamp };
  switch (log.kind) {
    case 'deposit':
      store.insertDeposit({
        ...at,
        label: log.label,
        scope: pool.scope,
        pool: pool.address,
        depositor: log.depositor,
        commitment: log.commitment,
        value: log.value,
        precommitment: log.precommitment,
      });
      return;
    case 'leaf':
      store.insertLeaf({ scope: pool.scope, index: log.index, leaf: log.leaf, root: log.root, block: log.block });
      return;
    case 'withdrawal':
      store.insertWithdrawal({
        ...at,
        scope: pool.scope,
        processooor: log.processooor,
        value: log.value,
        spentNullifier: log.spentNullifier,
        newCommitment: log.newCommitment,
      });
      return;
    case 'ragequit':
      store.insertRagequit({
        ...at,
        label: log.label,
        scope: pool.scope,
        ragequitter: log.ragequitter,
        commitment: log.commitment,
        value: log.value,
      });
      return;
  }
}
