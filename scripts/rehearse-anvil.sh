#!/usr/bin/env bash
# Full rehearsal against a local anvil fork of Sepolia:
# deploy (CourseSepolia) -> smoke deposits (CourseSmoke) -> export deployments/anvil.json -> verify.
# Env: ETHEREUM_SEPOLIA_RPC (required), ANVIL_PORT (default 8545), KEEP_ANVIL=1 to leave anvil running.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONTRACTS="$ROOT/core/packages/contracts"
: "${ETHEREUM_SEPOLIA_RPC:?set ETHEREUM_SEPOLIA_RPC}"
PORT="${ANVIL_PORT:-8545}"
RPC="http://127.0.0.1:$PORT"

# Impersonated local-only accounts (no keys involved).
DEPLOYER=0x5ea5000000000000000000000000000000000d01
POSTMAN=0x5ea5000000000000000000000000000000000d02

FORGE_OUT="$CONTRACTS/deployments/11155111.json"
BACKUP=""
if [[ -f "$FORGE_OUT" ]]; then BACKUP="$(mktemp)"; cp "$FORGE_OUT" "$BACKUP"; fi

anvil --fork-url "$ETHEREUM_SEPOLIA_RPC" --chain-id 11155111 --port "$PORT" --silent &
ANVIL_PID=$!
cleanup() {
  if [[ -n "$BACKUP" ]]; then mv "$BACKUP" "$FORGE_OUT"; else rm -f "$FORGE_OUT"; fi
  if [[ "${KEEP_ANVIL:-0}" != "1" ]]; then kill "$ANVIL_PID" 2>/dev/null || true; fi
}
trap cleanup EXIT

for _ in $(seq 1 60); do cast chain-id --rpc-url "$RPC" >/dev/null 2>&1 && break; sleep 0.5; done
cast rpc anvil_setBalance "$DEPLOYER" 0x56BC75E2D63100000 --rpc-url "$RPC" >/dev/null
cast rpc anvil_impersonateAccount "$DEPLOYER" --rpc-url "$RPC" >/dev/null

export OWNER_ADDRESS="$DEPLOYER" POSTMAN_ADDRESS="$POSTMAN" DEPLOYER_ADDRESS="$DEPLOYER"
export FOUNDRY_BROADCAST="broadcast-anvil"

cd "$CONTRACTS"
forge script script/CourseDeploy.s.sol:CourseSepolia --rpc-url "$RPC" --broadcast --unlocked --sender "$DEPLOYER" --slow -vv
mkdir -p "$ROOT/deployments/raw/anvil"
cp "$FORGE_OUT" "$ROOT/deployments/raw/anvil/forge-deployment.json"

ENTRYPOINT_ADDRESS="$(node -e 'const c=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).contracts;console.log(c.find(x=>x.name==="Entrypoint_Proxy").address)' "$FORGE_OUT")"
export ENTRYPOINT_ADDRESS
forge script script/CourseSmoke.s.sol:CourseSmoke --rpc-url "$RPC" --broadcast --unlocked --sender "$DEPLOYER" --slow -vv
cp "$CONTRACTS/broadcast-anvil/CourseSmoke.s.sol/11155111/run-latest.json" "$ROOT/deployments/raw/anvil/smoke-run.json"

cd "$ROOT/scripts"
node export-deployment.mjs --rpc "$RPC" \
  --forge-deployment "$ROOT/deployments/raw/anvil/forge-deployment.json" \
  --smoke-run "$ROOT/deployments/raw/anvil/smoke-run.json" \
  --owner "$DEPLOYER" --postman "$POSTMAN" --out "$ROOT/deployments/anvil.json"
node verify-deployment.mjs --file "$ROOT/deployments/anvil.json" --rpc "$RPC"

if [[ "${KEEP_ANVIL:-0}" == "1" ]]; then echo "anvil left running on $RPC (pid $ANVIL_PID)"; fi
