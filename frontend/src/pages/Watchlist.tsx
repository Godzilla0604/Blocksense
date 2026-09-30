import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useWallets } from "@/hooks/queries";
import { useSelection } from "@/hooks/useSelection";
import { useTableUrlState } from "@/hooks/useUrlState";
import { filterSortWallets } from "@/lib/walletSort";
import type { WalletRow } from "@/types/api";
import { fmtBtc, fmtDate } from "@/lib/utils";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Address } from "@/components/ui/Address";
import { RiskPill } from "@/components/ui/RiskPill";
import { ScoreBar } from "@/components/ui/ScoreBar";
import { ErrorState } from "@/components/ui/States";
import { Tip } from "@/components/ui/Tooltip";
import { FLAG_OPTIONS, RiskToggle, Segmented } from "@/components/graph/GraphControls";

const COLUMNS: Column<WalletRow>[] = [
  { key: "wallet", header: "Wallet", render: (w) => <Address value={w.id} head={10} tail={6} className="text-xs" /> },
  { key: "risk", header: "Risk score", sortable: true, render: (w) => <ScoreBar score={w.composite_score} risk={w.risk_category} /> },
  { key: "category", header: "Risk category", render: (w) => <RiskPill risk={w.risk_category} size="sm" /> },
  { key: "tx_count", header: "Transactions", sortable: true, className: "tabular-nums text-right", headerClassName: "text-right", render: (w) => w.tx_count },
  { key: "volume", header: "BTC volume", sortable: true, className: "tabular-nums text-right whitespace-nowrap", headerClassName: "text-right", render: (w) => fmtBtc(w.volume, 4) },
  { key: "counterparties", header: "Counterparties", sortable: true, className: "tabular-nums text-right", headerClassName: "text-right", render: (w) => w.counterparties },
  { key: "degree", header: "Network degree", sortable: true, className: "tabular-nums text-right", headerClassName: "text-right", render: (w) => w.degree },
  { key: "last_activity", header: "Last activity", sortable: true, className: "whitespace-nowrap text-secondary", render: (w) => fmtDate(w.last_activity) },
  {
    key: "reason", header: "Primary reason", className: "max-w-[320px]",
    render: (w) => (
      <Tip content={w.primary_reason}>
        <span className="block truncate text-xs text-secondary" tabIndex={0}>{w.primary_reason}</span>
      </Tip>
    ),
  },
];

export default function Watchlist() {
  const wallets = useWallets();
  const navigate = useNavigate();
  const { selected, select } = useSelection();
  const { sort, flag, risk, onSort, setFlag, setRisk } = useTableUrlState({ key: "risk", dir: "desc" });

  const rows = useMemo(
    () => (wallets.data ? filterSortWallets(wallets.data, sort, flag, risk) : []),
    [wallets.data, sort, flag, risk],
  );

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Anomaly Watchlist</h1>
          <p className="mt-1 text-sm text-secondary">
            Wallets ranked by network-adjusted risk score. Select a row to open its investigation.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Segmented label="Flag filter" value={flag} options={FLAG_OPTIONS} onChange={setFlag} />
          <RiskToggle value={risk} onChange={setRisk} />
        </div>
      </header>
      {wallets.isError ? (
        <ErrorState error={wallets.error} onRetry={() => wallets.refetch()} title="Couldn't load the watchlist" />
      ) : (
        <>
          <DataTable
            columns={COLUMNS}
            rows={rows}
            rowKey={(w) => w.id}
            sort={sort}
            onSort={onSort}
            loading={wallets.isLoading}
            activeKey={selected}
            emptyMessage="No wallets match this filter."
            onRowClick={(w) => { select(w.id); navigate(`/entity/${w.id}`); }}
          />
          {wallets.data && (
            <p className="text-xs text-secondary">
              Showing {rows.length} of {wallets.data.length} wallets. Flagged means a network-adjusted score of 50 or more.
            </p>
          )}
        </>
      )}
    </div>
  );
}
