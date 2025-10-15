# backend/main.py
import json, os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from routers.damage import router as damage_router
from routers.creator import router as creator_router
from routers.custom_encounters import router as custom_enc_router

from engine.engine_patched import Combatant, EncounterOptions, simulate_mixed

from typing import List, Dict, Any, Optional



app = FastAPI(title="TPKA Encounter Simulator API", version="0.7.0")
# (Optional) Relax CORS for local Vite
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers
app.include_router(creator_router, prefix="/api")
app.include_router(damage_router,  prefix="/api")
app.include_router(custom_enc_router, prefix="/api")

# ---------- Data ----------
DATA_ROOT = os.path.join(os.path.dirname(__file__), "data", "v1")

def load_json(name: str):
    with open(os.path.join(DATA_ROOT, name), "r") as f:
        return json.load(f)

PCS: list = []
ITEMS: list = []
PATHS: list = []
MONSTERS: list = []
ENCOUNTERS: list = []
TRAPS: list = []
ROOM_EFFECTS: list = []
CLASSES: list = []
WEAPONS: list = []
ARMORS: list = []

def refresh_data():
    global PCS, ITEMS, PATHS, MONSTERS, ENCOUNTERS, TRAPS, ROOM_EFFECTS, CLASSES, WEAPONS, ARMORS
    PCS = load_json("pc_baselines.json")["pc_baselines"]
    ITEMS = load_json("items.json")["items"]
    PATHS = load_json("paths.json")["paths"]
    mx = load_json("monsters_encounters.json")
    MONSTERS = mx["monsters"]
    ENCOUNTERS = mx["encounters"]
    tr = load_json("traps_room_effects.json")
    TRAPS = tr["traps"]
    ROOM_EFFECTS = tr["room_effects"]
    CLASSES = load_json("classes.json")["classes"]
    WEAPONS = load_json("weapons.json")["weapons"]
    ARMORS = load_json("armors.json")["armors"]

refresh_data()

# ---------- Helpers ----------
def apply_path_and_items(base: Dict[str, Any], path_id: Optional[str], item_ids: List[str]) -> Dict[str, Any]:
    out = dict(base)
    out["crit_range"] = int(out.get("crit_range", 20))
    out["attacks_per_round"] = int(out.get("attacks_per_round", 1))
    ac = int(out["ac"]); atk = int(out["attack_bonus"]); hp = int(out["hp"])
    dmg_prof = [tuple(x) for x in out["damage_profile"]]

    for iid in (item_ids or []):
        it = next((i for i in ITEMS if i["id"] == iid), None)
        if not it: continue
        mods = it.get("mods", {})
        if "ac_bonus" in mods: ac += int(mods["ac_bonus"])
        if "to_hit_bonus" in mods: atk += int(mods["to_hit_bonus"])
        if "damage_bonus_flat" in mods:
            if dmg_prof:
                n, d, b = dmg_prof[-1]
                dmg_prof[-1] = (n, d, b + int(mods["damage_bonus_flat"]))
            else:
                dmg_prof.append((0, 0, int(mods["damage_bonus_flat"])))
        tb = it.get("temp_buff", {})
        if "hp_temp" in tb: hp += int(tb["hp_temp"])

    if path_id:
        p = next((x for x in PATHS if x["id"] == path_id), None)
        if p:
            atk += 1
            for ab in p.get("mods", {}).get("abilities", []):
                if ab.get("type") == "on_crit":
                    out["crit_range"] = max(19, out["crit_range"] - 1)

    out["ac"] = ac
    out["attack_bonus"] = atk
    out["damage_profile"] = dmg_prof
    out["hp"] = hp
    return out

# --- Ability math ---
def rogue_sneak_dice(level: int) -> List[tuple]:
    steps = [(1,1),(3,2),(5,3),(7,4),(9,5),(11,6),(13,7),(15,8),(17,9),(19,10)]
    dice = 1
    for lvl, d6 in steps:
        if level >= lvl: dice = d6
    return [(dice, 6, 0)] if dice > 0 else []

def fighter_action_surge_attacks(level: int, base_apr: int) -> int:
    return base_apr if level >= 2 else 0

# Simple spell burst presets (per combat, once)
SPELL_BURSTS: Dict[str, List[tuple]] = {
    "L1": [(2,8,0)],
    "L2": [(3,8,0)],
    "L3": [(4,8,0)]
}

