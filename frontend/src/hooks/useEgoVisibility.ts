import { useMemo } from "react";
import { useWalletNetwork } from "./queries";
import type { Depth } from "@/components/graph/TransactionGraph";

/** For 1-hop/2-hop views, fetch only the ego graph and return its node IDs. */
export function useEgoVisibility(selected: string | null, depth: Depth) {
  const d = depth === "2-hop" ? 2 : 1;
  const q = useWalletNetwork(depth === "full" ? null : selected, d);
  const ids = useMemo(
    () => (depth === "full" || !q.data ? null : new Set(q.data.nodes.map((n) => n.id))),
    [depth, q.data],
  );
  return { visibleIds: ids, loading: depth !== "full" && q.isFetching };
}
