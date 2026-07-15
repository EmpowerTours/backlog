import { NextRequest, NextResponse } from "next/server";
import type { Address } from "viem";
import { isAddress } from "@/lib/format";
import { fetchViewer, fetchRepos, scoreRepos } from "@/lib/github";
import { getCached } from "@/lib/scoreCache";
import { signScores, type CanonRow } from "@/lib/attest";

export const runtime = "nodejs";
export const maxDuration = 60;

const STATUS_NUM: Record<string, number> = {
  active: 0,
  polishing: 1,
  done: 2,
  abandoned: 3,
};

// Sign the caller's OWN scored portfolio for a given wallet. The server re-derives (or reuses
// the cached) scores from the authenticated GitHub account — the client cannot supply numbers —
// then returns the exact calldata + a scorer signature the contract will accept.
export async function POST(req: NextRequest) {
  const token = req.cookies.get("gh_token")?.value;
  if (!token)
    return NextResponse.json({ error: "not connected" }, { status: 401 });

  let owner: unknown;
  try {
    owner = (await req.json())?.owner;
  } catch {
    return NextResponse.json({ error: "bad request body" }, { status: 400 });
  }
  if (typeof owner !== "string" || !isAddress(owner))
    return NextResponse.json(
      { error: "invalid owner address" },
      { status: 400 },
    );

  try {
    const viewer = await fetchViewer(token);
    let projects = getCached(viewer.login);
    if (!projects) {
      const repos = await fetchRepos(token);
      projects = await scoreRepos(token, repos);
    }

    const rows: CanonRow[] = projects.slice(0, 60).map((p) => ({
      slug: p.slug.slice(0, 60),
      name: p.name.slice(0, 80),
      percent: Math.max(0, Math.min(100, Math.round(p.percent))),
      status: STATUS_NUM[p.status] ?? 0,
      note: p.note.slice(0, 160),
    }));
    if (rows.length === 0)
      return NextResponse.json({ error: "nothing to attest" }, { status: 400 });

    const deadline = Math.floor(Date.now() / 1000) + 600; // 10-minute validity
    const signed = await signScores(owner as Address, rows, deadline);
    return NextResponse.json({ ...signed, login: viewer.login });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
