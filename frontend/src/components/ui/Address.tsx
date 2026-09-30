import { Tip } from "./Tooltip";
import { cn, shortAddr } from "@/lib/utils";

/** Wallet address / hash — always monospace (PRD §3.3), full value on hover. */
export function Address({ value, full = false, className, head, tail }: {
  value: string; full?: boolean; className?: string; head?: number; tail?: number;
}) {
  const text = full ? value : shortAddr(value, head, tail);
  if (full) return <span className={cn("font-mono break-all", className)}>{text}</span>;
  return (
    <Tip content={<span className="font-mono break-all">{value}</span>}>
      <span className={cn("font-mono", className)} tabIndex={0}>{text}</span>
    </Tip>
  );
}
