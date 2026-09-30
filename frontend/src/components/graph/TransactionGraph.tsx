import { useEffect, useMemo, useRef, useState } from "react";
import cytoscape, { type Core, type ElementDefinition, type NodeSingular } from "cytoscape";
import type { GraphData, GraphNode, RiskCategory } from "@/types/api";
import { RISK_COLOR, cn, fmtBtc, fmtDate, prefersReducedMotion, shortAddr } from "@/lib/utils";
import { RiskPill } from "@/components/ui/RiskPill";

export type Depth = "full" | "1-hop" | "2-hop";
export type FlagFilter = "all" | "flagged" | "non-flagged";

export interface TransactionGraphProps {
  data: GraphData;
  mode?: "full" | "compact";
  selectedWalletId?: string | null;
  onSelectWallet?: (id: string) => void;
  /** Nodes to show (e.g. result of a 1-hop/2-hop ego query). null = all. */
  visibleIds?: Set<string> | null;
  riskFilter?: Set<RiskCategory> | null;
  flaggedFilter?: FlagFilter;
  clusterFilter?: number | null;
  /** Increment to re-fit the camera ("Reset View"). */
  resetKey?: number;
  className?: string;
}

// Positions survive re-renders, filter changes and page navigation so the
// layout never jumps (PRD §6.1 "layout must remain stable").
const positionCache = new Map<string, { x: number; y: number }>();

function nodeSize(volume: number, maxVol: number, compact: boolean) {
  const s = Math.sqrt(volume / Math.max(maxVol, 1e-9));
  return compact ? 12 + 22 * s : 16 + 34 * s;
}

function buildElements(data: GraphData, compact: boolean): ElementDefinition[] {
  const maxVol = Math.max(...data.nodes.map((n) => n.volume), 0);
  const maxW = Math.max(...data.edges.map((e) => e.weight), 0);
  const nodes: ElementDefinition[] = data.nodes.map((n) => ({
    group: "nodes",
    data: {
      ...n,
      label: shortAddr(n.id, 6, 4),
      color: RISK_COLOR[n.risk] ?? "#4B5874",
      size: nodeSize(n.volume, maxVol, compact),
    },
    position: positionCache.get(n.id) ? { ...positionCache.get(n.id)! } : undefined,
  }));
  const edges: ElementDefinition[] = data.edges.map((e) => ({
    group: "edges",
    data: { ...e, width: 1 + 5 * Math.sqrt(e.weight / Math.max(maxW, 1e-9)) },
  }));
  return [...nodes, ...edges];
}

const STYLE: cytoscape.StylesheetJson = [
  {
    selector: "node",
    style: {
      "background-color": "data(color)",
      width: "data(size)",
      height: "data(size)",
      "border-width": 1.5,
      "border-color": "#0A0E17",
      label: "",
      color: "#F1F5F9",
      "font-family": "Consolas, JetBrains Mono, monospace",
      "font-size": 10,
      "text-valign": "top",
      "text-margin-y": -6,
      "text-background-color": "#111827",
      "text-background-opacity": 0.9,
      "text-background-padding": "3px",
      "text-background-shape": "roundrectangle",
      "underlay-color": "data(color)",
      "underlay-opacity": 0,
      "underlay-padding": 0,
      "underlay-shape": "ellipse",
      "transition-property": "opacity, border-width, underlay-opacity",
      "transition-duration": 200,
    } as cytoscape.Css.Node,
  },
  { selector: "node.hover", style: { label: "data(label)", "z-index": 20 } },
  {
    selector: "node.selected",
    style: {
      "border-width": 3,
      "border-color": "#F1F5F9",
      "underlay-opacity": 0.35,
      "underlay-padding": 10,
      label: "data(label)",
      "z-index": 30,
    } as cytoscape.Css.Node,
  },
  { selector: "node.hidden, edge.hidden", style: { display: "none" } },
  { selector: "node.far", style: { opacity: 0.15 } },
  { selector: "node.hop2", style: { opacity: 0.6 } },
  {
    selector: "edge",
    style: {
      width: "data(width)",
      "line-color": "#3A4660",
      "target-arrow-color": "#3A4660",
      "target-arrow-shape": "triangle",
      "arrow-scale": 0.8,
      "curve-style": "bezier",
      opacity: 0.7,
      "transition-property": "opacity, line-color",
      "transition-duration": 200,
    },
  },
  { selector: "edge.hop1", style: { opacity: 1, "line-color": "#6B7FA3", "target-arrow-color": "#6B7FA3", "z-index": 10 } },
  { selector: "edge.hop2", style: { opacity: 0.4 } },
  { selector: "edge.far", style: { opacity: 0.1 } },
];

