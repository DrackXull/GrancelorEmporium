#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
VENV="$BACKEND/.venv"

usage() {
  cat <<EOF
Usage: $0 [--tunnel=cloudflare|ngrok|none]

Builds the React app, copies it to backend/static, starts FastAPI on 127.0.0.1:8000,
and optionally opens a public HTTPS tunnel (single URL serves SPA + /api).

Examples:
  $0 --tunnel=none         # local-only
  $0 --tunnel=cloudflare   # quick, free trycloudflare.com URL
  $0 --tunnel=ngrok        # ngrok URL (ephemeral unless you have reserved domain)
EOF
}

TUNNEL="${1:-"--tunnel=none"}"
TUNNEL="${TUNNEL#--tunnel=}"

if [[ "$TUNNEL" != "cloudflare" && "$TUNNEL" != "ngrok" && "$TUNNEL" != "none" ]]; then
  usage; exit 1
fi

echo "==> Building frontend"
pushd "$FRONTEND" >/dev/null
# IMPORTANT: ensure same-origin in production build (no external API base)
VITE_API_BASE="" npm install >/dev/null 2>&1 || npm install
VITE_API_BASE="" npm run build
popd >/dev/null

echo "==> Syncing build into backend/static"
mkdir -p "$BACKEND/static"
rsync -a --delete "$FRONTEND/dist/" "$BACKEND/static/"

echo "==> Ensuring Python venv"
python3 -m venv "$VENV" 2>/dev/null || true
# shellcheck disable=SC1091
source "$VENV/bin/activate"
pip install --upgrade pip >/dev/null
pip install -r "$ROOT/requirements.txt" >/dev/null

echo "==> Starting backend (http://127.0.0.1:8000)"
pushd "$BACKEND" >/dev/null
( uvicorn main:app --host 127.0.0.1 --port 8000 --reload ) &
BACK_PID=$!
popd >/dev/null

# wait for server
for i in {1..60}; do
  if curl -fsS "http://127.0.0.1:8000/assets" >/dev/null 2>&1 || curl -fsS "http://127.0.0.1:8000" >/dev/null 2>&1; then
    break
  fi
  sleep 0.3
done

PUBLIC_URL="http://127.0.0.1:8000"

if [[ "$TUNNEL" == "cloudflare" ]]; then
  if ! command -v cloudflared >/dev/null 2>&1; then
    echo "WARN: cloudflared not found. Install:"
    echo "  curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared && chmod +x cloudflared && sudo mv cloudflared /usr/local/bin/"
  else
    echo "==> Opening Cloudflare quick tunnel…"
    ( cloudflared tunnel --url http://127.0.0.1:8000 2>&1 | tee "$ROOT/.cf.out" ) &
    for i in {1..60}; do
      if grep -Eo 'https://[a-zA-Z0-9.-]+\.trycloudflare\.com' "$ROOT/.cf.out" >/dev/null 2>&1; then
        PUBLIC_URL="$(grep -Eo 'https://[a-zA-Z0-9.-]+\.trycloudflare\.com' "$ROOT/.cf.out" | head -n1)"
        break
      fi
      sleep 0.3
    done
  fi
elif [[ "$TUNNEL" == "ngrok" ]]; then
  if ! command -v ngrok >/dev/null 2>&1; then
    echo "WARN: ngrok not found. Install from https://ngrok.com/download and run:"
    echo "  ngrok config add-authtoken <YOUR_TOKEN>"
  else
    echo "==> Opening ngrok tunnel…"
    ( ngrok http --log=stdout 8000 | tee "$ROOT/.ngrok.out" ) &
    for i in {1..60}; do
      if grep -Eo 'ngrok http --domain=stallion-tough-secretly.ngrok-free.app 8000' "$ROOT/.ngrok.out" >/dev/null 2>&1; then
        PUBLIC_URL="$(grep -Eo 'ngrok http --domain=stallion-tough-secretly.ngrok-free.app 8000' "$ROOT/.ngrok.out" | head -n1)"
        break
      fi
      sleep 0.3
    done
  fi
fi

echo
echo "================================================================"
echo "  Single-URL app is live at:  $PUBLIC_URL"
echo "  (Serves SPA + /api/* from the same origin)"
echo "================================================================"
echo
wait $BACK_PID
