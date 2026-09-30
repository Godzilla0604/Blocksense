import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useTemporal, useWallet, useWalletTransactions, useWallets } from "@/hooks/queries";
import { useSelection } from "@/hooks/useSelection";
import { fmtShortDate } from "@/lib/utils";
import { ActivityHeatmap } from "@/components/charts/ActivityHeatmap";
import { RiskActivityTimeline } from "@/components/charts/RiskActivityTimeline";
import { ActivityTimeline, axisProps, chartTooltip, walletDaily } from "@/components/charts/ActivityTimeline";
import { Segmented } from "@/components/graph/GraphControls";
import { Address } from "@/components/ui/Address";
import { RiskPill } from "@/components/ui/RiskPill";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { KpiCard } from "@/components/ui/KpiCard";

function SelectedWalletTemporal() {
  const { selected, select } = useSelection();
  const wallets = useWallets();
  const id = selected ?? wallets.data?.[0]?.id ?? null;
  const w = useWallet(id);
  const txs = useWalletTransactions(id);
  const daily = useMemo(() => walletDaily(txs.data ?? []), [txs.data]);
  const bursts = daily.filter((d) => d.spike);

  return (
    <section className="card">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-medium">Selected wallet</h2>
          {w.data && (
            <div className="mt-1 flex items-center gap-3">
              <Address value={w.data.id} head={12} tail={8} className="text-xs" />
              <RiskPill risk={w.data.risk_category} size="sm" />
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={id ?? ""}
            onChange={(e) => select(e.target.value)}
            aria-label="Choose wallet"
            className="h-8 max-w-[260px] rounded-lg border border-subtle bg-base px-2 font-mono text-xs focus:border-accent/60 focus:outline-none"
          >
            {wallets.data?.map((x) => <option key={x.id} value={x.id}>{x.id.slice(0, 10)}…{x.id.slice(-6)} ({x.risk_category})</option>)}
          </select>
          {id && <Link to={`/entity/${id}`} className="text-xs text-accent hover:underline">Investigate</Link>}
        </div>
      </div>
      {txs.isError ? <ErrorState error={txs.error} onRetry={() => txs.refetch()} /> : txs.isLoading ? <div className="skeleton h-64" /> : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div>
            <div className="mb-1 text-xs text-secondary">Transaction count, incoming and outgoing BTC</div>
            <ActivityTimeline txs={txs.data ?? []} height={250} />
          </div>
          <div className="flex flex-col gap-4">
            <div>
              <div className="mb-1 text-xs text-secondary">Counterparty growth (cumulative unique)</div>
              {daily.length ? (
                <div className="h-32">
                  <ResponsiveContainer>
                    <LineChart data={daily} margin={{ top: 6, right: 6, bottom: 0, left: -24 }}>
                      <CartesianGrid stroke="#232B3D" strokeDasharray="2 4" vertical={false} />
                      <XAxis dataKey="date" tickFormatter={fmtShortDate} {...axisProps} minTickGap={30} />
                      <YAxis allowDecimals={false} {...axisProps} width={40} />
                      <Tooltip {...chartTooltip} labelFormatter={(l) => fmtShortDate(String(l))} />
                      <Line type="stepAfter" dataKey="counterparties" name="Counterparties" stroke="#22D3EE" strokeWidth={1.8} dot={false} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : <EmptyState message="No temporal activity found for this range." className="py-6" />}
            </div>
            <KpiCard
              label="Activity bursts"
              value={bursts.length}
              sub={bursts.length ? `Busiest: ${fmtShortDate([...bursts].sort((a, b) => b.count - a.count)[0].date)}` : "No day with ≥3 tx and ≥2× the wallet's daily mean"}
            />
            {w.data && (
              <KpiCard
                label="Busiest 3-day window"
                value={`${Math.round(w.data.metrics.burst_ratio * 100)}%`}
                sub="of this wallet's lifetime BTC volume"
              />
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export default function TemporalAnalysis() {
  const t = useTemporal();
  const [metric, setMetric] = useState<"count" | "volume">("count");
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold">Temporal Analysis</h1>
        <p className="mt-1 max-w-2xl text-sm text-secondary">
          Highlights periods of concentrated transaction activity and behavioural changes across the monitored network.
        </p>
      </header>

      {t.isError ? <ErrorState error={t.error} onRetry={() => t.refetch()} title="Couldn't load temporal data" /> : (
        <>
          <section className="card">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="text-base font-medium">Transaction Activity by Risk Level</h2>
              <Segmented label="Metric" value={metric} onChange={setMetric}
                options={[{ value: "count", label: "Transactions" }, { value: "volume", label: "BTC volume" }]} />
            </div>
            {t.data ? <RiskActivityTimeline data={t.data} metric={metric} /> : <div className="skeleton h-64" />}
            <p className="mt-2 text-[11px] text-secondary">Each transaction takes the risk level of its higher-risk wallet.</p>
          </section>

          <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[auto_minmax(0,1fr)]">
            <section className="card min-w-0">
              <h2 className="mb-4 text-base font-medium">Activity heatmap</h2>
              {t.data ? <ActivityHeatmap data={t.data} /> : <div className="skeleton h-96" />}
            </section>
            <SelectedWalletTemporal />
          </div>
        </>
      )}
    </div>
  );
}
