import "server-only";
import {
  encodeAbiParameters,
  keccak256,
  toBytes,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

// Monad mainnet. The digests below MUST match Backlog.sol byte-for-byte.
const CHAIN_ID = BigInt(143);

function contractAddr(): Address {
  const a = process.env.NEXT_PUBLIC_BACKLOG_ADDRESS as Address | undefined;
  if (!a || a === "0x0000000000000000000000000000000000000000")
    throw new Error("NEXT_PUBLIC_BACKLOG_ADDRESS is not set");
  return a;
}

function scorer() {
  const raw = process.env.SCORER_PRIVATE_KEY;
  if (!raw) throw new Error("SCORER_PRIVATE_KEY is not set");
  const pk = (raw.startsWith("0x") ? raw : `0x${raw}`) as Hex;
  return privateKeyToAccount(pk);
}

export function scorerAddress(): Address {
  return scorer().address;
}

export interface CanonRow {
  slug: string;
  name: string;
  percent: number;
  status: number; // 0..3
  note: string;
}

/**
 * Sign the exact calldata for batchUpsert so the contract will accept this owner's write.
 * Mirrors: keccak256(abi.encode(chainid, this, owner, deadline, slugs, names, percents, statuses, notes)).
 */
export async function signScores(
  owner: Address,
  rows: CanonRow[],
  deadline: number,
) {
  const slugs = rows.map((r) => r.slug);
  const names = rows.map((r) => r.name);
  const percents = rows.map((r) => r.percent);
  const statuses = rows.map((r) => r.status);
  const notes = rows.map((r) => r.note);

  const digest = keccak256(
    encodeAbiParameters(
      [
        { type: "uint256" },
        { type: "address" },
        { type: "address" },
        { type: "uint64" },
        { type: "string[]" },
        { type: "string[]" },
        { type: "uint8[]" },
        { type: "uint8[]" },
        { type: "string[]" },
      ],
      [
        CHAIN_ID,
        contractAddr(),
        owner,
        BigInt(deadline),
        slugs,
        names,
        percents,
        statuses,
        notes,
      ],
    ),
  );
  const signature = await scorer().signMessage({ message: { raw: digest } });
  return { slugs, names, percents, statuses, notes, deadline, signature };
}

/**
 * Sign a liveness observation for a bonded claim, used to `resolve` a challenge.
 * Mirrors: keccak256(abi.encode(chainid, this, keccak256("LIVENESS"), builder, slugHash, live, observedAt)).
 */
export async function signLiveness(
  builder: Address,
  slug: string,
  live: boolean,
  observedAt: number,
) {
  const tag = keccak256(toBytes("LIVENESS"));
  const slugHash = keccak256(toBytes(slug));
  const digest = keccak256(
    encodeAbiParameters(
      [
        { type: "uint256" },
        { type: "address" },
        { type: "bytes32" },
        { type: "address" },
        { type: "bytes32" },
        { type: "bool" },
        { type: "uint64" },
      ],
      [
        CHAIN_ID,
        contractAddr(),
        tag,
        builder,
        slugHash,
        live,
        BigInt(observedAt),
      ],
    ),
  );
  const signature = await scorer().signMessage({ message: { raw: digest } });
  return { builder, slug, live, observedAt, signature };
}
