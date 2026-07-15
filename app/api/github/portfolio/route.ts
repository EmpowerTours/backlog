import { NextRequest, NextResponse } from "next/server";
import { fetchViewer, fetchRepos, scoreRepos } from "@/lib/github";
import { setCached } from "@/lib/scoreCache";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const token = req.cookies.get("gh_token")?.value;
  if (!token)
    return NextResponse.json({ error: "not connected" }, { status: 401 });

  try {
    const [viewer, repos] = await Promise.all([
      fetchViewer(token),
      fetchRepos(token),
    ]);
    const projects = await scoreRepos(token, repos);
    setCached(viewer.login, projects); // so /attest signs the same scores without re-scoring
    return NextResponse.json({
      login: viewer.login,
      name: viewer.name,
      projects,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
