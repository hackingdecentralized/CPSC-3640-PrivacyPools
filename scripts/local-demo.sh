#!/usr/bin/env bash
# One-command local demo: anvil fork of Sepolia + course contracts + ASP + relayer + website.
#
#   ./scripts/local-demo.sh up <teacher-wallet-address>   start everything (website on http://localhost:3100)
#   ./scripts/local-demo.sh fund <wallet-address>         give a wallet 10 ETH on the fork
#   ./scripts/local-demo.sh down                          stop everything
#
# MetaMask: add a network with RPC http://127.0.0.1:8547 and chain id 11155111 (it is a copy of Sepolia).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RPC=http://127.0.0.1:8547
COMPOSE=(docker compose -f "$ROOT/deploy/docker-compose.yml" -f "$ROOT/deploy/docker-compose.local.yml")
ANVIL_MNEMONIC="test test test test test test test test test test test junk" # anvil's public dev mnemonic
STATE="$ROOT/.local-demo"
mkdir -p "$STATE"

up() {
  local admin="${1:?usage: local-demo.sh up <teacher-wallet-address>}"
  echo "== 1/4 fork Sepolia and deploy the course contracts (anvil on :8547)"
  # log to a file: the kept-alive anvil inherits stdout, so a pipe would never close
  if ! KEEP_ANVIL=1 ANVIL_PORT=8547 ETHEREUM_SEPOLIA_RPC="${ETHEREUM_SEPOLIA_RPC:-https://ethereum-sepolia-rpc.publicnode.com}" \
    "$ROOT/scripts/rehearse-anvil.sh" > "$STATE/rehearse.log" 2>&1; then
    tail -20 "$STATE/rehearse.log"; echo "fork/deploy failed (log: $STATE/rehearse.log)"; exit 1
  fi
  tail -1 "$STATE/rehearse.log"
  lsof -ti tcp:8547 -sTCP:LISTEN > "$STATE/anvil.pid"

  local postman
  postman="$(node -e 'console.log(require(process.argv[1]).roles.postman)' "$ROOT/deployments/anvil.json")"
  cast rpc anvil_impersonateAccount "$postman" --rpc-url "$RPC" >/dev/null
  cast rpc anvil_setBalance "$postman" 0x56BC75E2D63100000 --rpc-url "$RPC" >/dev/null

  echo "== 2/4 start the ASP (:8182) and relayer (:3132)"
  ADMIN_ADDRESSES="$admin" ADMIN_TOKEN_SECRET="$(openssl rand -hex 32)" \
    RELAYER_PRIVATE_KEY="$(cast wallet private-key "$ANVIL_MNEMONIC" 2)" POSTMAN_UNLOCKED_ADDRESS="$postman" \
    "${COMPOSE[@]}" up -d --build --wait

  echo "== 3/4 point the website at the fork"
  node "$ROOT/scripts/sync-website-config.mjs" --from "$ROOT/deployments/anvil.json" >/dev/null
  (cd "$ROOT/website" && [ -d node_modules ] || corepack pnpm install --frozen-lockfile)

  echo "== 4/4 start the website (http://localhost:3100)"
  (cd "$ROOT/website" && NEXT_PUBLIC_IS_TESTNET=true NEXT_PUBLIC_SEPOLIA_RPC_URL="$RPC" \
    NEXT_PUBLIC_ASP_ENDPOINT_TEST=http://127.0.0.1:8182 NEXT_PUBLIC_RELAYER_URL=http://127.0.0.1:3132 \
    nohup corepack pnpm dev -p 3100 > "$STATE/website.log" 2>&1 & echo $! > "$STATE/website.pid")
  for _ in $(seq 1 90); do curl -sf -o /dev/null http://localhost:3100 && break; sleep 2; done
  echo
  echo "Ready:  website http://localhost:3100   ASP page http://localhost:3100/asp"
  echo "        ASP http://127.0.0.1:8182/health   relayer http://127.0.0.1:3132/ping"
  echo "Next:   ./scripts/local-demo.sh fund <your MetaMask address>"
}

fund() {
  local who="${1:?usage: local-demo.sh fund <wallet-address>}"
  cast rpc anvil_setBalance "$who" 0x8AC7230489E80000 --rpc-url "$RPC" >/dev/null
  echo "funded $who with 10 ETH on the fork (BULLDOGS: use the Claim button on the site)"
}

down() {
  # only stop what this script started
  lsof -ti tcp:3100 -sTCP:LISTEN | xargs kill 2>/dev/null || true
  [ -f "$STATE/website.pid" ] && kill "$(cat "$STATE/website.pid")" 2>/dev/null || true
  "${COMPOSE[@]}" down -v 2>/dev/null || true
  [ -f "$STATE/anvil.pid" ] && kill $(cat "$STATE/anvil.pid") 2>/dev/null || true
  rm -rf "$STATE"
  # the website config was re-synced from the fork; restore the committed copy
  git -C "$ROOT" checkout -- website/src/config/course.json 2>/dev/null || true
  echo "stopped"
}

case "${1:-}" in
  up) shift; up "$@" ;;
  fund) shift; fund "$@" ;;
  down) down ;;
  *) sed -n '2,9p' "$0"; exit 1 ;;
esac
