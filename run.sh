#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
VENV_DIR="$BACKEND_DIR/.venv"

killbg() {
  jobs -p | xargs -r kill
}
trap killbg EXIT

echo "==> Checking Python..."
if ! command -v python3 >/dev/null 2>&1; then
  echo "ERROR: python3 not found. Install Python 3 first." >&2
  exit 1
fi

# Check that venv is available
if ! python3 -m venv --help >/dev/null 2>&1; then
  echo "ERROR: The venv module is missing. On Ubuntu/WSL run:" >&2
  echo "  sudo apt update && sudo apt install -y python3-venv" >&2
  exit 1
fi

# Create venv if missing
if [ ! -d "$VENV_DIR" ]; then
  echo "==> Creating backend virtualenv..."
  python3 -m venv "$VENV_DIR"
  # shellcheck disable=SC1091
  source "$VENV_DIR/bin/activate"
  python -m pip install --upgrade pip
  python -m pip install -r "$ROOT_DIR/requirements.txt"
  deactivate
fi

echo "==> Starting backend on http://localhost:8000 ..."
(
  # shellcheck disable=SC1091
  source "$VENV_DIR/bin/activate"
  cd "$BACKEND_DIR"
  exec uvicorn main:app --reload --port 8000
) &

echo "==> Starting frontend on http://localhost:5173 ..."
cd "$FRONTEND_DIR"
if [ ! -d "node_modules" ]; then
  npm install
fi
exec npm run dev
