#!/usr/bin/env node
// On-chain smoke verification of a deployments/<net>.json file. Exit code 1 on any failure.
// Usage: node verify-deployment.mjs --file <deployment.json> --rpc <url>
// Note: the balance-delta checks read pool balances at the smoke-deposit blocks (N-1 and N), so the RPC must serve
// state for those blocks: any node right after deploy, an archive node later.
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { createPublicClient, http, isAddressEqual, parseEventLogs } from 'viem';
import { NATIVE_ASSET, ROLES, entrypointAbi, erc20Abi, poolAbi } from './lib/abis.mjs';

// Independent expectations from the course spec. The deployment file and the chain can agree with each other and
// still both be wrong, so these are asserted separately (as "spec:" checks) against the on-chain values.
const COURSE_SPEC = {
  chainId: 11155111, // Sepolia (the anvil rehearsal fork uses the same id)
  token: { address: '0xBc2BEfb9a8aA70AfA23F7451A0794466976B6974', symbol: 'BULLDOGS', decimals: 18 },
  pools: {
    ETH: { asset: NATIVE_ASSET, decimals: 18, minimumDepositAmount: 10n ** 15n, vettingFeeBPS: 0n, maxRelayFeeBPS: 100n },
    BULLDOGS: {
      asset: '0xBc2BEfb9a8aA70AfA23F7451A0794466976B6974',
      decimals: 18,
      minimumDepositAmount: 10n ** 19n,
      vettingFeeBPS: 0n,
      maxRelayFeeBPS: 100n,
    },
  },
};

const { values: args } = parseArgs({ options: { file: { type: 'string' }, rpc: { type: 'string' } } });
if (!args.file || !args.rpc) throw new Error('usage: --file <deployment.json> --rpc <url>');

const d = JSON.parse(readFileSync(args.file, 'utf8'));
const client = createPublicClient({ transport: http(args.rpc) });
const ep = { address: d.contracts.entrypoint.proxy, abi: entrypointAbi };
let failures = 0;

function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures++;
}
const same = (a, b) => isAddressEqual(a, b);

const rpcChainId = await client.getChainId();
check('chain id', rpcChainId === d.chainId);
check(`spec: chain id is ${COURSE_SPEC.chainId}`, rpcChainId === COURSE_SPEC.chainId && d.chainId === COURSE_SPEC.chainId, `rpc ${rpcChainId}, file ${d.chainId}`);
check('owner holds OWNER_ROLE', await client.readContract({ ...ep, functionName: 'hasRole', args: [ROLES.OWNER, d.roles.owner] }));
check('postman holds ASP_POSTMAN', await client.readContract({ ...ep, functionName: 'hasRole', args: [ROLES.POSTMAN, d.roles.postman] }));

const t = { address: d.token.address, abi: erc20Abi };
const tokenSymbol = await client.readContract({ ...t, functionName: 'symbol' });
const tokenDecimals = Number(await client.readContract({ ...t, functionName: 'decimals' }));
check('token name', (await client.readContract({ ...t, functionName: 'name' })) === d.token.name);
check('token symbol', tokenSymbol === d.token.symbol);
check('token decimals', tokenDecimals === d.token.decimals);

// Course-spec checks: token and pool set.
const spec = COURSE_SPEC;
const poolSymbols = d.pools.map((p) => p.symbol);
check(
  'spec: exactly two pools, ETH and BULLDOGS',
  poolSymbols.length === 2 && Object.keys(spec.pools).every((s) => poolSymbols.includes(s)),
  poolSymbols.join(', '),
);
check(`spec: token address is ${spec.token.address}`, same(d.token.address, spec.token.address), d.token.address);
const bulldogsPool = d.pools.find((p) => p.symbol === 'BULLDOGS');
check('spec: token address equals BULLDOGS pool asset', Boolean(bulldogsPool) && same(d.token.address, bulldogsPool.asset));
check(`spec: token symbol (on-chain) is ${spec.token.symbol}`, tokenSymbol === spec.token.symbol, tokenSymbol);
check(`spec: token decimals (on-chain) is ${spec.token.decimals}`, tokenDecimals === spec.token.decimals, String(tokenDecimals));

