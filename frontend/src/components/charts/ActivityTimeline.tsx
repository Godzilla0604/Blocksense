import { useMemo } from "react";
import {
  Area, Bar, CartesianGrid, ComposedChart, Legend, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { WalletTx } from "@/types/api";
import { fmtShortDate } from "@/lib/utils";
import { EmptyState } from "@/components/ui/States";

export const chartTooltip = {
  contentStyle: { background: "#111827", border: "1px solid #232B3D", borderRadius: 8, fontSize: 12 },
  labelStyle: { color: "#8A9BB8", marginBottom: 4 },
  itemStyle: { padding: 0 },
  cursor: { fill: "rgba(255,255,255,0.03)" },
};
export const axisProps = {
  stroke: "#232B3D",
  tick: { fill: "#8A9BB8", fontSize: 11 },
  tickLine: false,
};

export interface DailyWalletPoint {
  date: string; count: number; in: number; out: number; counterparties: number; spike: boolean;
}

/** Bucket a wallet's transactions by day across its active range. */
export function walletDaily(txs: WalletTx[]): DailyWalletPoint[] {
  if (!txs.length) return [];
  const byDay = new Map<string, { count: number; in: number; out: number; cps: Set<string> }>();
  for (const t of txs) {
    const d = t.timestamp.slice(0, 10);
    const b = byDay.get(d) ?? { count: 0, in: 0, out: 0, cps: new Set<string>() };
    b.count++;
    b[t.direction] += t.amount;
    b.cps.add(t.counterparty);
    byDay.set(d, b);
  }
  const days = [...byDay.keys()].sort();
  const start = new Date(days[0] + "T00:00:00Z");
  const end = new Date(days[days.length - 1] + "T00:00:00Z");
  start.setUTCDate(start.getUTCDate() - 1);
  end.setUTCDate(end.getUTCDate() + 1);
  const seen = new Set<string>();
  const out: DailyWalletPoint[] = [];
  const counts = [...byDay.values()].map((b) => b.count);
  const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    const b = byDay.get(key);
    b?.cps.forEach((c) => seen.add(c));
    out.push({
      date: key,
      count: b?.count ?? 0,
      in: +(b?.in ?? 0).toFixed(6),
      out: +(b?.out ?? 0).toFixed(6),
      counterparties: seen.size,
      spike: !!b && b.count >= Math.max(3, mean * 2),
    });
  }
  return out;
}

export function ActivityTimeline({ txs, height = 240 }: { txs: WalletTx[]; height?: number }) {
  const data = useMemo(() => walletDaily(txs), [txs]);
  if (!data.length) return <EmptyState message="No transactions found." />;
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 16, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid stroke="#232B3D" strokeDasharray="2 4" vertical={false} />
          <XAxis dataKey="date" tickFormatter={fmtShortDate} {...axisProps} minTickGap={24} />
          <YAxis yAxisId="btc" {...axisProps} width={48} />
          <YAxis yAxisId="n" orientation="right" allowDecimals={false} {...axisProps} width={28} />
          <Tooltip {...chartTooltip} labelFormatter={(l) => fmtShortDate(String(l))} />
          <Legend wrapperStyle={{ fontSize: 11, color: "#8A9BB8" }} iconType="circle" iconSize={7} />
          <Area yAxisId="btc" type="stepAfter" dataKey="in" name="Incoming BTC" stroke="#22D3EE" fill="#22D3EE" fillOpacity={0.15} strokeWidth={1.5} isAnimationActive={false} />
          <Area yAxisId="btc" type="stepAfter" dataKey="out" name="Outgoing BTC" stroke="#A78BFA" fill="#A78BFA" fillOpacity={0.12} strokeWidth={1.5} isAnimationActive={false} />
          <Bar yAxisId="n" dataKey="count" name="Transactions" fill="#8A9BB8" fillOpacity={0.45} barSize={6} radius={[2, 2, 0, 0]} isAnimationActive={false} />
          {data.filter((d) => d.spike).map((d) => (
            <ReferenceDot key={d.date} yAxisId="n" x={d.date} y={d.count} r={5} fill="none" stroke="#F1F5F9" strokeWidth={1.5}
              label={{ value: "spike", position: "top", fill: "#F1F5F9", fontSize: 10 }} />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
