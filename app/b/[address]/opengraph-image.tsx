import { ImageResponse } from "next/og";
import type { Address } from "viem";
import { isAddress } from "@/lib/format";
import { readPortfolio } from "@/lib/readChain";
import { vitals } from "@/lib/backlog";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Backlog — onchain builder portfolio";

const C = {
  ink: "#0e0f12",
  panel: "#16181d",
  edge: "#262a31",
  text: "#e7e7e4",
  dim: "#8a8f98",
  accent: "#4fb477",
  active: "#e0a34e",
  polishing: "#5b9bd5",
  abandoned: "#6b6b72",
};

function Stat({
  n,
  label,
  color,
}: {
  n: number;
  label: string;
  color: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
      }}
    >
      <div style={{ fontSize: 56, fontWeight: 800, color }}>{n}</div>
      <div
        style={{
          fontSize: 22,
          color: C.dim,
          textTransform: "uppercase",
          letterSpacing: 2,
        }}
      >
        {label}
      </div>
    </div>
  );
}

export default async function Image({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;
  let v = { n: 0, avg: 0, done: 0, polishing: 0, active: 0, abandoned: 0 };
  let short = address;
  if (isAddress(address)) {
    short = `${address.slice(0, 6)}…${address.slice(-4)}`;
    try {
      v = vitals(await readPortfolio(address as Address));
    } catch {
      // leave zeros
    }
  }

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        background: C.ink,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ fontSize: 40, fontWeight: 800, color: C.text }}>
          backlog
        </div>
        <div style={{ fontSize: 24, color: C.accent }}>
          verified onchain · Monad
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "flex-end" }}>
          <div
            style={{
              fontSize: 160,
              fontWeight: 800,
              color: C.text,
              lineHeight: 1,
            }}
          >
            {`${v.avg}%`}
          </div>
          <div
            style={{
              fontSize: 30,
              color: C.dim,
              paddingBottom: 24,
              paddingLeft: 20,
            }}
          >
            {`avg completion across ${v.n} projects`}
          </div>
        </div>
        <div style={{ display: "flex", gap: 56, marginTop: 36 }}>
          <Stat n={v.done} label="Shipped" color={C.accent} />
          <Stat n={v.polishing} label="Polishing" color={C.polishing} />
          <Stat n={v.active} label="Active" color={C.active} />
          <Stat n={v.abandoned} label="Buried" color={C.abandoned} />
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ fontSize: 28, color: C.dim }}>{short}</div>
        <div style={{ fontSize: 24, color: C.dim }}>
          the honest ledger of everything you&apos;ve built
        </div>
      </div>
    </div>,
    { ...size },
  );
}
