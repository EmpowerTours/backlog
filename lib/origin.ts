import type { NextRequest } from "next/server";

/**
 * The app's PUBLIC origin. Behind a proxy (Railway), `new URL(req.url).origin`
 * is the container's internal host (e.g. https://localhost:8080), which breaks
 * OAuth redirect_uri matching. Prefer an explicit APP_URL, then the proxy's
 * forwarded headers, then the Host header, and only fall back to req.url.
 */
export function publicOrigin(req: NextRequest): string {
  const env = process.env.APP_URL;
  if (env) return env.replace(/\/+$/, "");

  const proto =
    req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? "https";
  const host =
    req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ??
    req.headers.get("host") ??
    null;
  if (host && !host.startsWith("localhost")) return `${proto}://${host}`;

  return new URL(req.url).origin;
}
