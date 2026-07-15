"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatEther, type Address } from "viem";
import { useAccount } from "wagmi";
import { Header } from "@/components/Header";
import { BondControls } from "@/components/BondControls";
import { shortAddr } from "@/lib/format";

interface Claim {
  builder: string;
  slug: string;
  name: string;
  percent: number;
  url: string;
  amount: string;
  challenger: string;
  challenged: boolean;
  cureDeadline: number;
}

export default function ClaimsBoard() {
  const { address } = useAccount();
  const [claims, setClaims] = useState<Claim[] | null>(null);

  const load = useCallback(() => {
    fetch("/api/claims")
      .then((r) => r.json())
      .then((d) => setClaims(d.claims ?? []))
      .catch(() => setClaims([]));
  }, []);
  useEffect(() => load(), [load]);

  const total =
    claims?.reduce((s, c) => s + Number(formatEther(BigInt(c.amount))), 0) ?? 0;

  return (
    <>
      <Header />
      <main className="mx-auto max-w-4xl px-5 pb-24">
        <div className="pt-6">
          <div className="text-xs uppercase tracking-widest text-dim">
            Bonded claims
          </div>
          <h1 className="mt-1 font-display text-3xl font-extrabold text-text">
            Every builder with money on the line.
          </h1>
          <p className="mt-2 max-w-xl text-sm text-dim">
            Each of these is a builder staking MON that a shipped project is
            live. Think one&apos;s dead? Challenge it — match the bond, and if
            the deployment is down after the cure window, you take the pot.
          </p>
        </div>

        {claims === null ? (
          <div className="panel mt-6 p-6 text-sm text-dim">
            Reading bonds from the chain…
          </div>
        ) : claims.length === 0 ? (
          <div className="panel mt-6 p-6">
            <div className="font-display font-semibold text-text">
              No live bonds yet.
            </div>
            <div className="mt-1 text-sm text-dim">
              Be the first — score your GitHub, write it onchain, and stake that
              a shipped project is live.
            </div>
          </div>
        ) : (
          <>
            <div className="mt-4 flex gap-6 text-sm text-dim">
              <span>
                <span className="font-mono text-text">{claims.length}</span>{" "}
                live bonds
              </span>
              <span>
                <span className="font-mono text-text">{total.toFixed(1)}</span>{" "}
                MON at stake
              </span>
            </div>

            <div className="panel mt-4 divide-y divide-edge px-6">
              {claims.map((c) => (
                <div
                  key={c.builder + c.slug}
                  className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 sm:w-64">
                    <div className="truncate font-display font-semibold text-text">
                      {c.name}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-dim">
                      <Link
                        href={`/b/${c.builder}`}
                        className="font-mono hover:text-accent"
                      >
                        {shortAddr(c.builder)}
                      </Link>
                      <span className="text-faint">·</span>
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate hover:text-accent"
                      >
                        {c.url.replace(/^https?:\/\//, "")}
                      </a>
                    </div>
                  </div>

                  <div className="flex-1">
                    <span className="rounded bg-done/15 px-2 py-1 font-mono text-xs text-done">
                      🔒 {formatEther(BigInt(c.amount))} MON
                    </span>
                  </div>

                  <div className="sm:justify-self-end">
                    <BondControls
                      builder={c.builder as Address}
                      slug={c.slug}
                      status={2}
                      owner={
                        !!address &&
                        address.toLowerCase() === c.builder.toLowerCase()
                      }
                      onChange={load}
                    />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </>
  );
}
