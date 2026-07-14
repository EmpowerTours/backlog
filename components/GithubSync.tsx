"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { backlog, barColor, STATUS_META } from "@/lib/backlog";
import { useTx } from "@/lib/useTx";
import { Connect } from "./Connect";

interface Proposed {
  slug: string;
  name: string;
  percent: number;
  status: "active" | "polishing" | "done" | "abandoned";
  note: string;
}

const STATUS_NUM = { active: 0, polishing: 1, done: 2, abandoned: 3 } as const;

export function GithubSync({ onWritten }: { onWritten: () => void }) {
  const { isConnected } = useAccount();
  const [state, setState] = useState<
    "loading" | "disconnected" | "ready" | "error"
  >("loading");
  const [login, setLogin] = useState<string | null>(null);
  const [projects, setProjects] = useState<Proposed[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const tx = useTx();

  useEffect(() => {
    fetch("/api/github/portfolio")
      .then(async (r) => {
        if (r.status === 401) return setState("disconnected");
        const d = await r.json();
        if (!r.ok) {
          setErr(d.error || "GitHub error");
          return setState("error");
        }
        setLogin(d.login);
        setProjects(d.projects || []);
        setState("ready");
      })
      .catch(() => setState("error"));
  }, []);

  useEffect(() => {
    if (tx.isConfirmed) {
      onWritten();
      tx.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tx.isConfirmed]);

  function writeOnchain() {
    const capped = projects.slice(0, 60); // keep one tx sane
    tx.send({
      ...backlog,
      functionName: "batchUpsert",
      args: [
        capped.map((p) => p.slug.slice(0, 60)),
        capped.map((p) => p.name.slice(0, 80)),
        capped.map((p) => p.percent),
        capped.map((p) => STATUS_NUM[p.status]),
        capped.map((p) => p.note.slice(0, 150)),
      ],
    });
  }

  if (state === "loading") return null;

  if (state === "disconnected") {
    return (
      <div className="panel p-6">
        <h2 className="font-display text-lg font-bold text-text">
          Build your portfolio from GitHub
        </h2>
        <p className="mt-1 max-w-lg text-sm text-dim">
          Connect GitHub and an AI scores every repo&apos;s completion — free,
          on your own GitHub Models quota. Then sign one transaction to put it
          onchain.
        </p>
        <a
          href="/api/auth/github/login"
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-edge-bright bg-ink-2 px-4 py-2.5 text-sm font-semibold text-text transition hover:border-accent hover:text-accent"
        >
          <GithubMark /> Connect GitHub
        </a>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="panel p-6 text-sm text-active">
        Couldn&apos;t reach GitHub{err ? `: ${err}` : ""}.{" "}
        <a href="/api/auth/github/login" className="underline">
          Reconnect
        </a>
      </div>
    );
  }

  // ready
  const shown = projects.slice(0, 60);
  return (
    <div className="panel p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-text">
            {shown.length} repos scored for{" "}
            <span className="text-accent">@{login}</span>
          </h2>
          <p className="text-sm text-dim">
            Review, then write it onchain. You sign; it&apos;s your portfolio.
          </p>
        </div>
        {isConnected ? (
          <button
            onClick={writeOnchain}
            disabled={tx.isBusy || shown.length === 0}
            className="rounded-lg bg-accent px-4 py-2.5 font-display font-bold text-ink transition hover:brightness-110 disabled:opacity-50"
          >
            {tx.isPending
              ? "Confirm in wallet…"
              : tx.isConfirming
                ? "Writing…"
                : `Write ${shown.length} onchain`}
          </button>
        ) : (
          <Connect />
        )}
      </div>

      {tx.error && (
        <p className="mt-3 text-sm text-active">
          {/rejected|denied/i.test(tx.error.message)
            ? "You rejected the transaction."
            : "Write failed."}
        </p>
      )}

      <div className="mt-5 max-h-96 divide-y divide-edge overflow-y-auto">
        {shown.map((p) => {
          const meta = STATUS_META[STATUS_NUM[p.status]];
          return (
            <div key={p.slug} className="flex items-center gap-4 py-2.5">
              <span className={`h-2 w-2 shrink-0 rounded-full ${meta.dot}`} />
              <span className="w-48 shrink-0 truncate text-sm text-text">
                {p.name}
              </span>
              <div className="bar flex-1">
                <span
                  style={{
                    width: `${p.percent}%`,
                    background: barColor(STATUS_NUM[p.status]),
                  }}
                />
              </div>
              <span className="w-10 shrink-0 text-right font-mono text-xs text-dim">
                {p.percent}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GithubMark() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}
