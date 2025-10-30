# README.md

## Grancelor’s Emporium (TPKA WebApp)

Single-repo app containing:
- **frontend/** — Vite + React UI served from FastAPI static in prod
- **backend/** — FastAPI + SQLModel + SQLite (or Postgres) API
- **data/** — Authoritative JSON for 5e + PF2e, plus runtime overrides

---

## Quick Start

```bash
# From repo root
./serve_onehost_ngrok.sh <your-ngrok-domain>
# This will:
# 1) build the frontend (Vite)
# 2) sync dist -> backend/static
# 3) ensure backend/.venv + deps
# 4) run Uvicorn on 127.0.0.1:8000
# 5) open/verify ngrok tunnel
Health check:

bash
Copy code
curl -s http://127.0.0.1:8000/api/ping | jq
# -> { "ok": true, "service": "tpka-api", "version": "0.6.1" }
Data Layout (sources of truth)
pgsql
Copy code
backend/
  data/
    v1/                        # thin, shared catalog (optional)
      classes.json
      weapons.json
      armors.json
      items.json
      pc_baselines.json
      paths.json
      traps_room_effects.json
    systems/
      5e/
        classes.json           # full 5e
        weapons.json
        armors.json
        feats.json
        spells.json
        backgrounds.json
        ancestries.json        # optional for 5e
      pf2e/
        classes.json           # full PF2e
        weapons.json
        armors.json
        feats.json
        spells.json
        backgrounds.json
        ancestries.json
        runes.json
        traits.json
    runtime/
      overrides/
        5e/
          classes_overrides.json
        pf2e/
          classes_overrides.json
      searches.json            # saved searches for UI
Primary: JSON in backend/data/systems/{5e|pf2e}

Mirrors: SQLite/Postgres via ingester for fast queries

Runtime overlays: backend/data/runtime/overrides/... (merged after base JSON)

Ingest (JSON → DB)
Environment:

bash
Copy code
# pick a DB; default is sqlite file under backend/
export TPKA_DATABASE_URL="sqlite:///$PWD/backend/tpka.db"
export TPKA_DB_WRITE=1
Run:

bash
Copy code
source backend/.venv/bin/activate 2>/dev/null || python3 -m venv backend/.venv && source backend/.venv/bin/activate
pip install -r backend/requirements.txt

# optional normalization
python backend/scripts/normalize_json.py \
  backend/data/v1/classes.json \
  backend/data/systems/5e/classes.json \
  backend/data/systems/pf2e/classes.json \
  backend/data/runtime/overrides/5e/classes_overrides.json \
  backend/data/runtime/overrides/pf2e/classes_overrides.json

# wipe + ingest
python -m backend.scripts.ingest_v1_json --wipe --verbose
Expected counters (example):

less
Copy code
[✓] classes[5e]: 13   [✓] subclasses[5e]: 27   [✓] features[5e]: 80
[✓] classes[pf2e]: 23 [✓] subclasses[pf2e]: 72 [✓] features[pf2e]: 130
...
Verify:

bash
Copy code
curl -s 'http://127.0.0.1:8000/api/classes?ruleset=5e'  | jq 'length'   # ~13
curl -s 'http://127.0.0.1:8000/api/classes?ruleset=pf2e' | jq 'length'   # ~23
Frontend Dev
bash
Copy code
cd frontend
npm i
npm run dev
# open http://localhost:5173 (dev server, not proxied)
Source Maps
For prod debugging, we ship sourcemaps:

frontend/vite.config.js has build.sourcemap: true

In DevTools: Settings ▸ Sources ▸ Enable JS source maps

Open a stack frame in assets/index-*.js ▸ it resolves to original src/*

API Highlights
GET /api/ping — health/version

GET /api/classes?ruleset=5e|pf2e&q=...

GET /api/classes/{id} — class + subclasses + features by level

GET /api/catalog?kind=weapons|armors|feats|spells|ancestries|backgrounds|classes|runes

Authoring Rules (lintable)
IDs: lower_snake_case, ASCII only (e.g., chain_mail, flaming_rune)

Names: Title Case ("Chain Mail", "School of Evocation")

Cross-refs by id, never by display name

Per-system files live under backend/data/systems/{5e|pf2e}

Overrides live under backend/data/runtime/overrides/{5e|pf2e}

Repo Hygiene (locked)
Root owns the repo (single .git here).
Ignore the right things so the tree stays clean & pushes are fast.

.gitignore (essentials):

bash
Copy code
# Node
frontend/node_modules/
frontend/dist/
frontend/.vite/
frontend/.eslintcache

# Python
backend/.venv/
backend/__pycache__/
**/__pycache__/
*.pyc

# DB / state
backend/*.db
backend/*.sqlite
backend/*.sqlite3
*.db
*.sqlite
*.sqlite3

# Env/secrets
.env
backend/.env
.env.local
frontend/.env
frontend/.env.*
!frontend/.env.example

# OS/editor
.DS_Store
Thumbs.db
*.swp
.idea/
.vscode/
Common Pitfalls & Fixes
Crash at startup: NameError: Request is not defined
Add Request to FastAPI imports in backend/main.py
from fastapi import ..., Request

PF2e returns 500 but 5e works
Ensure DB is freshly ingested, and you’re hitting /api/classes?ruleset=pf2e (lowercase).
Confirm counts via curl + jq (see Ingest).

Frontend shows minified stack
Source maps must be enabled in build and DevTools settings. Rebuild, hard-reload.

Release Checklist
python -m backend.scripts.ingest_v1_json --wipe --verbose

curl /api/classes?ruleset=5e|pf2e sanity ✓

npm run build && ./serve_onehost_ngrok.sh <domain>

Open /data, /creator, /sim

Commit: only JSON + scripts + README. Screenshots in PR.

License
SRD content falls under the respective SRD licenses. Homebrew content © respective authors.