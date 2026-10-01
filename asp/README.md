# Teaching ASP

A small Association Set Provider for the CPSC 3640 / CPSC 5400 Privacy Pool demo. It:

- indexes deposits from the course pools;
- auto-approves each one after a delay unless the teacher declines it;
- publishes the Association Set root to the Entrypoint;
- serves the API the upstream website expects, plus teaching and admin endpoints.

## Configuration (env)

| Variable | Required | Default | Meaning |
|---|---|---|---|
| `DEPLOYMENT_FILE` | yes | `/config/deployment.json` in Docker | `deployments/<net>.json` from the repo |
| `RPC_URL` | yes | | Sepolia RPC (Alchemy/Infura recommended) |
| `POSTMAN_PRIVATE_KEY` | one of | | Key of the account holding `ASP_POSTMAN` |
| `POSTMAN_UNLOCKED_ADDRESS` | one of | | anvil only: impersonated postman |
| `ADMIN_ADDRESSES` | yes | | Comma-separated teacher wallet addresses |
| `ADMIN_TOKEN_SECRET` | yes | | ≥ 32 random characters (`openssl rand -hex 32`) |
| `PORT` | no | 8080 | HTTP port (the Docker image and the compose stack set 8182) |
| `DB_PATH` | no | `./data/asp.sqlite` (`/data/asp.sqlite` in Docker) | SQLite file |
| `CORS_ORIGINS` | no | `*` | Comma-separated allowed origins |
| `AUTO_APPROVE_DELAY_SEC` | no | 120 | Initial auto-approve delay (admin can change) |
| `PUBLISH_INTERVAL_SEC` | no | 60 | Initial minimum seconds between root publishes |
| `POLL_INTERVAL_MS` | no | 6000 | Loop period |
| `CONFIRMATIONS` | no | 2 | Blocks to wait before indexing |
| `LOG_CHUNK_SIZE` | no | 500 | Max block range per `eth_getLogs` |

## Run

Node 24 runs the TypeScript sources directly, so there is no build step.

```bash
npm ci
DEPLOYMENT_FILE=../deployments/sepolia.json RPC_URL=... POSTMAN_PRIVATE_KEY=... \
  ADMIN_ADDRESSES=0x... ADMIN_TOKEN_SECRET=$(openssl rand -hex 32) npm start
```

Docker: `docker build -t course-asp . && docker run -p 8182:8182 -v $PWD/../deployments/sepolia.json:/config/deployment.json:ro -v asp-data:/data --env-file asp.env course-asp`

## Local run against an anvil fork

`scripts/dev-anvil.sh` runs the ASP against the anvil Sepolia fork that `../scripts/rehearse-anvil.sh` leaves running, using `../deployments/anvil.json`. It checks that the RPC is up and on the right chain. It also impersonates the deployment's postman (`roles.postman`) and tops it up with ETH. Then it starts `node src/main.ts` with short demo timings.

```bash
# from the repo root: fork Sepolia, deploy the course contracts, keep anvil up on :8547
KEEP_ANVIL=1 ANVIL_PORT=8547 ETHEREUM_SEPOLIA_RPC=https://ethereum-sepolia-rpc.publicnode.com ./scripts/rehearse-anvil.sh
# start the ASP (Ctrl-C to stop)
ADMIN_ADDRESSES=0xYourTeacherWallet ./asp/scripts/dev-anvil.sh
curl -s localhost:8182/health
# when done: stop anvil
lsof -ti tcp:8547 | xargs kill
```

| Variable | Default |
|---|---|
| `ADMIN_ADDRESSES` | required |
| `ASP_RPC` | `http://127.0.0.1:8547` (passed to the ASP as `RPC_URL`) |
| `DEPLOYMENT_FILE` | `../deployments/anvil.json` |
| `PORT` | 8182 |
| `AUTO_APPROVE_DELAY_SEC` | 10 |
| `PUBLISH_INTERVAL_SEC` | 5 |
| `CONFIRMATIONS` | 0 |
| `POSTMAN_UNLOCKED_ADDRESS` | `roles.postman` from the deployment file |
| `ADMIN_TOKEN_SECRET` | a fresh `openssl rand -hex 32` each run, so admin tokens do not survive a restart |
| `DB_PATH` | `asp/data/dev-anvil.sqlite`, which git ignores |

The SQLite file outlives anvil. After you start a fresh fork, delete `asp/data/dev-anvil.sqlite` so the ASP does not keep deposits from the old fork.

To try a deposit on the fork, impersonate any address (`cast rpc anvil_impersonateAccount` and `anvil_setBalance`). Then call `Entrypoint.deposit(uint256)` with `cast send --unlocked --from <addr> ... --value 0.001ether`. For BULLDOGS, call `claim()`, then `approve(entrypoint, 10e18)`, then `deposit(address,uint256,uint256)`. Watch `GET /teaching/deposits` go from `pending` to `approved`, then watch `GET /teaching/snapshots` for the next published root.

## Tests

```bash
npm test                 # unit tests
npm run typecheck
```

## API

- **Website-compatible:**
  - `GET /:chainId/public/{mt-leaves, mt-roots, pool-info, events, pools-stats, deposit-amounts, pool-statistics, deposits-by-label}`, with the `X-Pool-Scope` header where the pool matters.
  - `GET /global/public/{events, statistics}`.
- **Teaching:** `GET /teaching/{settings, deposits, snapshots, tree?scope=&label=&commitment=}` and `GET /snapshots/:cid`.
- **Admin:** `POST /admin/nonce {address}`, then sign `message` with the teacher wallet and `POST /admin/login {address, nonce, signature}` to get `{token}`. After that, with `Authorization: Bearer <token>`:
  - `POST /admin/deposits/:label/{approve,decline}`
  - `POST /admin/settings {autoApproveDelaySec?, publishIntervalSec?, freezeRoots?}`
- **Ops:** `GET /health`.

The ASP root is shared by both pools (one Entrypoint). `mt-leaves` always returns the labels of the last root **confirmed on-chain**, so proofs built from it match `Entrypoint.latestRoot()`.
