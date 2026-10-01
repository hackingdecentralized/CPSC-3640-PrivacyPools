# CPSC 3640 — Course Demo Privacy Pool (Sepolia)

An educational Privacy Pool on Ethereum Sepolia, built on 0xbow's
[privacy-pools-core](https://github.com/0xbow-io/privacy-pools-core) and
[privacy-pools-website](https://github.com/0xbow-io/privacy-pools-website).
Not for production use.

Assets: Sepolia ETH and Bulldogs (BULLDOGS) `0xBc2BEfb9a8aA70AfA23F7451A0794466976B6974`.

## Layout

```
core/          upstream privacy-pools-core (subtree, see UPSTREAM.md)
website/       upstream privacy-pools-website (subtree)
asp/           Teaching ASP service
deploy/        VPS docker-compose (ASP + relayer + Caddy)
deployments/   deployment records (sepolia.json is the source of truth)
scripts/       export / verify / rehearsal scripts
docs/          design spec, plans, runbooks
```

## Docs

- Design: [docs/superpowers/specs/2026-09-30-course-privacy-pool-design.md](docs/superpowers/specs/2026-09-30-course-privacy-pool-design.md)
- Deploying contracts: [docs/runbooks/deploy-contracts.md](docs/runbooks/deploy-contracts.md)
