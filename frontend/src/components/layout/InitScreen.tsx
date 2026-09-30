import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Loader2, RotateCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useStatus } from "@/hooks/queries";
import { api, STATIC_MODE } from "@/services/api";
import { ErrorState } from "@/components/ui/States";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LIVE_STAGES = [
  "Loading transaction data...",
  "Building transaction network...",
  "Computing behavioural features...",
  "Analyzing temporal activity...",
  "Generating anomaly scores...",
];

// Static hosting: the analysis ran at export time, so each stage here is a
// real load of that stage's precomputed output (and warms the query cache).
const STATIC_STAGES: { label: string; key: string; fn: () => Promise<unknown> }[] = [
  { label: "Loading transaction summary...", key: "summary", fn: api.summary },
  { label: "Loading transaction network...", key: "network", fn: api.network },
  { label: "Loading wallet risk scores...", key: "wallets", fn: api.wallets },
  { label: "Loading temporal activity...", key: "temporal", fn: api.temporal },
  { label: "Loading model evaluation...", key: "evaluation", fn: api.evaluation },
];

interface Progress { stages: string[]; current: number; ready: boolean; walletCount?: number | null; error?: unknown; waiting?: boolean }

/** Live mode: poll /api/status for the backend's real startup stages. */
function useLiveProgress(): Progress & { retry?: () => void } {
  const status = useStatus(true);
  const s = status.data;
  const stages = s?.stages ?? LIVE_STAGES;
  return {
    stages,
    current: s ? (s.ready ? stages.length : s.stage_index) : -1,
    ready: !!s?.ready,
    walletCount: s?.wallet_count,
    error: s?.error ? new Error(s.error) : undefined,
    waiting: status.isError && status.failureCount > 2,
  };
}

/** Static mode: load each precomputed dataset in order. */
function useStaticProgress(): Progress & { retry: () => void } {
  const qc = useQueryClient();
  const [current, setCurrent] = useState(0);
  const [error, setError] = useState<unknown>();
  const [walletCount, setWalletCount] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);
  const started = useRef(-1);

  useEffect(() => {
    if (started.current === attempt) return;
    started.current = attempt;
    let cancelled = false;
    (async () => {
      setError(undefined);
      for (let i = 0; i < STATIC_STAGES.length; i++) {
        if (cancelled) return;
        setCurrent(i);
        const st = STATIC_STAGES[i];
        try {
          const data = await qc.fetchQuery({ queryKey: [st.key], queryFn: st.fn, staleTime: Infinity });
          if (st.key === "summary") setWalletCount((data as { wallet_count: number }).wallet_count);
        } catch (e) {
          if (!cancelled) setError(e);
          return;
        }
      }
      if (!cancelled) setCurrent(STATIC_STAGES.length);
    })();
    return () => { cancelled = true; };
  }, [attempt, qc]);

  const retry = useCallback(() => { setAttempt((a) => a + 1); }, []);
  return {
    stages: STATIC_STAGES.map((s) => s.label),
    current,
    ready: current >= STATIC_STAGES.length,
    walletCount,
    error,
    retry,
  };
}

const useProgress = STATIC_MODE ? useStaticProgress : useLiveProgress;

/** Full-screen first-load state driven by real progress signals (PRD §7.1). */
export function InitScreen({ onDone }: { onDone: () => void }) {
  const reduce = useReducedMotion();
  const p = useProgress();
  const [phase, setPhase] = useState<"loading" | "ready">("loading");

  useEffect(() => {
    if (p.ready && phase === "loading") {
      const t = setTimeout(() => setPhase("ready"), reduce ? 150 : 450);
      return () => clearTimeout(t);
    }
  }, [p.ready, phase, reduce]);

  useEffect(() => {
    if (phase === "ready") {
      const t = setTimeout(onDone, reduce ? 500 : 1300);
      return () => clearTimeout(t);
    }
  }, [phase, onDone, reduce]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-base px-6">
      <div className="w-full max-w-md">
        <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" width={72} height={72} className="mb-5 h-[72px] w-[72px]" />
        <div className="text-2xl font-semibold tracking-[0.2em]">BLOCKSENSE</div>
        <AnimatePresence mode="wait">
          {phase === "loading" ? (
            <motion.div key="loading" exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
              <p className="mt-1 text-sm text-secondary">Initializing transaction intelligence</p>
              <ol className="mt-8 space-y-3" aria-live="polite">
                {p.stages.map((label, i) => {
                  const done = i < p.current;
                  const active = i === p.current && !p.ready && !p.error;
                  return (
                    <li key={label} className={cn("flex items-center gap-3 text-sm transition-colors duration-200",
                      done ? "text-primary" : active ? "text-accent" : "text-secondary/60")}>
                      <span className="flex h-5 w-5 items-center justify-center">
                        {done ? <Check className="h-4 w-4 text-accent" />
                          : active ? <Loader2 className={cn("h-4 w-4", !reduce && "animate-spin")} />
                          : <span className="h-3 w-3 rounded-full border border-current" />}
                      </span>
                      {label}
                    </li>
                  );
                })}
              </ol>
              {p.waiting && (
                <p className="mt-6 text-xs text-secondary">
                  Waiting for the API at <span className="font-mono">localhost:8000</span>. Start the backend and this screen will continue automatically.
                </p>
              )}
              {p.error !== undefined && (
                <div className="mt-6 space-y-3">
                  <ErrorState title="Analysis data failed to load" error={p.error} />
                  {"retry" in p && p.retry && (
                    <Button size="sm" onClick={p.retry}><RotateCw className="h-3.5 w-3.5" /> Retry</Button>
                  )}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div key="ready" initial={{ opacity: 0, y: reduce ? 0 : 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
              <p className="mt-8 text-lg font-medium text-accent">Analysis Ready</p>
              <p className="mt-1 text-4xl font-semibold tabular-nums">{p.walletCount ?? "—"}</p>
              <p className="text-sm text-secondary">wallets monitored</p>
            </motion.div>
          )}
        </AnimatePresence>
        <p className="mt-10 border-t border-subtle pt-4 text-xs text-secondary">
          Demo environment running on synthetic transaction data. Scores are risk signals for investigation, not findings of wrongdoing.
          {STATIC_MODE && " This hosted version shows a precomputed analysis snapshot."}
        </p>
      </div>
    </div>
  );
}
