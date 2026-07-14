"use client";

import { useState } from "react";

export function ShareButton() {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(window.location.href).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="rounded-lg border border-edge-bright bg-panel px-3 py-2 text-sm font-semibold text-text transition hover:border-accent hover:text-accent"
    >
      {copied ? "Copied ✓" : "Share"}
    </button>
  );
}
