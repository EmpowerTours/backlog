import { formatEther, type Address } from "viem";

export function shortAddr(a?: string): string {
  if (!a) return "";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

/** Trim trailing zeros from a MON amount for display. */
export function fmtMon(wei: bigint): string {
  const s = formatEther(wei);
  return s.includes(".") ? s.replace(/\.?0+$/, "") : s;
}

/** Seconds -> H:MM:SS or M:SS (no hours if under an hour). */
export function clockString(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

/** Unix seconds -> local wall-clock time, e.g. "7:00 AM". */
export function wallTime(unixSeconds: bigint): string {
  return new Date(Number(unixSeconds) * 1000).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Unix seconds -> "Mon, Jul 14 · 7:00 AM". */
export function wallDateTime(unixSeconds: bigint): string {
  return new Date(Number(unixSeconds) * 1000).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function isAddress(v: string): v is Address {
  return /^0x[a-fA-F0-9]{40}$/.test(v);
}
