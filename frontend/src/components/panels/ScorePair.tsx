import { Tip } from "@/components/ui/Tooltip";

/** Base score (cyan) vs network-adjusted score (violet) — PRD §5.3. */
export function ScorePair({ base, propagated, stacked = false }: { base: number; propagated: number; stacked?: boolean }) {
  const delta = propagated - base;
  return (
    <div className={stacked ? "flex flex-col gap-2" : "flex flex-wrap gap-x-6 gap-y-2"}>
      <Tip content="Anomaly score from this wallet's own behaviour, timing and position.">
        <div tabIndex={0}>
          <div className="text-[11px] text-secondary">Base score</div>
          <div className="text-xl font-semibold tabular-nums text-accent">{base.toFixed(1)}</div>
        </div>
      </Tip>
      <Tip content="Base score blended with neighbours' scores (70% self, 30% neighbours, 2 rounds). Determines the risk category.">
        <div tabIndex={0}>
          <div className="text-[11px] text-secondary">Network-adjusted</div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-semibold tabular-nums text-accent-secondary">{propagated.toFixed(1)}</span>
            <span className="text-[11px] tabular-nums text-secondary">{delta >= 0 ? "+" : ""}{delta.toFixed(1)}</span>
          </div>
        </div>
      </Tip>
    </div>
  );
}
