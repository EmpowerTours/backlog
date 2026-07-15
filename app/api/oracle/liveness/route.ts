import { NextRequest, NextResponse } from "next/server";
import {
  createPublicClient,
  http,
  keccak256,
  toBytes,
  type Address,
} from "viem";
import { monad } from "@/lib/chain";
import { backlog } from "@/lib/backlog";
import { isAddress } from "@/lib/format";
import { signLiveness } from "@/lib/attest";

export const runtime = "nodejs";
export const maxDuration = 30;

// Obvious placeholder/parked pages return 200 but aren't a real deployment. Heuristic, labeled as one.
const PLACEHOLDER =
  /coming soon|under construction|default backend|nginx|it works!|welcome to nginx|this page is parked/i;

/**
 * The liveness oracle. It reads the URL the builder COMMITTED onchain for this bond (not one the
 * caller supplies), checks whether it responds, and signs the verdict so anyone can `resolve` the
 * challenge. Because the URL is public onchain, anyone can re-check it and confirm the oracle was honest.
 */
export async function POST(req: NextRequest) {
  let body: { builder?: string; slug?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request body" }, { status: 400 });
  }
  const { builder, slug } = body;
  if (
    typeof builder !== "string" ||
    !isAddress(builder) ||
    typeof slug !== "string" ||
    !slug
  )
    return NextResponse.json(
      { error: "builder + slug required" },
      { status: 400 },
    );

  try {
    const client = createPublicClient({ chain: monad, transport: http() });
    const url = (await client.readContract({
      ...backlog,
      functionName: "bondUrl",
      args: [builder as Address, keccak256(toBytes(slug))],
    })) as string;

    if (!url)
      return NextResponse.json(
        { error: "no active bond for this project" },
        { status: 404 },
      );

    // check the committed URL
    let live = false;
    if (/^https?:\/\//i.test(url)) {
      try {
        const res = await fetch(url, {
          method: "GET",
          redirect: "follow",
          signal: AbortSignal.timeout(8000),
        });
        if (res.status < 400) {
          const text = (await res.text()).slice(0, 4000);
          live = text.trim().length > 0 && !PLACEHOLDER.test(text);
        }
      } catch {
        live = false;
      }
    }

    const observedAt = Math.floor(Date.now() / 1000);
    const signed = await signLiveness(
      builder as Address,
      slug,
      live,
      observedAt,
    );
    return NextResponse.json({ ...signed, url });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
