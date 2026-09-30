# blocksense

AI-assisted Bitcoin transaction intelligence console (SIH 2026, PS 26146).
It surfaces anomalies and risk signals for investigation. It never asserts guilt or identity.

- `backend/`: FastAPI, pandas, scikit-learn (Isolation Forest), NetworkX
- `frontend/`: React 18, TypeScript, Vite, Tailwind, TanStack Query, Cytoscape.js, Recharts, Framer Motion

## Run it

**Quick start on Windows:** double-click `start-backend.bat`, then `start-frontend.bat`,
and open http://localhost:5173. The first run installs packages and takes a few minutes.
(Mac/Linux: `./start-backend.sh` and `./start-frontend.sh` in two terminals.)

**Manual steps:**

You need Python 3.10+ and Node 18+.

**1. Backend** (terminal 1)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --port 8000
```

API docs: http://localhost:8000/docs

**2. Frontend** (terminal 2)

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. Vite proxies `/api` to port 8000, so no CORS setup is needed.

**Tests**

```bash
cd backend && pytest -q
```

## Deploy to GitHub Pages

The hosted version needs no server. On every push to `main`, GitHub Actions
(`.github/workflows/deploy.yml`) does the following:

1. Installs the backend and runs the test suite.
2. Runs the full analysis pipeline on the CSV (`backend/export_static.py`) and saves every API
   response as JSON. Each file is validated against the same Pydantic schemas the live API uses.
3. Builds the frontend in static mode, reading those JSON files instead of calling `/api`.
4. Publishes the result to GitHub Pages.

**One-time setup**

1. Create a new repository on GitHub (for example `blocksense`). Public repos get Pages for free.
2. Push this folder to it on the `main` branch:
   ```bash
   git init
   git add .
   git commit -m "BlockSense"
   git branch -M main
   git remote add origin https://github.com/<your-username>/blocksense.git
   git push -u origin main
   ```
3. In the repo, go to **Settings > Pages** and set **Source** to **GitHub Actions**.
4. Open the **Actions** tab and wait for "Deploy to GitHub Pages" to finish (about 2–3 minutes).
   If it ran before step 3 and failed, click **Re-run all jobs**.
5. The site is at `https://<your-username>.github.io/blocksense/`.

After that, every `git push` redeploys automatically. To use a new dataset, replace the CSV in
`backend/data/` and push.

**Static vs live mode.** The hosted site shows a snapshot computed in CI; the About panel shows
when. The loading screen lists the real files it loads rather than backend stages. For a live
demo of the model running, use the local setup above: the same code runs as a FastAPI server.

**Build the static site locally**

```bash
cd backend && python export_static.py
cd ../frontend && npm run build:static
```

The output is in `frontend/dist/`. Set `VITE_BASE=/blocksense/` to test under a sub-path.

## Using your own data

Replace `backend/data/blocksense_transactions_75.csv`, or point to another file:

```bash
BLOCKSENSE_DATA=/path/to/file.csv uvicorn main:app --port 8000
```

Required columns: `transaction_id, timestamp, sender_wallet, receiver_wallet, amount_btc`.
Optional ground-truth columns: `sender_label, receiver_label, scenario_type`.
They are removed at load time and only used by `/api/evaluation`.

`BLOCKSENSE_STAGE_DELAY` (default `0.35` seconds) adds a short pause between startup
stages so the loading screen visibly shows each real stage. Set it to `0` to start instantly.

## How scoring works

1. **Features per wallet** (labels never used):
   - Behavioural: volume, counts, fan-in/out, pass-through ratio.
   - Temporal: bursts, intervals, receive-to-forward delay.
   - Network: degree, PageRank, betweenness, clustering.
2. **Isolation Forest** runs on the full feature matrix. Separate forests per group give the
   Behavioural 40% / Temporal 30% / Network 30% breakdown.
3. **Typology signal.** Five label-free AML indicators that give anomalies a *direction*:
   - off-hours activity (00:00–06:00 UTC),
   - rapid forwarding (under 60 min),
   - peel-chain re-sends (within 3% of the amount just received),
   - fan-in/out within 2 hours,
   - structuring (similar-sized sends within 2 hours).
4. **Base score** = 0.45 × anomaly + 0.55 × typology, min-max scaled to 0–100.
5. **Network-adjusted score** = 0.7 × own base + 0.3 × neighbour average, capped at 2 rounds.
   This score sets the category: High ≥ 75, Medium 50–74, Low < 50. Flagged = score ≥ 50.
6. **Explanations** compare each feature with the network median and standard deviation.
   Values over 2σ are marked strong. All text comes from templates filled with real numbers.

### Why a typology signal was added

On this dataset, Isolation Forest alone ranks legitimate hubs (exchange, merchant, treasury)
as most anomalous, and scores worse than random (AUC 0.38). Suspicious wallets are 11 of 25,
so they are not rare, which is the case Isolation Forest is built for. The typology indicators
separate "unusual" from "unusual in a laundering-like way".

### Evaluation (be upfront about this)

At a threshold of 50: precision 0.79, recall 1.00, F1 0.88. All 11 labelled-suspicious wallets
are flagged. The exchange, merchant and payroll hub are also flagged for review.

The indicators were designed with this dataset in view. With 25 wallets, the metrics
illustrate the approach; they are not evidence of real-world performance.

## API

| Endpoint | Purpose |
|---|---|
| `GET /api/status` | Startup stage and readiness |
| `GET /api/summary` | KPIs, date range, risk clusters |
| `GET /api/wallets` | Watchlist. Query params: `sort`, `order`, `flag`, `risk`, `min_score`, `max_score`, `q` |
| `GET /api/wallet/{id}` | Profile, scores, metrics, explanations, counterparties |
| `GET /api/wallet/{id}/transactions` | Wallet transactions |
| `GET /api/wallet/{id}/network?depth=1\|2` | Ego graph |
| `GET /api/network` | Full graph. Query params: `risk`, `flag`, `cluster` |
| `GET /api/temporal` | Daily series, hour × date heatmap, activity by risk level |
| `GET /api/evaluation` | Post-hoc precision / recall / F1 |

Errors return `{"error": {"code", "message", "details"}}`:
400 for bad input, 404 for an unknown wallet, 503 while still initializing.

## Notes

- **Risk clusters.** The whole dataset forms one connected network. "High-risk clusters" therefore
  counts the connected groups among *flagged* wallets that contain at least one High-risk wallet.
- **Entity Investigation with no wallet ID** opens the currently selected wallet. With no selection,
  it opens the highest-risk wallet.
- **Font.** The whole UI uses Consolas (bundled with Windows). Machines without it fall back to
  JetBrains Mono from Google Fonts, then to the system monospace font.
- **shadcn/ui.** Button and Tooltip are written in the shadcn pattern (Radix + CVA) and restyled
  to the PRD tokens. There is no CLI setup to run.