# ---------- Models ----------
class AbilityToggles(BaseModel):
    sneak_attack: bool = False
    action_surge: bool = False
    spell_burst: Optional[str] = None   # "L1" | "L2" | "L3" | None

class PartyMember(BaseModel):
    pc_id: str
    path_id: Optional[str] = None
    item_ids: List[str] = []
    name: Optional[str] = None
    abilities: AbilityToggles = AbilityToggles()

class PartyCustom(BaseModel):
    name: str = "Custom"
    ac: int
    hp: int
    attack_bonus: int
    attacks_per_round: int = 1
    damage_profile: List[List[int]]
    crit_range: int = 20
    level: Optional[int] = 1
    archetype: Optional[str] = "fighter"
    path_id: Optional[str] = None
    item_ids: List[str] = []
    abilities: AbilityToggles = AbilityToggles()

class RunRequest(BaseModel):
    encounter_id: str
    trap_ids: List[str] = []
    trials: int = 1000
    initiative: str = "random"
    strategy: str = "focus_lowest"
    party: List[PartyMember] = []
    party_custom: List[PartyCustom] = []
    ignore_room_effects: bool = False

class SeriesStep(BaseModel):
    type: str
    encounter_id: Optional[str] = None
    trials: Optional[int] = 1000
    trap_ids: List[str] = []
    ignore_room_effects: bool = False

class RunSeriesRequest(BaseModel):
    party: List[PartyMember] = []
    party_custom: List[PartyCustom] = []
    sequence: List[SeriesStep]
    initiative: str = "random"
    strategy: str = "focus_lowest"

class BuildPCRequest(BaseModel):
    class_id: str
    level: int
    armor_id: str
    weapon_id: str
    name: Optional[str] = None
    str_mod: int | None = None
    dex_mod: int | None = None
    con_mod: int | None = None
    int_mod: int | None = None
    wis_mod: int | None = None
    cha_mod: int | None = None
    attack_stat: Optional[str] = None
    attacks_per_round: int | None = None

def _avg_die(d: int) -> float:
    return (1 + d) / 2.0

def build_pc_statline(req: BuildPCRequest) -> Dict[str, Any]:
    klass = next(c for c in CLASSES if c["id"] == req.class_id)
    armor = next(a for a in ARMORS if a["id"] == req.armor_id)
    weap  = next(w for w in WEAPONS if w["id"] == req.weapon_id)

    defaults_map = {
        "fighter": dict(str_mod=3, dex_mod=1, con_mod=2, int_mod=0, wis_mod=0, cha_mod=0),
        "rogue":   dict(str_mod=0, dex_mod=3, con_mod=1, int_mod=0, wis_mod=1, cha_mod=0),
        "wizard":  dict(str_mod=0, dex_mod=2, con_mod=1, int_mod=3, wis_mod=1, cha_mod=0),
    }
    defaults = defaults_map.get(klass["id"], defaults_map["fighter"])
    mods = {k: (getattr(req, k) if getattr(req, k) is not None else v) for k, v in defaults.items()}

    attack_stat = (req.attack_stat or
                   ("int" if (weap["id"] == "arcane_bolt" and klass["id"] == "wizard") else
                    ("dex" if mods["dex_mod"] >= mods["str_mod"] else "str")))
    atk_mod = mods[f"{attack_stat}_mod"]

    prof = klass["prof_by_level"][max(1, min(req.level, len(klass["prof_by_level"]))) - 1]
    auto_apr = 1
    if klass["id"] == "fighter":
        auto_apr = 3 if req.level >= 11 else 2 if req.level >= 5 else 1
    apr = int(req.attacks_per_round or auto_apr)

    dex_for_ac = min(mods["dex_mod"], armor["dex_cap"]) if armor["dex_cap"] is not None else mods["dex_mod"]
    ac = armor["base_ac"] + (0 if armor["dex_cap"] == 0 else dex_for_ac)

    attack_bonus = prof + atk_mod

    dmg_prof: List[List[int]] = []
    for n, d, b in weap["dice"]:
        add = atk_mod if weap.get("adds_mod", True) else 0
        dmg_prof.append([n, d, b + add])

    hd = klass["hit_die"]
    hp = int(round((_avg_die(hd) * req.level) + (mods["con_mod"] * req.level)))
    name = req.name or f"{klass['name']} L{req.level}"

    return {
        "id": f"custom_{klass['id']}_l{req.level}_{armor['id']}_{weap['id']}_{attack_stat}_{apr}",
        "name": name,
        "archetype": klass["id"],
        "level": req.level,
        "ac": ac,
        "hp": hp,
        "attack_bonus": attack_bonus,
        "attacks_per_round": apr,
        "damage_profile": dmg_prof,
        "crit_range": 20,
        "attack_stat": attack_stat
    }

