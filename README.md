Grancelor’s Emporium (TPKA Webapp)

Single-host FastAPI + Vite app powering the Total Party Kill Arena ecosystem.
JSON-first data → SQLite mirror → API → Frontend.

Architecture Overview
Layer	Description
Frontend	React + Vite SPA built to frontend/dist, synced to backend/static/ via serve_onehost_ngrok.sh.
Backend	FastAPI app with layered JSON ingestion, optional SQLite mirror, and power-scoring engines.
Data	Stored under backend/data/: system rulesets (5e, PF2e), campaigns, and runtime overrides.
Database	SQLite mirror (backend/tpka.db) automatically generated when TPKA_DB_WRITE=1.
Repository Layout
backend/
  main.py                # FastAPI app entry
  db.py                  # DB engine and session helpers
  data_layers.py         # Layered JSON → SQL model loader
  models.py              # SQLModel definitions
  routes_catalog.py      # API route registration
  scripts/
    ingest_v1_json.py    # JSON → DB ingester
  data/
    systems/
      5e/     classes.json, spells.json, items.json
      pf2e/   classes.json, spells.json, items.json
    runtime/overrides/
      5e/classes_overrides.json
      pf2e/classes_overrides.json
    campaigns/emporium/
      {5e,pf2e}/monsters/
      shared/{encounters,traps}.json
  static/                # built frontend (synced)
frontend/
  src/                   # React code
  public/
  vite.config.js
serve_onehost_ngrok.sh   # build → sync → run → tunnel

Environment Configuration

Create .env (root or backend/.env) and verify these lines:

# Backend
TPKA_DB_WRITE=1
TPKA_DATABASE_URL=sqlite:///backend/tpka.db
TPKA_RULESET_DEFAULT=5e

# Frontend (create frontend/.env.local)

HTTP client: We use axios via frontend/src/utils/api.js as the single HTTP stack. Do not call fetch("/api/...") directly and do not use utils/http.js. Import the default client:

import api from "../utils/api";
const info = await api.getData(ruleset);


Or import named helpers:

import { search2, getProgression } from "../utils/api";


Note: import { api } from "../utils/api" is invalid—api is the default export object.
VITE_API_BASE=http://127.0.0.1:8000


Always use absolute paths when exporting TPKA_DATABASE_URL manually:
export TPKA_DATABASE_URL="sqlite:///$PWD/backend/tpka.db"

Strict Data ↔ DB Protocol

To keep backend and ingester synchronized, follow this exact sequence every time.

1️⃣ Activate Environment
cd tpka_webapp
source backend/.venv/bin/activate 2>/dev/null || python3 -m venv backend/.venv && source backend/.venv/bin/activate
pip install -r backend/requirements.txt
export TPKA_DATABASE_URL="sqlite:///$PWD/backend/tpka.db"
export TPKA_DB_WRITE=1

2️⃣ Ingest JSON → DB
python -m backend.scripts.ingest_v1_json --wipe --verbose


Expected summary:

[✓] classes[5e]: 13 upserted
[✓] classes[pf2e]: 23 upserted
[counts] {'classes':26, 'subclasses':93, ...}

3️⃣ Sanity-check DB
sqlite3 backend/tpka.db '
.mode column
SELECT ruleset, COUNT(*) AS n FROM "class" GROUP BY ruleset ORDER BY ruleset;
'


Should print:

5e   13
auto 3
pf2e 23

4️⃣ Run API Server (same venv + DB)
UVICORN_LOG_LEVEL=debug PYTHONUNBUFFERED=1 \
uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload


When the server starts, watch for
[db] DATABASE_URL=sqlite:////.../backend/tpka.db
— that confirms the correct mirror file.

5️⃣ Ping API
curl -s 'http://127.0.0.1:8000/api/ping' | jq
curl -s 'http://127.0.0.1:8000/api/classes?ruleset=5e'  | jq 'length'    # ≈13
curl -s 'http://127.0.0.1:8000/api/classes?ruleset=pf2e' | jq 'length'   # ≈23

Frontend Workflow
Install
cd frontend
npm i

Dev
VITE_API_BASE=http://127.0.0.1:8000 npm run dev

Build (+ sourcemaps for debugging)
npm run build


This outputs to frontend/dist/ with source maps enabled (configured in vite.config.js).

Serve Single-Host

From repo root:

./serve_onehost_ngrok.sh stallion-tough-secretly.ngrok-free.app


The script:

Builds frontend

Syncs dist → backend/static/

Starts backend (Uvicorn)

Opens ngrok tunnel and prints your public URL

Common Commands
Task	Command
Rebuild & re-ingest data	python -m backend.scripts.ingest_v1_json --wipe --verbose
Reset DB	rm backend/tpka.db then ingest again
Rehydrate from JSON (at runtime)	curl -X POST http://127.0.0.1:8000/api/admin/rehydrate
Check class counts	`curl -s 'http://127.0.0.1:8000/api/classes?ruleset=pf2e
'
Open interactive DB	sqlite3 backend/tpka.db
Development Notes

Keep exactly one DB file (backend/tpka.db).

Alembic migrations (if used) should target the same path in alembic.ini.

Ruleset strings are lowercase (5e, pf2e).

Frontend uses a single API helper: src/utils/api.js.

All React files import hooks as named (useState, useEffect, etc.); minified builds include source maps for inspection in DevTools.

Troubleshooting
Symptom	Likely Cause	Fix
/api/classes?ruleset=5e returns 3	Server using different DB than ingester	Verify [db] DATABASE_URL on startup; re-ingest with absolute path
“Internal Server Error” (500) on class routes	Missing dependency in requirements.txt	Re-install backend deps in venv
Blank frontend page	Mismatch between build output and Vite base URL	Rebuild with correct VITE_API_BASE
Minified stack traces	Source maps disabled	Confirm build.sourcemap = true in vite.config.js
Quick Reference Endpoints
Endpoint	Description
GET /api/ping	Health check
GET /api/classes?ruleset={5e,pf2e}	List all classes
GET /api/search2?q=...&types=class,spell,feat,monster	Full-text search
GET /api/progression	Level progression data
POST /api/score/spell	Spell power scoring
POST /api/score/monster	Monster scoring
POST /api/sim/run	Monte Carlo combat sim
POST /api/searches/save	Save search
POST /api/admin/rehydrate	Reload JSON → DB
Next Goals

Expand power-scoring data (items, spells, monsters).

Implement live PF2e “Damage Preview” panel.

Migrate /api/search2 to database indexing.

Finish PF2e rune property validation in progression.

License

© 2025 Total Party Kill Arena / Grancelor’s Emporium.
All data and code under custom TPKA Studio license.