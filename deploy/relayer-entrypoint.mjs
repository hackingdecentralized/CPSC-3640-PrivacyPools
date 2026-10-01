// Container entrypoint for the course relayer (deploy/relayer.Dockerfile).
//
// Renders the upstream relayer's config.json from env + the mounted deployment file, then starts the
// relayer in this process. The rendered file holds the signer key, so it lives only inside the
// container (/tmp, mode 0600) and is deleted again as soon as the relayer has parsed it.
//
// Env:
//   DEPLOYMENT_FILE      deployments/<net>.json         (default /config/deployment.json)
//   RPC_URL              chain RPC                       (required)
//   RELAYER_PRIVATE_KEY  signer + fee receiver key       (required)
//   RELAYER_FEE_BPS      flat relay fee, both assets     (default 10 = 0.1%; the unmodified website refuses a
//                        0-bps quote, and the Entrypoint caps it at each pool's maxRelayFeeBPS, 100 here)
//   RELAYER_DB_PATH      SQLite file                     (default /data/relayer.sqlite)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { privateKeyToAccount } from "viem/accounts";

const NATIVE_ASSET = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const ETH_MIN_WITHDRAW = 500000000000000n; // 0.0005 ETH
const CONFIG_PATH = "/tmp/relayer.config.json";

function fail(message) {
  console.error(`relayer-entrypoint: ${message}`);
  process.exit(1);
}

function required(name) {
  const value = process.env[name];
  if (!value) fail(`${name} is required`);
  return value;
}

const deploymentFile = process.env.DEPLOYMENT_FILE || "/config/deployment.json";
const rpcUrl = required("RPC_URL");
const privateKey = required("RELAYER_PRIVATE_KEY");
const feeBpsRaw = process.env.RELAYER_FEE_BPS || "10";
const dbPath = process.env.RELAYER_DB_PATH || "/data/relayer.sqlite";

if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) fail("RELAYER_PRIVATE_KEY must be 0x followed by 64 hex characters");
if (!/^\d+$/.test(feeBpsRaw)) fail(`RELAYER_FEE_BPS must be a non-negative integer, got "${feeBpsRaw}"`);
const feeBps = BigInt(feeBpsRaw);

let deployment;
try {
  deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
} catch (e) {
  fail(`cannot read deployment file ${deploymentFile}: ${e.message}`);
}
const entrypoint = deployment?.contracts?.entrypoint?.proxy;
if (!Number.isInteger(deployment?.chainId)) fail(`${deploymentFile} has no numeric chainId`);
if (!entrypoint) fail(`${deploymentFile} has no contracts.entrypoint.proxy`);
if (!Array.isArray(deployment.pools) || deployment.pools.length === 0) fail(`${deploymentFile} has no pools`);

const supportedAssets = deployment.pools.map((pool) => {
  // The Entrypoint reverts relays whose fee exceeds the pool's maxRelayFeeBPS; refuse to quote such a fee.
  if (pool.maxRelayFeeBPS !== undefined && feeBps > BigInt(pool.maxRelayFeeBPS)) {
    fail(`RELAYER_FEE_BPS ${feeBps} exceeds ${pool.symbol} maxRelayFeeBPS ${pool.maxRelayFeeBPS}`);
  }
  const isNative = pool.asset.toLowerCase() === NATIVE_ASSET.toLowerCase();
  if (!isNative && !Number.isInteger(pool.decimals)) fail(`${pool.symbol} pool has no decimals`);
  return {
    asset_address: isNative ? NATIVE_ASSET : pool.asset,
    asset_name: pool.symbol,
    fee_bps: feeBps.toString(),
    fee_mode: "flat",
    // 0.0005 ETH, or one whole token (1 BULLDOGS).
    min_withdraw_amount: (isNative ? ETH_MIN_WITHDRAW : 10n ** BigInt(pool.decimals)).toString(),
  };
});

const signer = privateKeyToAccount(privateKey);
const config = {
  defaults: {
    fee_receiver_address: signer.address,
    signer_private_key: privateKey,
    entrypoint_address: entrypoint,
  },
  chains: [
    {
      chain_id: deployment.chainId,
      chain_name: "sepolia",
      rpc_url: rpcUrl,
      native_currency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
      supported_assets: supportedAssets,
    },
  ],
  sqlite_db_path: dbPath,
  cors_allow_all: true,
  allowed_domains: [],
};

fs.mkdirSync(path.dirname(dbPath), { recursive: true });
fs.rmSync(CONFIG_PATH, { force: true });
fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), { mode: 0o600 });
process.env.CONFIG_PATH = CONFIG_PATH;

console.log(
  `relayer-entrypoint: chain ${deployment.chainId}, entrypoint ${entrypoint}, signer/fee receiver ${signer.address}, ` +
    `db ${dbPath}, assets ` +
    supportedAssets.map((a) => `${a.asset_name}(${a.fee_mode} ${a.fee_bps} bps, min ${a.min_withdraw_amount})`).join(", "),
);

// Same as `exec node dist/index.js`, minus the extra process: the relayer parses CONFIG_PATH while its modules load.
const here = path.dirname(fileURLToPath(import.meta.url));
try {
  await import(pathToFileURL(path.join(here, "dist/index.js")).href);
} finally {
  fs.rmSync(CONFIG_PATH, { force: true });
}
