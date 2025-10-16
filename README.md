
# TPKA Encounter Simulator — Web App (FastAPI + React/Vite)

This is a ready-to-run webapp for your Monte Carlo encounter simulator.

## Quickstart (in this IDE)

This project is configured to run automatically in this cloud IDE.
1.  The **Backend API** server will start on port 8000.
2.  The **Frontend UI** will start on a separate port and be available in the "Previews" tab.

You do not need to run any commands manually. Just open the web preview to use the application.

## Status

*   **Completed:** Backend API for Character Sheets (`/api/sheets`).
*   **In Progress:** Frontend UI for Character Sheet v1.

## Roadmap

### Character Sheet v1
-   **[In Progress]** Live character sheet with HP, AC, stats, inventory, currency, and notes.
-   **[Done]** Data is persistent via `/api/sheets` and stored in `user_data/sheets.json`.

### Campaign Save System
-   Full CRUD API for campaigns at `/api/campaigns`.
-   Tracks active campaign, party roster, owned items, currency, quest flags, and room upgrades.

### Quests & Triggers
-   Data models for quests, including steps, rewards, and completion triggers.
-   Endpoints for managing quests (`/api/quests`) and executing triggers (`/api/triggers/run`).

### DM Dashboard
-   A dedicated tab for Dungeon Masters to manage the campaign.
-   Mark quests as complete, add/remove conditions, award loot, and perform bulk operations.

### Balance Analytics
-   Aggregate DPR, TTK, and win% across classes/levels/items.
-   `/api/analytics` endpoints + charts: heatmaps of matchup outcomes.

### Content Packs (Modular Data)
-   Loadable “packs”: base ruleset + optional homebrew pack overlays.
-   `/api/packs/enable` to toggle; merge strategy with priority.

### User Submissions & Moderation Queue
-   `/api/submissions` to submit items/abilities/spells.
-   “Moderator” role UI to approve/decline; approved become shared templates.

### Import/Export Bundles
-   Zip a campaign (sheets, encounters, items, quests) for backup or sharing.
-   Import with validation and conflict resolution.

### Schema Migrations
-   Version headers on all JSON; simple migrators when structure evolves.
-   `/api/migrate/preview` and `/api/migrate/run`.

### Autosave + Conflict Recovery
-   Autosave campaign state; keep last 5 snapshots.
-   UI button “Restore previous autosave”.

### Keyboard-First UX for TBS
-   Hotkeys for next target, use ability 1–4, end turn.
-   Reduce clicks; make playtesting snappy.

### Performance Pass
-   Workerize Monte Carlo (Web Workers) for 100k+ runs without UI jank.
-   Cache common roll distributions by seed + profile hash.

### Test Harness + Fixtures
-   Unit tests for adapter, conditions, quests, loot resolution.
-   Fixture-driven sims to ensure no regressions in balance.
