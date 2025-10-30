#!/usr/bin/env bash
# ==============================================================================
# Grancelor’s Emporium / TPKA WebApp
# prepare-branch.sh — Branch Prep + Session Bootstrap Utility
# ------------------------------------------------------------------------------
# WHAT THIS DOES
#   • Safely tags your current work-in-progress commit (timestamped).
#   • Creates and switches to a new development branch.
#   • (Optionally) builds the frontend and syncs dist → backend/static.
#   • Prints a ready-to-paste "NEW SESSION INIT" block for the next chat.
#
# QUICK START
#   chmod +x prepare-branch.sh
#   ./prepare-branch.sh
#
# RECOMMENDED FLOW (copy/paste)
#   ./prepare-branch.sh --version v0.7 --branch phase4-db-progression-v0.7
#   ./serve_onehost_ngrok.sh <your-ngrok-subdomain>.ngrok-free.app
#   # open ngrok URL, verify app, then paste the printed NEW SESSION INIT
#
# OPTIONS
#   -p, --path <dir>       Repo root (default: $HOME/tpka_webapp)
#   -v, --version <ver>    Display/status version string (default: v0.7)
#   -b, --branch <name>    Branch name (default: phase4-db-progression-<version>)
#   -s, --skip-build       Skip vite build + static sync
#   -n, --no-tag           Do not create a timestamp tag
#       --tag-prefix <p>   Tag prefix (default: v)
#   -d, --dry-run          Print actions, do nothing
#   -h, --help             Show this help
#
# SAFETY
#   • If working tree is dirty, we auto-commit ("Auto-save before branch prep")
#     unless you’re in --dry-run mode.
#   • Tag is purely for rollback convenience; disable with --no-tag.
#
# HOW-TO (LONG FORM)
#   1) Make sure your repo exists at ~/tpka_webapp (or pass --path).
#   2) Run: ./prepare-branch.sh  (or with options above).
#   3) The script:
#        a) Ensures you’re in the repo and on a committed state (auto-commit).
#        b) Creates a timestamp tag like v20251027-1430 (unless --no-tag).
#        c) Creates & switches to the new branch.
#        d) Builds the frontend (unless --skip-build).
#        e) Copies frontend/dist → backend/static (unless --skip-build).
#        f) Prints a NEW SESSION INIT block. Copy/paste it to start a new chat.
#   4) Start the app:
#        ./serve_onehost_ngrok.sh <your-ngrok>.ngrok-free.app
#   5) In the new chat, paste the NEW SESSION INIT and attach:
#        /backend/main.py
#        /backend/progression.py
#        /frontend/src/App.jsx
#
# TIPS
#   • If you only want the branch and tag, pass --skip-build.
#   • If you want a dry rehearsal, pass --dry-run.
#   • You can change the default version printed in the session header with --version.
#
# ==============================================================================

set -euo pipefail

# ----- Colors ---------------------------------------------------------------
Y="\033[1;33m"; G="\033[1;32m"; C="\033[1;36m"; R="\033[0m"

# ----- Defaults -------------------------------------------------------------
PROJECT_NAME="Grancelor’s Emporium"
REPO_ROOT="${HOME}/tpka_webapp"
TAG_PREFIX="v"
NEXT_VERSION="v0.7"
BRANCH_NAME=""          # if empty, derived from version
DO_BUILD=1
DO_TAG=1
DRY_RUN=0

# ----- Args -----------------------------------------------------------------
print_help() {
  sed -n '1,160p' "$0" | sed 's/^# \{0,1\}//' | sed '1,20d' | sed '1s/.*/(help truncated to relevant section)/' >/dev/null
  cat <<'EOS'
Usage: prepare-branch.sh [options]

Options:
  -p, --path <dir>       Repo root (default: $HOME/tpka_webapp)
  -v, --version <ver>    Display/status version string (default: v0.7)
  -b, --branch <name>    Branch name (default: phase4-db-progression-<version>)
  -s, --skip-build       Skip vite build + static sync
  -n, --no-tag           Do not create a timestamp tag
      --tag-prefix <p>   Tag prefix (default: v)
  -d, --dry-run          Print actions, do nothing
  -h, --help             Show this help
EOS
}

# Basic manual parse to support long/short flags
while [[ $# -gt 0 ]]; do
  case "$1" in
    -p|--path) REPO_ROOT="$2"; shift 2;;
    -v|--version) NEXT_VERSION="$2"; shift 2;;
    -b|--branch) BRANCH_NAME="$2"; shift 2;;
    -s|--skip-build) DO_BUILD=0; shift 1;;
    -n|--no-tag) DO_TAG=0; shift 1;;
    --tag-prefix) TAG_PREFIX="$2"; shift 2;;
    -d|--dry-run) DRY_RUN=1; shift 1;;
    -h|--help) print_help; exit 0;;
    *) echo "Unknown option: $1"; print_help; exit 1;;
  esac
