#!/usr/bin/env bash
# Run the Teaching ASP against a local anvil fork of Sepolia (from ../scripts/rehearse-anvil.sh with KEEP_ANVIL=1).
#
#   ADMIN_ADDRESSES=0xYourTeacherWallet ./asp/scripts/dev-anvil.sh
#
# Env (all optional except ADMIN_ADDRESSES):
#   ASP_RPC                 anvil RPC                       (default http://127.0.0.1:8547)
#   DEPLOYMENT_FILE         deployment record               (default <repo>/deployments/anvil.json)
#   PORT                    HTTP port                       (default 8182)
#   AUTO_APPROVE_DELAY_SEC  initial auto-approve delay      (default 10)
#   PUBLISH_INTERVAL_SEC    initial min seconds per publish (default 5)
#   CONFIRMATIONS           blocks to wait before indexing  (default 0)
#   POSTMAN_UNLOCKED_ADDRESS impersonated postman           (default roles.postman from the deployment file)
#   ADMIN_TOKEN_SECRET      HMAC secret for admin tokens    (default: fresh `openssl rand -hex 32` per run)
#   DB_PATH                 SQLite file                     (default asp/data/dev-anvil.sqlite)
# The postman is impersonated on anvil and topped up with ETH if it holds less than 1 ETH.
set -euo pipefail

ASP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="$(dirname "$ASP_DIR")"

: "${ADMIN_ADDRESSES:?set ADMIN_ADDRESSES to the teacher wallet address(es), comma-separated}"
ASP_RPC="${ASP_RPC:-http://127.0.0.1:8547}"
DEPLOYMENT_FILE="${DEPLOYMENT_FILE:-$ROOT/deployments/anvil.json}"

if [[ ! -f "$DEPLOYMENT_FILE" ]]; then
  echo "error: $DEPLOYMENT_FILE not found; run KEEP_ANVIL=1 ANVIL_PORT=8547 ./scripts/rehearse-anvil.sh first" >&2
  exit 1
fi
if [[ ! -d "$ASP_DIR/node_modules" ]]; then
  echo "error: $ASP_DIR/node_modules missing; run 'npm ci' in asp/ first" >&2
  exit 1
fi

json_field() { node -e 'const d = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")); console.log(process.argv[2].split(".").reduce((o, k) => o[k], d))' "$DEPLOYMENT_FILE" "$1"; }

EXPECTED_CHAIN_ID="$(json_field chainId)"
if ! CHAIN_ID="$(cast chain-id --rpc-url "$ASP_RPC" 2>/dev/null)"; then
  echo "error: no RPC node answering on $ASP_RPC; start anvil with KEEP_ANVIL=1 ANVIL_PORT=8547 ./scripts/rehearse-anvil.sh" >&2
  exit 1
fi
if [[ "$CHAIN_ID" != "$EXPECTED_CHAIN_ID" ]]; then
  echo "error: $ASP_RPC reports chain id $CHAIN_ID but $DEPLOYMENT_FILE is for $EXPECTED_CHAIN_ID" >&2
  exit 1
fi

POSTMAN_UNLOCKED_ADDRESS="${POSTMAN_UNLOCKED_ADDRESS:-$(json_field roles.postman)}"
cast rpc anvil_impersonateAccount "$POSTMAN_UNLOCKED_ADDRESS" --rpc-url "$ASP_RPC" >/dev/null
POSTMAN_BALANCE="$(cast balance "$POSTMAN_UNLOCKED_ADDRESS" --rpc-url "$ASP_RPC")"
# awk compares as floating point: bash integers overflow on wei amounts above ~9.2 ETH.
if awk -v wei="$POSTMAN_BALANCE" 'BEGIN { exit !(wei + 0 < 1e18) }'; then
  cast rpc anvil_setBalance "$POSTMAN_UNLOCKED_ADDRESS" 0x56BC75E2D63100000 --rpc-url "$ASP_RPC" >/dev/null
fi

if [[ -z "${ADMIN_TOKEN_SECRET:-}" ]]; then
  ADMIN_TOKEN_SECRET="$(openssl rand -hex 32)"
  echo "note: generated a fresh ADMIN_TOKEN_SECRET; admin tokens will not survive a restart"
fi

DB_PATH="${DB_PATH:-$ASP_DIR/data/dev-anvil.sqlite}"
mkdir -p "$(dirname "$DB_PATH")"

# The ASP takes exactly one postman signer; never let a stray private key from the shell leak into a dev run.
unset POSTMAN_PRIVATE_KEY
export DEPLOYMENT_FILE POSTMAN_UNLOCKED_ADDRESS ADMIN_ADDRESSES ADMIN_TOKEN_SECRET DB_PATH
export RPC_URL="$ASP_RPC"
export PORT="${PORT:-8182}"
export AUTO_APPROVE_DELAY_SEC="${AUTO_APPROVE_DELAY_SEC:-10}"
export PUBLISH_INTERVAL_SEC="${PUBLISH_INTERVAL_SEC:-5}"
export CONFIRMATIONS="${CONFIRMATIONS:-0}"

echo "Teaching ASP (anvil): rpc=$RPC_URL port=$PORT db=$DB_PATH postman=$POSTMAN_UNLOCKED_ADDRESS admins=$ADMIN_ADDRESSES"
echo "  autoApproveDelaySec=$AUTO_APPROVE_DELAY_SEC publishIntervalSec=$PUBLISH_INTERVAL_SEC confirmations=$CONFIRMATIONS"
cd "$ASP_DIR"
exec node src/main.ts
