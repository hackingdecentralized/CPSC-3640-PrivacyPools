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

## If a broadcast stops partway

If step 2 or 3 is interrupted (dropped connection, RPC error, laptop sleep, some transactions not yet mined), do not start over:

1. Re-run the **identical** command from that step with `--resume` appended, e.g. for step 2:
   ```bash
   forge script script/CourseDeploy.s.sol:CourseSepolia --account deployer --sender $DEPLOYER_ADDRESS \
     --rpc-url $ETHEREUM_SEPOLIA_RPC --broadcast --verify --slow -vv --resume
   ```
   Same for step 3 with the `CourseSmoke.s.sol:CourseSmoke` command. Forge picks up where it stopped using the saved state in `broadcast/` and `cache/`.
2. Do **not** run the anvil rehearsal (`rehearse-anvil.sh`) in between. It uses the same chain id (11155111) and the same forge `cache/` as the real broadcast, so leave it alone until the broadcast is finished.
3. Do **not** import a new deployer. A new deployer is only for an intentional fresh instance (see "Redeploying"); a resume must use the same account.

If Etherscan verification (`--verify`) fails after the contracts are deployed, re-run the step 2 command with `--resume --verify` (the step 2 command already has `--verify`, so this is the same command with `--resume` appended), or verify individual contracts with `forge verify-contract`. The deployment itself is already on-chain; verification can be retried at any time.

## 4. Export + verify (Claude can run this; no private keys needed — uses your RPC URL)

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
Expected final line: `ALL CHECKS PASSED`. The output includes `spec:` lines: independent checks against the course spec (chain id 11155111, the BULLDOGS token address, minimum deposits 0.001 ETH / 10 BULLDOGS, 0% vetting fee, 1% max relay fee, exactly the ETH and BULLDOGS pools).

The pool and entrypoint `deploymentBlock` values in the export are the block at which forge simulated the script, which is a lower bound on the real deployment block. They are meant only as the start block for scanning logs, not as the exact block of deployment.

Run this soon after step 3: the balance checks read pool state at the smoke-deposit blocks, which non-archive RPC nodes prune after a while.

## Redeploying

CreateX salts include the deployer address, so redeploying from the same `deployer` account reverts. To get a fresh instance, import a new deployer account.
