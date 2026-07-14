"use client";

import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";

/** Thin wrapper around write + receipt-wait with a single status surface. */
export function useTx() {
  const {
    writeContract,
    data: hash,
    isPending,
    error,
    reset,
  } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash,
    });

  return {
    send: writeContract,
    hash,
    isPending, // waiting for wallet signature
    isConfirming, // tx in mempool, waiting for receipt
    isConfirmed,
    isBusy: isPending || isConfirming,
    error,
    reset,
  };
}
