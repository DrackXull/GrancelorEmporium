#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./serve_onehost_ngrok.sh <your-ngrok-domain>
# Example:
#   ./serve_onehost_ngrok.sh stallion-tough-secretly.ngrok-free.app

NGROK_DOMAIN="${1:-}"
if [[ -z "${NGROK_DOMAIN}" ]]; then
  echo "ERROR: missing ngrok domain. Example:"
  echo "  ./serve_onehost_ngrok.sh stallion-tough-secretly.ngrok-free.app"
  exit 1
fi

# --- Paths / config -------------------------------------------------
ROOT="$(cd "$(dirname "$0")" && pwd)"
FRONTEND="$ROOT/frontend"
BACKEND="$ROOT/backend"
STATIC_DIR="$BACKEND/static"
VENV="$BACKEND/.venv"
PORT="${PORT:-8000}"
HOST="127.0.0.1"
UVICORN_APP="backend.main:app"   # keep package path; run from repo root
# -------------------------------------------------------------------

echo "==> (1/6) Building frontend for same-origin API"
cd "$FRONTEND"
npm run build

echo "==> (2/6) Syncing build to backend/static"
mkdir -p "$STATIC_DIR"
rsync -a --delete "$FRONTEND/dist/" "$STATIC_DIR/"

echo "==> (3/6) Ensuring Python venv + deps at $VENV"
cd "$ROOT"
python3 -m venv "$VENV" >/dev/null 2>&1 || true
# shellcheck disable=SC1091
source "$VENV/bin/activate"
pip install -U pip >/dev/null
pip install -r "$ROOT/requirements.txt" >/dev/null
# ensure 'backend' is a package for 'backend.main:app'
[ -f "$BACKEND/__init__.py" ] || touch "$BACKEND/__init__.py"
deactivate

# Stop anything old
pkill -f "uvicorn .*:${PORT}" 2>/dev/null || true
pkill -f "uvicorn ${UVICORN_APP}" 2>/dev/null || true
pkill -f "ngrok http" 2>/dev/null || true
sleep 0.25

echo "==> (4/6) Starting backend on ${HOST}:${PORT}"
(
  # shellcheck disable=SC1091
  source "$VENV/bin/activate"
  cd "$ROOT"   # IMPORTANT: run from repo root so 'backend' is importable
  exec uvicorn "${UVICORN_APP}" --host "${HOST}" --port "${PORT}" --reload
) &

echo "==> (5/6) Waiting for backend health..."
set +e
for i in {1..80}; do
  sleep 0.25
  curl -fs "http://${HOST}:${PORT}/api/ping" >/dev/null && break
done
set -e

# ---- NGROK ---------------------------------------------------------
if ! command -v ngrok >/dev/null 2>&1; then
  echo "WARNING: 'ngrok' not found on PATH."
  echo "Install ngrok and set your authtoken:"
  echo "  https://ngrok.com/download"
  echo "  ngrok config add-authtoken <YOUR_TOKEN>"
  echo "Skipping ngrok step. Local dev is ready at http://${HOST}:${PORT}"
  exit 0
fi

echo "==> (6/6) Starting ngrok tunnel => https://${NGROK_DOMAIN}"
# For a specific subdomain/domain, your ngrok account must have it reserved.
# Logs go to .ngrok.log so you can inspect failures.
rm -f .ngrok.log
ngrok http "http://${HOST}:${PORT}" --domain="${NGROK_DOMAIN}" --log=stdout > .ngrok.log 2>&1 &
sleep 1

if curl -fs "https://${NGROK_DOMAIN}/api/ping" >/dev/null; then
  echo "Public URL: https://${NGROK_DOMAIN}"
else
  echo "NOTE: Could not verify https://${NGROK_DOMAIN}/api/ping yet."
  echo "Dumping ngrok logs:"
  tail -n 80 .ngrok.log || true
fi
