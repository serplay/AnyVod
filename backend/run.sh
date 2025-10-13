#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/app"
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
