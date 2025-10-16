# 🏰 Grancelor Emporium  
*A Living Campaign Companion & Monte Carlo Battle Simulator for Total Party Kill Arena*

---

## 🎯 Purpose

**Grancelor Emporium** is a hybrid **TTRPG campaign companion** and **combat simulator** built for the world of **Total Party Kill Arena (TPKA)**—and adaptable for any tabletop or homebrew system.

It began as a Monte Carlo encounter tester but is growing into a full toolkit where **players, DMs, and designers** can:

- Build and save characters, monsters, items, and spells.  
- Run encounter simulations to test balance or strategy.  
- Track player sheets, currencies, and evolving equipment.  
- Automate campaign bookkeeping, loot, and quest rewards.  
- Eventually, play out turn-based fights using real abilities.

---

## ⚙️ Core Features

### 🎲 Battle Simulator / Monte Carlo Tester
- Runs thousands of combat trials between defined parties and encounters.  
- Supports resistances, weaknesses, damage types, abilities, and room effects.  
- Generates win %, DPR, round histograms, and other analytics.  
- Allows toggling abilities like Sneak Attack, Action Surge, and Spell Burst.  
- Integrates with custom characters, monsters, and items.

### 🧙 Character & Creature Builder
- Create PCs or NPCs with full stat blocks, gear, and abilities.  
- Define or import custom damage profiles, spells, and passives.  
- Save and instantly **send creations into the simulator’s party slots**.  
- Build unique monsters and export them as ready-to-use encounters.

### ⚔️ Encounter Builder & Tester
- Combine any mix of monsters, traps, and room modifiers.  
- Simulate at scale or manually test turn by turn (future).  
- Store reusable encounter templates for campaigns.

### 📜 Campaign Companion (planned)
- Live character sheet tied to the same database as the simulator.  
- Tracks health, buffs, debuffs, inventory, and unique campaign currency.  
- Handles room/quest triggers—automatically awarding items or debts.  
- Allows DMs to mark quests complete, distributing loot or rewards to players.  
- Integrates metroidvania-style *living quarters* upgrades and economy systems.

### 🧩 Modular Expansion & Community Content
- Custom items, abilities, and spells can be uploaded for mod review.  
- Approved submissions become shareable templates for all users.  
- Supports “house-rules” data packs and campaign-specific modules.

---

## 🧠 Future Goals
- **Turn-based simulator** where players manually use abilities instead of pure Monte Carlo runs.  
- **Automated balance analysis** suggesting ability or item adjustments.  
- **DM dashboard** for real-time quest progression, encounter triggers, and loot assignment.  
- **Persistent player profiles** across multiple campaigns.  
- **Cross-sync** between the battle tester and campaign companion.

---

## 🧰 Tech Stack

| Layer | Technology |
|:------|:------------|
| **Frontend** | React (Vite) + Recharts + Tailwind + FastAPI REST integration |
| **Backend** | Python 3.12 / FastAPI / Uvicorn + modular routers |
| **Simulation Engine** | Deterministic Monte Carlo core with variance toggle & damage adapter |
| **Data Storage** | JSON files (user_data) → to be migrated to SQLite or Postgres later |

---

## 🚀 Run Locally

```bash
# backend
cd backend
uvicorn main:app --reload
bash
Copy code
# frontend
cd frontend
npm install
npm run dev
Open http://localhost:5173

🧩 Current Modules
Module	Description
Creator	Build and save PCs / Monsters / Items / Resistances
Party Bridge	One-click link from Creator → Party Slots
Damage Engine	Unified damage calculator with resistances, variance, & crit logic
Custom Encounters	User-made encounters merged into /api/data dynamically
Monte Carlo Panel	Dev tool for testing damage probability distributions

🧙 Vision Statement
A single platform where simulation meets storytelling — empowering DMs to balance encounters, players to understand their builds, and worlds to evolve organically with every roll of the dice.

📂 Repository Structure
bash
Copy code
backend/
  engine/           # simulation core
  routers/          # API endpoints (creator, custom_encounters, etc.)
  user_data/        # saved characters, monsters, encounters
frontend/
  src/
    components/     # React panels
    lib/            # localStorage bridge utilities
🧾 License
© 2025 Grinning Goblin Productions / Drack Xull.
For personal and non-commercial use while in development.

💬 Contact / Community
Discord (coming soon)

GitHub Issues → bug reports / feature requests

DM @DrackXull for collaboration or integration inquiries

“When simulation becomes story, every roll has meaning.”