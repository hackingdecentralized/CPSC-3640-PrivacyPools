#!/usr/bin/env node
// Backend end-to-end check (spec §7): for ETH and BULLDOGS, a mnemonic-derived deposit -> ASP approval ->
// website-equivalent ZK proof (SDK 1.4.0, website ceremony artifacts) -> relayer /quote + /request ->
// recipient paid and nullifier spent. Then one more ETH deposit exits through ragequit.
// Exit code 1 on any failure.
//
// Usage (from the repo root):
//   node scripts/e2e-withdraw.mjs --deployment deployments/anvil.json --rpc http://127.0.0.1:8547 \
//     --asp http://127.0.0.1:8182 --relayer http://127.0.0.1:3132 [--artifacts website/public] [--asp-timeout 600]
//
// Student account: on anvil a fresh address is impersonated and funded. On any other chain the script uses
// STUDENT_PRIVATE_KEY from the environment (never hard-coded), which needs ~0.003 ETH plus gas.
//
// The proof inputs mirror website/src/hooks/useWithdraw.ts + website/src/utils/{sdk,proof}.ts:
//   ASP and state leaves from GET <asp>/<chainId>/public/mt-leaves, Merkle proofs via generateMerkleProof,
//   the fee commitment from POST <relayer>/relayer/quote with the recipient,
//   withdrawal = { processooor: entrypoint, data: feeCommitment.withdrawalData }, context = calculateContext(withdrawal, scope),
//   withdrawal secrets from AccountService.createWithdrawalSecrets, tree depths 32, full-amount withdrawal.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import {
  AccountService,
  Circuits,
  DataService,
  PrivacyPoolSDK,
  calculateContext,
  generateDepositSecrets,
  generateMasterKeys,
  generateMerkleProof,
} from '@0xbow/privacy-pools-core-sdk';
import {
  createPublicClient,
  createWalletClient,
  encodeAbiParameters,
  formatUnits,
  getAddress,
  http,
  isAddressEqual,
  parseAbi,
  parseAbiParameters,
  parseEventLogs,
  parseUnits,
} from 'viem';
import { english, generateMnemonic, generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { NATIVE_ASSET } from './lib/abis.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AMOUNTS = { ETH: '0.001', BULLDOGS: '10' }; // the pools' minimum deposits
const TREE_DEPTH = 32n; // state and ASP tree depth, as the website passes them

const { values: args } = parseArgs({
  options: {
    deployment: { type: 'string' },
    rpc: { type: 'string' },
    asp: { type: 'string' },
    relayer: { type: 'string' },
    artifacts: { type: 'string', default: path.join(REPO_ROOT, 'website/public') },
    'asp-timeout': { type: 'string', default: '600' },
  },
});
if (!args.deployment || !args.rpc || !args.asp || !args.relayer) {
  console.error('usage: --deployment <file> --rpc <url> --asp <url> --relayer <url> [--artifacts <dir>] [--asp-timeout <sec>]');
  process.exit(2);
}
const ASP = args.asp.replace(/\/+$/, '');
const RELAYER = args.relayer.replace(/\/+$/, '');
const ASP_TIMEOUT_MS = Number(args['asp-timeout']) * 1000;

const entrypointAbi = parseAbi([
  'function deposit(uint256 _precommitment) payable returns (uint256)',
  'function deposit(address _asset, uint256 _value, uint256 _precommitment) returns (uint256)',
  'function latestRoot() view returns (uint256)',
  'event WithdrawalRelayed(address indexed _relayer, address indexed _recipient, address indexed _asset, uint256 _amount, uint256 _feeAmount)',
  'error PrecommitmentAlreadyUsed()',
  'error InvalidWithdrawalAmount()',
  'error RelayFeeGreaterThanMax()',
  'error InvalidProcessooor()',
  'error PoolNotFound()',
  'error MinimumDepositAmount()',
]);
const poolAbi = parseAbi([
  'struct RagequitProof { uint256[2] pA; uint256[2][2] pB; uint256[2] pC; uint256[4] pubSignals; }',
  'function SCOPE() view returns (uint256)',
  'function currentRoot() view returns (uint256)',
  'function nullifierHashes(uint256) view returns (bool)',
  'function ragequit(RagequitProof _proof)',
  'event Deposited(address indexed _depositor, uint256 _commitment, uint256 _label, uint256 _value, uint256 _precommitmentHash)',
  'event Withdrawn(address indexed _processooor, uint256 _value, uint256 _spentNullifier, uint256 _newCommitment)',
  'event Ragequit(address indexed _ragequitter, uint256 _commitment, uint256 _label, uint256 _value)',
  'error InvalidProof()',
  'error InvalidCommitment()',
  'error ContextMismatch()',
  'error UnknownStateRoot()',
  'error IncorrectASPRoot()',
  'error OnlyOriginalDepositor()',
  'error NullifierAlreadySpent()',
]);
const tokenAbi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function claim()',
]);

