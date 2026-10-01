# VPS stack: Teaching ASP + relayer + Caddy

One `docker compose` stack runs the course backend on a small Linux server:

| Service | What it is | Public URL | Data volume |
|---|---|---|---|
| `asp` | Teaching ASP (`../asp`): indexes deposits, auto-approves them unless the teacher declines, publishes the root | `https://$ASP_HOST` | `privacy-pool_asp-data` |
| `relayer` | Upstream relayer with the course's flat-fee patch (`relayer.Dockerfile`) | `https://$RELAYER_HOST` | `privacy-pool_relayer-data` |
| `caddy` | Reverse proxy; gets and renews the HTTPS certificates | ports 80 and 443 | `privacy-pool_caddy-data`, `privacy-pool_caddy-config` |

Files in this directory:
- `docker-compose.yml`: the stack;
- `Caddyfile`: the two HTTPS sites;
- `.env.example`: every setting, with comments; copy it to `.env`;
- `up.sh`: checks `.env`, then builds and starts the stack;
- `docker-compose.local.yml`: the same stack on your laptop against an anvil fork (see the last section).

## Before you start

You need:
- `deployments/sepolia.json` committed in the repo (written by the Sepolia contract deployment).
- **Two fresh wallets**, each made only for this, for example with `cast wallet new`:
  - the **postman**: the address in `roles.postman` of `deployments/sepolia.json`. It publishes the ASP roots. Fund it with about 0.05 Sepolia ETH.
  - the **relayer**: it sends the relayed withdrawals and receives the fees. Fund it with about 0.1 Sepolia ETH.

  Never use a well-known or test key (anvil, hardhat, tutorials) for either one. On Sepolia those accounts carry sweeper delegations that drain any ETH sent to them.
- The teacher's wallet address (admin login for the ASP).
- A Sepolia RPC URL, ideally a keyed one from Alchemy or Infura.
- A server with a public IPv4 address: Ubuntu 24.04 with 1–2 vCPU, 2 GB RAM (the image builds need it) and 20 GB of disk is enough.
- Optional: a domain. Without one, use `sslip.io` names, for example `asp.203.0.113.7.sslip.io` for a server at 203.0.113.7.

## Set up a fresh Ubuntu 24.04 server

1. **Open the firewall.** In the cloud provider's firewall or security group, allow inbound TCP 22, TCP 80, TCP 443 and UDP 443. Caddy needs port 80 reachable to obtain its certificates.

   If you also use `ufw`, allow the same ports there:
   ```bash
   sudo ufw allow OpenSSH && sudo ufw allow 80/tcp && sudo ufw allow 443 && sudo ufw enable
   ```
   Docker publishes ports past `ufw`, so the provider firewall is the one that matters.

2. **Install Docker Engine and the compose plugin** with Docker's official convenience script, then let your user run `docker`:
   ```bash
   sudo apt-get update && sudo apt-get install -y git curl
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   sudo usermod -aG docker "$USER"
   ```
   Log out and back in, then check that `docker compose version` prints v2.24 or newer. Docker's apt repository (docs.docker.com/engine/install/ubuntu) works just as well.

3. **Clone the repo.** The images are built on the server from the repo's sources:
   ```bash
   git clone <repo URL> privacy-pool
   cd privacy-pool/deploy
   ```
   The deployment record `deployments/sepolia.json` comes with the clone; the stack mounts it read-only into both services.

4. **Create the settings file**, and fill in every value as the comments in it explain:
   ```bash
   cp .env.example .env && chmod 600 .env
   nano .env
   ```
   The required values are `RPC_URL`, `ASP_HOST`, `RELAYER_HOST`, `POSTMAN_PRIVATE_KEY`, `ADMIN_ADDRESSES`, `ADMIN_TOKEN_SECRET` (`openssl rand -hex 32`) and `RELAYER_PRIVATE_KEY`. Set `CORS_ORIGINS` to the website's Vercel URL. `RELAYER_FEE_BPS` defaults to 10 (0.1%).

   Before you continue, point both hostnames at the server's IP: add DNS A records, or use the sslip.io names.

5. **Start the stack**:
   ```bash
   ./up.sh
   ```
   `up.sh` refuses to run unless `.env` exists, has mode 600 and sets the required values. It then runs `docker compose up -d --build --wait`, which builds the two images (a few minutes the first time), starts all three containers, and waits until the ASP and relayer report healthy. At the end it prints the check URLs.

