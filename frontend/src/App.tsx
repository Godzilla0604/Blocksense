import { useCallback, useState } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { NavBar } from "@/components/layout/NavBar";
import { InitScreen } from "@/components/layout/InitScreen";
import Dashboard from "@/pages/Dashboard";
import Watchlist from "@/pages/Watchlist";
import EntityInvestigation from "@/pages/EntityInvestigation";
import NetworkGraph from "@/pages/NetworkGraph";
import TemporalAnalysis from "@/pages/TemporalAnalysis";
import { EmptyState } from "@/components/ui/States";
import { Link } from "react-router-dom";

const INIT_KEY = "blocksense.initialized";

function Footer() {
  return (
    <footer className="mx-auto mt-10 w-full max-w-[1680px] border-t border-subtle px-6 py-4 text-[11px] text-secondary">
      Demo environment on synthetic transaction data. BlockSense surfaces risk signals that require further investigation; it does not identify wallet owners or determine wrongdoing.
    </footer>
  );
}

export default function App() {
  const [initialized, setInitialized] = useState(() => {
    try { return sessionStorage.getItem(INIT_KEY) === "1"; } catch { return false; }
  });
  const done = useCallback(() => {
    try { sessionStorage.setItem(INIT_KEY, "1"); } catch { /* ignore */ }
    setInitialized(true);
  }, []);
  const location = useLocation();

  if (!initialized) return <InitScreen onDone={done} />;

  return (
    <div className="flex min-h-screen flex-col">
      <NavBar />
      <main key={location.pathname.split("/")[1]} className="mx-auto w-full max-w-[1680px] flex-1 px-6 py-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/watchlist" element={<Watchlist />} />
          <Route path="/entity/:walletId?" element={<EntityInvestigation />} />
          <Route path="/network" element={<NetworkGraph />} />
          <Route path="/temporal" element={<TemporalAnalysis />} />
          <Route path="*" element={<EmptyState message="This page doesn't exist." action={<Link className="text-sm text-accent" to="/">Go to dashboard</Link>} />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
