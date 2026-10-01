#!/usr/bin/env bash
# Start or update the VPS stack (Teaching ASP + relayer + Caddy) from deploy/.env.
#
#   cp .env.example .env && chmod 600 .env   # fill it in first
#   ./up.sh
#
# Refuses to run unless deploy/.env exists, has mode 600 and sets every required value. Then it builds the images,
# (re)starts what changed and waits until the ASP and relayer report healthy. Running it again after `git pull`
# updates the stack; the data volumes are kept.
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$DEPLOY_DIR")"
ENV_FILE="$DEPLOY_DIR/.env"
NATIVE_ASSET=0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE

fail() {
  echo "up.sh: $*" >&2
  exit 1
}

[[ -f "$ENV_FILE" ]] || fail "deploy/.env not found. Create it with: cd deploy && cp .env.example .env && chmod 600 .env, then fill it in."
MODE="$(stat -c '%a' "$ENV_FILE" 2>/dev/null || stat -f '%Lp' "$ENV_FILE")"
[[ "$MODE" == 600 ]] || fail "deploy/.env holds secrets but has mode $MODE; run: chmod 600 deploy/.env"
docker compose version >/dev/null 2>&1 || fail "docker compose is not available; install Docker first (deploy/README.md)"

# Every variable the stack reads. Compose lets a variable exported in the shell win over .env, so drop them all
# here: deploy/.env is the only source.
STACK_VARS=(DEPLOYMENT RPC_URL ASP_HOST RELAYER_HOST POSTMAN_PRIVATE_KEY ADMIN_ADDRESSES ADMIN_TOKEN_SECRET CORS_ORIGINS
  AUTO_APPROVE_DELAY_SEC PUBLISH_INTERVAL_SEC POLL_INTERVAL_MS CONFIRMATIONS LOG_CHUNK_SIZE RELAYER_PRIVATE_KEY RELAYER_FEE_BPS
  POSTMAN_UNLOCKED_ADDRESS CLOUDFLARE_TUNNEL_TOKEN)
unset "${STACK_VARS[@]}"

# Value of KEY in .env: the last KEY=value line, without surrounding quotes.
env_value() {
  local line value
  line="$(grep -E "^[[:space:]]*(export[[:space:]]+)?$1=" "$ENV_FILE" | tail -n 1 || true)"
  value="${line#*=}"
  value="${value%$'\r'}"
  if [[ "$value" =~ ^\"(.*)\"$ || "$value" =~ ^\'(.*)\'$ ]]; then value="${BASH_REMATCH[1]}"; fi
  printf '%s' "$value"
}

missing=()
for var in RPC_URL ASP_HOST RELAYER_HOST POSTMAN_PRIVATE_KEY ADMIN_ADDRESSES ADMIN_TOKEN_SECRET RELAYER_PRIVATE_KEY; do
  [[ -n "$(env_value "$var")" ]] || missing+=("$var")
done
((${#missing[@]} == 0)) || fail "deploy/.env must set: ${missing[*]} (see the comments in .env.example)"
[[ -z "$(env_value POSTMAN_UNLOCKED_ADDRESS)" ]] || fail "POSTMAN_UNLOCKED_ADDRESS is for local anvil runs only; remove it from deploy/.env"
for var in POSTMAN_PRIVATE_KEY RELAYER_PRIVATE_KEY; do
  [[ "$(env_value "$var")" =~ ^0x[0-9a-fA-F]{64}$ ]] || fail "$var must be 0x followed by 64 hex characters"
done
lower() { tr '[:upper:]' '[:lower:]'; }
[[ "$(env_value POSTMAN_PRIVATE_KEY | lower)" != "$(env_value RELAYER_PRIVATE_KEY | lower)" ]] ||
  fail "POSTMAN_PRIVATE_KEY and RELAYER_PRIVATE_KEY must be two different wallets"
(($(env_value ADMIN_TOKEN_SECRET | wc -c) >= 32)) || fail "ADMIN_TOKEN_SECRET must be at least 32 characters (openssl rand -hex 32)"
[[ -n "$(env_value CORS_ORIGINS)" ]] || echo "up.sh: warning: CORS_ORIGINS is empty, so any website may call the ASP; set it to the website URL"

DEPLOYMENT="$(env_value DEPLOYMENT)"
DEPLOYMENT_FILE="$ROOT/deployments/${DEPLOYMENT:-sepolia}.json"
[[ -f "$DEPLOYMENT_FILE" ]] || fail "deployment record $DEPLOYMENT_FILE not found (git pull, or check DEPLOYMENT in deploy/.env)"
CHAIN_ID="$(sed -n 's/^  "chainId": *\([0-9][0-9]*\).*/\1/p' "$DEPLOYMENT_FILE" | head -n 1)"

cd "$DEPLOY_DIR"
# With a Cloudflare Tunnel token, cloudflared replaces Caddy (see docker-compose.cloudflare.yml).
if [[ -n "$(env_value CLOUDFLARE_TUNNEL_TOKEN)" ]]; then
  export COMPOSE_FILE="docker-compose.yml:docker-compose.cloudflare.yml"
  FRONT=cloudflared
  echo "up.sh: using the Cloudflare Tunnel instead of Caddy"
else
  FRONT=caddy
fi
# Without this, the default provenance attestation (it carries a build timestamp) gives every rebuild a new image
# ID on the containerd image store, so each run would needlessly recreate the ASP and relayer.
export BUILDX_NO_DEFAULT_ATTESTATIONS=1
echo "up.sh: building and starting the stack (deployment $(basename "$DEPLOYMENT_FILE"))..."
if ! docker compose up -d --build --remove-orphans --wait --wait-timeout 300; then
  docker compose ps
  fail "the stack did not become healthy; inspect it with: cd deploy && docker compose logs --tail 100 asp relayer $FRONT"
fi
docker compose ps

ASP_HOST="$(env_value ASP_HOST)"
RELAYER_HOST="$(env_value RELAYER_HOST)"
cat <<EOF

The stack is up. On the first start, Caddy may need a minute to obtain certificates (with the Cloudflare Tunnel,
check that its public hostnames point at asp:8182 and relayer:3132). Check from anywhere:
  curl -s https://$ASP_HOST/health
  curl -s "https://$RELAYER_HOST/relayer/details?chainId=${CHAIN_ID:-11155111}&assetAddress=$NATIVE_ASSET"
Logs: cd deploy && ${COMPOSE_FILE:+COMPOSE_FILE=$COMPOSE_FILE }docker compose logs -f --tail 100 asp relayer $FRONT
EOF
