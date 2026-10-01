import type { Auth } from '../auth.ts';
import type { Store } from '../db.ts';
import type { Policy } from '../policy.ts';
import type { PublishResult } from '../publisher.ts';
import type { Address, Clock, PoolConfig } from '../types.ts';

export type Health = {
  lastIndexedBlock: number | null;
  lastPublish: PublishResult | null;
  lastError: string | null;
  lastTickAt: number | null;
};

export type ApiContext = {
  chainId: number;
  entrypoint: Address;
  pools: PoolConfig[];
  corsOrigins: string[] | '*';
  store: Store;
  policy: Policy;
  publisher: { onchainRoot(): Promise<bigint | null> };
  auth: Auth;
  clock: Clock;
  health: Health;
};
