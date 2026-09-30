import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { RiskCategory } from "@/types/api";
import type { SortState } from "@/components/ui/DataTable";
import type { FlagFilter } from "@/components/graph/TransactionGraph";

const RISKS: RiskCategory[] = ["High", "Medium", "Low"];

/** Sort + filter state stored in the query string (PRD §6.6). */
export function useTableUrlState(defaultSort: SortState) {
  const [params, setParams] = useSearchParams();

  const sort: SortState = {
    key: params.get("sort") ?? defaultSort.key,
    dir: (params.get("dir") as "asc" | "desc") ?? defaultSort.dir,
  };
  const flag = (params.get("flag") as FlagFilter) ?? "all";
  const riskParam = params.get("risk");
  const risk = useMemo(
    () => new Set((riskParam ?? "").split(",").filter((r): r is RiskCategory => RISKS.includes(r as RiskCategory))),
    [riskParam],
  );

  const update = useCallback((patch: Record<string, string | null>) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      Object.entries(patch).forEach(([k, v]) => (v === null || v === "" ? next.delete(k) : next.set(k, v)));
      return next;
    }, { replace: true });
  }, [setParams]);

  const onSort = (key: string) =>
    update({ sort: key, dir: sort.key === key && sort.dir === "desc" ? "asc" : "desc" });
  const setFlag = (f: FlagFilter) => update({ flag: f === "all" ? null : f });
  const setRisk = (r: Set<RiskCategory>) => update({ risk: r.size ? [...r].join(",") : null });

  return { params, sort, flag, risk, onSort, setFlag, setRisk, update };
}
