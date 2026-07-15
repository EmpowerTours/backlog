// Server-only GitHub integration: OAuth, repo listing, and free scoring via GitHub Models.
import "server-only";

const GH_AUTHORIZE = "https://github.com/login/oauth/authorize";
const GH_TOKEN = "https://github.com/login/oauth/access_token";
const GH_API = "https://api.github.com";
const GH_MODELS = "https://models.github.ai/inference/chat/completions";

export const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID ?? "";
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET ?? "";
export const GITHUB_MODELS_MODEL =
  process.env.GITHUB_MODELS_MODEL ?? "openai/gpt-4o-mini";
// read:user for identity, repo to see private repos, models:read for GitHub Models
export const GITHUB_SCOPES = "read:user repo models:read";

export interface Scored {
  slug: string;
  name: string;
  percent: number;
  status: "active" | "polishing" | "done" | "abandoned";
  note: string;
}

export function authorizeUrl(redirectUri: string, state: string): string {
  const u = new URL(GH_AUTHORIZE);
  u.searchParams.set("client_id", GITHUB_CLIENT_ID);
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("scope", GITHUB_SCOPES);
  u.searchParams.set("state", state);
  return u.toString();
}

export async function exchangeCode(
  code: string,
  redirectUri: string,
): Promise<string> {
  const res = await fetch(GH_TOKEN, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
    }),
  });
  const data = await res.json();
  if (!data.access_token)
    throw new Error(data.error_description || "token exchange failed");
  return data.access_token as string;
}

function ghHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "backlog-app",
  };
}

export interface GhViewer {
  login: string;
  name: string | null;
  avatar_url: string;
}

export async function fetchViewer(token: string): Promise<GhViewer> {
  const res = await fetch(`${GH_API}/user`, { headers: ghHeaders(token) });
  if (!res.ok) throw new Error(`GitHub /user ${res.status}`);
  return res.json();
}

export interface GhRepo {
  name: string;
  fullName: string;
  defaultBranch: string;
  description: string | null;
  pushedAt: string | null;
  createdAt: string | null;
  language: string | null;
  size: number;
  fork: boolean;
  archived: boolean;
  openIssues: number;
  url: string;
  homepage: string | null;
  // filled by enrichRepos — real content signals
  files?: number;
  codeFiles?: number;
  hasTests?: boolean;
  hasReadme?: boolean;
  hasManifest?: boolean;
  isLive?: boolean; // homepage URL responds (deployed = shipped signal)
}

export async function fetchRepos(token: string): Promise<GhRepo[]> {
  // owner-affiliated repos, most recently pushed first
  const res = await fetch(
    `${GH_API}/user/repos?per_page=100&sort=pushed&affiliation=owner`,
    { headers: ghHeaders(token) },
  );
  if (!res.ok) throw new Error(`GitHub /user/repos ${res.status}`);
  const raw = (await res.json()) as Array<Record<string, unknown>>;
  return raw
    .filter((r) => !r.fork) // your own work, not forks
    .map((r) => ({
      name: String(r.name),
      fullName: String(r.full_name ?? r.name),
      defaultBranch: String(r.default_branch ?? "HEAD"),
      description: (r.description as string) ?? null,
      pushedAt: (r.pushed_at as string) ?? null,
      createdAt: (r.created_at as string) ?? null,
      language: (r.language as string) ?? null,
      size: Number(r.size ?? 0),
      fork: Boolean(r.fork),
      archived: Boolean(r.archived),
      openIssues: Number(r.open_issues_count ?? 0),
      url: String(r.html_url ?? ""),
      homepage: (r.homepage as string) || null,
    }));
}

/** Ping a repo's homepage; a 2xx/3xx means it's deployed and serving = a real "shipped" signal. */
async function checkLive(homepage: string | null): Promise<boolean> {
  if (!homepage || !/^https?:\/\//i.test(homepage)) return false;
  try {
    const res = await fetch(homepage, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(5000),
    });
    return res.status < 400;
  } catch {
    return false;
  }
}

const NON_CODE =
  /(?:^|\/)(?:readme|license|licence|\.gitignore|\.gitattributes|changelog|contributing|code_of_conduct)|(?:package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb)$|(?:^|\/)(?:node_modules|dist|build|out|\.next|vendor|coverage)\//i;
const TEST_RE = /(?:^|\/)(?:tests?|__tests__|spec|specs)\//i;
const TEST_FILE = /\.(?:test|spec)\.[a-z]+$|_test\.[a-z]+$|\.t\.sol$/i;
const MANIFEST =
  /(?:^|\/)(?:package\.json|Cargo\.toml|go\.mod|pyproject\.toml|requirements\.txt|foundry\.toml|Gemfile|pom\.xml)$/i;
