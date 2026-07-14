import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { monad } from "./chain";

export const config = createConfig({
  chains: [monad],
  connectors: [injected()],
  transports: {
    [monad.id]: http("https://rpc.monad.xyz"),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
