# Backlog

The honest ledger of everything you've built.

You start a lot of projects. Some ship. Some sit at 90% forever. Some quietly die and you never admit it. There's no single place that tells you the truth about all of them — a kanban board goes stale the moment you stop updating it, because keeping it current is itself a chore you'll abandon.

Backlog doesn't ask you to update anything. It reads the place that already holds the truth — **your GitHub repos** — has an AI score how done each project actually is, and writes the result **onchain to Monad**. What's shipped, what's left, and what's dead. Dead projects get buried, not hidden.

The chain is the point: it's a public, self-updating record of your building that you can't quietly backdate. A builder's track record, kept honest by a machine.

## How it works

1. **Connect GitHub.** Backlog fetches your repos, reads each one's file tree (code files, tests, manifest) and pings its deployment, then hands the digest to an AI that returns `{percent, note}` per project. Lifecycle (active / polishing / done / abandoned) is derived deterministically from the score, recency, and whether the repo is actually live — so a 100% project is never labeled "active" and a live app is never called dead.
2. **Sign one transaction.** The whole portfolio is written to the **Backlog** contract on Monad in a single `batchUpsert`. You sign with your own wallet — it's your portfolio, under your address.
3. **Read it from the chain.** The web app reads your portfolio straight from Monad: completion bars, lifecycle, and a one-click "bury" for dead projects. Every builder's portfolio has a public URL at `/b/<address>` and a live badge at `/badge/<address>`.

No manual entry. No board to babysit. Nothing to paste.

## Onchain

- **Contract:** `Backlog.sol` — a per-address project registry (`upsertProject`, `batchUpsert`, `removeProject`, plus views). No admin, no upgradeability; every address writes only its own portfolio.
- **Network:** Monad mainnet (chainid 143).
- **Address:** `0x6F432296262feFa84DcFF4b520071616b33794fb` · [MonadScan](https://monadscan.com/address/0x6F432296262feFa84DcFF4b520071616b33794fb)

## Run it

**Contract**
```bash
cd contracts
forge test          # 11 tests
./deploy.sh         # deploy + verify on Monad mainnet
```

**Web app**
```bash
npm install
npm run dev         # http://localhost:3000
```
Set `NEXT_PUBLIC_BACKLOG_ADDRESS` and the GitHub OAuth vars (see `env.sample`) so the app can read the contract and score your repos.

## Stack

Foundry (Solidity 0.8.20) · Next.js + wagmi/viem · GitHub OAuth + GitHub Models for scoring. Deployed on Railway.

## Scoring & scale

Reading a portfolio is free and needs no wallet. Writing costs a little Monad gas.

Scoring runs on **GitHub Models** (free tier). The hosted app tries each visitor's own GitHub token first, then falls back to a shared server token (`GITHUB_MODELS_TOKEN`), then to a no-AI heuristic — so it never hard-fails and visitors paste nothing. For true per-user scale (everyone on their own free quota), convert the login from an OAuth App to a **GitHub App**, whose user-to-server tokens can carry `models:read`.
