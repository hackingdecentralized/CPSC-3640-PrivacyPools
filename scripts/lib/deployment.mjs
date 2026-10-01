import { getAddress } from 'viem';

const REQUIRED = ['WithdrawalVerifier', 'CommitmentVerifier', 'Entrypoint_Implementation', 'Entrypoint_Proxy'];
const POOL_PREFIXES = { PrivacyPoolSimple_: 'simple', PrivacyPoolComplex_: 'complex' };

/**
 * Parse forge's deployments/<chainId>.json written by DeployProtocol._saveDeploymentData.
 * Scopes in that file are bare JSON numbers (precision is lost), so they are ignored here;
 * read SCOPE() on-chain instead.
 */
export function parseForgeDeployment(rawText) {
  const { contracts } = JSON.parse(rawText);
  const byName = new Map(contracts.map((c) => [c.name, c]));
  const missing = REQUIRED.filter((name) => !byName.has(name));
  if (missing.length > 0) throw new Error(`forge deployment is missing ${missing.join(', ')}`);

  const pools = [];
  for (const c of contracts) {
    for (const [prefix, kind] of Object.entries(POOL_PREFIXES)) {
      if (c.name.startsWith(prefix)) {
        pools.push({
          symbol: c.name.slice(prefix.length),
          kind,
          address: getAddress(c.address),
          asset: getAddress(c.asset),
          deploymentBlock: Number(c.deploymentBlock),
        });
      }
    }
  }
  if (pools.length === 0) throw new Error('forge deployment has no pools');

  const proxy = byName.get('Entrypoint_Proxy');
  return {
    withdrawalVerifier: getAddress(byName.get('WithdrawalVerifier').address),
    ragequitVerifier: getAddress(byName.get('CommitmentVerifier').address),
    entrypointImplementation: getAddress(byName.get('Entrypoint_Implementation').address),
    entrypointProxy: getAddress(proxy.address),
    deploymentBlock: Number(proxy.deploymentBlock),
    pools,
  };
}

/** Find the smoke deposit tx hashes in forge's broadcast run-latest.json for CourseSmoke. */
export function findSmokeTxs(runJson) {
  const find = (fn) => runJson.transactions.find((t) => t.function === fn)?.hash;
  const ethDepositTx = find('deposit(uint256)');
  const tokenDepositTx = find('deposit(address,uint256,uint256)');
  if (!ethDepositTx) throw new Error('smoke run has no ETH deposit (deposit(uint256))');
  if (!tokenDepositTx) throw new Error('smoke run has no token deposit (deposit(address,uint256,uint256))');
  return { ethDepositTx, tokenDepositTx };
}

/** Assemble the deployments/<net>.json object (spec §5.1). All bigints become decimal strings. */
export function buildDeployment({ chainId, upstream, forge, smoke, onchain }) {
  return {
    chainId,
    upstream: {
      core: upstream['privacy-pools-core'].sha,
      website: upstream['privacy-pools-website'].sha,
    },
    roles: { owner: getAddress(onchain.roles.owner), postman: getAddress(onchain.roles.postman) },
    contracts: {
      withdrawalVerifier: forge.withdrawalVerifier,
      ragequitVerifier: forge.ragequitVerifier,
      entrypoint: {
        proxy: forge.entrypointProxy,
        implementation: forge.entrypointImplementation,
        deploymentBlock: forge.deploymentBlock,
      },
    },
    pools: forge.pools.map((p) => {
      const c = onchain.pools[p.address];
      if (!c) throw new Error(`no on-chain data for pool ${p.address}`);
      return {
        symbol: p.symbol,
        asset: p.asset,
        address: p.address,
        scope: c.scope.toString(),
        deploymentBlock: p.deploymentBlock,
        decimals: c.decimals,
        minimumDepositAmount: c.minimumDepositAmount.toString(),
        vettingFeeBPS: Number(c.vettingFeeBPS),
        maxRelayFeeBPS: Number(c.maxRelayFeeBPS),
      };
    }),
    token: { ...onchain.token, address: getAddress(onchain.token.address) },
    smokeTest: smoke,
  };
}
