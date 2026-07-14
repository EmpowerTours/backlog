import { defineChain } from "viem";

/** Monad mainnet — chainid 143. */
export const monad = defineChain({
  id: 143,
  name: "Monad",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.monad.xyz"] },
  },
  blockExplorers: {
    default: { name: "MonadScan", url: "https://monadscan.com" },
  },
});

export const explorerTx = (hash: string) =>
  `${monad.blockExplorers.default.url}/tx/${hash}`;
export const explorerAddress = (addr: string) =>
  `${monad.blockExplorers.default.url}/address/${addr}`;
