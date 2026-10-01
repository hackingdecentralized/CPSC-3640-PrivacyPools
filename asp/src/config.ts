import { readFileSync } from 'node:fs';
import { getAddress } from 'viem';
import type { Address, PoolConfig } from './types.ts';

export type PostmanSigner = { privateKey: `0x${string}` } | { unlockedAddress: Address };

export type AspConfig = {
  chainId: number;
  entrypoint: Address;
  pools: PoolConfig[];
  rpcUrl: string;
  postman: PostmanSigner;
  adminAddresses: Address[];
  adminTokenSecret: string;
  port: number;
  corsOrigins: string[] | '*';
  dbPath: string;
  defaults: { autoApproveDelaySec: number; publishIntervalSec: number };
  pollIntervalMs: number;
  confirmations: number;
  logChunkSize: number;
};

type Env = Record<string, string | undefined>;

/** The subset of deployments/<net>.json (Plan 1, spec §5.1) the ASP needs. */
type DeploymentFile = {
  chainId: number;
  contracts: { entrypoint: { proxy: string } };
  pools: { symbol: string; address: string; asset: string; scope: string; deploymentBlock: number; decimals: number }[];
};

export function parseConfig(env: Env, readFile: (path: string) => string = (path) => readFileSync(path, 'utf8')): AspConfig {
  const get = (key: string): string | undefined => env[key]?.trim() || undefined;
  const required = (key: string): string => {
    const value = get(key);
    if (!value) throw new Error(`missing required env ${key}`);
    return value;
  };
  const int = (key: string, fallback: number, min = 0): number => {
    const raw = get(key);
    if (raw === undefined) return fallback;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < min) throw new Error(`env ${key} must be an integer >= ${min}, got "${raw}"`);
    return n;
  };
  const list = (raw: string): string[] =>
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

  const deployment = JSON.parse(readFile(required('DEPLOYMENT_FILE'))) as DeploymentFile;
  const rpcUrl = required('RPC_URL');

  const privateKey = get('POSTMAN_PRIVATE_KEY');
  const unlocked = get('POSTMAN_UNLOCKED_ADDRESS');
  if (Boolean(privateKey) === Boolean(unlocked)) {
    throw new Error('set exactly one of POSTMAN_PRIVATE_KEY or POSTMAN_UNLOCKED_ADDRESS');
  }
  if (privateKey && !/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new Error('POSTMAN_PRIVATE_KEY must be a 0x-prefixed 32-byte hex string');
  }
  const postman: PostmanSigner = privateKey
    ? { privateKey: privateKey as `0x${string}` }
    : { unlockedAddress: getAddress(unlocked as string) };

  const adminTokenSecret = required('ADMIN_TOKEN_SECRET');
  if (adminTokenSecret.length < 32) throw new Error('ADMIN_TOKEN_SECRET must be at least 32 characters');

  const cors = get('CORS_ORIGINS') ?? '*';

  return {
    chainId: deployment.chainId,
    entrypoint: getAddress(deployment.contracts.entrypoint.proxy),
    pools: deployment.pools.map((p) => ({
      symbol: p.symbol,
      address: getAddress(p.address),
      asset: getAddress(p.asset),
      scope: BigInt(p.scope),
      deploymentBlock: p.deploymentBlock,
      decimals: p.decimals,
    })),
    rpcUrl,
    postman,
    adminAddresses: list(required('ADMIN_ADDRESSES')).map((a) => getAddress(a)),
    adminTokenSecret,
    port: int('PORT', 8080, 1),
    corsOrigins: cors === '*' ? '*' : list(cors),
    dbPath: get('DB_PATH') ?? './data/asp.sqlite',
    defaults: {
      autoApproveDelaySec: int('AUTO_APPROVE_DELAY_SEC', 120),
      publishIntervalSec: int('PUBLISH_INTERVAL_SEC', 60),
    },
    pollIntervalMs: int('POLL_INTERVAL_MS', 6000, 100),
    confirmations: int('CONFIRMATIONS', 2),
    logChunkSize: int('LOG_CHUNK_SIZE', 500, 1),
  };
}
