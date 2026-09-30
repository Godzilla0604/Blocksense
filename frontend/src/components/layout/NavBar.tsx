import { useMemo, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { useWallets } from "@/hooks/queries";
import { api } from "@/services/api";
import { useSelection } from "@/hooks/useSelection";
import { cn, shortAddr } from "@/lib/utils";
import { RiskPill } from "@/components/ui/RiskPill";

const ITEMS = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/watchlist", label: "Anomaly Watchlist" },
  { to: "/entity", label: "Entity Investigation" },
  { to: "/network", label: "Network Graph" },
  { to: "/temporal", label: "Temporal Analysis" },
];

function Logo() {
  return <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" width={30} height={30} className="h-[30px] w-[30px]" />;
}

/** Global search: resolves against the cached /api/wallets list, falls back to /api/wallet/{id}. */
function GlobalSearch() {
  const wallets = useWallets();
  const navigate = useNavigate();
  const { select } = useSelection();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (s.length < 2 || !wallets.data) return [];
    return wallets.data.filter((w) => w.id.toLowerCase().includes(s)).slice(0, 6);
  }, [q, wallets.data]);

  const go = (id: string) => {
    select(id);
    navigate(`/entity/${id}`);
    setQ(""); setOpen(false); setMsg(null);
    inputRef.current?.blur();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const s = q.trim();
    if (!s) return;
    if (matches.length) return go(matches[0].id);
    try { await api.wallet(s); go(s); }
    catch { setMsg("No monitored wallet matches that address."); }
  };

  return (
    <form onSubmit={submit} className="relative w-full max-w-xs" role="search">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary" />
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); setMsg(null); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search wallet address"
        aria-label="Search wallet address"
        spellCheck={false}
        className="h-9 w-full rounded-lg border border-subtle bg-base pl-9 pr-3 font-mono text-xs text-primary placeholder:font-sans placeholder:text-secondary focus:border-accent/60 focus:outline-none"
      />
      {open && (matches.length > 0 || msg) && (
        <div className="absolute right-0 top-11 z-50 w-full min-w-[300px] overflow-hidden rounded-lg border border-subtle bg-panel shadow-xl">
          {msg && <div className="px-3 py-2.5 text-xs text-secondary">{msg}</div>}
          {matches.map((w) => (
            <button
              key={w.id} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => go(w.id)}
              className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-white/5"
            >
              <span className="font-mono text-xs">{shortAddr(w.id, 10, 8)}</span>
              <RiskPill risk={w.risk_category} size="sm" />
            </button>
          ))}
        </div>
      )}
    </form>
  );
}

export function NavBar() {
  return (
    <header className="sticky top-0 z-40 h-16 border-b border-subtle bg-panel">
      <div className="mx-auto flex h-full max-w-[1680px] items-center gap-6 px-6">
        <NavLink to="/" className="flex shrink-0 items-center gap-2.5" aria-label="BlockSense home">
          <Logo />
          <span className="text-[15px] font-semibold tracking-tight">BlockSense</span>
        </NavLink>
        <nav className="flex h-full min-w-0 flex-1 items-stretch gap-1 overflow-x-auto" aria-label="Primary">
          {ITEMS.map((it) => (
            <NavLink
              key={it.to} to={it.to} end={it.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center whitespace-nowrap border-b-2 px-3 text-sm transition-colors duration-150",
                  isActive ? "border-accent text-accent" : "border-transparent text-secondary hover:text-primary",
                )
              }
            >
              {it.label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden shrink-0 md:block md:w-72"><GlobalSearch /></div>
      </div>
    </header>
  );
}
