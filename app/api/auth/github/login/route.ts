import { NextRequest, NextResponse } from "next/server";
import { authorizeUrl, GITHUB_CLIENT_ID } from "@/lib/github";
import { publicOrigin } from "@/lib/origin";

export async function GET(req: NextRequest) {
  if (!GITHUB_CLIENT_ID) {
    return NextResponse.json(
      { error: "GITHUB_CLIENT_ID not set" },
      { status: 500 },
    );
  }
  const origin = publicOrigin(req);
  const redirectUri = `${origin}/api/auth/github/callback`;
  const state = crypto.randomUUID();

  const res = NextResponse.redirect(authorizeUrl(redirectUri, state));
  res.cookies.set("gh_state", state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
    secure: origin.startsWith("https"),
  });
  return res;
}