# ---------- Routes ----------
@app.get("/api/ping")
def ping(): return {"ok": True}

@app.post("/api/reload_data")
def reload_data():
    refresh_data()
    # --- merge user-created encounters (if any) ---
    try:
        import os, json
        user_enc_path = os.path.join(os.path.dirname(__file__), "user_data", "encounters.json")
        if os.path.exists(user_enc_path):
            with open(user_enc_path, "r") as f:
                user_encs = json.load(f)
            if isinstance(user_encs, list) and user_encs:
                data["encounters"] = list(data.get("encounters", [])) + user_encs
    except Exception:
# non-fatal
        pass
    return {"ok": True, "counts": {
        "pcs": len(PCS), "items": len(ITEMS), "paths": len(PATHS),
        "monsters": len(MONSTERS), "encounters": len(ENCOUNTERS),
        "traps": len(TRAPS), "room_effects": len(ROOM_EFFECTS),
        "classes": len(CLASSES), "weapons": len(WEAPONS), "armors": len(ARMORS)
    }}

@app.get("/api/data")
def all_data():
    return {
        "pc_baselines": PCS, "items": ITEMS, "paths": PATHS,
        "monsters": MONSTERS, "encounters": ENCOUNTERS,
        "traps": TRAPS, "room_effects": ROOM_EFFECTS,
        "classes": CLASSES, "weapons": WEAPONS, "armors": ARMORS
    }

@app.post("/api/build_pc")
def build_pc(req: BuildPCRequest):
    return build_pc_statline(req)

