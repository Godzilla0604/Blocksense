"""Central configuration: paths, thresholds, weights. Override with env vars."""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = Path(os.getenv("BLOCKSENSE_DATA", BASE_DIR / "data" / "blocksense_transactions_75.csv"))

# Columns that carry ground truth. They are stripped at ingestion and only
# re-read by the evaluation module AFTER scoring is complete.
LABEL_COLUMNS = ["sender_label", "receiver_label", "scenario_type"]

# Risk thresholds (PRD §9)
HIGH_THRESHOLD = 75.0
MEDIUM_THRESHOLD = 50.0

# Component weighting (PRD §9): behavioural / temporal / network
COMPONENT_WEIGHTS = {"behavioural": 0.40, "temporal": 0.30, "network": 0.30}

# Base score blend: unsupervised anomaly strength vs. typology direction
ANOMALY_WEIGHT = 0.45
TYPOLOGY_WEIGHT = 0.55

# Risk propagation (PRD §10)
PROPAGATION_SELF_WEIGHT = 0.7
PROPAGATION_NEIGHBOR_WEIGHT = 0.3
PROPAGATION_ITERATIONS = 2  # hard cap to prevent echo-chamber inflation

# Isolation Forest
IF_N_ESTIMATORS = 300
IF_RANDOM_STATE = 42

# Temporal burst window (PRD §7)
BURST_WINDOW_DAYS = 3

# Explainability (PRD §11)
EXPLAIN_STRONG_SIGMA = 2.0     # ">2 std from median" => strong reason
EXPLAIN_SUPPORT_SIGMA = 1.0    # shown as supporting signal
EXPLAIN_MAX_FACTORS = 5

# Ego graph limits
MAX_EGO_DEPTH = 2

# Optional pause between startup stages so the frontend's initialization
# screen can visibly show each real stage. Set to 0 for tests / production.
STAGE_DELAY_SECONDS = float(os.getenv("BLOCKSENSE_STAGE_DELAY", "0.35"))

CORS_ORIGINS = os.getenv(
    "BLOCKSENSE_CORS", "http://localhost:5173,http://127.0.0.1:5173"
).split(",")
