import type { Address } from "viem";
import { backlogAbi } from "./abi";

/** Backlog contract on Monad mainnet. Set after deploy via NEXT_PUBLIC_BACKLOG_ADDRESS. */
export const BACKLOG_ADDRESS = (process.env.NEXT_PUBLIC_BACKLOG_ADDRESS ??
  "0x0000000000000000000000000000000000000000") as Address;

export const backlog = { address: BACKLOG_ADDRESS, abi: backlogAbi } as const;

export const isConfigured =
  BACKLOG_ADDRESS !== "0x0000000000000000000000000000000000000000";

export const Status = {
  Active: 0,
  Polishing: 1,
  Done: 2,
  Abandoned: 3,
} as const;
export type StatusValue = (typeof Status)[keyof typeof Status];

export interface Project {
  slug: string;
  name: string;
  percent: number;
  status: number;
  note: string;
  updatedAt: bigint;
}

export const STATUS_META: Record<
  number,
  { label: string; color: string; dot: string }
> = {
  0: { label: "Active", color: "text-active", dot: "bg-active" },
  1: { label: "Polishing", color: "text-polishing", dot: "bg-polishing" },
  2: { label: "Done", color: "text-done", dot: "bg-done" },
  3: { label: "Abandoned", color: "text-abandoned", dot: "bg-abandoned" },
};

export function barColor(status: number): string {
  return (
    {
      0: "var(--color-active)",
      1: "var(--color-polishing)",
      2: "var(--color-done)",
      3: "var(--color-abandoned)",
    }[status] ?? "var(--color-dim)"
  );
}

export function agoDays(updatedAt: bigint): string {
  if (!updatedAt) return "";
  const d = Math.floor((Date.now() / 1000 - Number(updatedAt)) / 86400);
  if (d <= 0) return "today";
  if (d === 1) return "1 day ago";
  if (d < 30) return `${d} days ago`;
  const m = Math.floor(d / 30);
  return m === 1 ? "1 month ago" : `${m} months ago`;
}

/** Portfolio roll-up for the vitals header. */
export function vitals(projects: Project[]) {
  const n = projects.length;
  const byStatus = { active: 0, polishing: 0, done: 0, abandoned: 0 };
  let sum = 0;
  for (const p of projects) {
    sum += p.percent;
    if (p.status === 0) byStatus.active++;
    else if (p.status === 1) byStatus.polishing++;
    else if (p.status === 2) byStatus.done++;
    else if (p.status === 3) byStatus.abandoned++;
  }
  return { n, avg: n ? Math.round(sum / n) : 0, ...byStatus };
}
