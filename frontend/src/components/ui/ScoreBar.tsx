import { RISK_COLOR } from "@/lib/utils";
import type { RiskCategory } from "@/types/api";

export function ScoreBar({ score, risk }: { score: number; risk: RiskCategory }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-9 text-right text-sm font-medium tabular-nums">{score.toFixed(1)}</span>
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-subtle" aria-hidden>
        <div className="h-full rounded-full" style={{ width: `${score}%`, backgroundColor: RISK_COLOR[risk] }} />
      </div>
    </div>
  );
}
