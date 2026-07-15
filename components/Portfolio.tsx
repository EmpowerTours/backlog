"use client";

import { useEffect, useState } from "react";
import type { Address } from "viem";
import { useReadContract } from "wagmi";
import { backlog, isConfigured, type Project } from "@/lib/backlog";
import { useTx } from "@/lib/useTx";
import { shortAddr } from "@/lib/format";
import { Vitals } from "./Vitals";
import { ProjectRow } from "./ProjectRow";
import { BadgeCard } from "./BadgeCard";

export function Portfolio({
  address,
  owner,
}: {
  address: Address;
  owner: boolean;
}) {
  const { data, isLoading, refetch } = useReadContract({
    ...backlog,
    functionName: "getProjects",
    args: [address],
    query: { enabled: isConfigured },
  });
  const prune = useTx();
  const [pruningSlug, setPruningSlug] = useState<string | null>(null);

  useEffect(() => {
    if (prune.isConfirmed) {
      refetch();
      prune.reset();
      setPruningSlug(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prune.isConfirmed]);

  const projects = (data ?? []) as Project[];
  const living = projects
    .filter((p) => p.status !== 3)
    .sort((a, b) => b.percent - a.percent);
  const dead = projects.filter((p) => p.status === 3);

  function onPrune(slug: string) {
    setPruningSlug(slug);
    prune.send({ ...backlog, functionName: "removeProject", args: [slug] });
  }

  if (!isConfigured) {
    return (
      <Notice title="Contract not set yet">
        Deploy <code className="text-text">Backlog.sol</code> and set{" "}
        <code className="text-text">NEXT_PUBLIC_BACKLOG_ADDRESS</code>.
      </Notice>
    );
  }
  if (isLoading)
    return (
      <Notice title="Reading the chain…">
        Loading {shortAddr(address)}&apos;s portfolio.
      </Notice>
    );

  if (projects.length === 0) {
    return (
      <Notice title="Nothing onchain yet">
        {owner ? (
          <>
            Use the <span className="text-text">Connect GitHub</span> card above
            to score your repos and write your portfolio onchain with this
            wallet — nothing to install, nothing to paste.
          </>
        ) : (
          <>This builder hasn&apos;t synced a portfolio yet.</>
        )}
      </Notice>
    );
  }

  return (
    <div className="space-y-6">
      <Vitals projects={projects} />

      <div className="panel px-6">
        <SectionLabel>In flight</SectionLabel>
        <div className="divide-y divide-edge">
          {living.map((p) => (
            <ProjectRow
              key={p.slug}
              p={p}
              builder={address}
              canPrune={owner}
              onPrune={onPrune}
              pruning={pruningSlug === p.slug}
              onChange={refetch}
            />
          ))}
        </div>
      </div>

      {dead.length > 0 && (
        <div className="panel px-6">
          <SectionLabel>The graveyard · {dead.length} abandoned</SectionLabel>
          <div className="divide-y divide-edge">
            {dead.map((p) => (
              <ProjectRow
                key={p.slug}
                p={p}
                builder={address}
                canPrune={owner}
                onPrune={onPrune}
                pruning={pruningSlug === p.slug}
                onChange={refetch}
              />
            ))}
          </div>
        </div>
      )}

      {prune.error && (
        <p className="text-sm text-active">
          {/rejected|denied/i.test(prune.error.message)
            ? "You rejected the transaction."
            : "Couldn't remove that one."}
        </p>
      )}

      {owner && <BadgeCard address={address} />}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-b border-edge py-3 text-xs font-semibold uppercase tracking-widest text-dim">
      {children}
    </div>
  );
}

function Notice({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="panel p-6">
      <div className="font-display font-semibold text-text">{title}</div>
      <div className="mt-1 text-sm text-dim">{children}</div>
    </div>
  );
}
