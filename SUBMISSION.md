# Backlog — Spark hackathon submission

**Name:** Backlog

**Description:** An onchain ledger of everything you're building. An AI reads your git history and AI-coding sessions, scores how done each project actually is, and writes the whole portfolio to Monad — what's shipped, what's left, what's dead.

**Problem:** If you build with AI, you spin up projects constantly. Some ship, some sit at 90% forever, some quietly die — and you never admit which. There's no honest, single source of truth for the real state of all of them. A manual kanban goes stale the second you stop updating it, because keeping it current is itself a chore you'll abandon.

**Solution:** Backlog reads the truth that already exists — your git history and your Claude Code sessions (or, in the hosted app, your GitHub over OAuth). An AI scores each project's % complete and lifecycle (active / polishing / done / abandoned), and it anchors that portfolio onchain on Monad as a public, un-fakeable, self-updating record of your building. Dead projects get buried, not hidden. No manual entry, ever.

**Category:** Mainnet

**Contract address:** `0x6F432296262feFa84DcFF4b520071616b33794fb` (Monad mainnet, chainid 143, verified on MonadScan)

**Project URL:** https://backlog-production-d1b6.up.railway.app

**GitHub repo:** https://github.com/EmpowerTours/backlog

**Demo video:** _<upload + fill>_

**Post URL:** _<social post — fill>_

---

## Demo video script (< 3 min)

**0:00 – 0:20 — the problem.** "I build with AI every day, so I start a *lot* of projects. Some shipped. Some are stuck at 90%. Some I quietly gave up on. I have no idea what state they're all in — and a todo list won't help, because I'll never keep it updated."

**0:20 – 0:55 — the CLI (the honest engine).** Run `node cli/sync.mjs --dry-run`. Narrate: "This scans every repo in my projects folder *and* my actual Claude Code session transcripts, and an AI scores how done each one really is." Show the table filling in with real percentages and the abandoned ones flagged. Point at one note: "it correctly called this a stale duplicate."

**0:55 – 1:15 — write it onchain.** Run `node cli/sync.mjs` (no dry-run). Show the tx hash, open it on MonadScan. "32 projects, one transaction, on Monad mainnet. This is now a public, timestamped record I can't quietly backdate."

**1:15 – 2:05 — the hosted app (anyone can use it).** Open the site. Click **Connect GitHub** → authorize. "An AI just scored all my repos — free, on my own GitHub Models quota, no API key to paste." Connect wallet → **Write onchain** (one tx). Show the dashboard: the vitals header (avg %, shipped / polishing / active / dead), the completion bars, and **the graveyard** of abandoned projects. Click **bury** on a dead one.

**2:05 – 2:35 — why onchain.** "The point isn't a prettier dashboard. It's that this is *honest*. It's public at `/b/my-address`, it updates itself on a cron, and I can't fake my track record — the truth comes straight from my git log and my AI sessions."

**2:35 – 2:50 — close.** "Backlog. The honest ledger of everything you've built. On Monad."

---

## Social post (for the viral prize)

> I built an AI that reads all my Claude Code sessions + git history, scores how done each of my 32 projects *actually* is, and writes the honest truth onchain — including the graveyard of the ones I quietly abandoned. 💀
>
> No manual updates. You can't fake your build record when it comes straight from your commits.
>
> Onchain on @monad_xyz for the @buildanything Spark hackathon 👇
> [link] [demo video] [screenshot of the dashboard + graveyard]

Alt hook: "Your git history already knows which of your projects are dead. Backlog just puts it onchain where you can't lie about it."