export function TransactionGraph({
  data, mode = "full", selectedWalletId, onSelectWallet, visibleIds = null, riskFilter = null,
  flaggedFilter = "all", clusterFilter = null, resetKey = 0, className,
}: TransactionGraphProps) {
  const compact = mode === "compact";
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const onSelectRef = useRef(onSelectWallet);
  onSelectRef.current = onSelectWallet;
  const [hover, setHover] = useState<{ node: GraphNode; x: number; y: number } | null>(null);

  const dataKey = useMemo(
    () => data.nodes.map((n) => n.id).sort().join("|") + "#" + data.edges.length,
    [data],
  );

  // ---- mount / data change ------------------------------------------------
  useEffect(() => {
    if (!containerRef.current) return;
    const cy = cytoscape({
      container: containerRef.current,
      elements: buildElements(data, compact),
      style: STYLE,
      layout: { name: "preset" },
      minZoom: 0.3,
      maxZoom: 1.8,
      userZoomingEnabled: !compact,
      userPanningEnabled: !compact,
      boxSelectionEnabled: false,
      autoungrabify: compact,
    });
    cyRef.current = cy;

    const missing = cy.nodes().filter((n) => !positionCache.has(n.id()));
    const finish = () => {
      cy.nodes().forEach((n) => { positionCache.set(n.id(), { ...n.position() }); });
      cy.fit(undefined, compact ? 16 : 40);
    };
    if (missing.length === 0) {
      finish();
    } else if (missing.length === cy.nodes().length) {
      // Deterministic seed (circle sorted by id) + force layout, run once.
      cy.nodes().sort((a, b) => a.id().localeCompare(b.id()))
        .layout({ name: "circle", animate: false }).run();
      const layout = cy.layout({
        name: "cose", animate: false, randomize: false, nodeRepulsion: () => 9000,
        idealEdgeLength: () => 80, gravity: 0.35, numIter: 1500, nodeOverlap: 12,
      } as cytoscape.LayoutOptions);
      layout.one("layoutstop", finish);
      layout.run();
    } else {
      // Place newcomers around their known neighbours; keep existing positions fixed.
      missing.forEach((n) => {
        const known = n.neighborhood().nodes().filter((m) => positionCache.has(m.id()));
        const c = { x: 0, y: 0 };
        known.forEach((m) => {
          const p = positionCache.get(m.id())!;
          c.x += p.x / known.length;
          c.y += p.y / known.length;
        });
        n.position({ x: c.x + (Math.random() - 0.5) * 80, y: c.y + (Math.random() - 0.5) * 80 });
      });
      finish();
    }

    cy.on("mouseover", "node", (e) => {
      const n = e.target as NodeSingular;
      n.addClass("hover");
      const p = n.renderedPosition();
      setHover({ node: n.data() as GraphNode, x: p.x, y: p.y - n.renderedHeight() / 2 });
      if (containerRef.current) containerRef.current.style.cursor = "pointer";
    });
    cy.on("mouseout", "node", (e) => {
      (e.target as NodeSingular).removeClass("hover");
      setHover(null);
      if (containerRef.current) containerRef.current.style.cursor = "";
    });
    cy.on("pan zoom", () => setHover(null));
    cy.on("dragfree", "node", (e) => positionCache.set(e.target.id(), { ...e.target.position() }));
    cy.on("tap", "node", (e) => onSelectRef.current?.((e.target as NodeSingular).id()));

    return () => { cy.destroy(); cyRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey, compact]);

  // ---- filters (visibility only — never re-layout) -------------------------
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.batch(() => {
      cy.nodes().forEach((n) => {
        const d = n.data() as GraphNode;
        const ok =
          (!visibleIds || visibleIds.has(d.id)) &&
          (!riskFilter || riskFilter.size === 0 || riskFilter.has(d.risk)) &&
          (flaggedFilter === "all" || (flaggedFilter === "flagged" ? d.flagged : !d.flagged)) &&
          (clusterFilter === null || d.cluster === clusterFilter);
        // Always keep the selected wallet visible so context isn't lost.
        n.toggleClass("hidden", !ok && d.id !== selectedWalletId);
      });
      cy.edges().forEach((e) => {
        e.toggleClass("hidden", e.source().hasClass("hidden") || e.target().hasClass("hidden"));
      });
    });
  }, [dataKey, visibleIds, riskFilter, flaggedFilter, clusterFilter, selectedWalletId]);

  // ---- selection emphasis: 1-hop 100%, 2-hop ~40%, beyond ~10% --------------
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.batch(() => {
      cy.elements().removeClass("selected hop1 hop2 far");
      const sel = selectedWalletId ? cy.getElementById(selectedWalletId) : null;
      if (!sel || sel.empty()) return;
      sel.addClass("selected");
      const vis = cy.elements().not(".hidden");
      const n1 = sel.closedNeighborhood().intersection(vis);
      const n2 = n1.closedNeighborhood().intersection(vis);
      const hop1Nodes = n1.nodes();
      const hop2Nodes = n2.nodes().difference(hop1Nodes);
      sel.connectedEdges().addClass("hop1");
      n2.edges().difference(sel.connectedEdges()).addClass("hop2");
      vis.edges().difference(n2.edges()).addClass("far");
      hop2Nodes.addClass("hop2");
      vis.nodes().difference(n2.nodes()).addClass("far");
    });
    const sel = selectedWalletId ? cy.getElementById(selectedWalletId) : null;
    if (sel && sel.nonempty() && !sel.hasClass("hidden")) {
      const target = sel.closedNeighborhood().not(".hidden");
      if (compact) cy.fit(undefined, 16);
      else cy.animate({ fit: { eles: target, padding: 70 }, duration: prefersReducedMotion() ? 0 : 450, easing: "ease-out-cubic" });
    }
  }, [selectedWalletId, dataKey, visibleIds, riskFilter, flaggedFilter, clusterFilter, compact]);

  // ---- reset view -------------------------------------------------------------
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || resetKey === 0) return;
    cy.animate({ fit: { eles: cy.elements().not(".hidden"), padding: 40 }, duration: prefersReducedMotion() ? 0 : 350 });
  }, [resetKey]);

  // ---- pulsing ring on unselected high-risk nodes (2.5s loop) --------------
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    const reduce = prefersReducedMotion();
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const phase = ((t - start) % 2500) / 2500;
      const s = (1 - Math.cos(phase * 2 * Math.PI)) / 2; // ease-in-out 0→1→0
      cy.batch(() => {
        cy.nodes().forEach((n) => {
          if (n.hasClass("selected")) return;
          if (n.data("risk") === "High" && !n.hasClass("hidden")) {
            n.style({ "underlay-opacity": reduce ? 0.2 : 0.08 + 0.3 * (1 - s), "underlay-padding": reduce ? 5 : 3 + 9 * s });
          } else if (n.style("underlay-opacity") !== "0") {
            n.removeStyle("underlay-opacity underlay-padding");
          }
        });
      });
      if (!reduce) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [dataKey, selectedWalletId]);

  // Clear inline pulse styles on the selected node so the solid glow shows.
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !selectedWalletId) return;
    cy.getElementById(selectedWalletId).removeStyle("underlay-opacity underlay-padding");
  }, [selectedWalletId]);

  return (
    <div className={cn("relative h-full w-full overflow-hidden", className)}>
      <div ref={containerRef} className="absolute inset-0" aria-label="Transaction network graph" role="application" />
      {hover && (
        <div
          className="pointer-events-none absolute z-20 w-60 -translate-x-1/2 -translate-y-full rounded-lg border border-subtle bg-panel/95 p-3 text-xs shadow-xl backdrop-blur"
          style={{ left: hover.x, top: hover.y - 10 }}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-primary">{shortAddr(hover.node.id, 8, 6)}</span>
            <RiskPill risk={hover.node.risk} size="sm" />
          </div>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-secondary">
            <dt>Risk score</dt><dd className="text-right tabular-nums text-primary">{hover.node.score.toFixed(1)}</dd>
            <dt>Transactions</dt><dd className="text-right tabular-nums text-primary">{hover.node.tx_count}</dd>
            <dt>BTC volume</dt><dd className="text-right tabular-nums text-primary">{fmtBtc(hover.node.volume, 3)}</dd>
            <dt>Counterparties</dt><dd className="text-right tabular-nums text-primary">{hover.node.counterparties}</dd>
            <dt>Last activity</dt><dd className="text-right text-primary">{fmtDate(hover.node.last_activity)}</dd>
          </dl>
        </div>
      )}
    </div>
  );
}

export function GraphLegend({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-secondary", className)}>
      {(["High", "Medium", "Low"] as const).map((r) => (
        <span key={r} className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: RISK_COLOR[r] }} /> {r}
        </span>
      ))}
      <span>Node size: BTC volume</span>
      <span>Edge width: amount</span>
    </div>
  );
}
