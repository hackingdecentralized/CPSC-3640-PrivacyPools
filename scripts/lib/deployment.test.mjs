import { describe, expect, it } from 'vitest';
import { buildDeployment, findSmokeTxs, parseForgeDeployment } from './deployment.mjs';

const D = '0x5ea5000000000000000000000000000000000d01';
const FORGE_RAW = `{"chainId":11155111,"contracts":[
{"name":"WithdrawalVerifier","address":"0x1000000000000000000000000000000000000001","deployer":"${D}","deploymentBlock":100},
{"name":"CommitmentVerifier","address":"0x1000000000000000000000000000000000000002","deployer":"${D}","deploymentBlock":100},
{"name":"Entrypoint_Implementation","address":"0x1000000000000000000000000000000000000003","deployer":"${D}","deploymentBlock":100},
{"name":"Entrypoint_Proxy","address":"0x1000000000000000000000000000000000000004","deployer":"${D}","deploymentBlock":100,"constructorArgs":"0xabcd"},
{"name":"PrivacyPoolSimple_ETH","address":"0x1000000000000000000000000000000000000005","deployer":"${D}","deploymentBlock":101,"scope":12345678901234567890123456789012345678901234567890,"asset":"0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE","constructorArgs":"0x01"},
{"name":"PrivacyPoolComplex_BULLDOGS","address":"0x1000000000000000000000000000000000000006","deployer":"${D}","deploymentBlock":102,"scope":98765432109876543210987654321098765432109876543210,"asset":"0xbc2befb9a8aa70afa23f7451a0794466976b6974","constructorArgs":"0x02"}
]}`;

const SMOKE_RUN = {
  transactions: [
    { hash: '0xaaa', function: 'deposit(uint256)' },
    { hash: '0xbbb', function: 'claim()' },
    { hash: '0xccc', function: 'approve(address,uint256)' },
    { hash: '0xddd', function: 'deposit(address,uint256,uint256)' },
  ],
};

describe('parseForgeDeployment', () => {
  it('extracts addresses, blocks and pools with checksummed addresses', () => {
    const f = parseForgeDeployment(FORGE_RAW);
    expect(f.withdrawalVerifier).toBe('0x1000000000000000000000000000000000000001');
    expect(f.ragequitVerifier).toBe('0x1000000000000000000000000000000000000002');
    expect(f.entrypointImplementation).toBe('0x1000000000000000000000000000000000000003');
    expect(f.entrypointProxy).toBe('0x1000000000000000000000000000000000000004');
    expect(f.deploymentBlock).toBe(100);
    expect(f.pools).toEqual([
      { symbol: 'ETH', kind: 'simple', address: '0x1000000000000000000000000000000000000005', asset: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', deploymentBlock: 101 },
      { symbol: 'BULLDOGS', kind: 'complex', address: '0x1000000000000000000000000000000000000006', asset: '0xBc2BEfb9a8aA70AfA23F7451A0794466976B6974', deploymentBlock: 102 },
    ]);
  });

  it('does not expose scope from forge JSON (precision loss)', () => {
    const f = parseForgeDeployment(FORGE_RAW);
    expect(f.pools[0]).not.toHaveProperty('scope');
  });

  it('throws when a required contract is missing', () => {
    expect(() => parseForgeDeployment('{"chainId":1,"contracts":[]}')).toThrow(/Entrypoint_Proxy/);
  });
});

describe('findSmokeTxs', () => {
  it('finds the ETH and token deposit transactions', () => {
    expect(findSmokeTxs(SMOKE_RUN)).toEqual({ ethDepositTx: '0xaaa', tokenDepositTx: '0xddd' });
  });

  it('throws when a deposit is missing', () => {
    expect(() => findSmokeTxs({ transactions: [{ hash: '0xaaa', function: 'deposit(uint256)' }] })).toThrow(/token deposit/);
  });
});

describe('buildDeployment', () => {
  const forge = parseForgeDeployment(FORGE_RAW);
  const onchain = {
    roles: { owner: D, postman: '0x5ea5000000000000000000000000000000000d02' },
    pools: {
      '0x1000000000000000000000000000000000000005': { scope: 2n ** 250n + 12345n, minimumDepositAmount: 10n ** 15n, vettingFeeBPS: 0n, maxRelayFeeBPS: 100n, decimals: 18 },
      '0x1000000000000000000000000000000000000006': { scope: 2n ** 251n + 67890n, minimumDepositAmount: 10n * 10n ** 18n, vettingFeeBPS: 0n, maxRelayFeeBPS: 100n, decimals: 18 },
    },
    token: { address: '0xBc2BEfb9a8aA70AfA23F7451A0794466976B6974', name: 'Bulldogs', symbol: 'BULLDOGS', decimals: 18 },
  };
  const upstream = {
    'privacy-pools-core': { sha: 'coresha' },
    'privacy-pools-website': { sha: 'websitesha' },
  };

  it('builds the spec §5.1 schema with decimal-string big numbers', () => {
    const d = buildDeployment({ chainId: 11155111, upstream, forge, smoke: findSmokeTxs(SMOKE_RUN), onchain });
    expect(d).toEqual({
      chainId: 11155111,
      upstream: { core: 'coresha', website: 'websitesha' },
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
        { symbol: 'ETH', asset: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', address: '0x1000000000000000000000000000000000000005', scope: '1809251394333065553493296640760748560207343510400633813116524750123642662969', deploymentBlock: 101, decimals: 18, minimumDepositAmount: '1000000000000000', vettingFeeBPS: 0, maxRelayFeeBPS: 100 },
        { symbol: 'BULLDOGS', asset: '0xBc2BEfb9a8aA70AfA23F7451A0794466976B6974', address: '0x1000000000000000000000000000000000000006', scope: '3618502788666131106986593281521497120414687020801267626233049500247285369138', deploymentBlock: 102, decimals: 18, minimumDepositAmount: '10000000000000000000', vettingFeeBPS: 0, maxRelayFeeBPS: 100 },
      ],
      token: { address: '0xBc2BEfb9a8aA70AfA23F7451A0794466976B6974', name: 'Bulldogs', symbol: 'BULLDOGS', decimals: 18 },
      smokeTest: { ethDepositTx: '0xaaa', tokenDepositTx: '0xddd' },
    });
    expect(() => JSON.stringify(d)).not.toThrow();
  });
});
