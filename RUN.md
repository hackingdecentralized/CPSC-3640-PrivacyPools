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

**1. Deploy the contracts (once).** Follow [DEPLOY.md](DEPLOY.md): three wallets, one `.env`, two `forge` commands, then export, sync the website and push.

**2. Server.** Use any small Ubuntu VPS:

```bash
git clone <your repo> && cd <repo>/deploy
cp .env.example .env && chmod 600 .env    # fill it in, every line is commented
./up.sh
```

`ASP_HOST` and `RELAYER_HOST` can be `asp.<server-ip>.sslip.io` and `relayer.<server-ip>.sslip.io` if you have no domain. Full guide: `deploy/README.md`.

The ASP listens on port 8182 and the relayer on 3132, in Docker and on the host (published on `127.0.0.1` only). With a Cloudflare Tunnel, point the public hostnames at `http://localhost:8182` and `http://localhost:3132` (cloudflared on the host) or `asp:8182` and `relayer:3132` (cloudflared in compose).

**3. Website (GitHub Pages).** In the GitHub repo:

1. **Settings → Pages**: set **Source** to **GitHub Actions**.
2. **Settings → Secrets and variables → Actions → Variables**: add

   | Variable | Value |
   |---|---|
   | `NEXT_PUBLIC_SEPOLIA_RPC_URL` | your Alchemy or Infura Sepolia URL |
   | `NEXT_PUBLIC_ASP_ENDPOINT_TEST` | `https://<ASP_HOST>` |
   | `NEXT_PUBLIC_RELAYER_URL` | `https://<RELAYER_HOST>` |
   | `NEXT_PUBLIC_PROJECT_ID` | optional WalletConnect project ID |

3. Push to `main` (or run the **Deploy website to GitHub Pages** workflow by hand). The site appears at **https://hackingdecentralized.github.io/CPSC-3640-PrivatePools/**.

These values are built into the public site, so anyone can read the RPC URL: use a key restricted to that domain in Alchemy or Infura. Then set `CORS_ORIGINS=https://hackingdecentralized.github.io` in `deploy/.env` and run `./up.sh` again.

**4. Class.** Give students some Sepolia ETH and the site link. They use MetaMask on Sepolia.
