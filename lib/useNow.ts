"use client";

import { useEffect, useState } from "react";

/** Current time in unix seconds, ticking every `intervalMs`. SSR-safe (starts null). */
export function useNow(intervalMs = 1000): bigint {
  const [now, setNow] = useState<bigint>(() =>
    BigInt(Math.floor(Date.now() / 1000)),
  );
  useEffect(() => {
    const id = setInterval(
      () => setNow(BigInt(Math.floor(Date.now() / 1000))),
      intervalMs,
    );
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