// ---------------------------------------------------------------------------------------------------------------------
// Reporting

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures++;
  return ok;
}
const note = (msg) => console.log(`      ${msg}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const json = (v) => JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? x.toString() : x));

async function getJson(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  if (!res.ok) throw new Error(`${init?.method ?? 'GET'} ${url} -> HTTP ${res.status}: ${text.slice(0, 500)}`);
  return body;
}
const postJson = (url, body) => getJson(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: json(body) });

// ---------------------------------------------------------------------------------------------------------------------
// Setup

const deployment = JSON.parse(readFileSync(args.deployment, 'utf8'));
const chainId = deployment.chainId;
const entrypoint = getAddress(deployment.contracts.entrypoint.proxy);
const chain = {
  id: chainId,
  name: `chain-${chainId}`,
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [args.rpc] } },
};
const publicClient = createPublicClient({ chain, transport: http(args.rpc) });

const rpcChainId = await publicClient.getChainId();
if (rpcChainId !== chainId) {
  console.error(`RPC ${args.rpc} is on chain ${rpcChainId}, deployment file is for ${chainId}`);
  process.exit(1);
}
const clientVersion = await publicClient.request({ method: 'web3_clientVersion' }).catch(() => '');
const isAnvil = /anvil/i.test(String(clientVersion));

let student;
if (isAnvil) {
  student = privateKeyToAccount(generatePrivateKey()).address; // only the address: anvil signs for it
  await publicClient.request({ method: 'anvil_impersonateAccount', params: [student] });
  await publicClient.request({ method: 'anvil_setBalance', params: [student, '0x8AC7230489E80000'] }); // 10 ETH
} else {
  const key = process.env.STUDENT_PRIVATE_KEY;
  if (!key) {
    console.error('not an anvil node: set STUDENT_PRIVATE_KEY (instructor-funded Sepolia test key)');
    process.exit(2);
  }
  student = privateKeyToAccount(key);
}
const studentAddress = typeof student === 'string' ? student : student.address;
const wallet = createWalletClient({ chain, transport: http(args.rpc), account: student });

// The SDK reads the website's ceremony artifacts (hash-pinned by SDK 1.4.0) from disk: new URL('artifacts/<file>', baseUrl).
const artifactsBase = pathToFileURL(path.resolve(args.artifacts)).href.replace(/\/?$/, '/');
const sdk = new PrivacyPoolSDK(new Circuits({ baseUrl: artifactsBase, browser: false }));
// AccountService wants a DataService (event scans); this script never scans, but builds one as the website does.
const dataService = new DataService(
  deployment.pools.map((p) => ({
    chainId,
    privacyPoolAddress: getAddress(p.address),
    startBlock: BigInt(p.deploymentBlock),
    rpcUrl: args.rpc,
    apiKey: 'sdk',
  })),
);

console.log(`e2e-withdraw: chain ${chainId} (${isAnvil ? 'anvil fork' : 'live'}), entrypoint ${entrypoint}`);
console.log(`  student ${studentAddress}${isAnvil ? ' (impersonated)' : ''}, asp ${ASP}, relayer ${RELAYER}`);
console.log(`  artifacts ${artifactsBase}artifacts/\n`);

// ---------------------------------------------------------------------------------------------------------------------
// Steps

async function send(label, request) {
  const { request: req } = await publicClient.simulateContract({ account: student, ...request });
  const hash = await wallet.writeContract(req);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error(`${label} reverted (tx ${hash})`);
  return receipt;
}

const balanceOf = (pool, who) =>
  pool.isNative
    ? publicClient.getBalance({ address: who })
    : publicClient.readContract({ address: pool.asset, abi: tokenAbi, functionName: 'balanceOf', args: [who] });

/** Deposit through the Entrypoint the way website/src/hooks/useDeposit.ts does; return the SDK pool account. */
async function deposit(pool, accountService, index) {
  const { nullifier, secret, precommitment } = accountService.createDepositSecrets(pool.scope, index);
  let receipt;
  if (pool.isNative) {
    receipt = await send('deposit', {
      address: entrypoint,
      abi: entrypointAbi,
      functionName: 'deposit',
      args: [precommitment],
      value: pool.amount,
    });
  } else {
    const balance = await balanceOf(pool, studentAddress);
    if (balance < pool.amount) {
      await send('claim', { address: pool.asset, abi: tokenAbi, functionName: 'claim' });
      note(`claimed ${pool.symbol}: balance ${formatUnits(await balanceOf(pool, studentAddress), pool.decimals)}`);
    }
    await send('approve', { address: pool.asset, abi: tokenAbi, functionName: 'approve', args: [entrypoint, pool.amount] });
    receipt = await send('deposit', {
      address: entrypoint,
      abi: entrypointAbi,
      functionName: 'deposit',
      args: [pool.asset, pool.amount, precommitment],
    });
  }
  const event = parseEventLogs({ abi: poolAbi, eventName: 'Deposited', logs: receipt.logs }).find((e) =>
    isAddressEqual(e.address, pool.address),
  );
  if (!event) throw new Error(`no Deposited event from pool ${pool.address} in ${receipt.transactionHash}`);
  const { _label: label, _commitment: commitmentHash, _value: value, _precommitmentHash } = event.args;
  check(`${pool.symbol}: deposit #${index} Deposited event`, _precommitmentHash === precommitment && value === pool.amount,
    `tx ${receipt.transactionHash}, value ${formatUnits(value, pool.decimals)}`);

  const poolAccount = accountService.addPoolAccount(pool.scope, value, nullifier, secret, label, receipt.blockNumber, receipt.transactionHash);
  check(`${pool.symbol}: SDK commitment hash == on-chain commitment`, poolAccount.deposit.hash === commitmentHash, `label ${label}`);
  return { commitment: poolAccount.deposit, receipt };
}

