import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";

// Backend data is precomputed once per server start, so treat it as static
// for the session (Frontend PRD §8). staleTime Infinity = never refetch.
const STATIC = { staleTime: Infinity, gcTime: Infinity } as const;

export const useStatus = (enabled: boolean) =>
  useQuery({
    queryKey: ["status"],
    queryFn: api.status,
    enabled,
    refetchInterval: (q) => (q.state.data?.ready || q.state.data?.error ? false : 250),
    retry: true,
    retryDelay: 800,
  });

export const useSummary = () => useQuery({ queryKey: ["summary"], queryFn: api.summary, ...STATIC });
export const useWallets = () => useQuery({ queryKey: ["wallets"], queryFn: api.wallets, ...STATIC });
export const useNetwork = () => useQuery({ queryKey: ["network"], queryFn: api.network, ...STATIC });
export const useTemporal = () => useQuery({ queryKey: ["temporal"], queryFn: api.temporal, ...STATIC });
export const useEvaluation = () => useQuery({ queryKey: ["evaluation"], queryFn: api.evaluation, ...STATIC });

export const useWallet = (id?: string | null) =>
  useQuery({ queryKey: ["wallet", id], queryFn: () => api.wallet(id!), enabled: !!id, ...STATIC });

export const useWalletTransactions = (id?: string | null) =>
  useQuery({ queryKey: ["wallet-tx", id], queryFn: () => api.walletTransactions(id!), enabled: !!id, ...STATIC });

export const useWalletNetwork = (id?: string | null, depth: 1 | 2 = 1) =>
  useQuery({
    queryKey: ["wallet-net", id, depth],
    queryFn: () => api.walletNetwork(id!, depth),
    enabled: !!id,
    placeholderData: (prev) => prev,
    ...STATIC,
  });
