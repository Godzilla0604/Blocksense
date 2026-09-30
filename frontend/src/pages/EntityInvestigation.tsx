import { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight, Network, ReceiptText } from "lucide-react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useSummary, useWallet, useWalletNetwork, useWalletTransactions, useWallets } from "@/hooks/queries";
import { useSelection } from "@/hooks/useSelection";
import type { WalletDetail, WalletTx } from "@/types/api";
import { CYAN, RISK_COLOR, VIOLET, fmtBtc, fmtDate, fmtDateTime } from "@/lib/utils";
import { Address } from "@/components/ui/Address";
import { RiskGauge } from "@/components/ui/RiskGauge";
import { RiskPill } from "@/components/ui/RiskPill";
import { KpiCard, KpiSkeleton } from "@/components/ui/KpiCard";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { ActivityTimeline, chartTooltip } from "@/components/charts/ActivityTimeline";
import { TransactionGraph } from "@/components/graph/TransactionGraph";
import { Segmented } from "@/components/graph/GraphControls";
import { ScorePair } from "@/components/panels/ScorePair";
import { WhyFlagged } from "@/components/panels/WhyFlagged";

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
}

function Section({ id, title, aside, children, className }: {
  id?: string; title: string; aside?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <section id={id} className={`card scroll-mt-24 ${className ?? ""}`}>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-base font-medium">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

const TX_COLUMNS: Column<WalletTx>[] = [
  { key: "tx_id", header: "Transaction", render: (t) => <span className="font-mono text-xs">{t.tx_id}</span> },
  { key: "timestamp", header: "Time", className: "whitespace-nowrap text-secondary", render: (t) => fmtDateTime(t.timestamp) },
  {
    key: "direction", header: "Direction",
    render: (t) => t.direction === "in"
      ? <span className="inline-flex items-center gap-1 text-accent"><ArrowDownLeft className="h-3.5 w-3.5" /> In</span>
      : <span className="inline-flex items-center gap-1 text-accent-secondary"><ArrowUpRight className="h-3.5 w-3.5" /> Out</span>,
  },
  { key: "counterparty", header: "Counterparty", render: (t) => <Address value={t.counterparty} head={10} tail={6} className="text-xs" /> },
  { key: "amount", header: "Amount", className: "text-right tabular-nums whitespace-nowrap", headerClassName: "text-right", render: (t) => fmtBtc(t.amount, 4) },
];

function RiskBreakdown({ w }: { w: WalletDetail }) {
  const data = (["behavioural", "temporal", "network"] as const).map((g) => ({
    name: g[0].toUpperCase() + g.slice(1),
    weight: Math.round(w.component_scores[g].weight * 100),
    score: w.component_scores[g].score,
    contribution: +(w.component_scores[g].score * w.component_scores[g].weight).toFixed(1),
  }));
  return (
    <div>
      <div className="h-32">
        <ResponsiveContainer>
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 8 }}>
            <XAxis type="number" domain={[0, 100]} hide />
            <YAxis type="category" dataKey="name" width={84} tick={{ fill: "#8A9BB8", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip {...chartTooltip} formatter={(v: number, _n, p) => [`${v.toFixed(1)} (weight ${p.payload.weight}%)`, "Component score"]} />
            <Bar dataKey="score" barSize={10} radius={[0, 4, 4, 0]} background={{ fill: "#232B3D", radius: 4 }} isAnimationActive={false}>
              {data.map((d) => <Cell key={d.name} fill={CYAN} fillOpacity={0.35 + d.weight / 100} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px] text-secondary">
        {data.map((d) => (
          <div key={d.name} className="rounded-md border border-subtle py-1.5">
            <dt>{d.name} {d.weight}%</dt>
            <dd className="text-sm font-medium tabular-nums text-primary">{d.score.toFixed(0)}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-[11px] leading-relaxed text-secondary">
        Isolation Forest anomaly {w.model.anomaly_score.toFixed(0)}, typology signal {w.model.typology_score.toFixed(0)}. The base score blends both, then rescales to 0–100 across the network.
      </p>
    </div>
  );
}

function Counterparties({ w, onOpen }: { w: WalletDetail; onOpen: (id: string) => void }) {
  const m = w.metrics;
  const total = m.in_volume + m.out_volume || 1;
  if (!w.top_counterparties.length) return <EmptyState message="No counterparties found." />;
  return (
    <div>
      <div className="mb-1 flex justify-between text-[11px] text-secondary">
        <span className="text-accent">In {fmtBtc(m.in_volume, 3)}</span>
        <span className="text-accent-secondary">Out {fmtBtc(m.out_volume, 3)}</span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-subtle" aria-label="Incoming vs outgoing volume">
        <div style={{ width: `${(m.in_volume / total) * 100}%`, background: CYAN }} />
        <div style={{ width: `${(m.out_volume / total) * 100}%`, background: VIOLET }} />
      </div>
      <ul className="mt-4 divide-y divide-subtle">
        {w.top_counterparties.slice(0, 6).map((c) => (
          <li key={c.wallet}>
            <button onClick={() => onOpen(c.wallet)} className="flex w-full items-center justify-between gap-3 py-2 text-left hover:text-accent">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: RISK_COLOR[c.risk_category] }} title={`${c.risk_category} risk`} />
                <Address value={c.wallet} head={8} tail={5} className="text-xs" />
              </span>
              <span className="text-right text-[11px] tabular-nums text-secondary">
                {c.in_volume > 0 && <span className="text-accent">+{c.in_volume.toFixed(3)}</span>}
                {c.in_volume > 0 && c.out_volume > 0 && " "}
                {c.out_volume > 0 && <span className="text-accent-secondary">−{c.out_volume.toFixed(3)}</span>}
                <span className="ml-2">{c.tx_count} tx</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EntityView({ walletId }: { walletId: string }) {
  const reduce = useReducedMotion();
  const navigate = useNavigate();
  const location = useLocation();
  const { select } = useSelection();
  const summary = useSummary();
  const w = useWallet(walletId);
  const txs = useWalletTransactions(walletId);
  const [depth, setDepth] = useState<"1" | "2">("1");
  const net = useWalletNetwork(walletId, depth === "2" ? 2 : 1);

  useEffect(() => { select(walletId); }, [walletId, select]);
  useEffect(() => {
    if (location.hash && w.data) setTimeout(() => scrollToId(location.hash.slice(1)), 60);
  }, [location.hash, w.data]);

  const sortedTx = useMemo(() => [...(txs.data ?? [])].sort((a, b) => b.timestamp.localeCompare(a.timestamp)), [txs.data]);
  const open = (id: string) => navigate(`/entity/${id}`);

  if (w.isError) return <ErrorState error={w.error} onRetry={() => w.refetch()} title="Couldn't load this wallet" />;
  const d = w.data;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={walletId}
        initial={{ opacity: 0, y: reduce ? 0 : 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]"
      >
        {/* Main column */}
        <div className="flex min-w-0 flex-col gap-6">
          <section className="panel p-5">
            {!d ? (
              <div className="flex items-center gap-6"><div className="skeleton h-[148px] w-[148px] rounded-full" /><div className="flex-1 space-y-3"><div className="skeleton h-5 w-3/4" /><div className="skeleton h-6 w-28" /><div className="skeleton h-10 w-60" /></div></div>
            ) : (
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                <RiskGauge score={d.propagated_score} />
                <div className="min-w-0 flex-1 space-y-3">
                  <div>
                    <div className="text-xs text-secondary">Wallet under investigation</div>
                    <Address value={d.id} full className="text-base" />
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <RiskPill risk={d.risk_category} />
                    {d.flagged && <span className="text-xs text-secondary">Flagged for anomalous behaviour. Requires further investigation.</span>}
                  </div>
                  <ScorePair base={d.base_score} propagated={d.propagated_score} />
                </div>
                <div className="flex shrink-0 flex-row gap-2 sm:flex-col">
                  <Button size="sm" onClick={() => scrollToId("transactions")}><ReceiptText className="h-3.5 w-3.5" /> View transactions</Button>
                  <Button size="sm" onClick={() => scrollToId("network")}><Network className="h-3.5 w-3.5" /> View network</Button>
                </div>
              </div>
            )}
          </section>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {!d ? Array.from({ length: 8 }).map((_, i) => <KpiSkeleton key={i} />) : (
              <>
                <KpiCard label="Total transactions" value={d.metrics.tx_count} sub={`${d.metrics.in_tx} in, ${d.metrics.out_tx} out`} />
                <KpiCard label="Total BTC" value={d.metrics.total_volume.toFixed(3)} sub="BTC moved" />
                <KpiCard label="Unique counterparties" value={d.metrics.counterparties} />
                <KpiCard label="Network degree" value={d.metrics.degree} sub={`PageRank ${d.metrics.pagerank.toFixed(3)}`} />
                <KpiCard label="Incoming volume" value={<span className="text-accent">{d.metrics.in_volume.toFixed(3)}</span>} sub="BTC" />
                <KpiCard label="Outgoing volume" value={<span className="text-accent-secondary">{d.metrics.out_volume.toFixed(3)}</span>} sub="BTC" />
                <KpiCard label="Last activity" value={<span className="text-xl">{fmtDate(d.metrics.last_activity)}</span>} sub={`Active ${d.metrics.activity_span_days.toFixed(0)} days`} />
                <KpiCard label="Network cluster" value={d.cluster >= 0 ? `#${d.cluster + 1}` : "None"} sub={d.cluster >= 0 ? "Connected flagged group" : "Not in a flagged group"} />
              </>
            )}
          </div>

          <Section title="Activity timeline" aside={<span className="text-[11px] text-secondary">Daily, UTC</span>}>
            {txs.isLoading ? <div className="skeleton h-60" /> : txs.isError
              ? <ErrorState error={txs.error} onRetry={() => txs.refetch()} />
              : <ActivityTimeline txs={txs.data ?? []} />}
          </Section>

          <Section title="Risk signals">
            {!d ? <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-12" />)}</div>
              : <WhyFlagged explanations={d.explanations} risk={d.risk_category} />}
          </Section>

          <Section id="transactions" title="Transaction history" aside={<span className="text-[11px] text-secondary">{sortedTx.length} transactions</span>}>
            {txs.isError ? <ErrorState error={txs.error} onRetry={() => txs.refetch()} /> : (
              <DataTable columns={TX_COLUMNS} rows={sortedTx} rowKey={(t) => t.tx_id} loading={txs.isLoading} emptyMessage="No transactions found." dense className="border-0 bg-transparent" />
            )}
          </Section>
        </div>

        {/* Secondary column */}
        <div className="flex min-w-0 flex-col gap-6">
          <Section id="network" title="Local neighbourhood"
            aside={<Segmented label="Neighbourhood depth" value={depth} onChange={setDepth} options={[{ value: "1", label: "1-hop" }, { value: "2", label: "2-hop" }]} />}>
            <div className="h-72 overflow-hidden rounded-lg border border-subtle bg-base/40">
              {net.isError ? <ErrorState error={net.error} onRetry={() => net.refetch()} className="border-0" /> :
                net.data ? <TransactionGraph data={net.data} mode="compact" selectedWalletId={walletId} onSelectWallet={open} />
                  : <div className="skeleton h-full w-full rounded-none" />}
            </div>
            <p className="mt-2 text-[11px] text-secondary">Click a neighbour to investigate it.</p>
          </Section>

          <Section title="Counterparties">
            {d ? <Counterparties w={d} onOpen={open} /> : <div className="skeleton h-40" />}
          </Section>

          <Section title="Risk factor breakdown">
            {d ? <RiskBreakdown w={d} /> : <div className="skeleton h-40" />}
          </Section>

          <Section title="About this data">
            <dl className="space-y-2 text-xs">
              <div className="flex justify-between gap-3"><dt className="text-secondary">Source</dt><dd>Uploaded transaction CSV</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-secondary">Environment</dt><dd>{summary.data?.meta.environment === "synthetic_demo" ? "Synthetic demo data" : summary.data?.meta.environment ?? "—"}</dd></div>
              {summary.data && <div className="flex justify-between gap-3"><dt className="text-secondary">Data range</dt><dd>{fmtDate(summary.data.date_range.start)} to {fmtDate(summary.data.date_range.end)}</dd></div>}
              {summary.data?.exported_at && <div className="flex justify-between gap-3"><dt className="text-secondary">Analysis snapshot</dt><dd>{fmtDateTime(summary.data.exported_at)}</dd></div>}
              {d && <div className="flex justify-between gap-3"><dt className="text-secondary">First seen</dt><dd>{fmtDateTime(d.metrics.first_activity)}</dd></div>}
            </dl>
            <p className="mt-3 text-[11px] leading-relaxed text-secondary">
              BlockSense highlights anomalies for investigation. It does not identify wallet owners or determine guilt.
            </p>
          </Section>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default function EntityInvestigation() {
  const { walletId } = useParams();
  const { selected } = useSelection();
  const wallets = useWallets();
  if (walletId) return <EntityView walletId={walletId} />;
  const target = selected ?? wallets.data?.[0]?.id;
  if (target) return <Navigate to={`/entity/${target}`} replace />;
  if (wallets.isError) return <ErrorState error={wallets.error} onRetry={() => wallets.refetch()} />;
  return <div className="skeleton h-96" />;
}