/** Poll the ASP until the label is in the confirmed association set and the ASP root equals the on-chain root. */
async function waitForAsp(pool, commitment) {
  const started = Date.now();
  let lastLog = 0;
  for (;;) {
    const headers = { 'X-Pool-Scope': pool.scope.toString() };
    const [leaves, roots] = await Promise.all([
      getJson(`${ASP}/${chainId}/public/mt-leaves`, { headers }),
      getJson(`${ASP}/${chainId}/public/mt-roots`, { headers }),
    ]);
    const hasLabel = leaves.aspLeaves.includes(commitment.label.toString());
    const hasLeaf = leaves.stateTreeLeaves.includes(commitment.hash.toString());
    const synced = roots.mtRoot === roots.onchainMtRoot;
    if (hasLabel && hasLeaf && synced) return { leaves, roots, waitedMs: Date.now() - started };
    if (Date.now() - started > ASP_TIMEOUT_MS) {
      throw new Error(`ASP timeout: label in aspLeaves=${hasLabel}, commitment in stateTreeLeaves=${hasLeaf}, mtRoot==onchainMtRoot=${synced}`);
    }
    if (Date.now() - lastLog > 15_000) {
      note(`waiting for ASP: label approved+published=${hasLabel}, leaf indexed=${hasLeaf}, roots synced=${synced}`);
      lastLog = Date.now();
    }
    await sleep(2_000);
  }
}

// website/src/utils/proof.ts encodeWithdrawData / prepareWithdrawRequest
const websiteWithdrawalData = (recipient, feeRecipient, feeBPS) =>
  encodeAbiParameters(parseAbiParameters('address recipient, address feeRecipient, uint256 relayFeeBPS'), [
    recipient,
    feeRecipient,
    BigInt(feeBPS),
  ]);
const padArray = (arr, length) => (arr.length >= length ? arr : [...arr, ...Array(length - arr.length).fill(0n)]);

