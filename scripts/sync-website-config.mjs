#!/usr/bin/env node
// Write website/src/config/course.json from a deployments/<net>.json record.
// Usage: node scripts/sync-website-config.mjs --from deployments/<net>.json [--out <path>]
//
// `network` is "sepolia" when the source file is sepolia.json and "anvil-fork"
// otherwise; the site shows a LOCAL FORK badge for anything but "sepolia".
// Plain Node, no dependencies: it only reshapes JSON.
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_OUT = resolve(ROOT, 'website/src/config/course.json');
// The website is wired to viem's `sepolia` chain; an anvil fork of Sepolia keeps this id.
const SEPOLIA_CHAIN_ID = 11155111;

const { values: args } = parseArgs({
  options: {
    from: { type: 'string' },
    out: { type: 'string' },
  },
});
if (!args.from) throw new Error('missing --from <deployments/<net>.json>');

const fromPath = resolve(args.from);
const outPath = args.out ? resolve(args.out) : DEFAULT_OUT;
const src = JSON.parse(readFileSync(fromPath, 'utf8'));

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const DECIMAL = /^[0-9]+$/;

const address = (value, what) => {
  if (typeof value !== 'string' || !ADDRESS.test(value)) throw new Error(`${what}: expected an address, got ${value}`);
  return value;
};
const decimalString = (value, what) => {
  const s = typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : value;
  if (typeof s !== 'string' || !DECIMAL.test(s)) throw new Error(`${what}: expected a decimal integer, got ${value}`);
  return s;
};
const blockNumber = (value, what) => {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${what}: expected a block number, got ${value}`);
  return value;
};

if (src.chainId !== SEPOLIA_CHAIN_ID) {
  throw new Error(`chainId is ${src.chainId}; the website only supports Sepolia (${SEPOLIA_CHAIN_ID}) or a fork of it`);
}
if (!Array.isArray(src.pools) || src.pools.length === 0) throw new Error('pools: expected a non-empty array');
if (!src.token) throw new Error('token: missing');

const course = {
  network: basename(fromPath) === 'sepolia.json' ? 'sepolia' : 'anvil-fork',
  chainId: src.chainId,
  entrypoint: address(src.contracts?.entrypoint?.proxy, 'contracts.entrypoint.proxy'),
  deploymentBlock: blockNumber(src.contracts?.entrypoint?.deploymentBlock, 'contracts.entrypoint.deploymentBlock'),
  pools: src.pools.map((p, i) => {
    if (typeof p.symbol !== 'string' || !p.symbol) throw new Error(`pools[${i}].symbol: missing`);
    if (!Number.isInteger(p.decimals)) throw new Error(`pools[${i}].decimals: expected an integer`);
    return {
      symbol: p.symbol,
      address: address(p.address, `pools[${i}].address`),
      asset: address(p.asset, `pools[${i}].asset`),
      scope: decimalString(p.scope, `pools[${i}].scope`),
      deploymentBlock: blockNumber(p.deploymentBlock, `pools[${i}].deploymentBlock`),
      decimals: p.decimals,
      minimumDepositAmount: decimalString(p.minimumDepositAmount, `pools[${i}].minimumDepositAmount`),
    };
  }),
  token: {
    address: address(src.token.address, 'token.address'),
    symbol: src.token.symbol,
    decimals: src.token.decimals,
  },
};

writeFileSync(outPath, JSON.stringify(course, null, 2) + '\n');
console.log(`wrote ${relative(process.cwd(), outPath)} (network ${course.network}, ${course.pools.length} pools)`);
