import { motion, useReducedMotion } from "framer-motion";
import { Activity, Clock3, Network } from "lucide-react";
import type { Explanation, FeatureGroup, RiskCategory } from "@/types/api";
import { cn } from "@/lib/utils";

const GROUPS: { key: FeatureGroup; label: string; icon: typeof Activity }[] = [
  { key: "behavioural", label: "Behavioural", icon: Activity },
  { key: "temporal", label: "Temporal", icon: Clock3 },
  { key: "network", label: "Network", icon: Network },
];

/** Explanations grouped Behavioural / Temporal / Network, staggered 80ms (PRD §5.3, §3.6). */
export function WhyFlagged({ explanations, risk, compact = false }: {
  explanations: Explanation[]; risk: RiskCategory; compact?: boolean;
}) {
  const reduce = useReducedMotion();
  const heading = risk === "Low" ? "Notable signals" : "Why flagged";
  if (!explanations.length) {
    return (
      <section>
        <h3 className="text-sm font-medium">{heading}</h3>
        <p className="mt-2 text-sm text-secondary">No significant deviation from the network baseline.</p>
      </section>
    );
  }
  let i = 0;
  return (
    <section aria-labelledby="why-flagged">
      <div className="flex items-baseline justify-between gap-2">
        <h3 id="why-flagged" className="text-sm font-medium">{heading}</h3>
        <span className="text-[11px] text-secondary">vs. network median</span>
      </div>
      <div className={cn("mt-3 flex flex-col", compact ? "gap-3" : "gap-4")}>
        {GROUPS.map(({ key, label, icon: Icon }) => {
          const items = explanations.filter((e) => e.group === key);
          if (!items.length) return null;
          return (
            <div key={key}>
              <div className="mb-1.5 flex items-center gap-1.5 text-xs text-secondary">
                <Icon className="h-3.5 w-3.5" /> {label}
              </div>
              <ul className="flex flex-col gap-1.5">
                {items.map((e) => {
                  const delay = reduce ? 0 : 0.08 * i++;
                  return (
                    <motion.li
                      key={e.feature}
                      initial={{ opacity: 0, y: reduce ? 0 : 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay, ease: "easeOut" }}
                      className="rounded-lg border border-subtle bg-base/40 px-3 py-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-sm leading-snug">{e.description}</span>
                        <span
                          className={cn(
                            "mt-0.5 shrink-0 rounded-full px-1.5 py-0.5 text-[10px]",
                            e.severity === "strong" ? "bg-white/10 text-primary" : "text-secondary",
                          )}
                          title={`${e.deviation.toFixed(1)} standard deviations from the median`}
                        >
                          {e.deviation.toFixed(1)}σ
                        </span>
                      </div>
                      {!compact && (
                        <div className="mt-1 text-xs text-secondary">
                          This wallet: <span className="text-primary">{e.value_display}</span>
                          <span className="mx-2 text-subtle">|</span>
                          Median: {e.baseline_display}
                        </div>
                      )}
                    </motion.li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-secondary">
        Risk signals for further investigation, not a finding of wrongdoing.
      </p>
    </section>
  );
}
