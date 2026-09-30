import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { useNetwork, useSummary, useWallet, useWallets } from "@/hooks/queries";
import { useSelection } from "@/hooks/useSelection";
import { useEgoVisibility } from "@/hooks/useEgoVisibility";
import { useTableUrlState } from "@/hooks/useUrlState";
import { filterSortWallets } from "@/lib/walletSort";
import type { WalletRow } from "@/types/api";
import { cn, fmtBtc, fmtDate } from "@/lib/utils";
import { GraphLegend, TransactionGraph, type Depth } from "@/components/graph/TransactionGraph";
import { DEPTH_OPTIONS, FLAG_OPTIONS, ResetButton, RiskToggle, Segmented } from "@/components/graph/GraphControls";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Address } from "@/components/ui/Address";
import { RiskPill } from "@/components/ui/RiskPill";
import { RiskGauge } from "@/components/ui/RiskGauge";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/States";

function ProfileSummary({ id }: { id: string | null }) {
  const w = useWallet(id);
  if (!id) return <p className="text-sm text-secondary">Select a wallet to see its profile.</p>;
  if (w.isError) return <ErrorState error={w.error} onRetry={() => w.refetch()} />;
  if (!w.data) return <div className="skeleton h-28" />;
  const d = w.data;
  return (
    <div className="flex gap-4">
      <RiskGauge score={d.propagated_score} size={84} stroke={7} />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Address value={d.id} head={10} tail={6} className="block text-xs" />
        <RiskPill risk={d.risk_category} size="sm" />
        <p className="line-clamp-2 text-xs text-secondary">{d.primary_reason}</p>
        <div className="flex gap-4 text-[11px] text-secondary">
          <span><span className="text-primary tabular-nums">{d.tx_count}</span> tx</span>
          <span><span className="text-primary tabular-nums">{d.counterparties}</span> counterparties</span>
          <span>Last {fmtDate(d.last_activity)}</span>
        </div>
        <Button asChild size="sm" variant="primary" className="mt-1"><Link to={`/entity/${d.id}`}>Open investigation</Link></Button>
      </div>
    </div>
  );
}

export default function NetworkGraph() {
  const network = useNetwork();
  const wallets = useWallets();
  const summary = useSummary();
  const { selected, select } = useSelection();
  const { params, sort, flag, risk, onSort, setFlag, setRisk, update } = useTableUrlState({ key: "risk", dir: "desc" });
  const [depth, setDepth] = useState<Depth>("full");
  const [resetKey, setResetKey] = useState(0);
  const [q, setQ] = useState("");
  const cluster = params.get("cluster") !== null ? Number(params.get("cluster")) : null;
  const { visibleIds } = useEgoVisibility(selected, depth);

  // Deep link: /network?wallet=<id>
  const linked = params.get("wallet");
  useEffect(() => { if (linked) { select(linked); update({ wallet: null }); } }, [linked, select, update]);

  const rank = useMemo(() => new Map((wallets.data ?? []).map((w, i) => [w.id, i + 1])), [wallets.data]);
  const rows = useMemo(() => {
    if (!wallets.data) return [];
    const base = filterSortWallets(wallets.data, sort, flag, risk, q);
    return cluster === null ? base : base.filter((w) => w.cluster === cluster);
  }, [wallets.data, sort, flag, risk, q, cluster]);

  const columns: Column<WalletRow>[] = [
    { key: "rank", header: "#", className: "tabular-nums text-secondary", render: (w) => rank.get(w.id) },
    { key: "wallet", header: "Wallet", render: (w) => <span className="whitespace-nowrap font-mono text-xs">{w.id.slice(0, 8)}…{w.id.slice(-4)}</span> },
    { key: "risk", header: "Score", sortable: true, className: "tabular-nums", render: (w) => w.composite_score.toFixed(1) },
    { key: "category", header: "Risk", render: (w) => <RiskPill risk={w.risk_category} size="sm" /> },
    { key: "volume", header: "Volume", sortable: true, className: "tabular-nums text-right whitespace-nowrap", headerClassName: "text-right", render: (w) => fmtBtc(w.volume, 2) },
    { key: "tx_count", header: "Tx", sortable: true, className: "tabular-nums text-right", headerClassName: "text-right", render: (w) => w.tx_count },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="panel flex flex-wrap items-center gap-3 px-4 py-3">
        <Segmented label="Flag filter" value={flag} options={FLAG_OPTIONS} onChange={setFlag} />
        <RiskToggle value={risk} onChange={setRisk} />
        <Segmented label="Depth" value={depth} options={DEPTH_OPTIONS} onChange={setDepth} />
        <label className="flex items-center gap-2 text-xs text-secondary">
          Cluster
          <select
            value={cluster ?? ""}
            onChange={(e) => update({ cluster: e.target.value === "" ? null : e.target.value })}
            className="h-8 rounded-lg border border-subtle bg-base px-2 text-xs text-primary focus:border-accent/60 focus:outline-none"
          >
            <option value="">All wallets</option>
            {summary.data?.risk_clusters.map((c) => (
              <option key={c.id} value={c.id}>Flagged group #{c.id + 1} ({c.size} wallets)</option>
            ))}
          </select>
        </label>
        <div className="ml-auto"><ResetButton onClick={() => setResetKey((k) => k + 1)} /></div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_460px]">
        <section className="panel relative h-[70vh] min-h-[520px] overflow-hidden" aria-label="Network graph workspace">
          {network.isLoading && <div className="skeleton absolute inset-4" />}
          {network.isError && <div className="p-4"><ErrorState error={network.error} onRetry={() => network.refetch()} /></div>}
          {network.data && (
            <TransactionGraph
              data={network.data}
              selectedWalletId={selected}
              onSelectWallet={select}
              riskFilter={risk}
              flaggedFilter={flag}
              clusterFilter={cluster}
              visibleIds={visibleIds}
              resetKey={resetKey}
            />
          )}
          <GraphLegend className="absolute bottom-3 left-4 rounded-md bg-panel/80 px-2 py-1 backdrop-blur" />
        </section>

        <aside className="flex min-w-0 flex-col gap-4">
          <div className="panel p-4"><ProfileSummary id={selected} /></div>
          <div className="panel flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="relative border-b border-subtle p-3">
              <Search className="pointer-events-none absolute left-6 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-secondary" />
              <input
                value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter wallets" aria-label="Filter wallet list"
                spellCheck={false}
                className="h-8 w-full rounded-lg border border-subtle bg-base pl-8 pr-3 font-mono text-xs placeholder:font-sans placeholder:text-secondary focus:border-accent/60 focus:outline-none"
              />
            </div>
            <div className={cn("max-h-[52vh] overflow-y-auto")}>
              {wallets.isError ? <ErrorState error={wallets.error} onRetry={() => wallets.refetch()} className="border-0" /> : (
                <DataTable
                  columns={columns} rows={rows} rowKey={(w) => w.id} sort={sort} onSort={onSort}
                  loading={wallets.isLoading} activeKey={selected} dense
                  emptyMessage="No wallets match this filter."
                  onRowClick={(w) => select(w.id)}
                  className="rounded-none border-0"
                />
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
