import type { WalletRow } from "@/types/api";
import type { SortState } from "@/components/ui/DataTable";
import type { FlagFilter } from "@/components/graph/TransactionGraph";
import type { RiskCategory } from "@/types/api";

const ACCESSOR: Record<string, (w: WalletRow) => number | string> = {
  score: (w) => w.composite_score,
  risk: (w) => w.composite_score,
  tx_count: (w) => w.tx_count,
  volume: (w) => w.volume,
  counterparties: (w) => w.counterparties,
  degree: (w) => w.degree,
  last_activity: (w) => w.last_activity,
};

export function filterSortWallets(rows: WalletRow[], sort: SortState, flag: FlagFilter, risk: Set<RiskCategory>, q = "") {
  const get = ACCESSOR[sort.key] ?? ACCESSOR.score;
  const s = q.trim().toLowerCase();
  return rows
    .filter((w) => flag === "all" || (flag === "flagged" ? w.flagged : !w.flagged))
    .filter((w) => risk.size === 0 || risk.has(w.risk_category))
    .filter((w) => !s || w.id.toLowerCase().includes(s))
    .sort((a, b) => {
      const va = get(a), vb = get(b);
      const c = va < vb ? -1 : va > vb ? 1 : 0;
      return sort.dir === "asc" ? c : -c;
    });
}
