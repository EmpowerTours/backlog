#!/usr/bin/env node
// backlog sync — read your repos + Claude Code sessions, score each project's completion
// with an AI, and write the portfolio onchain to Monad in one batch. Meant to run on a cron.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createWalletClient, http, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { buildDigests } from "./scan.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HOME = os.homedir();

// ---- config -------------------------------------------------------------
loadEnvFile(path.join(HOME, ".backlog", "env"));
const CFG = {
  projectsDir: process.env.BACKLOG_PROJECTS_DIR || path.join(HOME, "projects"),
  rpc: process.env.BACKLOG_RPC || "https://rpc.monad.xyz",
  address: process.env.BACKLOG_ADDRESS || "",
  pk: process.env.BACKLOG_PRIVATE_KEY || process.env.PRIVATE_KEY || "",
  anthropicKey: process.env.ANTHROPIC_API_KEY || "",
  model: process.env.BACKLOG_MODEL || "claude-sonnet-5",
};
const DRY = process.argv.includes("--dry-run");

const monad = defineChain({
  id: 143,
  name: "Monad",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: [CFG.rpc] } },
  blockExplorers: {
    default: { name: "MonadScan", url: "https://monadscan.com" },
  },
});

const STATUS = { active: 0, polishing: 1, done: 2, abandoned: 3 };

main().catch((e) => {
  console.error("✗", e.message || e);
  process.exit(1);
});

async function main() {
  console.log(`▶ scanning ${CFG.projectsDir} + Claude Code sessions…`);
  const digests = buildDigests(CFG.projectsDir);
  console.log(`  found ${digests.length} projects`);

  const scored = CFG.anthropicKey
    ? await scoreWithAI(digests)
    : (console.warn("  (no ANTHROPIC_API_KEY — using heuristic scoring)"),
      digests.map(heuristic));

  printTable(scored);

  if (DRY) {
    console.log("\n(dry run — nothing written onchain)");
    return;
  }
  if (!CFG.address || !CFG.pk) {
    console.error(
      "\n✗ set BACKLOG_ADDRESS and BACKLOG_PRIVATE_KEY to write onchain (or pass --dry-run)",
    );
    process.exit(1);
  }
  await writeOnchain(scored);
}

// ---- AI scoring ---------------------------------------------------------
function digestLine(p) {
  const g = p.git;
  const gpart = g
    ? `commits=${g.commitCount} lastCommit=${g.lastCommitDaysAgo}d dirty=${g.uncommitted} age=${g.ageDays}d recent="${(g.recentCommits || []).slice(0, 3).join(" | ").slice(0, 120)}"`
    : "no-git";
  const readme = (p.readme || "").split("\n").find((l) => l.trim()) || "";
  return `- ${p.slug} [${p.stack.join(",") || "?"}] ${gpart} | AI: mentions=${p.ai.mentions} lastTouch=${p.ai.lastTouchDaysAgo ?? "?"}d | readme:"${readme.slice(0, 90)}"`;
}

async function scoreWithAI(digests) {
  const list = digests.map(digestLine).join("\n");
  const system =
    "You assess software project completion for a solo builder's portfolio. " +
    "For each project you get git activity (commit count, days since last commit, uncommitted changes, age, recent commit subjects), " +
    "how much recent AI-pair-programming touched it, and the README's first line. " +
    "Return a STRICT JSON array, one object per project, no prose, no code fences. " +
    'Each object: {"slug":string,"name":string(<=80),"percent":0-100 integer,"status":"active"|"polishing"|"done"|"abandoned","note":string(<=150, what\'s left or current state)}. ' +
    "Heuristics: status 'done' if shipped/deployed/complete; 'polishing' if ~80-99% with only minor work left; 'active' if in progress recently; " +
    "'abandoned' if no commits in 45+ days AND not clearly finished, or if the README/commits signal it was dropped. Be honest and specific in notes.";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": CFG.anthropicKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: CFG.model,
      max_tokens: 8000,
      system,
      messages: [
        {
          role: "user",
          content: `Score these ${digests.length} projects:\n\n${list}`,
        },
      ],
    }),
  });
  if (!res.ok)
    throw new Error(
      `Anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`,
    );
  const data = await res.json();
  const text = (data.content || []).map((b) => b.text || "").join("");
  const json = text.slice(text.indexOf("["), text.lastIndexOf("]") + 1);
  let arr;
  try {
    arr = JSON.parse(json);
  } catch {
    throw new Error("could not parse AI response as JSON");
  }
  const bySlug = new Map(arr.map((x) => [x.slug, x]));
  return digests.map((p) => {
    const s = bySlug.get(p.slug);
    return s ? normalize(p, s) : heuristic(p);
  });
}

// ---- heuristic fallback (no API key) -----------------------------------
function heuristic(p) {
  const g = p.git;
  let percent = 20;
  let status = "active";
  if (g) {
    percent =
      Math.min(95, 25 + Math.min(60, g.commitCount)) -
      (g.uncommitted > 0 ? 5 : 0);
    if (g.lastCommitDaysAgo != null && g.lastCommitDaysAgo > 45)
      status = "abandoned";
    else if (percent >= 80) status = "polishing";
  } else if (p.ai.mentions === 0) {
    status = "abandoned";
    percent = 5;
  }
  return normalize(p, {
    name: p.slug,
    percent,
    status,
    note: g
      ? `${g.commitCount} commits, last ${g.lastCommitDaysAgo}d ago`
      : "no git history",
  });
}

function normalize(p, s) {
  const status = STATUS[s.status] != null ? s.status : "active";
  return {
    slug: p.slug.slice(0, 60),
    name: String(s.name || p.slug).slice(0, 80),
    percent: Math.max(0, Math.min(100, Math.round(Number(s.percent) || 0))),
    status,
    note: String(s.note || "").slice(0, 150),
  };
}

// ---- output -------------------------------------------------------------
function printTable(scored) {
  const bar = (p) => {
    const n = Math.round(p / 10);
    return "█".repeat(n) + "░".repeat(10 - n);
  };
  const icon = { active: "◐", polishing: "◕", done: "●", abandoned: "○" };
  console.log("");
  for (const s of [...scored].sort((a, b) => b.percent - a.percent)) {
    console.log(
      `  ${icon[s.status] || "·"} ${bar(s.percent)} ${String(s.percent).padStart(3)}%  ${s.slug.padEnd(22)} ${s.status.padEnd(10)} ${s.note}`,
    );
  }
}

// ---- onchain ------------------------------------------------------------
async function writeOnchain(scored) {
  const abi = JSON.parse(
    fs.readFileSync(path.join(__dirname, "abi.json"), "utf8"),
  );
  const account = privateKeyToAccount(
    CFG.pk.startsWith("0x") ? CFG.pk : `0x${CFG.pk}`,
  );
  const wallet = createWalletClient({
    account,
    chain: monad,
    transport: http(CFG.rpc),
  });

  const slugs = scored.map((s) => s.slug);
  const names = scored.map((s) => s.name);
  const percents = scored.map((s) => s.percent);
  const statuses = scored.map((s) => STATUS[s.status]);
  const notes = scored.map((s) => s.note);

  console.log(
    `\n▶ writing ${scored.length} projects onchain as ${account.address}…`,
  );
  const hash = await wallet.writeContract({
    address: CFG.address,
    abi,
    functionName: "batchUpsert",
    args: [slugs, names, percents, statuses, notes],
  });
  console.log(`✓ tx ${hash}`);
  console.log(`  https://monadscan.com/tx/${hash}`);
}

// ---- tiny env loader ----------------------------------------------------
function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && !process.env[m[1]])
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