@app.post("/api/run")
def run_sim(req: RunRequest):
    enc = next(e for e in ENCOUNTERS if e["id"] == req.encounter_id)
    unit = enc["waves"][0]["units"][0]
    mon = next(m for m in MONSTERS if m["id"] == unit["monster_id"])
    n_enemies = int(unit["count"])

    room_used = [] if req.ignore_room_effects else [
        r for r in ROOM_EFFECTS if r["id"] in enc.get("room_effects", [])
    ]
    traps_used = [t for t in TRAPS if t["id"] in (req.trap_ids or [])]

    enemy_damage_factor = 1.0
    tags = set(mon.get("tags", []))
    if "resist_nonmagical" in tags:
        enemy_damage_factor = 0.5

    enemy = Combatant(
        name=mon["name"], ac=mon["ac"], hp=mon["hp"],
        attack_bonus=mon["attack_bonus"], attacks_per_round=mon["attacks_per_round"],
        damage_profile=[tuple(x) for x in mon["damage_profile"]],
    )
    opts = EncounterOptions(
        max_rounds=20, initiative=req.initiative, target_strategy=req.strategy,
        traps=traps_used, room_effects=room_used,
    )

    # Party
    party_members: List[Combatant] = []

    for member in req.party:
        base = next(p for p in PCS if p["id"] == member.pc_id)
        mutated = apply_path_and_items(base, member.path_id, member.item_ids)

        level = int(mutated.get("level", base.get("level", 1)))
        arche = str(mutated.get("archetype", base.get("archetype", "fighter")))

        extra_dmg_round = rogue_sneak_dice(level) if member.abilities.sneak_attack else []
        extra_attacks_once = fighter_action_surge_attacks(level, int(mutated.get("attacks_per_round",1))) if member.abilities.action_surge and arche=="fighter" else 0
        extra_dmg_once = SPELL_BURSTS.get(member.abilities.spell_burst or "", [])

        c = Combatant(
            name=member.name or base["id"],
            ac=int(mutated["ac"]), hp=int(mutated["hp"]),
            attack_bonus=int(mutated["attack_bonus"]),
            attacks_per_round=int(mutated["attacks_per_round"]),
            damage_profile=[tuple(x) for x in mutated["damage_profile"]],
            crit_range=int(mutated.get("crit_range", 20)),
            extra_damage_first_hit=[tuple(x) for x in extra_dmg_round],
            extra_attacks_once=int(extra_attacks_once),
            extra_damage_once=[tuple(x) for x in extra_dmg_once],
        )
        party_members.append(c)

    for cm in req.party_custom:
        mutated = apply_path_and_items(cm.dict(), cm.path_id, cm.item_ids) \
            if (cm.path_id or cm.item_ids) else cm.dict()
        level = int(mutated.get("level", cm.level or 1))
        arche = str(mutated.get("archetype", cm.archetype or "fighter"))

        extra_dmg_round = rogue_sneak_dice(level) if cm.abilities.sneak_attack else []
        extra_attacks_once = fighter_action_surge_attacks(level, int(mutated.get("attacks_per_round",1))) if (cm.abilities.action_surge and arche=="fighter") else 0
        extra_dmg_once = SPELL_BURSTS.get(cm.abilities.spell_burst or "", [])

        party_members.append(Combatant(
            name=str(mutated.get("name", "Custom")),
            ac=int(mutated["ac"]), hp=int(mutated["hp"]),
            attack_bonus=int(mutated["attack_bonus"]),
            attacks_per_round=int(mutated.get("attacks_per_round", 1)),
            damage_profile=[tuple(x) for x in mutated["damage_profile"]],
            crit_range=int(mutated.get("crit_range", 20)),
            extra_damage_first_hit=[tuple(x) for x in extra_dmg_round],
            extra_attacks_once=int(extra_attacks_once),
            extra_damage_once=[tuple(x) for x in extra_dmg_once],
        ))

    # Monte Carlo
    wins = losses = draws = 0
    rounds_list: List[int] = []
    p_dmg: List[float] = []
    e_dmg: List[float] = []
    contrib_sums = [0.0 for _ in party_members]

    for _ in range(req.trials):
        r = simulate_mixed(
            party_members,
            enemy,
            n_enemies=n_enemies,
            opts=opts,
            enemy_damage_factor=enemy_damage_factor
        )
        wins += 1 if r["players_win"] else 0
        losses += 1 if r["enemies_win"] else 0
        draws += 1 if r["draw"] else 0
        rounds_list.append(r["rounds"])
        p_dmg.append(r["total_player_damage"])
        e_dmg.append(r["total_enemy_damage"])
        contrib = r.get("players_damage_contrib", [0] * len(party_members))
        for i in range(len(contrib_sums)):
            contrib_sums[i] += float(contrib[i] if i < len(contrib) else 0.0)

    trials_f = float(max(1, req.trials))
    avg_rounds = (sum(rounds_list) / len(rounds_list)) if rounds_list else 0.0
    avg_player_total = (sum(p_dmg) / trials_f) if p_dmg else 0.0
    avg_enemy_total  = (sum(e_dmg) / trials_f) if e_dmg else 0.0
    avg_player_per_round = (avg_player_total / avg_rounds) if avg_rounds > 0 else 0.0
    avg_enemy_per_round  = (avg_enemy_total / avg_rounds) if avg_rounds > 0 else 0.0
    avg_contrib = [c / trials_f for c in contrib_sums]
    avg_contrib_dpr = [(c / avg_rounds) if avg_rounds > 0 else 0.0 for c in avg_contrib]

    return {
        "win_pct": 100 * wins / trials_f,
        "lose_pct": 100 * losses / trials_f,
        "draw_pct": 100 * draws / trials_f,
        "avg_rounds": avg_rounds,
        "avg_player_dmg_total": avg_player_total,
        "avg_enemy_dmg_total": avg_enemy_total,
        "avg_player_dmg_per_round": avg_player_per_round,
        "avg_enemy_dmg_per_round": avg_enemy_per_round,
        "per_member_avg_dmg_total": avg_contrib,
        "per_member_avg_dpr": avg_contrib_dpr,
        "encounter": {
            "id": enc["id"], "name": enc["name"],
            "room_effects": enc.get("room_effects", []),
            "n_enemies": n_enemies
        },
        "enemy": {
            "name": mon["name"], "ac": mon["ac"], "hp": mon["hp"],
            "attack_bonus": mon["attack_bonus"],
            "attacks_per_round": mon["attacks_per_round"],
            "damage_profile": mon["damage_profile"],
            "tags": mon.get("tags", [])
        },
        "hist_rounds": (
            {str(k): rounds_list.count(k) for k in range(1, max(rounds_list) + 1)}
            if rounds_list else {}
        )
    }
