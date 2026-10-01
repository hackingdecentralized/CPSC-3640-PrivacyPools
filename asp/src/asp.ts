import { createApp } from './api/app.ts';
import type { Health } from './api/context.ts';
import { createAuth } from './auth.ts';
import { createViemChain, type LogSource, type RootChain } from './chain.ts';
import type { AspConfig } from './config.ts';
import { openStore } from './db.ts';
import { createIndexer } from './indexer.ts';
import { createPolicy } from './policy.ts';
import { createPublisher } from './publisher.ts';
import type { Clock } from './types.ts';

export type Asp = ReturnType<typeof createAsp>;

export function createAsp(cfg: AspConfig, clock: Clock, chain: { logs: LogSource; roots: RootChain } = createViemChain(cfg)) {
  const store = openStore(cfg.dbPath, { ...cfg.defaults, freezeRoots: false });
  const indexer = createIndexer({ store, source: chain.logs, pools: cfg.pools, confirmations: cfg.confirmations, chunkSize: cfg.logChunkSize });
  const policy = createPolicy(store, clock);
  const publisher = createPublisher({ store, chain: chain.roots, chainId: cfg.chainId, entrypoint: cfg.entrypoint, clock });
  const auth = createAuth({ store, secret: cfg.adminTokenSecret, admins: cfg.adminAddresses, clock });
  const health: Health = { lastIndexedBlock: null, lastPublish: null, lastError: null, lastTickAt: null };
  const app = createApp({
    chainId: cfg.chainId,
    entrypoint: cfg.entrypoint,
    pools: cfg.pools,
    corsOrigins: cfg.corsOrigins,
    store,
    policy,
    publisher,
    auth,
    clock,
    health,
  });

  /** One pass of the service loop: index -> auto-approve -> publish. */
  async function tickOnce(): Promise<void> {
    try {
      health.lastIndexedBlock = await indexer.tick();
      policy.tick();
      health.lastPublish = await publisher.tick();
      health.lastError = null;
    } catch (err) {
      health.lastError = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      health.lastTickAt = clock();
    }
  }

  return { store, indexer, policy, publisher, auth, app, health, tickOnce };
}
