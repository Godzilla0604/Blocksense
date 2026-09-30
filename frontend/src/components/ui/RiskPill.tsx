import type { RiskCategory } from "@/types/api";
import { RISK_COLOR, cn } from "@/lib/utils";

/** Copy is fixed to "High/Medium/Low Risk" — never guilt language (PRD §9). */
export function RiskPill({ risk, className, size = "md" }: { risk: RiskCategory; className?: string; size?: "sm" | "md" }) {
  const c = RISK_COLOR[risk];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        className,
      )}
      style={{ color: c, backgroundColor: `${c}1A`, boxShadow: `inset 0 0 0 1px ${c}40` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c }} />
      {risk} Risk
    </span>
  );
}
