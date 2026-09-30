import { useEffect, useMemo, useState } from "react";
import { useEvaluation, useNetwork, useSummary, useTemporal, useWallets } from "@/hooks/queries";
import { useSelection } from "@/hooks/useSelection";
import { useEgoVisibility } from "@/hooks/useEgoVisibility";
import type { RiskCategory } from "@/types/api";
import { fmtNum } from "@/lib/utils";
import { KpiCard, KpiSkeleton } from "@/components/ui/KpiCard";
import { ErrorState } from "@/components/ui/States";
import { GraphLegend, TransactionGraph, type Depth, type FlagFilter } from "@/components/graph/TransactionGraph";
import { DEPTH_OPTIONS, FLAG_OPTIONS, ResetButton, RiskToggle, Segmented } from "@/components/graph/GraphControls";
import { WalletInvestigationPanel } from "@/components/panels/WalletInvestigationPanel";

function EvaluationStrip() {
  const e = useEvaluation();
  if (!e.data) return null;
  const d = e.data;
  return (
    <details className="group text-xs text-secondary">
      <summary className="cursor-pointer select-none list-none hover:text-primary">
        Model check against held-out labels: precision {d.precision.toFixed(2)}, recall {d.recall.toFixed(2)}, F1 {d.f1.toFixed(2)}
        <span className="ml-1 text-secondary/70 group-open:hidden">(details)</span>
      </summary>
      <p className="mt-2 max-w-3xl leading-relaxed">
        {d.note} Flagged = network-adjusted score ≥ {d.threshold}. {d.confusion.tp} of {d.ground_truth_suspicious} labelled-suspicious wallets flagged; {d.confusion.fp} legitimate wallets also flagged for review ({d.wallets_evaluated} wallets total).
      </p>
    </details>
  );
}

export default function Dashboard() {
  const summary = useSummary();
  const network = useNetwork();
  const wallets = useWallets();
  const temporal = useTemporal();
  const { selected, select } = useSelection();

  const [flag, setFlag] = useState<FlagFilter>("all");
  const [risk, setRisk] = useState<Set<RiskCategory>>(new Set());
  const [depth, setDepth] = useState<Depth>("full");
  const [resetKey, setResetKey] = useState(0);
  const { visibleIds } = useEgoVisibility(selected, depth);

  // Auto-select the highest-risk wallet on first load (PRD §5.1).
  useEffect(() => {
    if (!selected && wallets.data?.length) select(wallets.data[0].id);
  }, [selected, wallets.data, select]);

  const sparks = useMemo(() => {
    if (!temporal.data) return null;
    // weekly buckets for compact sparklines
    const wk = (arr: number[]) => arr.reduce<number[]>((acc, v, i) => { acc[Math.floor(i / 7)] = (acc[Math.floor(i / 7)] ?? 0) + v; return acc; }, []);
    const riskHigh = temporal.data.risk_timeline.map((r) => Number(r.High) + Number(r.Medium));
    return {
      tx: wk(temporal.data.daily_txs.map((d) => d.count)),
      vol: wk(temporal.data.daily_vol.map((d) => d.volume)),
      flagged: wk(riskHigh),
    };
  }, [temporal.data]);

  const s = summary.data;

  return (
    <div className="flex flex-col gap-6">
      {summary.isError ? (
        <ErrorState error={summary.error} onRetry={() => summary.refetch()} title="Couldn't load network summary" />
      ) : (
        <section className="-mx-6 overflow-x-auto px-6 pb-1" aria-label="Key figures">
          <div className="grid min-w-[960px] grid-cols-5 gap-4">
            {!s ? Array.from({ length: 5 }).map((_, i) => <KpiSkeleton key={i} />) : (
              <>
                <KpiCard label="Total transactions" value={fmtNum(s.tx_count)} spark={sparks?.tx} sub="Weekly trend" />
                <KpiCard label="Monitored wallets" value={fmtNum(s.wallet_count)} sub={`${s.network_components} connected network${s.network_components === 1 ? "" : "s"}`} />
                <KpiCard label="Total BTC volume" value={fmtNum(s.volume, 2)} spark={sparks?.vol} sparkColor="#A78BFA" sub="BTC moved" />
                <KpiCard label="Flagged wallets" value={s.flagged_count} sub={`${s.risk_counts.High} high, ${s.risk_counts.Medium} medium`} spark={sparks?.flagged} sparkColor="#8A9BB8" />
                <KpiCard label="High-risk clusters" value={s.clusters} emphasis={s.clusters > 0 ? "high" : undefined}
                  sub={`${s.risk_cluster_count} connected group${s.risk_cluster_count === 1 ? "" : "s"} of flagged wallets`} />
              </>
            )}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,68fr)_minmax(0,32fr)]">
        <section className="panel flex min-h-[560px] flex-col overflow-hidden" aria-label="Transaction network">
          <div className="flex flex-wrap items-center gap-3 border-b border-subtle px-4 py-3">
            <Segmented label="Flag filter" value={flag} options={FLAG_OPTIONS} onChange={setFlag} />
            <RiskToggle value={risk} onChange={setRisk} />
            <Segmented label="Depth" value={depth} options={DEPTH_OPTIONS} onChange={setDepth} />
            <div className="ml-auto"><ResetButton onClick={() => setResetKey((k) => k + 1)} /></div>
          </div>
          <div className="relative flex-1 min-h-[480px]">
            {network.isLoading && <div className="skeleton absolute inset-4" />}
            {network.isError && <div className="p-4"><ErrorState error={network.error} onRetry={() => network.refetch()} title="Couldn't load the transaction network" /></div>}
            {network.data && (
              <TransactionGraph
                data={network.data}
                selectedWalletId={selected}
                onSelectWallet={select}
                riskFilter={risk}
                flaggedFilter={flag}
                visibleIds={visibleIds}
                resetKey={resetKey}
              />
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-subtle px-4 py-2.5">
            <GraphLegend />
            <span className="text-[11px] text-secondary">Scroll to zoom, drag to pan, click a wallet to investigate</span>
          </div>
        </section>

        <WalletInvestigationPanel walletId={selected} />
      </div>

      <EvaluationStrip />
    </div>
  );
}
