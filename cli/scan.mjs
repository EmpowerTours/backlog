// Project scanner: turn a directory of repos + your Claude Code transcripts into
// per-project signals (git state + how much AI work touched them recently).
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const HOME = os.homedir();

function sh(cmd, cwd) {
  try {
    return execSync(cmd, {
      cwd,
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
    }).trim();
  } catch {
    return "";
  }
}

function daysSince(iso) {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.floor((Date.now() - then) / 86_400_000);
}

/** Detect the stack so the scorer knows what "done" looks like. */
function stackOf(dir) {
  const has = (f) => fs.existsSync(path.join(dir, f));
  const tags = [];
  if (has("foundry.toml")) tags.push("foundry");
  if (has("hardhat.config.js") || has("hardhat.config.ts"))
    tags.push("hardhat");
  if (has("next.config.ts") || has("next.config.js") || has("next.config.mjs"))
    tags.push("next");
  if (has("package.json")) tags.push("node");
  if (has("Cargo.toml")) tags.push("rust");
  if (has("go.mod")) tags.push("go");
  if (has("requirements.txt") || has("pyproject.toml")) tags.push("python");
  if (has("Dockerfile")) tags.push("docker");
  return tags;
}

function readmeHead(dir) {
  for (const name of ["README.md", "README", "readme.md"]) {
    const p = path.join(dir, name);
    if (fs.existsSync(p)) {
      return fs
        .readFileSync(p, "utf8")
        .split("\n")
        .slice(0, 12)
        .join("\n")
        .slice(0, 700);
    }
  }
  return "";
}

/** Git facts for a repo, or null if it isn't one. */
function gitFacts(dir) {
  if (!fs.existsSync(path.join(dir, ".git"))) return null;
  const commitCount = Number(sh("git rev-list --count HEAD", dir) || "0");
  const lastCommitISO = sh("git log -1 --format=%cI", dir);
  const firstCommitISO =
    sh("git log --reverse --format=%cI -1", dir) ||
    sh("git log --format=%cI", dir).split("\n").pop();
  const branch = sh("git rev-parse --abbrev-ref HEAD", dir);
  const dirty = sh("git status --porcelain", dir)
    .split("\n")
    .filter(Boolean).length;
  const lastSubjects = sh("git log -5 --format=%s", dir)
    .split("\n")
    .filter(Boolean);
  return {
    commitCount,
    lastCommitDaysAgo: daysSince(lastCommitISO),
    ageDays: daysSince(firstCommitISO),
    branch,
    uncommitted: dirty,
    recentCommits: lastSubjects,
  };
}

/** List candidate projects: immediate subdirs of `root` that are git repos or have a known manifest. */
export function listProjects(root) {
  if (!fs.existsSync(root)) return [];
  const out = [];
  for (const name of fs.readdirSync(root)) {
    if (name.startsWith(".")) continue;
    const dir = path.join(root, name);
    let stat;
    try {
      stat = fs.statSync(dir);
    } catch {
      continue;
    }
    if (!stat.isDirectory()) continue;
    const git = gitFacts(dir);
    const stack = stackOf(dir);
    if (!git && stack.length === 0) continue; // not a real project
    out.push({ slug: name, dir, git, stack, readme: readmeHead(dir) });
  }
  return out;
}

/**
 * Scan Claude Code transcripts and tally, per project path, how much recent AI work
 * touched it and what the user was asking for. This is the "AI conversations" signal.
 */
export function scanTranscripts(
  projectsRoot,
  transcriptsRoot = path.join(HOME, ".claude", "projects"),
) {
  const activity = {}; // slug -> { mentions, lastTouchDaysAgo, prompts:Set }
  if (!fs.existsSync(transcriptsRoot)) return activity;

  const bump = (slug, whenMs, prompt) => {
    const a = (activity[slug] ??= {
      mentions: 0,
      lastTouchDaysAgo: null,
      prompts: new Set(),
    });
    a.mentions++;
    if (whenMs) {
      const d = Math.floor((Date.now() - whenMs) / 86_400_000);
      if (a.lastTouchDaysAgo === null || d < a.lastTouchDaysAgo)
        a.lastTouchDaysAgo = d;
    }
    if (prompt) a.prompts.add(prompt.slice(0, 160));
  };

  const pathRe = new RegExp(
    projectsRoot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "/([A-Za-z0-9._-]+)",
  );

  for (const dir of fs.readdirSync(transcriptsRoot)) {
    const d = path.join(transcriptsRoot, dir);
    let files;
    try {
      files = fs.readdirSync(d).filter((f) => f.endsWith(".jsonl"));
    } catch {
      continue;
    }
    for (const f of files) {
      let lines;
      try {
        lines = fs.readFileSync(path.join(d, f), "utf8").split("\n");
      } catch {
        continue;
      }
      let lastUserPrompt = null;
      for (const ln of lines) {
        if (!ln) continue;
        let o;
        try {
          o = JSON.parse(ln);
        } catch {
          continue;
        }
        const whenMs = o.timestamp ? new Date(o.timestamp).getTime() : null;
        const content = o.message?.content;
        if (o.type === "user" && typeof content === "string")
          lastUserPrompt = content;
        // find project paths referenced anywhere in this line
        const hits = ln.match(new RegExp(pathRe, "g"));
        if (hits) {
          const slugs = new Set(hits.map((h) => h.match(pathRe)[1]));
          for (const slug of slugs) bump(slug, whenMs, lastUserPrompt);
        }
      }
    }
  }
  // materialize prompt sets
  for (const a of Object.values(activity))
    a.prompts = [...a.prompts].slice(0, 4);
  return activity;
}

/** Combine repo signals with AI-activity signals into one digest per project. */
export function buildDigests(projectsRoot) {
  const projects = listProjects(projectsRoot);
  const activity = scanTranscripts(projectsRoot);
  return projects.map((p) => ({
    slug: p.slug,
    dir: p.dir,
    stack: p.stack,
    git: p.git,
    readme: p.readme,
    ai: activity[p.slug] ?? {
      mentions: 0,
      lastTouchDaysAgo: null,
      prompts: [],
    },
  }));
}
