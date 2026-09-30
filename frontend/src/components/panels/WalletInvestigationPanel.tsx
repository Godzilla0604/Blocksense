import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Network, ReceiptText } from "lucide-react";
import { Link } from "react-router-dom";
import { useWallet, useWalletNetwork } from "@/hooks/queries";
import { useSelection } from "@/hooks/useSelection";
import { fmtBtc, fmtDate } from "@/lib/utils";
import { Address } from "@/components/ui/Address";
import { RiskGauge } from "@/components/ui/RiskGauge";
import { RiskPill } from "@/components/ui/RiskPill";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/States";
import { TransactionGraph } from "@/components/graph/TransactionGraph";
import { ScorePair } from "./ScorePair";
import { WhyFlagged } from "./WhyFlagged";

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-subtle bg-base/40 px-3 py-2">
      <div className="text-[11px] text-secondary">{label}</div>
      <div className="mt-0.5 text-sm font-medium tabular-nums">{value}</div>
    </div>
  );
}

export function PanelSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <div className="skeleton h-[112px] w-[112px] rounded-full" />
        <div className="flex-1 space-y-2"><div className="skeleton h-4 w-40" /><div className="skeleton h-6 w-24" /><div className="skeleton h-8 w-36" /></div>
      </div>
      <div className="grid grid-cols-2 gap-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-12" />)}</div>
      <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-10" />)}</div>
    </div>
  );
}

/** Dashboard right panel: header, metrics, Why Flagged, compact network, actions (PRD §6.2). */
export function WalletInvestigationPanel({ walletId }: { walletId: string | null }) {
  const reduce = useReducedMotion();
  const { select } = useSelection();
  const q = useWallet(walletId);
  const net = useWalletNetwork(walletId, 1);

  return (
    <aside className="panel flex h-full min-h-[520px] flex-col p-5" aria-label="Wallet investigation panel">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-medium">Investigation</h2>
        {q.data && <span className="text-[11px] text-secondary">Last activity {fmtDate(q.data.last_activity)}</span>}
      </div>
      {!walletId && <p className="text-sm text-secondary">Select a wallet in the graph to investigate it.</p>}
      {walletId && q.isLoading && <PanelSkeleton />}
      {walletId && q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} title="Couldn't load this wallet" />}
      <AnimatePresence mode="wait" initial={false}>
        {q.data && (
          <motion.div
            key={q.data.id}
            initial={{ opacity: 0, y: reduce ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduce ? 0 : -8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="flex flex-1 flex-col gap-5"
          >
            <div className="flex items-center gap-4">
              <RiskGauge score={q.data.propagated_score} size={112} stroke={9} />
              <div className="min-w-0 flex-1 space-y-2">
                <Address value={q.data.id} className="block truncate text-sm" head={10} tail={8} />
                <RiskPill risk={q.data.risk_category} />
                <ScorePair base={q.data.base_score} propagated={q.data.propagated_score} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Metric label="Transactions" value={q.data.metrics.tx_count} />
              <Metric label="BTC volume" value={fmtBtc(q.data.metrics.total_volume, 3)} />
              <Metric label="Counterparties" value={q.data.metrics.counterparties} />
              <Metric label="Network degree" value={q.data.metrics.degree} />
            </div>

            <WhyFlagged explanations={q.data.explanations} risk={q.data.risk_category} compact />

            <div>
              <div className="mb-2 flex items-center justify-between text-xs text-secondary">
                <span>Local neighbourhood (1-hop)</span>
                <span>{net.data ? `${net.data.nodes.length - 1} neighbours` : ""}</span>
              </div>
              <div className="h-44 overflow-hidden rounded-lg border border-subtle bg-base/40">
                {net.data ? (
                  <TransactionGraph data={net.data} mode="compact" selectedWalletId={q.data.id} onSelectWallet={select} />
                ) : <div className="skeleton h-full w-full rounded-none" />}
              </div>
            </div>

            <div className="mt-auto flex flex-wrap gap-2">
              <Button asChild variant="primary" size="sm">
                <Link to={`/entity/${q.data.id}`}>View full investigation</Link>
              </Button>
              <Button asChild size="sm"><Link to={`/entity/${q.data.id}#transactions`}><ReceiptText className="h-3.5 w-3.5" /> Transactions</Link></Button>
              <Button asChild size="sm"><Link to={`/network?wallet=${q.data.id}`}><Network className="h-3.5 w-3.5" /> Network</Link></Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </aside>
  );
}
