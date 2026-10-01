import { describe, expect, it } from 'vitest';
import { parseConfig } from '../../src/config.ts';

const BIG_SCOPE = '21888242871839275222246405745257275088548364400416034343698204186575808495616';
const DEPLOYMENT = JSON.stringify({
  chainId: 11155111,
  upstream: { core: 'c', website: 'w' },
  roles: { owner: '0x5eA5000000000000000000000000000000000D01', postman: '0x5Ea5000000000000000000000000000000000D02' },
  contracts: {
    withdrawalVerifier: '0x1000000000000000000000000000000000000001',
    ragequitVerifier: '0x1000000000000000000000000000000000000002',
    entrypoint: {
      proxy: '0x1000000000000000000000000000000000000004',
      implementation: '0x1000000000000000000000000000000000000003',
      deploymentBlock: 100,
    },
  },
  pools: [
    { symbol: 'ETH', asset: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', address: '0x1000000000000000000000000000000000000005', scope: BIG_SCOPE, deploymentBlock: 101, decimals: 18, minimumDepositAmount: '1000000000000000', vettingFeeBPS: 0, maxRelayFeeBPS: 100 },
    { symbol: 'BULLDOGS', asset: '0xbc2befb9a8aa70afa23f7451a0794466976b6974', address: '0x1000000000000000000000000000000000000006', scope: '42', deploymentBlock: 102, decimals: 18, minimumDepositAmount: '10000000000000000000', vettingFeeBPS: 0, maxRelayFeeBPS: 100 },
  ],
});

const BASE = {
  DEPLOYMENT_FILE: '/config/deployment.json',
  RPC_URL: 'http://127.0.0.1:8545',
  POSTMAN_UNLOCKED_ADDRESS: '0x5ea5000000000000000000000000000000000d02',
  ADMIN_ADDRESSES: '0x5ea5000000000000000000000000000000000d01',
  ADMIN_TOKEN_SECRET: 'a'.repeat(32),
};
const read = () => DEPLOYMENT;

describe('parseConfig', () => {
  it('reads the entrypoint and pools from the deployment file', () => {
    const cfg = parseConfig(BASE, read);
    expect(cfg.chainId).toBe(11155111);
    expect(cfg.entrypoint).toBe('0x1000000000000000000000000000000000000004');
    expect(cfg.pools).toEqual([
      { symbol: 'ETH', address: '0x1000000000000000000000000000000000000005', asset: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', scope: BigInt(BIG_SCOPE), deploymentBlock: 101, decimals: 18 },
      { symbol: 'BULLDOGS', address: '0x1000000000000000000000000000000000000006', asset: '0xBc2BEfb9a8aA70AfA23F7451A0794466976B6974', scope: 42n, deploymentBlock: 102, decimals: 18 },
    ]);
  });

  it('applies defaults and checksums addresses', () => {
    const cfg = parseConfig(BASE, read);
    expect(cfg.rpcUrl).toBe('http://127.0.0.1:8545');
    expect(cfg.port).toBe(8080);
    expect(cfg.dbPath).toBe('./data/asp.sqlite');
    expect(cfg.corsOrigins).toBe('*');
    expect(cfg.defaults).toEqual({ autoApproveDelaySec: 120, publishIntervalSec: 60 });
    expect(cfg.pollIntervalMs).toBe(6000);
    expect(cfg.confirmations).toBe(2);
    expect(cfg.logChunkSize).toBe(500);
    expect(cfg.postman).toEqual({ unlockedAddress: '0x5Ea5000000000000000000000000000000000D02' });
    expect(cfg.adminAddresses).toEqual(['0x5eA5000000000000000000000000000000000D01']);
  });

  it('parses overrides and comma-separated lists', () => {
    const cfg = parseConfig(
      {
        ...BASE,
        PORT: '9000',
        CORS_ORIGINS: 'https://a.example, https://b.example',
        ADMIN_ADDRESSES: '0x5ea5000000000000000000000000000000000d01,0x5ea5000000000000000000000000000000000d02',
        AUTO_APPROVE_DELAY_SEC: '30',
        PUBLISH_INTERVAL_SEC: '0',
        DB_PATH: ':memory:',
      },
      read,
    );
    expect(cfg.port).toBe(9000);
    expect(cfg.corsOrigins).toEqual(['https://a.example', 'https://b.example']);
    expect(cfg.adminAddresses).toHaveLength(2);
    expect(cfg.defaults).toEqual({ autoApproveDelaySec: 30, publishIntervalSec: 0 });
    expect(cfg.dbPath).toBe(':memory:');
  });

  it('accepts a postman private key instead of an unlocked address', () => {
    const key = `0x${'11'.repeat(32)}`;
    const cfg = parseConfig({ ...BASE, POSTMAN_UNLOCKED_ADDRESS: undefined, POSTMAN_PRIVATE_KEY: key }, read);
    expect(cfg.postman).toEqual({ privateKey: key });
  });

  it('requires exactly one postman signer', () => {
    expect(() => parseConfig({ ...BASE, POSTMAN_UNLOCKED_ADDRESS: undefined }, read)).toThrow(
      /POSTMAN_PRIVATE_KEY or POSTMAN_UNLOCKED_ADDRESS/,
    );
    expect(() => parseConfig({ ...BASE, POSTMAN_PRIVATE_KEY: `0x${'11'.repeat(32)}` }, read)).toThrow(
      /POSTMAN_PRIVATE_KEY or POSTMAN_UNLOCKED_ADDRESS/,
    );
  });

  it('rejects missing env, short secrets, malformed keys and bad integers', () => {
    expect(() => parseConfig({ ...BASE, RPC_URL: undefined }, read)).toThrow(/RPC_URL/);
    expect(() => parseConfig({ ...BASE, ADMIN_TOKEN_SECRET: 'short' }, read)).toThrow(/ADMIN_TOKEN_SECRET/);
    expect(() => parseConfig({ ...BASE, PORT: 'abc' }, read)).toThrow(/PORT/);
    expect(() =>
      parseConfig({ ...BASE, POSTMAN_UNLOCKED_ADDRESS: undefined, POSTMAN_PRIVATE_KEY: '0x1234' }, read),
    ).toThrow(/POSTMAN_PRIVATE_KEY/);
  });
});
