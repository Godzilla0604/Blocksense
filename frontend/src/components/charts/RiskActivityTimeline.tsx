import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Temporal } from "@/types/api";
import { RISK_COLOR, fmtShortDate } from "@/lib/utils";
import { axisProps, chartTooltip } from "./ActivityTimeline";

/** "Transaction Activity by Risk Level" — each tx takes its higher-risk endpoint's category. */
export function RiskActivityTimeline({ data, metric = "count", height = 260 }: {
  data: Temporal; metric?: "count" | "volume"; height?: number;
}) {
  const suffix = metric === "volume" ? "_volume" : "";
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer>
        <BarChart data={data.risk_timeline} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid stroke="#232B3D" strokeDasharray="2 4" vertical={false} />
          <XAxis dataKey="date" tickFormatter={fmtShortDate} {...axisProps} minTickGap={28} />
          <YAxis {...axisProps} width={44} allowDecimals={metric === "volume"} />
          <Tooltip {...chartTooltip} labelFormatter={(l) => fmtShortDate(String(l))} />
          <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={7} />
          {(["Low", "Medium", "High"] as const).map((r) => (
            <Bar key={r} dataKey={`${r}${suffix}`} name={`${r} risk`} stackId="risk" fill={RISK_COLOR[r]}
              fillOpacity={0.85} isAnimationActive={false} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
