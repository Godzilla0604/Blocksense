import { useState, type ReactNode } from "react";
import { AlertTriangle, ChevronDown, RotateCw, SearchX } from "lucide-react";
import { Button } from "./button";
import { ApiError } from "@/services/api";
import { cn } from "@/lib/utils";

/** PRD §7.3 — title, one-line cause, retry, collapsible technical details. */
export function ErrorState({ error, onRetry, title = "Couldn't load this view", className }: {
  error: unknown; onRetry?: () => void; title?: string; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const e = error instanceof ApiError ? error : null;
  const cause = e?.message ?? (error instanceof Error ? error.message : "Unexpected error");
  const details = e ? `HTTP ${e.code || "network"} — ${e.details}` : String(error);
  return (
    <div role="alert" className={cn("card flex flex-col gap-3", className)}>
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-secondary" />
        <div className="min-w-0">
          <div className="font-medium">{title}</div>
          <div className="text-sm text-secondary">{cause}</div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {onRetry && <Button size="sm" onClick={onRetry}><RotateCw className="h-3.5 w-3.5" /> Retry</Button>}
        <Button size="sm" variant="ghost" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          Technical details <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
        </Button>
      </div>
      {open && <pre className="overflow-x-auto rounded-lg bg-base p-3 font-mono text-xs text-secondary">{details}</pre>}
    </div>
  );
}

export function EmptyState({ message, action, className }: { message: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 py-12 text-center", className)}>
      <SearchX className="h-6 w-6 text-secondary" />
      <p className="text-sm text-secondary">{message}</p>
      {action}
    </div>
  );
}
