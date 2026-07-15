"use client";

import { useState } from "react";
import type { Address } from "viem";

/** Surfaces the live badge + shareable links for a portfolio. The badge and the
 *  public card are just endpoints (/badge/<addr>, /b/<addr>) — this is their front door. */
export function BadgeCard({ address }: { address: Address }) {
  const [origin, setOrigin] = useState("");
  // read the public origin on the client so the copyable snippets are absolute URLs
  if (typeof window !== "undefined" && !origin)
    setOrigin(window.location.origin);

  const badgeUrl = `${origin}/badge/${address}`;
  const cardUrl = `${origin}/b/${address}`;
  const markdown = `[![backlog](${badgeUrl})](${cardUrl})`;

  return (
    <div className="panel p-6">
      <div className="text-xs font-semibold uppercase tracking-widest text-dim">
        Share your ledger
      </div>
      <p className="mt-2 max-w-lg text-sm text-dim">
        A live badge that reads straight from Monad — drop it in any README or
        profile. It updates itself every time you sync.
      </p>

      {/* the live badge, rendered from the endpoint */}
      <div className="mt-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/badge/${address}`} alt="backlog badge" className="h-6" />
      </div>

      <div className="mt-5 space-y-3">
        <CopyRow label="Markdown (for a README)" value={markdown} />
        <CopyRow label="Public card" value={cardUrl} />
        <CopyRow label="Badge image URL" value={badgeUrl} />
      </div>
    </div>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-faint">{label}</div>
      <div className="flex items-stretch gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg border border-edge bg-ink-2 px-3 py-2 font-mono text-xs text-text">
          {value}
        </code>
        <button
          onClick={() => {
            navigator.clipboard.writeText(value).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
          className="shrink-0 rounded-lg border border-edge-bright bg-panel px-3 text-sm font-semibold text-text transition hover:border-accent hover:text-accent"
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
    </div>
  );
}
