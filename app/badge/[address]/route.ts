import type { NextRequest } from "next/server";
import type { Address } from "viem";
import { isAddress } from "@/lib/format";
import { readPortfolio } from "@/lib/readChain";
import { vitals } from "@/lib/backlog";

// Live "verified onchain" badge. Reads the builder's vitals from Monad and renders an
// SVG (shields-style). Server-side chain read is bounded by a timeout so it can never
// hang the request — on timeout it degrades to a link-style badge.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address } = await params;
  let message = "onchain build ledger";
  let ok = false;

  if (isAddress(address)) {
    try {
      const projects = (await Promise.race([
        readPortfolio(address as Address),
        new Promise((_, rej) =>
          setTimeout(() => rej(new Error("timeout")), 6000),
        ),
      ])) as Awaited<ReturnType<typeof readPortfolio>>;
      const v = vitals(projects);
      message = `${v.done} shipped · ${v.avg}% avg · ${v.n} projects`;
      ok = true;
    } catch {
      message = "view onchain";
    }
  }

  const svg = renderBadge(message, ok);
  return new Response(svg, {
    headers: {
      "content-type": "image/svg+xml",
      // short cache so it stays current but isn't hammered
      "cache-control": "public, max-age=300, s-maxage=300",
    },
  });
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderBadge(msg: string, ok: boolean): string {
  const left = "backlog";
  const fs = 12;
  const cw = 6.6; // approx char width at fs 12, Verdana
  const padX = 9;
  const h = 24;
  const leftW = Math.round(left.length * cw + padX * 2);
  const rightW = Math.round(msg.length * cw + padX * 2);
  const w = leftW + rightW;
  const right = ok ? "#4fb477" : "#5b9bd5";
  const rightText = ok ? "#0e0f12" : "#0e0f12";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" role="img" aria-label="backlog: ${esc(msg)}">
  <clipPath id="r"><rect width="${w}" height="${h}" rx="4"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${leftW}" height="${h}" fill="#141419"/>
    <rect x="${leftW}" width="${rightW}" height="${h}" fill="${right}"/>
  </g>
  <g font-family="Verdana,DejaVu Sans,Geneva,sans-serif" font-size="${fs}" font-weight="700">
    <text x="${leftW / 2}" y="16" fill="#e7e7e4" text-anchor="middle">${left}</text>
    <text x="${leftW + rightW / 2}" y="16" fill="${rightText}" text-anchor="middle">${esc(msg)}</text>
  </g>
</svg>`;
}
