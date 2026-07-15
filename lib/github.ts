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

const STATUS_SET = new Set(["active", "polishing", "done", "abandoned"]);

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
  // filled by enrichRepos — real content signals
  files?: number;
  codeFiles?: number;
  hasTests?: boolean;
  hasReadme?: boolean;
  hasManifest?: boolean;
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
    }));
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
  try {
    const res = await fetch(
      `${GH_API}/repos/${repo.fullName}/git/trees/${repo.defaultBranch}?recursive=1`,
      { headers: ghHeaders(token), signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) {
      // 409 = empty repo (no commits)
      return {
        ...repo,
        files: 0,
        codeFiles: 0,
        hasTests: false,
        hasReadme: false,
        hasManifest: false,
      };
    }
    const data = (await res.json()) as {
      tree?: Array<{ path: string; type: string }>;
    };
    const blobs = (data.tree ?? []).filter((t) => t.type === "blob");
    const paths = blobs.map((b) => b.path);
    const codeFiles = paths.filter((p) => !NON_CODE.test(p)).length;
    return {
      ...repo,
      files: blobs.length,
      codeFiles,
      hasTests: paths.some((p) => TEST_RE.test(p) || TEST_FILE.test(p)),
      hasReadme: paths.some((p) => README_RE.test(p)),
      hasManifest: paths.some((p) => MANIFEST.test(p)),
    };
  } catch {
    return repo; // leave signals undefined; scorer treats as unknown
  }
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
  for (const t of candidates) {
    try {
      return await scoreWithModels(t, enriched);
    } catch (e) {
      console.warn("Models scoring attempt failed:", (e as Error).message);
    }
  }
  console.warn("All Models attempts failed — using heuristic.");
  return enriched.map(heuristicScore);
}

async function scoreWithModels(
  token: string,
  repos: GhRepo[],
): Promise<Scored[]> {
  const lines = repos
    .map(
      (r) =>
        `- ${r.name} [${r.language ?? "?"}] pushed=${daysAgo(r.pushedAt) ?? "?"}d ago age=${daysAgo(r.createdAt) ?? "?"}d files=${r.files ?? "?"} code=${r.codeFiles ?? "?"} tests=${r.hasTests ? "y" : "n"} manifest=${r.hasManifest ? "y" : "n"} issues=${r.openIssues}${r.archived ? " ARCHIVED" : ""} desc:"${(r.description ?? "").slice(0, 80)}"`,
    )
    .join("\n");

  const system =
    "You assess software project completion for a builder's portfolio from GitHub repo signals. " +
    "Return a STRICT JSON array, one object per repo, no prose, no code fences. " +
    'Each: {"slug":string,"name":string(<=80),"percent":0-100 int,"status":"active"|"polishing"|"done"|"abandoned","note":string(<=150)}. ' +
    "WEIGHT ACTUAL CONTENT HEAVILY: `code` = real source files (excludes README/license/lockfiles). " +
    "code=0 -> empty stub, percent 0-5, 'abandoned' regardless of age. code 1-2 -> barely started, <=20. " +
    "A repo is only 'done'/'polishing' with substantial code AND signs of completeness (tests, manifest, mature history). " +
    "'active' if pushed recently; 'abandoned' if untouched 45+ days and not clearly finished, or archived. " +
    "Do NOT rate a tiny repo as done just because it's old and stable. Be specific in notes (mention what's actually there).";

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
  let status: Scored["status"] = "active";
  let percent =
    code !== undefined
      ? Math.max(
          5,
          Math.min(
            85,
            8 + code * 3 + (r.hasTests ? 10 : 0) + (r.hasManifest ? 5 : 0),
          ),
        )
      : Math.max(10, Math.min(85, Math.round(Math.log2(r.size + 2) * 12)));
  if (r.archived || (pushed != null && pushed > 60)) {
    status = "abandoned";
  } else if (percent >= 80) status = "polishing";
  return normalize(r, {
    name: r.name,
    percent,
    status,
    note:
      r.description ??
      `${code ?? "?"} code files${r.hasTests ? " + tests" : ""}, last push ${pushed ?? "?"}d ago`,
  });
}

function normalize(r: GhRepo, s: Partial<Scored>): Scored {
  let status = (
    s.status && STATUS_SET.has(s.status) ? s.status : "active"
  ) as Scored["status"];
  let percent = Math.max(0, Math.min(100, Math.round(Number(s.percent) || 0)));
  let note = String(s.note || "").slice(0, 150);

  // Hard content guards — a repo with little/no real code can't score as finished,
  // no matter what the model says. `codeFiles` is undefined only if enrichment failed.
  const code = r.codeFiles;
  if (code !== undefined) {
    if (code === 0) {
      percent = Math.min(percent, 3);
      status = "abandoned";
      if (!note) note = "empty — no code files";
    } else if (code < 3) {
      percent = Math.min(percent, 20);
      if (status === "done" || status === "polishing") status = "active";
    } else if (code < 8 && (status === "done" || status === "polishing")) {
      percent = Math.min(percent, 60); // only a handful of files — not "done"
    }
  }

  return {
    slug: r.name.slice(0, 60),
    name: String(s.name || r.name).slice(0, 80),
    percent,
    status,
    note,
  };
}