async function withdrawViaRelayer(pool, accountService, commitment, details) {
  // ASP data, exactly what the website fetches.
  const { leaves, roots, waitedMs } = await waitForAsp(pool, commitment);
  check(`${pool.symbol}: ASP approved label and published root`, true, `waited ${(waitedMs / 1000).toFixed(1)} s, root ${roots.mtRoot}`);

  const stateMerkleProof = generateMerkleProof(leaves.stateTreeLeaves.map(BigInt), commitment.hash);
  const aspMerkleProof = generateMerkleProof(leaves.aspLeaves.map(BigInt), commitment.label);
  aspMerkleProof.index = Object.is(aspMerkleProof.index, NaN) ? 0 : aspMerkleProof.index; // website workaround
  const [latestAspRoot, currentStateRoot] = await Promise.all([
    publicClient.readContract({ address: entrypoint, abi: entrypointAbi, functionName: 'latestRoot' }),
    publicClient.readContract({ address: pool.address, abi: poolAbi, functionName: 'currentRoot' }),
  ]);
  check(`${pool.symbol}: ASP Merkle root == Entrypoint.latestRoot()`, aspMerkleProof.root === latestAspRoot, `${leaves.aspLeaves.length} labels`);
  check(`${pool.symbol}: state Merkle root == pool.currentRoot()`, stateMerkleProof.root === currentStateRoot, `${leaves.stateTreeLeaves.length} leaves`);

  // Fee commitment for a fresh recipient.
  const recipient = privateKeyToAccount(generatePrivateKey()).address;
  const quote = await postJson(`${RELAYER}/relayer/quote`, {
    chainId,
    amount: pool.amount.toString(),
    asset: pool.asset,
    recipient,
    extraGas: false,
  });
  const feeCommitment = quote.feeCommitment;
  check(`${pool.symbol}: relayer quote`, feeCommitment !== undefined && quote.feeBPS === details.feeBPS,
    `feeBPS ${quote.feeBPS}, expires in ${feeCommitment ? Math.round((feeCommitment.expiration - Date.now()) / 1000) : '?'} s`);

  const withdrawal = { processooor: entrypoint, data: feeCommitment.withdrawalData };
  check(`${pool.symbol}: fee commitment data == website prepareWithdrawRequest(recipient, entrypoint, relayer, feeBPS)`,
    withdrawal.data.toLowerCase() === websiteWithdrawalData(recipient, getAddress(details.feeReceiverAddress), quote.feeBPS).toLowerCase());

  // website getScope(): the pool's SCOPE() on-chain.
  const scope = await publicClient.readContract({ address: pool.address, abi: poolAbi, functionName: 'SCOPE' });
  check(`${pool.symbol}: on-chain SCOPE() == deployment scope`, scope === pool.scope);
  const context = calculateContext(withdrawal, scope);
  const { secret, nullifier } = accountService.createWithdrawalSecrets(commitment);

  // website prepareWithdrawalProofInput, full amount.
  const input = {
    withdrawalAmount: pool.amount,
    stateMerkleProof: { root: stateMerkleProof.root, leaf: commitment.hash, index: stateMerkleProof.index, siblings: padArray(stateMerkleProof.siblings, 32) },
    aspMerkleProof: { root: aspMerkleProof.root, leaf: commitment.label, index: aspMerkleProof.index, siblings: padArray(aspMerkleProof.siblings, 32) },
    stateRoot: stateMerkleProof.root,
    aspRoot: aspMerkleProof.root,
    stateTreeDepth: TREE_DEPTH,
    aspTreeDepth: TREE_DEPTH,
    context: BigInt(context),
    newSecret: secret,
    newNullifier: nullifier,
  };
  // website generateWithdrawalProof(): the commitment wrapper with its 0x1234 placeholders.
  const t0 = Date.now();
  const proof = await sdk.proveWithdrawal(
    {
      preimage: {
        label: commitment.label,
        value: commitment.value,
        precommitment: { hash: BigInt('0x1234'), nullifier: commitment.nullifier, secret: commitment.secret },
      },
      hash: commitment.hash,
      nullifierHash: BigInt('0x1234'),
    },
    input,
  );
  const provingMs = Date.now() - t0;
  check(`${pool.symbol}: withdrawal proof verifies locally (SDK 1.4.0)`, await sdk.verifyWithdrawal(proof), `proved in ${(provingMs / 1000).toFixed(1)} s`);

  const spentNullifier = BigInt(proof.publicSignals[1]);
  const nullifierSpent = () =>
    publicClient.readContract({ address: pool.address, abi: poolAbi, functionName: 'nullifierHashes', args: [spentNullifier] });
  const spentBefore = await nullifierSpent();
  const [recipientBefore, feeReceiverBefore] = await Promise.all([
    balanceOf(pool, recipient),
    balanceOf(pool, details.feeReceiverAddress),
  ]);

  const relay = await postJson(`${RELAYER}/relayer/request`, {
    withdrawal,
    proof: proof.proof,
    publicSignals: proof.publicSignals,
    scope: scope.toString(),
    chainId,
    feeCommitment,
  });
  if (!check(`${pool.symbol}: relayer accepted /relayer/request`, relay.success === true && Boolean(relay.txHash),
    relay.success ? `tx ${relay.txHash}` : `error: ${relay.error}`)) {
    return;
  }

  const receipt = await publicClient.waitForTransactionReceipt({ hash: relay.txHash });
  check(`${pool.symbol}: relayed tx mined successfully`, receipt.status === 'success', `block ${receipt.blockNumber}`);
  const tx = await publicClient.getTransaction({ hash: relay.txHash });
  check(`${pool.symbol}: relayed tx sent by the relayer, not the student`,
    isAddressEqual(tx.from, details.feeReceiverAddress) && !isAddressEqual(tx.from, studentAddress), `from ${tx.from}`);

  const fee = (pool.amount * BigInt(quote.feeBPS)) / 10_000n;
  const relayed = parseEventLogs({ abi: entrypointAbi, eventName: 'WithdrawalRelayed', logs: receipt.logs })[0];
  check(`${pool.symbol}: WithdrawalRelayed event`,
    relayed !== undefined && isAddressEqual(relayed.args._recipient, recipient) && relayed.args._amount === pool.amount && relayed.args._feeAmount === fee,
    relayed ? `amount ${formatUnits(relayed.args._amount, pool.decimals)}, fee ${formatUnits(relayed.args._feeAmount, pool.decimals)}` : 'missing');
  const withdrawn = parseEventLogs({ abi: poolAbi, eventName: 'Withdrawn', logs: receipt.logs }).find((e) => isAddressEqual(e.address, pool.address));
  check(`${pool.symbol}: pool Withdrawn event spends the proof's nullifier`, withdrawn?.args._spentNullifier === spentNullifier);

  const [recipientAfter, feeReceiverAfter] = await Promise.all([balanceOf(pool, recipient), balanceOf(pool, details.feeReceiverAddress)]);
  check(`${pool.symbol}: recipient balance +amount-fee`, recipientAfter - recipientBefore === pool.amount - fee,
    `recipient ${recipient} +${formatUnits(recipientAfter - recipientBefore, pool.decimals)} ${pool.symbol}`);
  if (!pool.isNative) {
    // For ETH the fee receiver is the relayer, which also pays the gas; that case is covered by the next check.
    check(`${pool.symbol}: fee receiver balance +fee`, feeReceiverAfter - feeReceiverBefore === fee, `+${formatUnits(feeReceiverAfter - feeReceiverBefore, pool.decimals)}`);
  }
  if (isAddressEqual(tx.from, details.feeReceiverAddress)) {
    // The relayer's ETH must change by exactly -gas (+fee for ETH). Anything else means ETH left the relayer some other
    // way, e.g. an EIP-7702-delegated fee receiver whose code sweeps it when the Entrypoint pays it the (even zero) fee.
    const [relayerBefore, relayerAfter] = await Promise.all([
      publicClient.getBalance({ address: tx.from, blockNumber: receipt.blockNumber - 1n }),
      publicClient.getBalance({ address: tx.from, blockNumber: receipt.blockNumber }),
    ]);
    const gasCost = receipt.gasUsed * receipt.effectiveGasPrice;
    const expected = (pool.isNative ? fee : 0n) - gasCost;
    check(`${pool.symbol}: relayer ETH changed only by gas${pool.isNative ? ' and fee' : ''}`, relayerAfter - relayerBefore === expected,
      `delta ${formatUnits(relayerAfter - relayerBefore, 18)} ETH, gas ${receipt.gasUsed} x ${receipt.effectiveGasPrice}`);
  }
  check(`${pool.symbol}: nullifier spent (pool.nullifierHashes)`, spentBefore === false && (await nullifierSpent()) === true, `nullifierHash ${spentNullifier}`);
}

