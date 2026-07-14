"use client";

import { type Project, vitals } from "@/lib/backlog";

function Stat({
  n,
  label,
  color,
}: {
  n: number;
  label: string;
  color: string;
}) {
  return (
    <div>
      <div className={`font-mono text-2xl font-bold ${color}`}>{n}</div>
      <div className="text-xs uppercase tracking-wide text-dim">{label}</div>
    </div>
  );
}

export function Vitals({ projects }: { projects: Project[] }) {
  const v = vitals(projects);
  const seg = (n: number) => (v.n ? `${(n / v.n) * 100}%` : "0%");

  return (
    <div className="panel p-6">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="text-xs uppercase tracking-widest text-dim">
            Portfolio
          </div>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="font-mono text-5xl font-bold text-text">
              {v.avg}%
            </span>
            <span className="text-dim">
              avg completion across {v.n} projects
            </span>
          </div>
        </div>
        <div className="flex gap-6">
          <Stat n={v.done} label="Shipped" color="text-done" />
          <Stat n={v.polishing} label="Polishing" color="text-polishing" />
          <Stat n={v.active} label="Active" color="text-active" />
          <Stat n={v.abandoned} label="Dead" color="text-abandoned" />
        </div>
      </div>

      {/* honest mix bar */}
      <div className="mt-5 flex h-2.5 w-full overflow-hidden rounded-full bg-edge">
        <span className="bg-done" style={{ width: seg(v.done) }} />
        <span className="bg-polishing" style={{ width: seg(v.polishing) }} />
        <span className="bg-active" style={{ width: seg(v.active) }} />
        <span className="bg-abandoned" style={{ width: seg(v.abandoned) }} />
      </div>
    </div>
  );
}
