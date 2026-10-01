# Runbook — Deploy course contracts to Sepolia

You run the steps marked **(you)**. They use your keystore password and are never automated.

## 0. Prerequisites (you)

1. Create three keystore accounts (each one prompts for the private key and a password):
   ```bash
   cast wallet import deployer --interactive
   cast wallet import postman --interactive
   cast wallet import relayer --interactive
   ```
2. Fund them on Sepolia: `deployer` ≥ 0.1 ETH, `postman` ≥ 0.05 ETH, `relayer` ≥ 0.2 ETH.
3. Get a Sepolia RPC URL (Alchemy or Infura) and an Etherscan API key.
4. Create `core/packages/contracts/.env` (git-ignored):
   ```bash
   ETHEREUM_SEPOLIA_RPC=https://eth-sepolia.g.alchemy.com/v2/<key>
   ETHERSCAN_API_KEY=<key>
   DEPLOYER_ADDRESS=<cast wallet address --account deployer>
   OWNER_ADDRESS=<same as DEPLOYER_ADDRESS>
   POSTMAN_ADDRESS=<cast wallet address --account postman>
   ```
   Find an account's address with `cast wallet address --account <name>`.

## 1. Rehearse (free)

```bash
cd core/packages/contracts && source .env
forge test --match-path 'test/course/*' -vv
cd ../../.. && ETHEREUM_SEPOLIA_RPC=$ETHEREUM_SEPOLIA_RPC ./scripts/rehearse-anvil.sh
```
Both must pass.

The rehearsal needs port 8545 free (override with ANVIL_PORT=...).

## 2. Deploy (you)

```bash
cd core/packages/contracts && source .env
forge script script/CourseDeploy.s.sol:CourseSepolia --account deployer --sender $DEPLOYER_ADDRESS \
  --rpc-url $ETHEREUM_SEPOLIA_RPC --broadcast --verify --slow -vv
```
Copy the `Entrypoint deployed at:` address into `.env` as `ENTRYPOINT_ADDRESS=…`.

## 3. Smoke deposits (you)

```bash
source .env
forge script script/CourseSmoke.s.sol:CourseSmoke --account deployer --sender $DEPLOYER_ADDRESS \
  --rpc-url $ETHEREUM_SEPOLIA_RPC --broadcast --slow -vv
```

## 4. Export + verify (Claude can run this; no keys needed)

```bash
cd "$(git rev-parse --show-toplevel)"
set -a && source core/packages/contracts/.env && set +a
mkdir -p deployments/raw/sepolia
cp core/packages/contracts/deployments/11155111.json deployments/raw/sepolia/forge-deployment.json
cp core/packages/contracts/broadcast/CourseDeploy.s.sol/11155111/run-latest.json deployments/raw/sepolia/deploy-run.json
cp core/packages/contracts/broadcast/CourseSmoke.s.sol/11155111/run-latest.json deployments/raw/sepolia/smoke-run.json
cd scripts
node export-deployment.mjs --rpc $ETHEREUM_SEPOLIA_RPC \
  --forge-deployment ../deployments/raw/sepolia/forge-deployment.json \
  --smoke-run ../deployments/raw/sepolia/smoke-run.json \
  --owner $OWNER_ADDRESS --postman $POSTMAN_ADDRESS --out ../deployments/sepolia.json
node verify-deployment.mjs --file ../deployments/sepolia.json --rpc $ETHEREUM_SEPOLIA_RPC
```
Expected final line: `ALL CHECKS PASSED`.

Run this soon after step 3: the balance checks read pool state at the smoke-deposit blocks, which non-archive RPC nodes prune after a while.

## Redeploying

CreateX salts include the deployer address, so redeploying from the same `deployer` account reverts. To get a fresh instance, import a new deployer account.
