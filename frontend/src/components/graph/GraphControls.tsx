import { RotateCcw } from "lucide-react";
import type { RiskCategory } from "@/types/api";
import { Button } from "@/components/ui/button";
import { RISK_COLOR, cn } from "@/lib/utils";
import type { Depth, FlagFilter } from "./TransactionGraph";

export function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string;
}) {
  return (
    <div className="inline-flex rounded-lg border border-subtle p-0.5" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cn("rounded-md px-2.5 py-1 text-xs transition-colors duration-150",
            value === o.value ? "bg-accent/15 text-accent" : "text-secondary hover:text-primary")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function RiskToggle({ value, onChange }: { value: Set<RiskCategory>; onChange: (v: Set<RiskCategory>) => void }) {
  return (
    <div className="flex gap-1.5" role="group" aria-label="Risk filter">
      {(["High", "Medium", "Low"] as const).map((r) => {
        const on = value.has(r);
        return (
          <button
            key={r}
            aria-pressed={on}
            onClick={() => {
              const next = new Set(value);
              on ? next.delete(r) : next.add(r);
              onChange(next);
            }}
            className="chip"
            style={on ? { borderColor: `${RISK_COLOR[r]}80`, color: RISK_COLOR[r], background: `${RISK_COLOR[r]}14` } : undefined}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: RISK_COLOR[r], opacity: on ? 1 : 0.5 }} />
            {r}
          </button>
        );
      })}
    </div>
  );
}

export const FLAG_OPTIONS: { value: FlagFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "flagged", label: "Flagged" },
  { value: "non-flagged", label: "Non-flagged" },
];
export const DEPTH_OPTIONS: { value: Depth; label: string }[] = [
  { value: "full", label: "Full network" },
  { value: "1-hop", label: "1-hop" },
  { value: "2-hop", label: "2-hop" },
];

export function ResetButton({ onClick }: { onClick: () => void }) {
  return <Button size="sm" variant="ghost" onClick={onClick}><RotateCcw className="h-3.5 w-3.5" /> Reset view</Button>;
}
