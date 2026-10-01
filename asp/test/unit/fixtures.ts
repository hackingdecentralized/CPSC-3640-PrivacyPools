import type { DepositRow, PoolConfig, Settings } from '../../src/types.ts';

export const ETH_POOL: PoolConfig = {
  symbol: 'ETH',
  address: '0x1000000000000000000000000000000000000005',
  asset: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  scope: 111n,
  deploymentBlock: 100,
  decimals: 18,
};

export const TOKEN_POOL: PoolConfig = {
  symbol: 'BULLDOGS',
  address: '0x1000000000000000000000000000000000000006',
  asset: '0xBc2BEfb9a8aA70AfA23F7451A0794466976B6974',
  scope: 222n,
  deploymentBlock: 100,
  decimals: 18,
};

export const DEFAULT_SETTINGS: Settings = { autoApproveDelaySec: 120, publishIntervalSec: 60, freezeRoots: false };

export const STUDENT = '0x0000000000000000000000000000000000005001';

export function txHash(n: bigint | number): `0x${string}` {
  return `0x${BigInt(n).toString(16).padStart(64, '0')}`;
}

/** A deposit row with sensible defaults; `label` drives the derived fields. */
export function deposit(overrides: Partial<DepositRow> & { label: bigint }): DepositRow {
  return {
    scope: ETH_POOL.scope,
    pool: ETH_POOL.address,
    depositor: STUDENT,
    commitment: overrides.label * 1000n,
    value: 10n ** 15n,
    precommitment: overrides.label * 7n,
    block: 200,
    logIndex: 0,
    txHash: txHash(overrides.label),
    timestamp: 1_000,
    ...overrides,
  };
}
