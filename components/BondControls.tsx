"use client";

import { useEffect, useState } from "react";
import {
  formatEther,
  keccak256,
  parseEther,
  toBytes,
  zeroAddress,
  type Address,
} from "viem";
import { useReadContract } from "wagmi";
import { backlog } from "@/lib/backlog";
import { useTx } from "@/lib/useTx";

const MIN_BOND = parseEther("0.1");
const ZERO = BigInt(0);

// Shipping-bond controls for a single Done project. Owner can stake "this is live" (with the URL the
// oracle will check) and withdraw; anyone else can challenge a bonded claim; after the cure window,
// anyone can resolve it with an oracle-signed liveness check.
export function BondControls({
  builder,
  slug,
  status,
  owner,
  onChange,
}: {
  builder: Address;
  slug: string;
  status: number;
  owner: boolean;
  onChange: () => void;
}) {
  const slugHash = keccak256(toBytes(slug));
  const { data, refetch } = useReadContract({
    ...backlog,
    functionName: "bonds",
    args: [builder, slugHash],
    query: { enabled: status === 2 },
  });
  const tx = useTx();
  const [showUrl, setShowUrl] = useState(false);
  const [url, setUrl] = useState("");
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    if (tx.isConfirmed) {
      refetch();
      onChange();
      tx.reset();
      setShowUrl(false);
      setUrl("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tx.isConfirmed]);

  if (status !== 2) return null; // only shipped/Done projects are bondable

  const [amount, challenger, cureDeadline] = (data as
    readonly [bigint, Address, bigint] | undefined) ?? [
    ZERO,
    zeroAddress,
    ZERO,
  ];
  const bonded = amount > ZERO;
  const challenged = challenger !== zeroAddress;
  const cureLeft = Number(cureDeadline) - Math.floor(Date.now() / 1000);
  const busy = tx.isBusy || resolving;

  function stake() {
    if (!/^https?:\/\//i.test(url)) return;
    tx.send({
      ...backlog,
      functionName: "bond",
      args: [slug, url.slice(0, 200)],
      value: MIN_BOND,
    });
  }
  function challenge() {
    tx.send({
      ...backlog,
      functionName: "challenge",
      args: [builder, slug],
      value: amount,
    });
  }
  function withdraw() {
    tx.send({ ...backlog, functionName: "withdrawBond", args: [slug] });
  }
  async function resolve() {
    setResolving(true);
    try {
      const r = await fetch("/api/oracle/liveness", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ builder, slug }),
      });
      const d = await r.json();
      if (r.ok) {
        tx.send({
          ...backlog,
          functionName: "resolve",
          args: [
            builder,
            slug,
            d.live,
            BigInt(d.observedAt),
            d.signature as `0x${string}`,
          ],
        });
      }
    } catch {
      /* ignore; button re-enables */
    } finally {
      setResolving(false);
    }
  }

  // --- challenged ---
  if (bonded && challenged) {
    const canResolve = cureLeft <= 0;
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="rounded bg-active/15 px-2 py-1 font-mono text-active">
          ⚔ challenged
        </span>
        {canResolve ? (
          <button
            onClick={resolve}
            disabled={busy}
            className="rounded border border-edge-bright px-2 py-1 font-semibold text-text transition hover:border-accent hover:text-accent disabled:opacity-40"
          >
            {resolving ? "checking…" : tx.isBusy ? "resolving…" : "resolve"}
          </button>
        ) : (
          <span className="font-mono text-faint">
            cure ends in {fmtLeft(cureLeft)}
          </span>
        )}
      </div>
    );
  }

  // --- bonded, unchallenged ---
  if (bonded) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span
          className="rounded bg-done/15 px-2 py-1 font-mono text-done"
          title="Real MON staked that this is live. Anyone can challenge it."
        >
          🔒 bonded {formatEther(amount)} MON
        </span>
        {owner ? (
          <button
            onClick={withdraw}
            disabled={busy}
            className="text-faint underline transition hover:text-text disabled:opacity-40"
          >
            withdraw
          </button>
        ) : (
          <button
            onClick={challenge}
            disabled={busy}
            className="rounded border border-edge-bright px-2 py-1 font-semibold text-text transition hover:border-active hover:text-active disabled:opacity-40"
            title="Bet it's dead. Match the bond; if the deployment is down after the cure window, you take the pot."
          >
            {tx.isBusy ? "…" : "challenge — dead?"}
          </button>
        )}
      </div>
    );
  }

  // --- not bonded: only the owner can stake ---
  if (!owner) return null;
  if (!showUrl) {
    return (
      <button
        onClick={() => setShowUrl(true)}
        className="rounded border border-edge px-2 py-1 text-xs text-dim transition hover:border-done hover:text-done"
        title="Put 0.1 MON behind this being live. Anyone can challenge; if it's dead you lose the bond."
      >
        stake it&apos;s live
      </button>
    );
  }
  return (
    <div className="flex items-center gap-2 text-xs">
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://your-live-url"
        className="w-44 rounded border border-edge bg-ink-2 px-2 py-1 font-mono text-text outline-none focus:border-accent"
      />
      <button
        onClick={stake}
        disabled={busy || !/^https?:\/\//i.test(url)}
        className="rounded bg-done px-2 py-1 font-semibold text-ink transition hover:brightness-110 disabled:opacity-40"
      >
        {tx.isBusy ? "…" : "bond 0.1"}
      </button>
      <button
        onClick={() => setShowUrl(false)}
        className="text-faint hover:text-text"
      >
        ✕
      </button>
    </div>
  );
}

function fmtLeft(secs: number): string {
  if (secs <= 0) return "0h";
  const h = Math.ceil(secs / 3600);
  if (h < 48) return `${h}h`;
  return `${Math.ceil(h / 24)}d`;
}
