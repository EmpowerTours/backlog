import { NextRequest, NextResponse } from "next/server";
import { exchangeCode } from "@/lib/github";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = req.cookies.get("gh_state")?.value;

  if (!code || !state || state !== cookieState) {
    return NextResponse.redirect(new URL("/?gh=error", url.origin));
  }

  try {
    const token = await exchangeCode(
      code,
      `${url.origin}/api/auth/github/callback`,
    );
    const res = NextResponse.redirect(new URL("/?gh=connected", url.origin));
    res.cookies.set("gh_token", token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8,
      secure: url.origin.startsWith("https"),
    });
    res.cookies.delete("gh_state");
    return res;
  } catch {
    return NextResponse.redirect(new URL("/?gh=error", url.origin));
  }
}
