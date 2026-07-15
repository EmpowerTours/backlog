# Backlog — Spark hackathon submission

**Name:** Backlog

**Description:** An onchain ledger of everything you're building. Connect GitHub and an AI scores how done each project actually is, then writes the whole portfolio to Monad — credibly-sourced (the scorer signs it, so you can't hand-type a fake number) and backed by real money (stake MON that a shipped project is live; anyone can challenge it).

**Problem:** If you build with AI, you spin up projects constantly. Some ship, some sit at 90% forever, some quietly die — and you never admit which. There's no honest, single source of truth for the real state of all of them. A manual kanban goes stale the second you stop updating it, because keeping it current is itself a chore you'll abandon.

**Solution:** Backlog reads the truth that already exists — your GitHub repos, over OAuth — and an AI scores each project's % complete against its own roadmap/checklist. Two things make it honest, not just another dashboard: (1) **attested writes** — the scorer signs every score, and the contract *rejects* any number that didn't come from it, so you can't inflate your own record; (2) **shipping bonds** — you can stake MON that a shipped project is really live, and anyone can challenge it. After a 3-day cure window an oracle-signed liveness check settles it; if your link is dead, the challenger takes the stake and the project auto-drops to the graveyard. A permissionless market for catching abandoned "done" claims — which can only exist onchain.

**Category:** Mainnet

**Contract address:** `0x37284f74Ce61378522CFC39fDE4FF9d40A195bb8` (Monad mainnet, chainid 143, verified on MonadScan)

**Project URL:** https://backlog-production-d1b6.up.railway.app

**GitHub repo:** https://github.com/EmpowerTours/backlog

**Demo video:** _<upload + fill>_

**Post URL:** _<social post — fill>_

---

## Demo video script (< 3 min)

**0:00 – 0:20 — the problem.** "I build with AI every day, so I start a *lot* of projects. Some shipped. Some are stuck at 90%. Some I quietly gave up on. I have no idea what state they're all in — and a todo list won't help, because I'll never keep it updated."

**0:20 – 0:55 — connect + score.** Open the site. Click **Connect GitHub** → authorize. Show the progress bar filling as it works. "An AI just read all my repos — the file tree, the tests, each project's own roadmap, whether it's actually deployed — and scored how done it really is. Free, on my own GitHub Models quota, nothing to paste." Show the table: live apps as shipped, stubs at 10–20%, dead ones flagged. Point at one: "it read this repo's checklist — 4 of 17 boxes done — and scored it honestly, not by vibes."

**0:55 – 1:30 — write it, and why you can't fake it.** Connect wallet → **Write onchain** → "Signing scores…" → confirm in MetaMask. "Here's the part that makes it honest: the *scorer* signs my scores, and the contract **rejects any number that didn't come from it**. I can't open MonadScan and write myself a fake 100% — it reverts." Open the tx on MonadScan. "My whole portfolio, one transaction, on Monad mainnet — public and un-backdatable."

**1:30 – 2:15 — put money on it (the part only a chain can do).** On a shipped project, click **stake it's live** → confirm the URL → **bond 0.1 MON**. "I just staked real money that this is live. Anyone can challenge it — if my deployment is dead 3 days later, they take my stake and it drops to the graveyard automatically." *(Aside, if asked about the hardcoded gas: "Monad reserves the block gas limit against your balance when estimating, so value txs falsely read as 'likely to fail' — I set explicit gas limits so it's clean.")* Show the "🔒 bonded" badge, and on a public `/b/<address>` page the **challenge** button a stranger would see.

**2:15 – 2:40 — why a chain.** "The point isn't a prettier dashboard. The score is credibly-sourced — signed, not self-reported. And there's a permissionless market where anyone can profit from catching a dead 'done' claim. That escrow-and-slash game can't run on a database. It's public at `/b/my-address`, with a live badge for any README."

**2:40 – 2:55 — close.** "Backlog. The honest ledger of everything you've built — signed, staked, and onchain. On Monad."

---

## Social post (for the viral prize)

> I connected my GitHub to an AI that scores how done each of my projects *actually* is, then writes it onchain — and here's the twist: I can't fake the numbers. The scorer signs them; the contract rejects anything I hand-type. 💀
>
> Then I staked real money that a project is live. If it's dead, anyone can challenge it, take my stake, and it drops to the graveyard automatically.
>
> An honest build record you can't lie your way into. Onchain on @monad_xyz for the @buildanything Spark hackathon 👇
> [link] [demo video] [screenshot of the dashboard + graveyard]

Alt hook: "Your GitHub already knows which of your projects are dead. Backlog puts it onchain, makes the score un-forgeable, and lets anyone bet money you're lying."
