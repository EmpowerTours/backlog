import { createPublicClient, http, type Address } from "viem";
import { monad } from "./chain";
import { backlog, type Project } from "./backlog";

/** Server-side read of an address's onchain portfolio (for OG images / metadata). */
export async function readPortfolio(address: Address): Promise<Project[]> {
  const client = createPublicClient({ chain: monad, transport: http() });
  const data = await client.readContract({
    ...backlog,
    functionName: "getProjects",
    args: [address],
  });
  return data as unknown as Project[];
}
