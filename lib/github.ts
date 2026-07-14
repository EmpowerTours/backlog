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
  description: string | null;
  pushedAt: string | null;
  createdAt: string | null;
  language: string | null;
  size: number;
  fork: boolean;
  archived: boolean;
  openIssues: number;
  url: string;
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

function daysAgo(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

/** Score repos with GitHub Models on the user's own token. Falls back to a heuristic. */
export async function scoreRepos(
  token: string,
  repos: GhRepo[],
): Promise<Scored[]> {
  try {
    return await scoreWithModels(token, repos);
  } catch (e) {
    console.warn(
      "GitHub Models scoring failed, using heuristic:",
      (e as Error).message,
    );
    return repos.map(heuristicScore);
  }
}

async function scoreWithModels(
  token: string,
  repos: GhRepo[],
): Promise<Scored[]> {
  const lines = repos
    .map(
      (r) =>
        `- ${r.name} [${r.language ?? "?"}] pushed=${daysAgo(r.pushedAt) ?? "?"}d ago age=${daysAgo(r.createdAt) ?? "?"}d size=${r.size}KB issues=${r.openIssues}${r.archived ? " ARCHIVED" : ""} desc:"${(r.description ?? "").slice(0, 90)}"`,
    )
    .join("\n");

  const system =
    "You assess software project completion for a builder's portfolio from GitHub repo metadata. " +
    "Return a STRICT JSON array, one object per repo, no prose, no code fences. " +
    'Each: {"slug":string,"name":string(<=80),"percent":0-100 int,"status":"active"|"polishing"|"done"|"abandoned","note":string(<=150)}. ' +
    "Heuristics: 'done' if mature and stable; 'polishing' if ~80-99%; 'active' if pushed recently; " +
    "'abandoned' if untouched 45+ days and not clearly finished, or archived. Be specific in notes.";

  // Prefer a server token with Models access (classic OAuth ignores models:read);
  // fall back to the user's own token in case it was granted.
  const modelsToken = process.env.GITHUB_MODELS_TOKEN || token;
  const res = await fetch(GH_MODELS, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${modelsToken}`,
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
  let status: Scored["status"] = "active";
  let percent = Math.max(
    10,
    Math.min(90, Math.round(Math.log2(r.size + 2) * 12)),
  );
  if (r.archived || (pushed != null && pushed > 45)) {
    status = "abandoned";
    percent = Math.min(percent, 60);
  } else if (percent >= 80) status = "polishing";
  return normalize(r, {
    name: r.name,
    percent,
    status,
    note:
      r.description ??
      `${r.language ?? "repo"}, last push ${pushed ?? "?"}d ago`,
  });
}

function normalize(r: GhRepo, s: Partial<Scored>): Scored {
  const status = (
    s.status && STATUS_SET.has(s.status) ? s.status : "active"
  ) as Scored["status"];
  return {
    slug: r.name.slice(0, 60),
    name: String(s.name || r.name).slice(0, 80),
    percent: Math.max(0, Math.min(100, Math.round(Number(s.percent) || 0))),
    status,
    note: String(s.note || "").slice(0, 150),
  };
}
