# Deploy the Privacy Pool contracts to Sepolia

You do this **once**. It deploys 5 contracts to Sepolia: the Entrypoint, the ETH pool, the BULLDOGS pool and two proof verifiers. The BULLDOGS token already exists and is not redeployed.

All commands run from the repo root unless a step says otherwise. Your keys stay in Foundry's encrypted keystore, and you type the passwords yourself.

---

## 0. One-time setup

You need [Foundry](https://getfoundry.sh) (`forge`, `cast`) and Node.js.

The contract dependencies must be installed. This is already done if `core/node_modules` exists:

```bash
ls core/node_modules >/dev/null 2>&1 || (cd core && npx --yes yarn@1.22.22 install --frozen-lockfile)
ls scripts/node_modules >/dev/null 2>&1 || (cd scripts && npm install)
```

Check that it compiles. Expect `Compiler run successful`:

```bash
(cd core/packages/contracts && forge build)
```

---

## 1. Create three wallets

| Wallet | What it does | Used where |
|---|---|---|
| **deployer** | deploys the contracts and owns the Entrypoint | this guide only |
| **postman** | publishes the ASP root on-chain | server `deploy/.env` → `POSTMAN_PRIVATE_KEY` |
| **relayer** | sends students' withdrawals and pays their gas | server `deploy/.env` → `RELAYER_PRIVATE_KEY` |

Generate a new key. Run this **three times**, once per wallet, and write down each **Address** and **Private key**:

```bash
cast wallet new
```

The deployer can also be your existing MetaMask account. Postman and relayer must be new wallets made only for this.

Import each key into Foundry's keystore. Each command asks for the private key and then a password:

```bash
cast wallet import deployer --interactive
```
```bash
cast wallet import postman --interactive
```
```bash
cast wallet import relayer --interactive
```

---

## 2. Fund the wallets with Sepolia ETH

| Wallet | Amount |
|---|---|
| deployer | ~0.1 ETH |
| postman | ~0.05 ETH |
| relayer | ~0.2 ETH |

---

## 3. Create the config file

You need:
- a Sepolia RPC URL from [Alchemy](https://alchemy.com) or [Infura](https://infura.io);
- optionally, an [Etherscan API key](https://etherscan.io/apis), which publishes the contract source on Etherscan.

```bash
cd core/packages/contracts
cat > .env <<'EOF'
ETHEREUM_SEPOLIA_RPC=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_KEY
DEPLOYER_ADDRESS=0xYourDeployerAddress
OWNER_ADDRESS=0xYourDeployerAddress
POSTMAN_ADDRESS=0xYourPostmanAddress
EOF
source .env
```

`OWNER_ADDRESS` is the same as `DEPLOYER_ADDRESS`. The relayer is **not** listed here; it has no on-chain role. This file is git-ignored.

---

## 4. Deploy

Still in `core/packages/contracts`:

```bash
forge script script/CourseDeploy.s.sol:CourseSepolia \
  --account deployer --sender $DEPLOYER_ADDRESS \
  --rpc-url $ETHEREUM_SEPOLIA_RPC --broadcast --verify --slow -vv
```

- It asks for the **deployer** keystore password.
- No Etherscan key? Remove `--verify`.
- When it finishes, find the line `Entrypoint deployed at: 0x…` and save that address:

```bash
echo "ENTRYPOINT_ADDRESS=0xTheEntrypointAddress" >> .env && source .env
```

---

## 5. Smoke deposits

This makes one 0.001 ETH deposit and one 10 BULLDOGS deposit, to prove the pools work:

```bash
forge script script/CourseSmoke.s.sol:CourseSmoke \
  --account deployer --sender $DEPLOYER_ADDRESS \
  --rpc-url $ETHEREUM_SEPOLIA_RPC --broadcast --slow -vv
```

---

## 6. Export and verify

Ask Claude to do this, or run it yourself. It needs no private keys, only your RPC URL, and should run soon after step 5.

```bash
cd "$(git rev-parse --show-toplevel)"
set -a && source core/packages/contracts/.env && set +a
mkdir -p deployments/raw/sepolia
cp core/packages/contracts/deployments/11155111.json deployments/raw/sepolia/forge-deployment.json
cp core/packages/contracts/broadcast/CourseDeploy.s.sol/11155111/run-latest.json deployments/raw/sepolia/deploy-run.json
cp core/packages/contracts/broadcast/CourseSmoke.s.sol/11155111/run-latest.json deployments/raw/sepolia/smoke-run.json
(cd scripts && node export-deployment.mjs --rpc $ETHEREUM_SEPOLIA_RPC \
  --forge-deployment ../deployments/raw/sepolia/forge-deployment.json \
  --smoke-run ../deployments/raw/sepolia/smoke-run.json \
  --owner $OWNER_ADDRESS --postman $POSTMAN_ADDRESS --out ../deployments/sepolia.json \
  && node verify-deployment.mjs --file ../deployments/sepolia.json --rpc $ETHEREUM_SEPOLIA_RPC)
```

The last line must be `ALL CHECKS PASSED`.

Then point the website at the new contracts and publish it:

```bash
node scripts/sync-website-config.mjs --from deployments/sepolia.json
git add deployments/sepolia.json deployments/raw/sepolia website/src/config/course.json
git commit -m "Use the Sepolia deployment" && git push
```

The GitHub Pages site rebuilds automatically, and its "LOCAL FORK" badge disappears.

---

## Next: the server

On your test server, `deploy/.env` needs:

```bash
POSTMAN_PRIVATE_KEY=0x...   # postman private key from step 1
RELAYER_PRIVATE_KEY=0x...   # relayer private key from step 1
ADMIN_ADDRESSES=0x...       # your wallet; it signs in on the /asp page
```

Fill in the rest from `deploy/.env.example`, then run `./up.sh`. See [RUN.md](RUN.md) part B.

---

## If something goes wrong

- **Step 4 or 5 stopped halfway** (network error, laptop asleep): re-run the **same** command with `--resume` at the end. Don't start over.
- **Only Etherscan verification failed:** the contracts are deployed anyway. Re-run step 4 with `--resume --verify`, or skip verification.
- **Need a completely fresh deployment:** import a **new** deployer wallet. Re-running from the same deployer fails, because the contract addresses are already taken.