6. **Check** from any machine:
   ```bash
   curl -s https://$ASP_HOST/health
   # {"ok":true,"chainId":11155111,"lastIndexedBlock":...,"lastError":null,...}
   curl -s "https://$RELAYER_HOST/relayer/details?chainId=11155111&assetAddress=0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
   # {"feeBPS":"10","feeReceiverAddress":"<relayer wallet>",...,"minWithdrawAmount":"500000000000000",...}
   ```
   In `/health`, `lastIndexedBlock` should keep rising, and `lastError` should stay `null`. Certificates can take a minute on the first start. If they do not appear, read the Caddy logs: usually DNS does not point at the server yet, or port 80 is blocked.

   For the full end-to-end proof on Sepolia (deposit, ASP approval, relayed withdrawal, ragequit), run the e2e script from a laptop with the repo. `STUDENT_PRIVATE_KEY` is a throwaway Sepolia key holding about 0.005 ETH:
   ```bash
   (cd scripts && npm ci)
   STUDENT_PRIVATE_KEY=0x... node scripts/e2e-withdraw.mjs --deployment deployments/sepolia.json --rpc <Sepolia RPC URL> \
     --asp https://$ASP_HOST --relayer https://$RELAYER_HOST
   ```
   It waits for the ASP's real auto-approve delay, up to 600 s by default (`--asp-timeout`).

## Operate

Run these from `deploy/`.

**Status and logs**
```bash
docker compose ps
docker compose logs -f --tail 100 asp relayer caddy   # Ctrl-C stops following, not the services
docker compose logs --since 1h relayer
```

**Update** after new commits (rebuilds what changed and keeps all volumes):
```bash
git pull
./up.sh
```

**Restart or stop**
```bash
docker compose restart asp
docker compose down        # stops and removes the containers; the volumes stay
```
Never run `docker compose down -v`, and never `docker volume rm` the `privacy-pool_*` volumes.

**Back up the ASP database.** The teacher's declines and settings live only in the `privacy-pool_asp-data` volume. Everything else can be rebuilt from the chain. Stop the ASP for a few seconds so the SQLite file is consistent, copy it out to `~/backups`, and start the ASP again:
```bash
mkdir -p ~/backups
docker compose stop asp
docker run --rm -v privacy-pool_asp-data:/data:ro -v ~/backups:/backup alpine \
  tar czf "/backup/asp-data-$(date +%Y%m%d-%H%M).tgz" -C /data .
docker compose start asp
```
Also copy the `.tgz` off the server, for example with `scp`. To restore, stop the ASP and unpack into the volume (the ASP runs as uid 1000):
```bash
docker compose stop asp
docker run --rm -v privacy-pool_asp-data:/data -v ~/backups:/backup alpine \
  sh -c 'rm -rf /data/* && tar xzf /backup/asp-data-YYYYMMDD-HHMM.tgz -C /data && chown -R 1000:1000 /data'
docker compose start asp
```

The relayer's volume holds only its request log, so it does not need backups. Caddy's volumes hold the certificates. Losing them only means Caddy issues new ones.

**Wallet balances.** Every root the ASP publishes costs the postman gas, and every withdrawal costs the relayer gas. Top both up with Sepolia ETH before they run dry: `cast balance <address> --ether --rpc-url $RPC_URL`.

## Local run against an anvil fork

`docker-compose.local.yml` runs the same two images on your laptop against the anvil Sepolia fork, without Caddy:
- It publishes the ASP on `127.0.0.1:8080` and the relayer on `127.0.0.1:13000`.
- It uses `deployments/anvil.json`.
- The ASP signs as the impersonated postman (`POSTMAN_UNLOCKED_ADDRESS`).
- It is a separate compose project, `privacy-pool-local`, so it never touches a real deployment's volumes.

Run from the repo root:

```bash
# fork Sepolia, deploy the course contracts, keep anvil on :8547
KEEP_ANVIL=1 ANVIL_PORT=8547 ETHEREUM_SEPOLIA_RPC=https://ethereum-sepolia-rpc.publicnode.com ./scripts/rehearse-anvil.sh
# unlock the deployment's postman on anvil and give it gas money
cast rpc anvil_impersonateAccount 0x5Ea5000000000000000000000000000000000D02 --rpc-url http://127.0.0.1:8547
cast rpc anvil_setBalance 0x5Ea5000000000000000000000000000000000D02 0x56BC75E2D63100000 --rpc-url http://127.0.0.1:8547
# start; secrets come from the shell only. RELAYER_PRIVATE_KEY is anvil dev account #2's key, a public test key:
# use it on the fork only, never on Sepolia.
ADMIN_ADDRESSES=$(cast wallet new --json | jq -r '.[0].address') ADMIN_TOKEN_SECRET=$(openssl rand -hex 32) \
  RELAYER_PRIVATE_KEY=<anvil dev account #2 key> \
  docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.local.yml up -d --build --wait
# prove it end to end
node scripts/e2e-withdraw.mjs --deployment deployments/anvil.json --rpc http://127.0.0.1:8547 \
  --asp http://127.0.0.1:8080 --relayer http://127.0.0.1:13000
# tear down; -v is right here (and only here): the next fork needs a fresh ASP database
docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.local.yml down -v
lsof -ti tcp:8547 | xargs kill
```

This was run on Docker Desktop (macOS), where `host.docker.internal` reaches anvil on the host's 127.0.0.1. On Linux, the containers come in through the Docker bridge, so anvil must listen on `0.0.0.0`. `rehearse-anvil.sh` binds 127.0.0.1 only, so add `--host 0.0.0.0` to its `anvil` command for such a run.
