"use client";

import { useState } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { injected } from "wagmi/connectors";
import { monad } from "@/lib/chain";
import { shortAddr } from "@/lib/format";

export function Connect() {
  const { address, isConnected, chainId } = useAccount();
  const { connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const [hint, setHint] = useState<string | null>(null);

  if (!isConnected) {
    const onClick = () => {
      const hasWallet = typeof window !== "undefined" && "ethereum" in window;
      if (!hasWallet) {
        setHint(
          "No browser wallet detected. On mobile, open this page inside your wallet app's browser (MetaMask, Rainbow, Coinbase Wallet). On desktop, install the MetaMask extension.",
        );
        return;
      }
      setHint(null);
      connect({ connector: injected() });
    };
    return (
      <div className="relative">
        <button
          onClick={onClick}
          disabled={isPending}
          className="rounded-lg border border-edge-bright bg-panel px-4 py-2 text-sm font-semibold text-text transition hover:border-accent hover:text-accent disabled:opacity-50"
        >
          {isPending ? "Opening wallet…" : "Connect wallet"}
        </button>
        {hint && (
          <p className="absolute right-0 z-10 mt-2 w-72 max-w-[80vw] rounded-lg border border-edge bg-panel p-3 text-xs text-dim shadow-lg">
            {hint}
          </p>
        )}
      </div>
    );
  }

  const wrongChain = chainId !== monad.id;

  return (
    <div className="flex items-center gap-2">
      {wrongChain && (
        <button
          onClick={() => switchChain({ chainId: monad.id })}
          className="rounded-lg border border-active bg-active/10 px-3 py-2 text-sm font-semibold text-active"
        >
          Switch to Monad
        </button>
      )}
      <button
        onClick={() => disconnect()}
        className="rounded-lg border border-edge bg-panel px-3 py-2 font-mono text-sm text-dim transition hover:text-text"
        title="Disconnect"
      >
        {shortAddr(address)}
      </button>
    </div>
  );
}
