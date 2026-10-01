#!/usr/bin/env node
// On-chain smoke verification of a deployments/<net>.json file. Exit code 1 on any failure.
// Usage: node verify-deployment.mjs --file <deployment.json> --rpc <url>
// Note: the balance-delta checks read pool balances at the smoke-deposit blocks (N-1 and N), so the RPC must serve
// state for those blocks: any node right after deploy, an archive node later.
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { createPublicClient, http, isAddressEqual, parseEventLogs } from 'viem';
import { NATIVE_ASSET, ROLES, entrypointAbi, erc20Abi, poolAbi } from './lib/abis.mjs';

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

check('chain id', (await client.getChainId()) === d.chainId);
check('owner holds OWNER_ROLE', await client.readContract({ ...ep, functionName: 'hasRole', args: [ROLES.OWNER, d.roles.owner] }));
check('postman holds ASP_POSTMAN', await client.readContract({ ...ep, functionName: 'hasRole', args: [ROLES.POSTMAN, d.roles.postman] }));

const t = { address: d.token.address, abi: erc20Abi };
check('token name', (await client.readContract({ ...t, functionName: 'name' })) === d.token.name);
check('token symbol', (await client.readContract({ ...t, functionName: 'symbol' })) === d.token.symbol);
check('token decimals', Number(await client.readContract({ ...t, functionName: 'decimals' })) === d.token.decimals);

for (const p of d.pools) {
  const pool = { address: p.address, abi: poolAbi };
  const [registered, min, vetting, maxRelay] = await client.readContract({ ...ep, functionName: 'assetConfig', args: [p.asset] });
  check(`${p.symbol}: assetConfig(asset).pool`, same(registered, p.address));
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

  const tx = p.asset === NATIVE_ASSET ? d.smokeTest.ethDepositTx : d.smokeTest.tokenDepositTx;
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

  const isNative = p.asset === NATIVE_ASSET;
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
