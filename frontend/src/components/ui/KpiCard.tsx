import type { ReactNode } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

export function KpiCard({ label, value, sub, spark, sparkColor = "#22D3EE", emphasis, className }: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  spark?: number[];
  sparkColor?: string;
  emphasis?: "high";
  className?: string;
}) {
  return (
    <div
      className={cn("card relative flex min-w-[180px] flex-col justify-between overflow-hidden", className)}
      style={emphasis === "high" ? { borderTop: "1px solid rgba(244,63,94,0.6)" } : undefined}
    >
      <div className="label">{label}</div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="text-3xl font-semibold tabular-nums leading-tight">{value}</div>
          {sub && <div className="mt-1 text-xs text-secondary">{sub}</div>}
        </div>
        {spark && spark.length > 1 && (
          <div className="h-10 w-24 shrink-0" aria-hidden>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={spark.map((v, i) => ({ i, v }))} margin={{ top: 2, bottom: 2, left: 0, right: 0 }}>
                <defs>
                  <linearGradient id={`sp-${label.replace(/\W/g, "")}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={sparkColor} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={sparkColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="v" stroke={sparkColor} strokeWidth={1.5}
                  fill={`url(#sp-${label.replace(/\W/g, "")})`} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

export function KpiSkeleton() {
  return (
    <div className="card min-w-[180px]">
      <div className="skeleton h-3 w-24" />
      <div className="skeleton mt-4 h-8 w-20" />
    </div>
  );
}
