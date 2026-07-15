import { NextResponse } from "next/server";
import {
  createPublicClient,
  http,
  keccak256,
  toBytes,
  zeroAddress,
  type Address,
} from "viem";
import { monad } from "@/lib/chain";
import { backlog } from "@/lib/backlog";

export const runtime = "nodejs";
export const maxDuration = 30;

// topic0 of Bonded(address indexed builder, bytes32 indexed slugHash, uint256 amount, string url)
const BONDED_TOPIC =
  "0x02ab4f559a4c90638074c492a984c86685345ba1d797a10327033fa9df3fd1b2";
const DEPLOY_BLOCK = 87995928;

interface Claim {
  builder: string;
  slug: string;
  name: string;
  percent: number;
  url: string;
  amount: string;
  challenger: string;
  challenged: boolean;
  cureDeadline: number;
}

interface Project {
  slug: string;
  name: string;
  percent: number;
}

// Public board of every live shipping bond. Discovers (builder, slugHash) pairs from Bonded logs via
// the explorer (Monad's own eth_getLogs is capped at 100 blocks), then reads authoritative current
// state on-chain and resolves slug strings so anyone can browse and challenge.
export async function GET() {
  const addr = process.env.NEXT_PUBLIC_BACKLOG_ADDRESS;
  const key = process.env.MONADSCAN_API_KEY;
  if (!addr || addr === zeroAddress) return NextResponse.json({ claims: [] });

  try {
    // 1) discover every bonded pair via the explorer logs API
    const pairs: { builder: Address; slugHash: `0x${string}` }[] = [];
    if (key) {
      const url = `https://api.etherscan.io/v2/api?chainid=143&module=logs&action=getLogs&address=${addr}&topic0=${BONDED_TOPIC}&fromBlock=${DEPLOY_BLOCK}&toBlock=latest&apikey=${key}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
      const data = (await res.json()) as {
        status: string;
        result?: { topics: string[] }[];
      };
      const seen = new Set<string>();
      for (const log of Array.isArray(data.result) ? data.result : []) {
        const builder = ("0x" + log.topics[1].slice(26)) as Address;
        const slugHash = log.topics[2] as `0x${string}`;
        const k = builder.toLowerCase() + slugHash;
        if (!seen.has(k)) {
          seen.add(k);
          pairs.push({ builder, slugHash });
        }
      }
    }

    const client = createPublicClient({ chain: monad, transport: http() });

    // 2) read current bond state + committed URL; keep only still-active bonds
    const active = (
      await Promise.all(
        pairs.map(async ({ builder, slugHash }) => {
          const [bond, url] = await Promise.all([
            client.readContract({
              ...backlog,
              functionName: "bonds",
              args: [builder, slugHash],
            }) as Promise<readonly [bigint, Address, bigint]>,
            client.readContract({
              ...backlog,
              functionName: "bondUrl",
              args: [builder, slugHash],
            }) as Promise<string>,
          ]);
          const [amount, challenger, cureDeadline] = bond;
          if (amount === BigInt(0)) return null; // resolved or withdrawn
          return {
            builder,
            slugHash,
            amount: amount.toString(),
            challenger,
            cureDeadline: Number(cureDeadline),
            url,
          };
        }),
      )
    ).filter(Boolean) as {
      builder: Address;
      slugHash: `0x${string}`;
      amount: string;
      challenger: Address;
      cureDeadline: number;
      url: string;
    }[];

    // 3) resolve slug strings + names/percent via getProjects (one read per builder)
    const builders = [...new Set(active.map((a) => a.builder))];
    const projByBuilder = new Map<string, Map<string, Project>>();
    await Promise.all(
      builders.map(async (b) => {
        const projects = (await client.readContract({
          ...backlog,
          functionName: "getProjects",
          args: [b],
        })) as unknown as Project[];
        const m = new Map<string, Project>();
        for (const p of projects) m.set(keccak256(toBytes(p.slug)), p);
        projByBuilder.set(b.toLowerCase(), m);
      }),
    );

    const claims: Claim[] = active.map((a) => {
      const p = projByBuilder.get(a.builder.toLowerCase())?.get(a.slugHash);
      return {
        builder: a.builder,
        slug: p?.slug ?? "",
        name: p?.name ?? a.slugHash.slice(0, 10),
        percent: p ? Number(p.percent) : 0,
        url: a.url,
        amount: a.amount,
        challenger: a.challenger,
        challenged: a.challenger !== zeroAddress,
        cureDeadline: a.cureDeadline,
      };
    });

    // newest/challenged first
    claims.sort((x, y) => Number(y.challenged) - Number(x.challenged));
    return NextResponse.json({ claims });
  } catch (e) {
    return NextResponse.json({ claims: [], error: (e as Error).message });
  }
}
