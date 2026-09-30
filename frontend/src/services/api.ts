import type {
  ApiErrorBody, Evaluation, GraphData, Status, Summary, Temporal, WalletDetail, WalletRow, WalletTx,
} from "@/types/api";

/**
 * Two data modes, same contract:
 *  - "api"    (default): live FastAPI backend at /api (dev proxy or VITE_API_BASE)
 *  - "static" (GitHub Pages): precomputed JSON from backend/export_static.py,
 *             served from <BASE_URL>data/
 */
export const STATIC_MODE = import.meta.env.VITE_DATA_MODE === "static";
const API_BASE = import.meta.env.VITE_API_BASE ?? "";
const DATA_BASE = `${import.meta.env.BASE_URL}data`;
const WALLET_RE = /^[A-Za-z0-9]{8,100}$/;

export class ApiError extends Error {
  constructor(public code: number, message: string, public details = "") {
    super(message);
  }
}

async function get<T>(url: string, notFound?: { message: string; details: string }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch (e) {
    throw STATIC_MODE
      ? new ApiError(0, "Can't load analysis data", `Network error fetching ${url} (${String(e)})`)
      : new ApiError(0, "Can't reach the BlockSense API", `Is the backend running on port 8000? (${String(e)})`);
  }
  if (!res.ok) {
    if (res.status === 404 && notFound) throw new ApiError(404, notFound.message, notFound.details);
    let body: ApiErrorBody | null = null;
    try { body = await res.json(); } catch { /* not JSON */ }
    throw new ApiError(
      res.status,
      body?.error?.message ?? `Request failed (${res.status})`,
      body?.error?.details ?? `${url} returned ${res.status} ${res.statusText}`,
    );
  }
  return res.json() as Promise<T>;
}

function checkId(id: string) {
  if (!WALLET_RE.test(id)) throw new ApiError(400, "Invalid wallet ID", "Wallet IDs are 8-100 alphanumeric characters.");
}

const walletMissing = (id: string) => ({ message: "Wallet not found", details: `No wallet ${id} in the monitored network.` });
const enc = encodeURIComponent;

const liveApi = {
  status: () => get<Status>(`${API_BASE}/api/status`),
  summary: () => get<Summary>(`${API_BASE}/api/summary`),
  wallets: () => get<WalletRow[]>(`${API_BASE}/api/wallets?sort=risk&order=desc`),
  wallet: (id: string) => get<WalletDetail>(`${API_BASE}/api/wallet/${enc(id)}`),
  walletTransactions: (id: string) => get<WalletTx[]>(`${API_BASE}/api/wallet/${enc(id)}/transactions`),
  walletNetwork: (id: string, depth: 1 | 2) => get<GraphData>(`${API_BASE}/api/wallet/${enc(id)}/network?depth=${depth}`),
  network: () => get<GraphData>(`${API_BASE}/api/network`),
  temporal: () => get<Temporal>(`${API_BASE}/api/temporal`),
  evaluation: () => get<Evaluation>(`${API_BASE}/api/evaluation`),
};

const staticApi: typeof liveApi = {
  // No server to poll: the static snapshot is always "ready".
  status: async () => ({ stage: "Ready", stage_index: 5, stages: [], progress: 100, ready: true }),
  summary: () => get<Summary>(`${DATA_BASE}/summary.json`),
  wallets: () => get<WalletRow[]>(`${DATA_BASE}/wallets.json`),
  wallet: async (id) => { checkId(id); return get<WalletDetail>(`${DATA_BASE}/wallet/${id}/detail.json`, walletMissing(id)); },
  walletTransactions: async (id) => { checkId(id); return get<WalletTx[]>(`${DATA_BASE}/wallet/${id}/transactions.json`, walletMissing(id)); },
  walletNetwork: async (id, depth) => { checkId(id); return get<GraphData>(`${DATA_BASE}/wallet/${id}/network-${depth}.json`, walletMissing(id)); },
  network: () => get<GraphData>(`${DATA_BASE}/network.json`),
  temporal: () => get<Temporal>(`${DATA_BASE}/temporal.json`),
  evaluation: () => get<Evaluation>(`${DATA_BASE}/evaluation.json`),
};

export const api = STATIC_MODE ? staticApi : liveApi;
