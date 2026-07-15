# Backlog

The honest ledger of everything you've built.

You start a lot of projects. Some ship. Some sit at 90% forever. Some quietly die and you never admit it. There's no single place that tells you the truth about all of them — a kanban board goes stale the moment you stop updating it, because keeping it current is itself a chore you'll abandon.

Backlog doesn't ask you to update anything. It reads the place that already holds the truth — **your GitHub repos** — has an AI score how done each project actually is, and writes the result **onchain to Monad**. What's shipped, what's left, and what's dead. Dead projects get buried, not hidden.

The chain is the point: it's a public, self-updating record of your building that you can't quietly backdate. A builder's track record, kept honest by a machine.

## How it works

1. **Connect GitHub.** Backlog fetches your repos, reads each one's file tree (code files, tests, manifest), its own roadmap/checklist, and pings its deployment, then hands the digest to an AI that returns `{percent, note}` per project. Lifecycle (active / polishing / done / abandoned) is derived deterministically from the score, recency, and whether the repo is actually live.
2. **The scorer signs your scores.** The contract only accepts a `batchUpsert` that carries a fresh signature from the off-chain scorer — so a portfolio *cannot* contain numbers you hand-typed. You still sign the transaction with your own wallet; the scorer signs the *scores*. Credibly-sourced, not just self-reported.
3. **Put money on it (optional).** For a shipped project you can post a **shipping bond** in MON, committing the live URL onchain. Anyone can challenge it; after a 3-day cure window an oracle-signed liveness check settles it. If the deployment is dead, the challenger takes the pot and the project drops to the graveyard — a permissionless market for catching abandoned "done" claims.
4. **Read it from the chain.** Completion bars, lifecycle, bond state, and a one-click "bury" for dead projects. Every builder's portfolio has a public URL at `/b/<address>` and a live badge at `/badge/<address>`.

No manual entry. No board to babysit. Nothing to paste.

## Onchain

- **Contract:** `Backlog.sol` — a per-address project registry with **attested writes** (every score is signed by the scorer; unsigned/forged writes revert) and **shipping bonds** (`bond`, `challenge`, `resolve`, `withdrawBond`). No admin, no upgradeability, no owner; every address writes only its own portfolio. Bond payouts follow checks-effects-interactions.
- **Network:** Monad mainnet (chainid 143).
- **Address:** `0x37284f74Ce61378522CFC39fDE4FF9d40A195bb8` · [MonadScan](https://monadscan.com/address/0x37284f74Ce61378522CFC39fDE4FF9d40A195bb8)
- **Why a chain, honestly:** the record is un-backdatable, public, self-sovereign, and composable; the bond market (escrow + challenge + slashing) can't exist off-chain. The one trust point — settlement rests on an oracle attesting whether the *committed* URL responds — is an objectively falsifiable fact anyone can re-check.

## Run it

**Contract**
```bash
cd contracts
forge test          # 27 tests
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
