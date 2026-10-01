# Upstream code

This repo vendors two upstream repositories with `git subtree --squash`.
Pinned versions are in [`upstream.json`](upstream.json).

| Prefix | Upstream | Pinned SHA |
|---|---|---|
| `core/` | https://github.com/0xbow-io/privacy-pools-core | `d494b63e79f33bb2b0c8ece6cdacdca465c3b884` |
| `website/` | https://github.com/0xbow-io/privacy-pools-website | `7df411128f7a18a61a77f7a0371bf0b857969e2a` |

## Updating a subtree

```bash
git fetch https://github.com/0xbow-io/privacy-pools-core.git <new-sha>
git subtree merge --prefix=core FETCH_HEAD --squash -m "Update privacy-pools-core to <new-sha>"
```
Then update `upstream.json` and the table above.

## Patch log

Every change to a file under `core/` or `website/`. New files are marked *(new)*.

| File | Change | Why |
|---|---|---|
| `core/packages/contracts/remappings.txt` | `lean-imt/` dir remapping replaced by per-file remappings for `InternalLeanIMT.sol` and `LeanIMT.sol` | Foundry 1.5.1 resolves the `.sol`-suffixed dir target without a trailing slash, breaking `forge build` |
| `core/packages/contracts/script/CourseDeploy.s.sol` *(new)* | `CourseSepolia` deploy config | ETH + BULLDOGS pools, zero vetting fee |
| `core/packages/contracts/script/CourseSmoke.s.sol` *(new)* | Smoke deposits | Live post-deploy check |
| `core/packages/contracts/test/course/CourseDeployFork.t.sol` *(new)* | Fork rehearsal tests | Verify deployment before broadcasting |
| `core/packages/contracts/deployments/.gitkeep` *(new)* | Output dir for forge deploy JSON | `vm.writeJson` target |
| `core/packages/relayer/src/config/schemas.ts` | `zAssetConfig` gains `fee_mode: "flat" \| "market"`, default `"market"` (upstream behaviour) | The course relayer charges a flat fee; BULLDOGS has no Uniswap market to price gas in |
| `core/packages/relayer/src/services/quote.service.ts` | `quoteFeeBPSNative` takes `feeMode`; `"flat"` returns `fee_bps` right after reading the gas price: no gas component, no Uniswap call | Same |
| `core/packages/relayer/src/handlers/relayer/quote.ts` | Passes the asset's `fee_mode`; forces `extraGas = false` for flat assets | `extraGas` swaps the fee through Uniswap |
| `core/packages/relayer/src/services/privacyPoolRelayer.service.ts` | Passes `fee_mode` to the fee check for requests without a fee commitment | Same fee rule on `/relayer/request` as on `/relayer/quote` |
