import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "./States";

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  sortable?: boolean;
  className?: string;
  headerClassName?: string;
}

export interface SortState { key: string; dir: "asc" | "desc"; }

/** Generic table. Sort state is owned by the page (kept in the URL, PRD §6.6). */
export function DataTable<T>({
  columns, rows, rowKey, sort, onSort, onRowClick, activeKey, loading, emptyMessage, dense, className,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  sort?: SortState;
  onSort?: (key: string) => void;
  onRowClick?: (row: T) => void;
  activeKey?: string | null;
  loading?: boolean;
  emptyMessage: string;
  dense?: boolean;
  className?: string;
}) {
  const pad = dense ? "px-3 py-2.5" : "px-4 py-3";
  return (
    <div className={cn("overflow-x-auto rounded-card border border-subtle bg-card", className)}>
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-panel">
          <tr>
            {columns.map((c) => {
              const active = sort?.key === c.key;
              const Icon = !active ? ArrowUpDown : sort!.dir === "asc" ? ArrowUp : ArrowDown;
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={active ? (sort!.dir === "asc" ? "ascending" : "descending") : undefined}
                  className={cn("border-b border-subtle text-left text-xs font-medium text-secondary whitespace-nowrap", pad, c.headerClassName)}
                >
                  {c.sortable && onSort ? (
                    <button
                      onClick={() => onSort(c.key)}
                      className={cn("inline-flex items-center gap-1 hover:text-primary", active && "text-accent")}
                    >
                      {c.header}
                      <Icon className="h-3 w-3" />
                    </button>
                  ) : c.header}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {loading &&
            Array.from({ length: 8 }).map((_, i) => (
              <tr key={i} className="border-b border-subtle last:border-0">
                {columns.map((c) => (
                  <td key={c.key} className={pad}><div className="skeleton h-4 w-full max-w-[140px]" /></td>
                ))}
              </tr>
            ))}
          {!loading && rows.map((r) => {
            const k = rowKey(r);
            return (
              <tr
                key={k}
                onClick={onRowClick ? () => onRowClick(r) : undefined}
                onKeyDown={onRowClick ? (e) => { if (e.key === "Enter") onRowClick(r); } : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                className={cn(
                  "border-b border-subtle last:border-0 transition-colors duration-150",
                  onRowClick && "cursor-pointer hover:bg-white/[0.03]",
                  activeKey === k && "bg-accent/[0.06]",
                )}
              >
                {columns.map((c) => <td key={c.key} className={cn(pad, "align-middle", c.className)}>{c.render(r)}</td>)}
              </tr>
            );
          })}
        </tbody>
      </table>
      {!loading && rows.length === 0 && <EmptyState message={emptyMessage} />}
    </div>
  );
}