const README_RE = /(?:^|\/)readme(\.md|\.txt)?$/i;

/** Read each repo's file tree to get real content signals. Bounded concurrency. */
export async function enrichRepos(
  token: string,
  repos: GhRepo[],
): Promise<GhRepo[]> {
  const out: GhRepo[] = [];
  const BATCH = 8;
  for (let i = 0; i < repos.length; i += BATCH) {
    const batch = repos.slice(i, i + BATCH);
    const enriched = await Promise.all(batch.map((r) => enrichOne(token, r)));
    out.push(...enriched);
  }
  return out;
}

async function enrichOne(token: string, repo: GhRepo): Promise<GhRepo> {
  // tree read + liveness ping in parallel
  const [tree, isLive] = await Promise.all([
    fetch(
      `${GH_API}/repos/${repo.fullName}/git/trees/${repo.defaultBranch}?recursive=1`,
      {
        headers: ghHeaders(token),
        signal: AbortSignal.timeout(8000),
      },
    )
      .then(async (res) =>
        res.ok
          ? ((await res.json()) as {
              tree?: Array<{ path: string; type: string }>;
            })
          : null,
      )
      .catch(() => null),
    checkLive(repo.homepage),
  ]);

  if (!tree) {
    // 409 (empty repo) or fetch failed
    return {
      ...repo,
      files: 0,
      codeFiles: 0,
      hasTests: false,
      hasReadme: false,
      hasManifest: false,
      isLive,
    };
  }
  const blobs = (tree.tree ?? []).filter((t) => t.type === "blob");
  const paths = blobs.map((b) => b.path);
  const codeFiles = paths.filter((p) => !NON_CODE.test(p)).length;
  return {
    ...repo,
    files: blobs.length,
    codeFiles,
    hasTests: paths.some((p) => TEST_RE.test(p) || TEST_FILE.test(p)),
    hasReadme: paths.some((p) => README_RE.test(p)),
    hasManifest: paths.some((p) => MANIFEST.test(p)),
    isLive,
  };
}

/** Deterministic status from completion + recency + liveness, so status never contradicts percent. */
function deriveStatus(r: GhRepo, percent: number): Scored["status"] {
  if (r.archived) return "abandoned";
  if (r.codeFiles !== undefined && r.codeFiles < 2) return "abandoned"; // effectively empty
  if (r.isLive) return "done"; // deployed and responding = shipped
  const pushed = daysAgo(r.pushedAt);
  const stale = pushed != null && pushed > 45;
  if (stale) return percent >= 90 ? "done" : "abandoned"; // finished-then-left vs given-up
  if (percent >= 85) return "done";
  if (percent >= 60) return "polishing";
  return "active";
}

