import { NextRequest, NextResponse } from "next/server";
import { exchangeCode } from "@/lib/github";
import { publicOrigin } from "@/lib/origin";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const origin = publicOrigin(req);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = req.cookies.get("gh_state")?.value;

  if (!code || !state || state !== cookieState) {
    return NextResponse.redirect(new URL("/?gh=error", origin));
  }

  try {
    const token = await exchangeCode(
      code,
      `${origin}/api/auth/github/callback`,
    );
    const res = NextResponse.redirect(new URL("/?gh=connected", origin));
    res.cookies.set("gh_token", token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8,
      secure: origin.startsWith("https"),
    });
    res.cookies.delete("gh_state");
    return res;
  } catch {
    return NextResponse.redirect(new URL("/?gh=error", origin));
  }
}
