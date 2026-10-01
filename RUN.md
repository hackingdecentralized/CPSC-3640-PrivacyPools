# How to run

## A. Try it on your laptop (5 minutes, nothing real)

Needs: Docker Desktop, Foundry, Node 24.

```bash
./scripts/local-demo.sh up <your MetaMask address>      # fork Sepolia + contracts + ASP + relayer + website
./scripts/local-demo.sh fund <your MetaMask address>    # 10 test ETH on the fork
```

1. In MetaMask, add a network with RPC `http://127.0.0.1:8547` and chain ID `11155111`.
2. Open **http://localhost:3100**, create an account, and deposit ETH. For BULLDOGS, switch to BULLDOGS and press **Claim** first.
3. After about 10 s the deposit is approved. **http://localhost:3100/asp** shows this. Sign in there with the address you passed to `up` to approve or decline deposits.
4. **Withdraw** to any address. The relayer pays the gas.

Stop with `./scripts/local-demo.sh down`.

## B. Run it for class on Sepolia

**1. Deploy the contracts (once).** Follow `docs/runbooks/deploy-contracts.md` sections 0, 2 and 3 to create three wallets, fund them, fill one `.env`, and run two `forge` commands. Then run section 4 (or ask Claude) to create `deployments/sepolia.json`, and:

```bash
node scripts/sync-website-config.mjs --from deployments/sepolia.json && git commit -am "Use the Sepolia deployment"
```

Push the repo to GitHub.

**2. Server.** Use any small Ubuntu VPS:

```bash
git clone <your repo> && cd <repo>/deploy
cp .env.example .env && chmod 600 .env    # fill it in, every line is commented
./up.sh
```

`ASP_HOST` and `RELAYER_HOST` can be `asp.<server-ip>.sslip.io` and `relayer.<server-ip>.sslip.io` if you have no domain. Full guide: `deploy/README.md`.

**3. Website.** On Vercel, import the repo with **Root Directory** set to `website`, and add these environment variables:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_IS_TESTNET` | `true` |
| `NEXT_PUBLIC_SEPOLIA_RPC_URL` | your Alchemy or Infura Sepolia URL |
| `NEXT_PUBLIC_ASP_ENDPOINT_TEST` | `https://<ASP_HOST>` |
| `NEXT_PUBLIC_RELAYER_URL` | `https://<RELAYER_HOST>` |

Then set `CORS_ORIGINS` in `deploy/.env` to the Vercel URL and run `./up.sh` again.

**4. Class.** Give students some Sepolia ETH and the Vercel link. They use MetaMask on Sepolia.