done

if [[ -z "${BRANCH_NAME}" ]]; then
  BRANCH_NAME="phase4-db-progression-${NEXT_VERSION}"
fi

# ----- Helper to run or echo ------------------------------------------------
run() {
  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "DRY-RUN: $*"
  else
    eval "$@"
  fi
}

# ----- Start ---------------------------------------------------------------
echo -e "${C}==> Preparing new development branch for ${PROJECT_NAME}${R}"
echo "Repo root: ${REPO_ROOT}"
echo "Version  : ${NEXT_VERSION}"
echo "Branch   : ${BRANCH_NAME}"
echo "Tagging  : $([[ $DO_TAG -eq 1 ]] && echo YES || echo NO)"
echo "Build    : $([[ $DO_BUILD -eq 1 ]] && echo YES || echo NO)"
echo "Dry-run  : $([[ $DRY_RUN -eq 1 ]] && echo YES || echo NO)"
echo

# 1) Verify repo exists
if [[ ! -d "${REPO_ROOT}/.git" ]]; then
  echo "❌ Not a git repo: ${REPO_ROOT}"
  exit 1
fi
cd "${REPO_ROOT}"

# 2) Ensure clean commit (auto-commit if dirty)
if [[ -n "$(git status --porcelain)" ]]; then
  echo -e "${Y}⚠️  Working directory not clean. Auto-committing...${R}"
  run "git add -A"
  run "git commit -m 'Auto-save before branch prep'"
else
  echo -e "${G}✅ Working tree is clean${R}"
fi

# 3) Create timestamp tag (optional)
if [[ "$DO_TAG" -eq 1 ]]; then
  TS_TAG="${TAG_PREFIX}$(date +%Y%m%d-%H%M)"
  run "git tag -a '${TS_TAG}' -m 'Auto-tag pre-${BRANCH_NAME} baseline'"
  echo -e "${G}✅ Created tag ${TS_TAG}${R}"
else
  echo -e "${Y}⏭️  Skipping tag creation (--no-tag)${R}"
fi

# 4) Create & switch to branch
run "git checkout -b '${BRANCH_NAME}'"
echo -e "${G}✅ Switched to branch ${BRANCH_NAME}${R}"

# 5) Build + Sync (optional)
if [[ "$DO_BUILD" -eq 1 ]]; then
  echo -e "${C}==> Building frontend (vite)${R}"
  if [[ -d "frontend" ]]; then
    if command -v npm >/dev/null 2>&1; then
      run "cd frontend && npm run build"
    else
      echo -e "${Y}⚠️  npm not found; skipping build${R}"
    fi
  else
    echo -e "${Y}⚠️  No ./frontend directory; skipping build${R}"
  fi

  echo -e "${C}==> Syncing build to backend/static${R}"
  run "mkdir -p backend/static"
  if [[ -d "frontend/dist" ]]; then
    run "cp -r frontend/dist/* backend/static/ 2>/dev/null || true"
    echo -e "${G}✅ Synced dist → backend/static${R}"
  else
    echo -e "${Y}⚠️  No frontend/dist found; nothing to sync${R}"
  fi
else
  echo -e "${Y}⏭️  Skipping build & sync (--skip-build)${R}"
fi

# 6) Print NEW SESSION INIT block
echo
echo -e "${Y}-------------------------------------------------------------${R}"
cat <<EOF
NEW SESSION INIT:
Project: ${PROJECT_NAME}
Root: ${REPO_ROOT}
Frontend: React/Vite (CreatorPanel.jsx)
Backend: FastAPI (main.py, progression.py)
Status: ${NEXT_VERSION} running via ./serve_onehost_ngrok.sh
Objective (Phase 4): DB layer + data browser + progression UI
EOF
echo -e "${Y}-------------------------------------------------------------${R}"
echo

echo -e "${C}Now run:${R}"
echo "  ./serve_onehost_ngrok.sh <your-ngrok-subdomain>.ngrok-free.app"
echo
echo -e "${C}Then paste the NEW SESSION INIT block above in ChatGPT and attach:${R}"
echo "  /backend/main.py"
echo "  /backend/progression.py"
echo "  /frontend/src/App.jsx"
echo
echo -e "${G}✅ Branch prepared and ready for development!${R}"
