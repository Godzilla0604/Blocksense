// Shared types mirroring the backend contract (Frontend PRD §8, Backend PRD §13).
export type RiskCategory = "High" | "Medium" | "Low";
export type FeatureGroup = "behavioural" | "temporal" | "network";

export interface Status {
  stage: string;
  stage_index: number;
  stages: string[];
  progress: number;
  ready: boolean;
  wallet_count?: number | null;
  error?: string | null;
}

export interface RiskCluster {
  id: number;
  size: number;
  wallets: string[];
  high: number;
  medium: number;
}

export interface Summary {
  wallet_count: number;
  tx_count: number;
  volume: number;
  flagged_count: number;
  clusters: number;
  risk_cluster_count: number;
  network_components: number;
  risk_counts: Record<RiskCategory, number>;
  date_range: { start: string; end: string };
  highest_risk_wallet: string | null;
  risk_clusters: RiskCluster[];
  meta: { environment: string };
  /** Present only in the static (GitHub Pages) snapshot. */
  exported_at?: string;
  source_file?: string;
}

export interface WalletRow {
  id: string;
  risk_category: RiskCategory;
  composite_score: number;
  base_score: number;
  propagated_score: number;
  flagged: boolean;
  tx_count: number;
  volume: number;
  counterparties: number;
  degree: number;
  last_activity: string;
  cluster: number;
  primary_reason: string;
}

export interface Explanation {
  factor: string;
  feature: string;
  group: FeatureGroup;
  value: number;
  baseline: number;
  deviation: number;
  severity: "strong" | "supporting";
  direction: string;
  value_display: string;
  baseline_display: string;
  description: string;
}

export interface WalletMetrics {
  tx_count: number;
  in_tx: number;
  out_tx: number;
  total_volume: number;
  in_volume: number;
  out_volume: number;
  net_flow: number;
  counterparties: number;
  fan_in: number;
  fan_out: number;
  avg_tx_size: number;
  max_tx_size: number;
  degree: number;
  in_degree: number;
  out_degree: number;
  pagerank: number;
  betweenness: number;
  clustering: number;
  first_activity: string;
  last_activity: string;
  activity_span_days: number;
  burst_ratio: number;
  median_interval_h: number;
}

export interface Counterparty {
  wallet: string;
  in_volume: number;
  out_volume: number;
  tx_count: number;
  risk_category: RiskCategory;
}

export interface WalletDetail extends WalletRow {
  metrics: WalletMetrics;
  component_scores: Record<FeatureGroup, { score: number; weight: number; share: number }>;
  model: { isolation_forest: number; anomaly_score: number; typology_score: number };
  explanations: Explanation[];
  top_counterparties: Counterparty[];
}

export interface WalletTx {
  tx_id: string;
  timestamp: string;
  amount: number;
  direction: "in" | "out";
  counterparty: string;
}

export interface GraphNode {
  id: string;
  risk: RiskCategory;
  score: number;
  base_score: number;
  flagged: boolean;
  tx_count: number;
  volume: number;
  counterparties: number;
  last_activity: string;
  cluster: number;
  hop?: number | null;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  weight: number;
  timestamp: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface Temporal {
  dates: string[];
  daily_txs: { date: string; count: number }[];
  daily_vol: { date: string; volume: number }[];
  heatmap: { date: string; hour: number; count: number; volume: number }[];
  risk_timeline: ({ date: string } & Record<string, number | string>)[];
}

export interface Evaluation {
  precision: number;
  recall: number;
  f1: number;
  confusion: { tp: number; fp: number; fn: number; tn: number };
  threshold: number;
  wallets_evaluated: number;
  ground_truth_suspicious: number;
  note: string;
}

export interface ApiErrorBody {
  error: { code: number; message: string; details: string };
}
