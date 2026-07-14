import { ImageResponse } from "next/og";
import { isAddress, shortAddr } from "@/lib/format";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Backlog — onchain builder portfolio";

const C = {
  ink: "#0e0f12",
  text: "#e7e7e4",
  dim: "#8a8f98",
  accent: "#4fb477",
};

// Network-free by design: no chain read on the server (that hangs some hosts).
// A clean branded card; the live vitals live on the page itself.
export default async function Image({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;
  const who = isAddress(address) ? shortAddr(address) : "builder";

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        background: C.ink,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 80,
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
        <div style={{ fontSize: 44, fontWeight: 800, color: C.text }}>
          backlog
        </div>
        <div style={{ fontSize: 26, color: C.accent }}>
          verified onchain · Monad
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            fontSize: 82,
            fontWeight: 800,
            color: C.text,
            lineHeight: 1.05,
          }}
        >
          The honest ledger of
        </div>
        <div
          style={{
            fontSize: 82,
            fontWeight: 800,
            color: C.text,
            lineHeight: 1.05,
          }}
        >
          everything you&apos;ve built.
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ fontSize: 30, color: C.dim }}>{who}</div>
        <div style={{ fontSize: 26, color: C.dim }}>
          proven onchain, not backdated
        </div>
      </div>
    </div>,
    { ...size },
  );
}
