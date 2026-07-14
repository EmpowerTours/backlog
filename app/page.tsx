"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { Header } from "@/components/Header";
import { Portfolio } from "@/components/Portfolio";
import { GithubSync } from "@/components/GithubSync";
import { Connect } from "@/components/Connect";

export default function Home() {
  const { address, isConnected } = useAccount();
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <>
      <Header />
      <main className="mx-auto max-w-4xl px-5 pb-24">
        {isConnected && address ? (
          <div className="space-y-6 pt-4">
            <GithubSync onWritten={() => setRefreshKey((k) => k + 1)} />
            <Portfolio key={refreshKey} address={address} owner />
          </div>
        ) : (
          <div className="space-y-10">
            <Hero />
            <GithubSync onWritten={() => setRefreshKey((k) => k + 1)} />
          </div>
        )}
      </main>
    </>
  );
}

function Hero() {
  return (
    <div className="pt-10 sm:pt-14">
      <h1 className="max-w-2xl font-display text-4xl font-extrabold leading-tight tracking-tight text-text sm:text-5xl">
        Every project you&apos;ve started, in one honest ledger.
      </h1>
      <p className="mt-5 max-w-xl text-lg text-dim">
        Connect GitHub and an AI scores how done each repo really is — free, on
        your own GitHub Models quota. Sign one transaction and your portfolio
        lives onchain on Monad. What&apos;s shipped, what&apos;s left, and what
        quietly died.
      </p>
      <p className="mt-4 max-w-xl text-sm text-faint">
        Power move: the <code className="text-dim">backlog sync</code> CLI also
        reads your local Claude Code sessions to score work that never hit a
        commit.
      </p>
    </div>
  );
}