for (const p of d.pools) {
  const pool = { address: p.address, abi: poolAbi };
  const [registered, min, vetting, maxRelay] = await client.readContract({ ...ep, functionName: 'assetConfig', args: [p.asset] });
  check(`${p.symbol}: assetConfig(asset).pool`, same(registered, p.address));

  const ps = spec.pools[p.symbol];
  const isNative = isAddressEqual(p.asset, NATIVE_ASSET);
  const assetDecimals = isNative
    ? 18
    : Number(await client.readContract({ address: p.asset, abi: erc20Abi, functionName: 'decimals' }));
  check(`${p.symbol}: spec: pool is in the course spec`, Boolean(ps));
  check(`${p.symbol}: spec: pool decimals equal asset decimals`, p.decimals === assetDecimals, `pool ${p.decimals}, asset ${assetDecimals}`);
  if (ps) {
    check(`${p.symbol}: spec: asset is ${ps.asset}`, same(p.asset, ps.asset), p.asset);
    check(`${p.symbol}: spec: decimals is ${ps.decimals}`, assetDecimals === ps.decimals && p.decimals === ps.decimals);
    check(`${p.symbol}: spec: minimumDepositAmount (on-chain) is ${ps.minimumDepositAmount}`, min === ps.minimumDepositAmount, min.toString());
    check(`${p.symbol}: spec: vettingFeeBPS (on-chain) is ${ps.vettingFeeBPS}`, vetting === ps.vettingFeeBPS, vetting.toString());
    check(`${p.symbol}: spec: maxRelayFeeBPS (on-chain) is ${ps.maxRelayFeeBPS}`, maxRelay === ps.maxRelayFeeBPS, maxRelay.toString());
  }
  check(`${p.symbol}: minimumDepositAmount`, min.toString() === p.minimumDepositAmount);
  check(`${p.symbol}: vettingFeeBPS`, Number(vetting) === p.vettingFeeBPS);
  check(`${p.symbol}: maxRelayFeeBPS`, Number(maxRelay) === p.maxRelayFeeBPS);
  check(`${p.symbol}: scopeToPool(scope)`, same(await client.readContract({ ...ep, functionName: 'scopeToPool', args: [BigInt(p.scope)] }), p.address));
  check(`${p.symbol}: SCOPE()`, (await client.readContract({ ...pool, functionName: 'SCOPE' })).toString() === p.scope);
  check(`${p.symbol}: ASSET()`, same(await client.readContract({ ...pool, functionName: 'ASSET' }), p.asset));
  check(`${p.symbol}: ENTRYPOINT()`, same(await client.readContract({ ...pool, functionName: 'ENTRYPOINT' }), d.contracts.entrypoint.proxy));
  check(`${p.symbol}: WITHDRAWAL_VERIFIER()`, same(await client.readContract({ ...pool, functionName: 'WITHDRAWAL_VERIFIER' }), d.contracts.withdrawalVerifier));
  check(`${p.symbol}: RAGEQUIT_VERIFIER()`, same(await client.readContract({ ...pool, functionName: 'RAGEQUIT_VERIFIER' }), d.contracts.ragequitVerifier));
  check(`${p.symbol}: not dead`, !(await client.readContract({ ...pool, functionName: 'dead' })));

  const tx = isNative ? d.smokeTest.ethDepositTx : d.smokeTest.tokenDepositTx;
  const receipt = await client.getTransactionReceipt({ hash: tx });
  check(`${p.symbol}: smoke deposit tx succeeded`, receipt.status === 'success', tx);
  const deposited = parseEventLogs({
    abi: poolAbi,
    eventName: 'Deposited',
    logs: receipt.logs.filter((l) => same(l.address, p.address)),
  })[0];
  check(`${p.symbol}: Deposited event emitted by pool`, Boolean(deposited));
  if (deposited) {
    check(`${p.symbol}: deposited value == minimum (zero vetting fee)`, deposited.args._value.toString() === p.minimumDepositAmount);
  }

  const token = { address: p.asset, abi: erc20Abi };
  if (deposited) {
    // Pool balance must rise by exactly the deposited value across the smoke deposit's block.
    const balanceAt = (blockNumber) =>
      isNative
        ? client.getBalance({ address: p.address, blockNumber })
        : client.readContract({ ...token, functionName: 'balanceOf', args: [p.address], blockNumber });
    const [before, after] = await Promise.all([balanceAt(receipt.blockNumber - 1n), balanceAt(receipt.blockNumber)]);
    const delta = after - before;
    check(`${p.symbol}: pool balance increased by deposited value`, delta === deposited.args._value, `delta ${delta}`);

    if (!isNative) {
      const transfer = parseEventLogs({
        abi: erc20Abi,
        eventName: 'Transfer',
        logs: receipt.logs.filter((l) => same(l.address, p.asset)),
      }).find((e) => same(e.args.from, d.contracts.entrypoint.proxy) && same(e.args.to, p.address));
      check(
        `${p.symbol}: ERC-20 Transfer entrypoint -> pool == deposited value`,
        transfer?.args.value === deposited.args._value,
        transfer ? `value ${transfer.args.value}` : 'no matching Transfer log',
      );
    }
  }
}

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