async function ragequit(pool, accountService, index) {
  const { commitment } = await deposit(pool, accountService, index);
  // website generateRagequitProof() + useExit's argument layout (pB coordinates swapped for the Solidity verifier).
  const proof = await sdk.proveCommitment(commitment.value, commitment.label, commitment.nullifier, commitment.secret);
  check(`${pool.symbol}: ragequit commitment proof verifies locally`, await sdk.verifyCommitment(proof));
  const p = proof.proof;
  const args = {
    pA: [BigInt(p.pi_a[0]), BigInt(p.pi_a[1])],
    pB: [
      [BigInt(p.pi_b[0][1]), BigInt(p.pi_b[0][0])],
      [BigInt(p.pi_b[1][1]), BigInt(p.pi_b[1][0])],
    ],
    pC: [BigInt(p.pi_c[0]), BigInt(p.pi_c[1])],
    pubSignals: proof.publicSignals.map((s) => BigInt(s)),
  };

  const before = await balanceOf(pool, studentAddress);
  const receipt = await send('ragequit', { address: pool.address, abi: poolAbi, functionName: 'ragequit', args: [args] });
  const after = await balanceOf(pool, studentAddress);
  const gasCost = receipt.gasUsed * receipt.effectiveGasPrice;

  const event = parseEventLogs({ abi: poolAbi, eventName: 'Ragequit', logs: receipt.logs }).find((e) => isAddressEqual(e.address, pool.address));
  check(`${pool.symbol}: Ragequit event`,
    event !== undefined && isAddressEqual(event.args._ragequitter, studentAddress) && event.args._label === commitment.label &&
      event.args._commitment === commitment.hash && event.args._value === commitment.value,
    `tx ${receipt.transactionHash}`);
  check(`${pool.symbol}: funds returned to the depositor`, after - before + gasCost === commitment.value,
    `+${formatUnits(after - before + gasCost, pool.decimals)} ${pool.symbol} before gas`);
  const spent = await publicClient.readContract({ address: pool.address, abi: poolAbi, functionName: 'nullifierHashes', args: [args.pubSignals[1]] });
  check(`${pool.symbol}: ragequit nullifier spent`, spent === true);
}

