import { NextRequest, NextResponse } from "next/server";
import { fetchViewer } from "@/lib/github";

export const runtime = "nodejs";

// Return the deployment URL GitHub has on record for one of the caller's repos, so the bond
// dialog can pre-fill it (the user just confirms instead of typing their live URL by hand).
export async function GET(req: NextRequest) {
  const token = req.cookies.get("gh_token")?.value;
  if (!token)
    return NextResponse.json({ error: "not connected" }, { status: 401 });

  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug)
    return NextResponse.json({ error: "slug required" }, { status: 400 });

  try {
    const viewer = await fetchViewer(token);
    const res = await fetch(
      `https://api.github.com/repos/${viewer.login}/${encodeURIComponent(slug)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "backlog-app",
        },
        signal: AbortSignal.timeout(6000),
      },
    );
    if (!res.ok) return NextResponse.json({ homepage: "" });
    const r = (await res.json()) as { homepage?: string | null };
    return NextResponse.json({ homepage: r.homepage || "" });
  } catch {
    return NextResponse.json({ homepage: "" });
  }
}
