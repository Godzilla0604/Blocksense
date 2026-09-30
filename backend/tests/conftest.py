import os
import sys
from pathlib import Path

os.environ.setdefault("BLOCKSENSE_STAGE_DELAY", "0")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