// ---------------------------------------------------------------------------------------------------------------------
// Run

const pools = deployment.pools.map((p) => ({
  symbol: p.symbol,
  address: getAddress(p.address),
  asset: getAddress(p.asset),
  isNative: isAddressEqual(p.asset, NATIVE_ASSET),
  scope: BigInt(p.scope),
  decimals: p.decimals,
  amount: parseUnits(AMOUNTS[p.symbol] ?? '0', p.decimals),
}));
const accounts = new Map();

for (const pool of pools) {
  console.log(`== ${pool.symbol}: deposit ${formatUnits(pool.amount, pool.decimals)} -> ASP -> proof -> relayed withdrawal`);
  try {
    if (pool.amount === 0n) throw new Error(`no test amount for pool ${pool.symbol}`);
    const details = await getJson(`${RELAYER}/relayer/details?chainId=${chainId}&assetAddress=${pool.asset}`);
    check(`${pool.symbol}: relayer details`, details.feeBPS !== undefined && Boolean(details.feeReceiverAddress),
      `feeBPS ${details.feeBPS}, fee receiver ${details.feeReceiverAddress}, min ${formatUnits(BigInt(details.minWithdrawAmount), pool.decimals)}`);

    const mnemonic = generateMnemonic(english);
    const accountService = new AccountService(dataService, { mnemonic });
    accounts.set(pool.symbol, accountService);
    const sdkSecrets = generateDepositSecrets(generateMasterKeys(mnemonic), pool.scope, 0n);
    const serviceSecrets = accountService.createDepositSecrets(pool.scope, 0n);
    check(`${pool.symbol}: mnemonic -> master keys -> deposit secrets (index 0)`,
      sdkSecrets.nullifier === serviceSecrets.nullifier && sdkSecrets.secret === serviceSecrets.secret);

    const { commitment } = await deposit(pool, accountService, 0n);
    await withdrawViaRelayer(pool, accountService, commitment, details);
  } catch (e) {
    check(`${pool.symbol}: flow completed`, false, e?.shortMessage ?? e?.message ?? String(e));
  }
  console.log('');
}

const ethPool = pools.find((p) => p.isNative);
console.log(`== ${ethPool.symbol}: deposit ${formatUnits(ethPool.amount, ethPool.decimals)} -> ragequit (no ASP, no relayer)`);
try {
  // Same account as the ETH withdrawal: its second deposit, index 1, as the website would derive it.
  const accountService = accounts.get(ethPool.symbol) ?? new AccountService(dataService, { mnemonic: generateMnemonic(english) });
  await ragequit(ethPool, accountService, BigInt(accountService.account.poolAccounts.get(ethPool.scope)?.length ?? 0));
} catch (e) {
  check(`${ethPool.symbol}: ragequit flow completed`, false, e?.shortMessage ?? e?.message ?? String(e));
}

if (isAnvil) await publicClient.request({ method: 'anvil_stopImpersonatingAccount', params: [studentAddress] }).catch(() => {});
console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
