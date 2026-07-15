# Backlog — Spark hackathon submission

**Name:** Backlog

**Description:** An onchain ledger of everything you're building. Connect GitHub and an AI scores how done each project actually is, then writes the whole portfolio to Monad — what's shipped, what's left, what's dead.

**Problem:** If you build with AI, you spin up projects constantly. Some ship, some sit at 90% forever, some quietly die — and you never admit which. There's no honest, single source of truth for the real state of all of them. A manual kanban goes stale the second you stop updating it, because keeping it current is itself a chore you'll abandon.

**Solution:** Backlog reads the truth that already exists — your GitHub repos, over OAuth. An AI scores each project's % complete, and its lifecycle (active / polishing / done / abandoned) is derived from that score plus recency plus whether the repo is actually live — so it can't contradict itself. It anchors that portfolio onchain on Monad as a public, un-fakeable record of your building. Dead projects get buried, not hidden. No manual entry, nothing to paste.

**Category:** Mainnet

**Contract address:** `0x37284f74Ce61378522CFC39fDE4FF9d40A195bb8` (Monad mainnet, chainid 143, verified on MonadScan)

**Project URL:** https://backlog-production-d1b6.up.railway.app

**GitHub repo:** https://github.com/EmpowerTours/backlog

**Demo video:** _<upload + fill>_

**Post URL:** _<social post — fill>_

---

## Demo video script (< 3 min)

**0:00 – 0:25 — the problem.** "I build with AI every day, so I start a *lot* of projects. Some shipped. Some are stuck at 90%. Some I quietly gave up on. I have no idea what state they're all in — and a todo list won't help, because I'll never keep it updated."

**0:25 – 1:15 — connect + score.** Open the site. Click **Connect GitHub** → authorize. "An AI just read all my repos — the file tree, the tests, whether each one's actually deployed — and scored how done each project really is. Free, on my own GitHub Models quota, no API key to paste." Show the table filling in: live apps at 85%+ marked shipped, the stubs down at 10–20%, the dead ones flagged. Point at one: "it correctly buried this stale duplicate."

**1:15 – 1:45 — write it onchain.** Connect wallet → click **Write onchain** → confirm one transaction in MetaMask. Show the tx hash, open it on MonadScan. "34 projects, one transaction, on Monad mainnet. This is now a public, timestamped record I can't quietly backdate."

**1:45 – 2:25 — read it back.** Show the dashboard: the vitals header (avg %, shipped / polishing / active / dead), the completion bars, and **the graveyard** of abandoned projects. Click **bury** on a dead one. Open `/b/<address>` — "this is public; anyone can verify my track record" — and the live `/badge/<address>` you can drop in a README.

**2:25 – 2:45 — why onchain.** "The point isn't a prettier dashboard. It's that this is *honest*. It's public, un-fakeable, and the score comes straight from the code — not from me typing a number I want to be true."

**2:45 – 2:55 — close.** "Backlog. The honest ledger of everything you've built. On Monad."

---

## Social post (for the viral prize)

> I connected my GitHub to an AI that scores how done each of my 34 projects *actually* is — then writes the honest truth onchain, including the graveyard of the ones I quietly abandoned. 💀
>
> No manual updates. You can't fake your build record when the score comes straight from your code.
>
> Onchain on @monad_xyz for the @buildanything Spark hackathon 👇
> [link] [demo video] [screenshot of the dashboard + graveyard]

Alt hook: "Your GitHub already knows which of your projects are dead. Backlog just puts it onchain where you can't lie about it."