function daysAgo(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

/**
 * Score repos with GitHub Models. Tries the user's OWN token first so every user
 * spends their own free Models quota (scales per-user); falls back to a shared
 * server token (GITHUB_MODELS_TOKEN) only if the user's token can't reach Models;
 * finally falls back to a free heuristic so scoring never hard-fails.
 *
 * NOTE on true multi-user scale: a classic OAuth "sign in" token usually can't call
 * GitHub Models (models:read isn't a classic OAuth scope). To make per-user scoring
 * work for everyone without a shared token, convert this login from an OAuth App to a
 * GitHub App — a GitHub App's user-to-server tokens can carry the `models:read`
 * permission, so each user scores on their own quota. That's the scale path.
 */
export async function scoreRepos(
  token: string,
  repos: GhRepo[],
): Promise<Scored[]> {
  // read each repo's real content (file counts, tests, manifest) with the user's token
  const enriched = await enrichRepos(token, repos);
  const serverToken = process.env.GITHUB_MODELS_TOKEN;
  const candidates = [
    ...new Set([token, serverToken].filter(Boolean)),
  ] as string[];

  // Score in parallel chunks: one giant prompt for 50+ repos is slow (~30s) and can
  // truncate the JSON. Chunks of ~18 run concurrently, so wall time ≈ one chunk, and
  // a truncated/failed chunk degrades to the heuristic without sinking the whole run.
  const CHUNK = 18;
  const chunks: GhRepo[][] = [];
  for (let i = 0; i < enriched.length; i += CHUNK) {
    chunks.push(enriched.slice(i, i + CHUNK));
  }
  const scored = await Promise.all(
    chunks.map((c) => scoreChunk(c, candidates)),
  );
  return scored.flat();
}

/** Score one chunk: try each token against Models, fall back to the heuristic. Never throws. */
async function scoreChunk(
  repos: GhRepo[],
  candidates: string[],
): Promise<Scored[]> {
  for (const t of candidates) {
    try {
      return await scoreWithModels(t, repos);
    } catch (e) {
      console.warn("Models chunk failed:", (e as Error).message);
    }
  }
  return repos.map(heuristicScore);
}

async function scoreWithModels(
  token: string,
  repos: GhRepo[],
): Promise<Scored[]> {
  const lines = repos
    .map(
      (r) =>
        `- ${r.name} [${r.language ?? "?"}] pushed=${daysAgo(r.pushedAt) ?? "?"}d ago files=${r.files ?? "?"} code=${r.codeFiles ?? "?"} tests=${r.hasTests ? "y" : "n"} manifest=${r.hasManifest ? "y" : "n"} live=${r.isLive ? "y" : "n"}${r.archived ? " ARCHIVED" : ""} desc:"${(r.description ?? "").slice(0, 80)}"`,
    )
    .join("\n");

  const system =
    "You estimate how COMPLETE each software project is (0-100), from GitHub signals. " +
    "Return a STRICT JSON array, one object per repo, no prose, no code fences. " +
    'Each: {"slug":string,"name":string(<=80),"percent":0-100 int,"note":string(<=150)}. ' +
    "Only output percent + a specific note. (Status is computed separately from percent, recency, and liveness — do not output it.) " +
    "CALIBRATE percent by real content — `code` = source files (excludes README/license/lockfiles): " +
    "code=0 -> 0-5. code 1-2 (bare scaffold/template/one-file) -> 8-20. code 3-8 (early prototype) -> 25-45. " +
    "code 9-25 with a manifest -> 45-70. substantial code + tests + manifest -> 70-90. only reserve 90-100 for clearly complete, polished, well-tested projects (or live=y). " +
    "Be STRICT: 'basic implementation, lacks tests' is ~40-55, NOT 80. A template or bones repo is ~15. Notes must name what's actually there.";

  const res = await fetch(GH_MODELS, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GITHUB_MODELS_MODEL,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: `Score these ${repos.length} repos:\n\n${lines}`,
        },
      ],
      temperature: 0.2,
    }),
    // hard bound — a stalled Models call must never hang the request forever
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok)
    throw new Error(
      `Models ${res.status}: ${(await res.text()).slice(0, 160)}`,
    );
  const data = await res.json();
  const text: string = data.choices?.[0]?.message?.content ?? "";
  const json = text.slice(text.indexOf("["), text.lastIndexOf("]") + 1);
  const arr = JSON.parse(json) as Array<Partial<Scored>>;
  const bySlug = new Map(arr.map((x) => [x.slug, x]));
  return repos.map((r) => {
    const s = bySlug.get(r.name);
    return s ? normalize(r, s) : heuristicScore(r);
  });
}

function heuristicScore(r: GhRepo): Scored {
  const pushed = daysAgo(r.pushedAt);
  const code = r.codeFiles;
  // percent only — normalize() derives status from it
  const percent =
    code !== undefined
      ? Math.max(
          5,
          Math.min(
            85,
            8 + code * 3 + (r.hasTests ? 10 : 0) + (r.hasManifest ? 5 : 0),
          ),
        )
      : Math.max(10, Math.min(85, Math.round(Math.log2(r.size + 2) * 12)));
  return normalize(r, {
    name: r.name,
    percent,
    note:
      r.description ??
      `${code ?? "?"} code files${r.hasTests ? " + tests" : ""}, last push ${pushed ?? "?"}d ago`,
  });
}

function normalize(r: GhRepo, s: Partial<Scored>): Scored {
  let percent = Math.max(0, Math.min(100, Math.round(Number(s.percent) || 0)));
  let note = String(s.note || "").slice(0, 150);

  // Hard content guards on the PERCENT — a repo with little/no real code can't be high,
  // no matter what the model says. codeFiles is undefined only if enrichment failed.
  const code = r.codeFiles;
  if (code !== undefined) {
    if (code === 0) {
      percent = Math.min(percent, 3);
      if (!note) note = "empty — no code files";
    } else if (code < 3) {
      percent = Math.min(percent, 20);
    } else if (code < 8) {
      percent = Math.min(percent, 60);
    }
  }
  if (r.isLive) percent = Math.max(percent, 85); // it's deployed and serving

  // Status is DERIVED from percent + recency + liveness, so it never contradicts the bar.
  const status = deriveStatus(r, percent);

  return {
    slug: r.name.slice(0, 60),
    name: String(s.name || r.name).slice(0, 80),
    percent,
    status,
    note,
  };
}
