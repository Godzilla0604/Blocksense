import { useMemo, useState } from "react";
import type { Temporal } from "@/types/api";
import { cn, fmtShortDate } from "@/lib/utils";
import { EmptyState } from "@/components/ui/States";

type Metric = "count" | "volume";

/** Lightweight SVG heatmap: X = hour of day (UTC), Y = date (PRD §5.5). */
export function ActivityHeatmap({ data, onlyActiveDays = true }: { data: Temporal; onlyActiveDays?: boolean }) {
  const [metric, setMetric] = useState<Metric>("count");
  const [hover, setHover] = useState<{ date: string; hour: number; count: number; volume: number } | null>(null);

  const { rows, cells, max } = useMemo(() => {
    const cells = new Map<string, { count: number; volume: number }>();
    data.heatmap.forEach((c) => cells.set(`${c.date}|${c.hour}`, c));
    const active = new Set(data.heatmap.map((c) => c.date));
    const rows = onlyActiveDays ? data.dates.filter((d) => active.has(d)) : data.dates;
    const max = Math.max(...data.heatmap.map((c) => c[metric]), 1e-9);
    return { rows, cells, max };
  }, [data, metric, onlyActiveDays]);

  if (!rows.length) return <EmptyState message="No temporal activity found for this range." />;

  const cell = 18, gap = 3, left = 64, top = 22;
  const width = left + 24 * (cell + gap);
  const height = top + rows.length * (cell + gap);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex gap-2" role="group" aria-label="Heatmap metric">
          {(["count", "volume"] as const).map((m) => (
            <button key={m} className="chip" data-active={metric === m} onClick={() => setMetric(m)}>
              {m === "count" ? "Transaction count" : "BTC volume"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-secondary">
          Less
          {[0.1, 0.3, 0.55, 0.8, 1].map((o) => (
            <span key={o} className="h-3 w-3 rounded-sm" style={{ background: `rgba(34,211,238,${o})` }} />
          ))}
          More
        </div>
      </div>
      <div className="overflow-x-auto">
        <svg width={width} height={height} className="block" role="img" aria-label="Transaction activity heatmap by hour and date">
          {Array.from({ length: 24 }).map((_, h) => (
            h % 3 === 0 && (
              <text key={h} x={left + h * (cell + gap) + cell / 2} y={12} textAnchor="middle" fontSize={10} fill="#8A9BB8">
                {String(h).padStart(2, "0")}
              </text>
            )
          ))}
          {rows.map((d, r) => (
            <g key={d}>
              <text x={left - 8} y={top + r * (cell + gap) + cell / 2 + 3.5} textAnchor="end" fontSize={10} fill="#8A9BB8">
                {fmtShortDate(d)}
              </text>
              {Array.from({ length: 24 }).map((_, h) => {
                const c = cells.get(`${d}|${h}`);
                const v = c ? c[metric] : 0;
                const o = v > 0 ? 0.15 + 0.85 * Math.sqrt(v / max) : 0;
                const isHover = hover?.date === d && hover.hour === h;
                return (
                  <rect
                    key={h}
                    x={left + h * (cell + gap)} y={top + r * (cell + gap)} width={cell} height={cell} rx={3}
                    fill={v > 0 ? `rgba(34,211,238,${o})` : "#161D2E"}
                    stroke={isHover ? "#F1F5F9" : "#1E263A"} strokeWidth={isHover ? 1.5 : 1}
                    onMouseEnter={() => setHover({ date: d, hour: h, count: c?.count ?? 0, volume: c?.volume ?? 0 })}
                    onMouseLeave={() => setHover(null)}
                  />
                );
              })}
            </g>
          ))}
        </svg>
      </div>
      <p className={cn("mt-2 h-4 text-xs", hover ? "text-primary" : "text-secondary")}>
        {hover
          ? `${fmtShortDate(hover.date)}, ${String(hover.hour).padStart(2, "0")}:00–${String(hover.hour).padStart(2, "0")}:59 UTC: ${hover.count} transaction${hover.count === 1 ? "" : "s"}, ${hover.volume.toFixed(4)} BTC`
          : "Hours in UTC. Showing days with at least one transaction."}
      </p>
    </div>
  );
}
