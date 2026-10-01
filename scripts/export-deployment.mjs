#!/usr/bin/env node
// Build deployments/<net>.json from forge outputs + on-chain reads.
// Usage: node export-deployment.mjs --rpc <url> --forge-deployment <path> --smoke-run <path>
//        --owner <addr> --postman <addr> --out <path>
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createPublicClient, getAddress, http, isAddressEqual } from 'viem';
import { NATIVE_ASSET, ROLES, entrypointAbi, erc20Abi, poolAbi } from './lib/abis.mjs';
import { buildDeployment, findSmokeTxs, parseForgeDeployment } from './lib/deployment.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const { values: args } = parseArgs({
  options: {
    rpc: { type: 'string' },
    'forge-deployment': { type: 'string' },
    'smoke-run': { type: 'string' },
    owner: { type: 'string' },
    postman: { type: 'string' },
    out: { type: 'string' },
  },
});
for (const k of ['rpc', 'forge-deployment', 'smoke-run', 'owner', 'postman', 'out']) {
  if (!args[k]) throw new Error(`missing --${k}`);
}

const client = createPublicClient({ transport: http(args.rpc) });
const chainId = await client.getChainId();
const forge = parseForgeDeployment(readFileSync(args['forge-deployment'], 'utf8'));
if (forge.chainId !== chainId) {
  throw new Error(`forge deployment is for chain ${forge.chainId} but --rpc is chain ${chainId}`);
}
const smoke = findSmokeTxs(JSON.parse(readFileSync(args['smoke-run'], 'utf8')));
const upstream = JSON.parse(readFileSync(resolve(ROOT, 'upstream.json'), 'utf8'));

const owner = getAddress(args.owner);
const postman = getAddress(args.postman);
const ep = { address: forge.entrypointProxy, abi: entrypointAbi };
if (!(await client.readContract({ ...ep, functionName: 'hasRole', args: [ROLES.OWNER, owner] }))) {
  throw new Error(`${owner} does not hold OWNER_ROLE`);
}
if (!(await client.readContract({ ...ep, functionName: 'hasRole', args: [ROLES.POSTMAN, postman] }))) {
  throw new Error(`${postman} does not hold ASP_POSTMAN`);
}

const pools = {};
let token;
for (const p of forge.pools) {
  const scope = await client.readContract({ address: p.address, abi: poolAbi, functionName: 'SCOPE' });
  const [registeredPool, minimumDepositAmount, vettingFeeBPS, maxRelayFeeBPS] = await client.readContract({
    ...ep,
    functionName: 'assetConfig',
    args: [p.asset],
  });
  if (!isAddressEqual(registeredPool, p.address)) {
    throw new Error(`entrypoint assetConfig(${p.asset}).pool is ${registeredPool} but forge deployment lists ${p.address}`);
  }
  let decimals = 18;
  if (!isAddressEqual(p.asset, NATIVE_ASSET)) {
    const t = { address: p.asset, abi: erc20Abi };
    const [name, symbol, dec] = await Promise.all([
      client.readContract({ ...t, functionName: 'name' }),
      client.readContract({ ...t, functionName: 'symbol' }),
      client.readContract({ ...t, functionName: 'decimals' }),
    ]);
    decimals = Number(dec);
    token = { address: p.asset, name, symbol, decimals };
  }
  pools[p.address] = { scope, minimumDepositAmount, vettingFeeBPS, maxRelayFeeBPS, decimals };
}
if (!token) throw new Error('no ERC-20 pool found');

const deployment = buildDeployment({ chainId, upstream, forge, smoke, onchain: { roles: { owner, postman }, pools, token } });
mkdirSync(dirname(resolve(args.out)), { recursive: true });
writeFileSync(args.out, JSON.stringify(deployment, null, 2) + '\n');
console.log(`wrote ${args.out}`);
