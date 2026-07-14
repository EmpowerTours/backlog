# Backlog

The honest ledger of everything you've built.

You start a lot of projects. Some ship. Some sit at 90% forever. Some quietly die and you never admit it. There's no single place that tells you the truth about all of them — a kanban board goes stale the moment you stop updating it, because keeping it current is itself a chore you'll abandon.

Backlog doesn't ask you to update anything. It reads the two places that already hold the truth — **your git history and your Claude Code sessions** — has an AI score how done each project actually is, and writes the result **onchain to Monad**. What's shipped, what's left, and what's dead. Dead projects get buried, not hidden.

The chain is the point: it's a public, self-updating record of your building that you can't quietly backdate. A builder's track record, kept honest by a machine.

## How it works

1. **`backlog sync`** (a CLI, meant to run on a cron) scans every repo under `~/projects` for git activity, scans your Claude Code transcripts for how much recent AI work touched each project, hands the digest to Claude, and gets back `{percent, status, note}` per project.
2. It writes the whole portfolio to the **Backlog** contract on Monad in a single `batchUpsert` transaction.
3. The **web app** reads your portfolio straight from the chain: completion bars, lifecycle (active / polishing / done / abandoned), and a one-click "bury" for dead projects. Every builder's portfolio has a public URL at `/b/<address>`.

No manual entry. No board to babysit.

## Onchain

- **Contract:** `Backlog.sol` — a per-address project registry (`upsertProject`, `batchUpsert`, `removeProject`, plus views). No admin, no upgradeability; every address writes only its own portfolio.
- **Network:** Monad mainnet (chainid 143).
- **Address:** `<set after deploy>` · [MonadScan](https://monadscan.com)

## Run it

**Contract**
```bash
cd contracts
forge test          # 11 tests
./deploy.sh         # deploy + verify on Monad mainnet
```

**Sync (score + write onchain)**
```bash
# put BACKLOG_ADDRESS, BACKLOG_PRIVATE_KEY, ANTHROPIC_API_KEY in ~/.backlog/env
node cli/sync.mjs --dry-run   # scan + score, print the table, write nothing
node cli/sync.mjs             # ...and write the portfolio onchain
```
Schedule it — one line in your crontab keeps the record current:
```
0 9 * * *  cd /path/to/backlog && node cli/sync.mjs >> ~/.backlog/sync.log 2>&1
```

**Web app**
```bash
npm install
npm run dev         # http://localhost:3000
```
Set `NEXT_PUBLIC_BACKLOG_ADDRESS` (see `env.sample`) so the app knows which contract to read.

## Stack

Foundry (Solidity 0.8.20) · Next.js + wagmi/viem · a plain Node CLI · the Claude API for scoring. Deployed on Railway.
