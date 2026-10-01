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
| `core/packages/contracts/script/CourseDeploy.s.sol` *(new)* | `CourseSepolia` deploy config | ETH + BULLDOGS pools, zero vetting fee |
| `core/packages/contracts/script/CourseSmoke.s.sol` *(new)* | Smoke deposits | Live post-deploy check |
| `core/packages/contracts/test/course/CourseDeployFork.t.sol` *(new)* | Fork rehearsal tests | Verify deployment before broadcasting |
| `core/packages/contracts/deployments/.gitkeep` *(new)* | Output dir for forge deploy JSON | `vm.writeJson` target |
