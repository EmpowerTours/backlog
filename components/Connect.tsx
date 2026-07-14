"use client";

import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { injected } from "wagmi/connectors";
import { monad } from "@/lib/chain";
import { shortAddr } from "@/lib/format";

export function Connect() {
  const { address, isConnected, chainId } = useAccount();
  const { connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  if (!isConnected) {
    return (
      <button
        onClick={() => connect({ connector: injected() })}
        disabled={isPending}
        className="rounded-lg border border-edge-bright bg-panel px-4 py-2 text-sm font-semibold text-text transition hover:border-dawn hover:text-dawn disabled:opacity-50"
      >
        {isPending ? "Opening wallet…" : "Connect wallet"}
      </button>
    );
  }

  const wrongChain = chainId !== monad.id;

  return (
    <div className="flex items-center gap-2">
      {wrongChain && (
        <button
          onClick={() => switchChain({ chainId: monad.id })}
          className="rounded-lg border border-led bg-led/10 px-3 py-2 text-sm font-semibold text-led"
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
