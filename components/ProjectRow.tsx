"use client";

import { type Project, STATUS_META, barColor, agoDays } from "@/lib/backlog";

export function ProjectRow({
  p,
  canPrune,
  onPrune,
  pruning,
}: {
  p: Project;
  canPrune: boolean;
  onPrune: (slug: string) => void;
  pruning: boolean;
}) {
  const meta = STATUS_META[p.status] ?? STATUS_META[0];
  const dead = p.status === 3;

  return (
    <div
      className={`flex flex-col gap-3 py-4 sm:flex-row sm:items-center ${dead ? "tomb" : ""}`}
    >
      <div className="flex min-w-0 items-start gap-3 sm:w-64">
        <span
          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${meta.dot}`}
          aria-hidden
        />
        <div className="min-w-0">
          <div className="proj-name truncate font-display font-semibold text-text">
            {p.name}
          </div>
          {p.note && <div className="truncate text-sm text-dim">{p.note}</div>}
        </div>
      </div>

      <div className="flex flex-1 items-center gap-4">
        <div className="bar flex-1">
          <span
            style={{ width: `${p.percent}%`, background: barColor(p.status) }}
          />
        </div>
        <span className="w-12 shrink-0 text-right font-mono text-sm text-text">
          {p.percent}%
        </span>
      </div>

      <div className="flex items-center justify-between gap-3 sm:w-40 sm:justify-end">
        <div className="text-right">
          <div
            className={`font-mono text-xs uppercase tracking-wide ${meta.color}`}
          >
            {meta.label}
          </div>
          <div className="font-mono text-xs text-faint">
            {agoDays(p.updatedAt)}
          </div>
        </div>
        {canPrune && dead && (
          <button
            onClick={() => onPrune(p.slug)}
            disabled={pruning}
            title="Remove this dead project from your onchain portfolio"
            className="rounded-md border border-edge px-2 py-1 text-xs text-dim transition hover:border-abandoned hover:text-text disabled:opacity-40"
          >
            {pruning ? "…" : "bury"}
          </button>
        )}
      </div>
    </div>
  );
}
