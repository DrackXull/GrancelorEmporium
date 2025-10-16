
# TPKA Encounter Simulator — Web App (FastAPI + React/Vite)

This is a ready-to-run webapp for your Monte Carlo encounter simulator.

## Quickstart (local)

### 1) Backend API
```bash
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --port 8000
```

### 2) Frontend UI
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 and run simulations.

## Deploy options
- **Render** or **Railway**: Deploy backend as a Python/uvicorn service.
- **Fly.io** or **Heroku**: Same, set `PORT` and serve at `/api`.
- **Netlify** or **Vercel**: Deploy the React build (`npm run build`), and point it at your API URL via `VITE_API_BASE` environment variable.

## Notes
- MVP supports one monster type from the first wave of a preset encounter.
- Traps & room effects are live. Paths/Items are loaded but not yet mutating PC stats (next patch).
- Extend `backend/data/v1/*.json` with your campaign content.
