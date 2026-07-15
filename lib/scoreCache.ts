import "server-only";
import type { Scored } from "./github";

// Short-lived server-side cache of a user's scored portfolio, keyed by GitHub login.
// The /portfolio route fills it; /attest reads it so signing doesn't re-score (and so the
// signed scores match exactly what the user just reviewed). Single-instance in-memory is
// fine here — a cache miss just re-scores.
const TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { projects: Scored[]; at: number }>();

export function setCached(login: string, projects: Scored[]): void {
  cache.set(login, { projects, at: Date.now() });
}

export function getCached(login: string): Scored[] | null {
  const e = cache.get(login);
  if (!e) return null;
  if (Date.now() - e.at > TTL_MS) {
    cache.delete(login);
    return null;
  }
  return e.projects;
}
