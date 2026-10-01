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
REAL_BROADCAST="$CONTRACTS/broadcast"
# Forge keeps --resume state in broadcast/ AND in cache/<script>/<chainId>/ (per-tx rpc urls). FOUNDRY_BROADCAST only
# redirects the former, and the fork shares chain id 11155111 with real Sepolia, so the rehearsal would overwrite the
# cache entries a real `--resume` needs. These dirs are backed up now and restored on exit.
CACHE_DIRS=(
  "$CONTRACTS/cache/CourseDeploy.s.sol/11155111"
  "$CONTRACTS/cache/CourseSmoke.s.sol/11155111"
)

# Refuse to run if something (e.g. a leftover KEEP_ANVIL=1 instance) already answers on the port:
# the new anvil would fail to bind while every later call silently hit the old node.
if cast chain-id --rpc-url "$RPC" >/dev/null 2>&1; then
  echo "error: an RPC node is already listening on $RPC; stop it or set ANVIL_PORT" >&2
  exit 1
fi

BACKUP=""
if [[ -f "$FORGE_OUT" ]]; then BACKUP="$(mktemp)"; cp "$FORGE_OUT" "$BACKUP"; fi
CACHE_BACKUP="$(mktemp -d)"
for i in "${!CACHE_DIRS[@]}"; do
  if [[ -d "${CACHE_DIRS[$i]}" ]]; then cp -a "${CACHE_DIRS[$i]}" "$CACHE_BACKUP/$i"; fi
done
RUN_MARKER="$(mktemp)"

anvil --fork-url "$ETHEREUM_SEPOLIA_RPC" --chain-id 11155111 --port "$PORT" --silent &
ANVIL_PID=$!
cleanup() {
  if [[ -n "$BACKUP" ]]; then mv "$BACKUP" "$FORGE_OUT"; else rm -f "$FORGE_OUT"; fi
  # Restore forge's resume cache byte-for-byte; if a dir did not exist before, remove what the rehearsal created.
  for i in "${!CACHE_DIRS[@]}"; do
    rm -rf "${CACHE_DIRS[$i]}"
    if [[ -d "$CACHE_BACKUP/$i" ]]; then
      mkdir -p "$(dirname "${CACHE_DIRS[$i]}")"
      cp -a "$CACHE_BACKUP/$i" "${CACHE_DIRS[$i]}"
      diff -r "$CACHE_BACKUP/$i" "${CACHE_DIRS[$i]}" >/dev/null || echo "warning: ${CACHE_DIRS[$i]} differs from its backup after restore" >&2
    else
      rmdir "$(dirname "${CACHE_DIRS[$i]}")" 2>/dev/null || true
    fi
  done
  rm -rf "$CACHE_BACKUP"
  rm -f "$RUN_MARKER"
  if [[ "${KEEP_ANVIL:-0}" != "1" ]]; then kill "$ANVIL_PID" 2>/dev/null || true; fi
}
trap cleanup EXIT

ready=0
for _ in $(seq 1 60); do
  if ! kill -0 "$ANVIL_PID" 2>/dev/null; then
    echo "error: anvil exited; is port $PORT in use?" >&2
    exit 1
  fi
  if cast chain-id --rpc-url "$RPC" >/dev/null 2>&1; then ready=1; break; fi
  sleep 0.5
done
if [[ "$ready" != 1 ]]; then
  echo "error: anvil did not become ready on $RPC within 30s" >&2
  exit 1
fi
cast rpc anvil_setBalance "$DEPLOYER" 0x56BC75E2D63100000 --rpc-url "$RPC" >/dev/null
cast rpc anvil_impersonateAccount "$DEPLOYER" --rpc-url "$RPC" >/dev/null

export OWNER_ADDRESS="$DEPLOYER" POSTMAN_ADDRESS="$POSTMAN" DEPLOYER_ADDRESS="$DEPLOYER"
export FOUNDRY_BROADCAST="broadcast-anvil"

# The rehearsal must never write forge's real broadcast dir (real Sepolia logs live there).
# Abort if anything under it was created/modified during this run, or if FOUNDRY_BROADCAST was ignored.
assert_real_broadcast_untouched() {
  if [[ -d "$REAL_BROADCAST" && -n "$(find "$REAL_BROADCAST" -newer "$RUN_MARKER" -print -quit)" ]]; then
    echo "error: $REAL_BROADCAST was written during the rehearsal; FOUNDRY_BROADCAST was ignored" >&2
    exit 1
  fi
  if [[ ! -d "$CONTRACTS/broadcast-anvil" || -z "$(find "$CONTRACTS/broadcast-anvil" -newer "$RUN_MARKER" -print -quit)" ]]; then
    echo "error: forge logs did not land in broadcast-anvil/; FOUNDRY_BROADCAST was ignored" >&2
    exit 1
  fi
}

cd "$CONTRACTS"
forge script script/CourseDeploy.s.sol:CourseSepolia --rpc-url "$RPC" --broadcast --unlocked --sender "$DEPLOYER" --slow -vv
assert_real_broadcast_untouched
mkdir -p "$ROOT/deployments/raw/anvil"
cp "$FORGE_OUT" "$ROOT/deployments/raw/anvil/forge-deployment.json"

ENTRYPOINT_ADDRESS="$(node -e 'const c=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).contracts;console.log(c.find(x=>x.name==="Entrypoint_Proxy").address)' "$FORGE_OUT")"
export ENTRYPOINT_ADDRESS
forge script script/CourseSmoke.s.sol:CourseSmoke --rpc-url "$RPC" --broadcast --unlocked --sender "$DEPLOYER" --slow -vv
assert_real_broadcast_untouched
cp "$CONTRACTS/broadcast-anvil/CourseSmoke.s.sol/11155111/run-latest.json" "$ROOT/deployments/raw/anvil/smoke-run.json"

cd "$ROOT/scripts"
node export-deployment.mjs --rpc "$RPC" \
  --forge-deployment "$ROOT/deployments/raw/anvil/forge-deployment.json" \
  --smoke-run "$ROOT/deployments/raw/anvil/smoke-run.json" \
  --owner "$DEPLOYER" --postman "$POSTMAN" --out "$ROOT/deployments/anvil.json"
node verify-deployment.mjs --file "$ROOT/deployments/anvil.json" --rpc "$RPC"

if [[ "${KEEP_ANVIL:-0}" == "1" ]]; then echo "anvil left running on $RPC (pid $ANVIL_PID)"; fi
