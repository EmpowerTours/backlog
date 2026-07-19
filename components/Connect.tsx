"use client";

import { useState } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { monad } from "@/lib/chain";
import { shortAddr } from "@/lib/format";

export function Connect() {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const [open, setOpen] = useState(false);

  if (!isConnected) {
    // de-duplicate by name (EIP-6963 can surface several injected entries)
    const seen = new Set<string>();
    const options = connectors.filter((c) => {
      if (seen.has(c.name)) return false;
      seen.add(c.name);
      return true;
    });

    // If a browser wallet extension is present, connect to it directly instead of
    // opening the picker — so desktop users hit MetaMask, not the WalletConnect QR.
    const hasBrowserWallet =
      typeof window !== "undefined" &&
      !!(window as unknown as { ethereum?: unknown }).ethereum;
    const injectedConnector =
      connectors.find((c) => /metamask/i.test(c.name)) ??
      connectors.find((c) => c.type === "injected" || c.id === "injected");

    return (
      <div className="relative">
        <button
          onClick={() => {
            if (hasBrowserWallet && injectedConnector) {
              // if the injected wallet errors (e.g. MetaMask stub present but not
              // actually installed), fall back to the picker instead of hanging
              connect(
                { connector: injectedConnector },
                { onError: () => setOpen(true) },
              );
            } else {
              setOpen((o) => !o);
            }
          }}
          disabled={isPending}
          className="rounded-lg border border-edge-bright bg-panel px-4 py-2 text-sm font-semibold text-text transition hover:border-accent hover:text-accent disabled:opacity-50"
        >
          {isPending ? "Opening wallet…" : "Connect wallet"}
        </button>
        {open && (
          <>
            <button
              aria-label="close"
              className="fixed inset-0 z-10 cursor-default"
              onClick={() => setOpen(false)}
            />
            <div className="absolute right-0 z-20 mt-2 w-60 max-w-[85vw] overflow-hidden rounded-lg border border-edge bg-panel shadow-xl">
              {options.map((c) => (
                <button
                  key={c.uid}
                  onClick={() => {
                    setOpen(false);
                    connect({ connector: c });
                  }}
                  className="block w-full px-4 py-3 text-left text-sm text-text transition hover:bg-ink-2"
                >
                  {c.name}
                </button>
              ))}
              <p className="border-t border-edge px-4 py-2.5 text-xs text-faint">
                On mobile, pick WalletConnect or Coinbase Wallet.
              </p>
            </div>
          </>
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
