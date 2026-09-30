import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

// Shared wallet selection across Dashboard / Entity / Network / Temporal
// (PRD §5.1: selection persists when navigating away and back in-session).
interface Ctx { selected: string | null; select: (id: string | null) => void; }
const SelectionContext = createContext<Ctx>({ selected: null, select: () => {} });
const KEY = "blocksense.selectedWallet";

function readInitial(): string | null {
  try { return sessionStorage.getItem(KEY); } catch { return null; }
}

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<string | null>(readInitial);
  const select = useCallback((id: string | null) => {
    setSelected(id);
    try { id ? sessionStorage.setItem(KEY, id) : sessionStorage.removeItem(KEY); } catch { /* ignore */ }
  }, []);
  return <SelectionContext.Provider value={{ selected, select }}>{children}</SelectionContext.Provider>;
}

export const useSelection = () => useContext(SelectionContext);
