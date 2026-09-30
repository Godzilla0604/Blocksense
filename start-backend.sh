#!/usr/bin/env bash
cd "$(dirname "$0")/backend"
[ -d .venv ] || { python3 -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt; }
. .venv/bin/activate
uvicorn main:app --port 8000
