# backend/power/pf2e.py
from __future__ import annotations
from typing import Dict, Any, List, Tuple
import math, re, random

# Very rough first-pass AoE average target counts by density
AOE_AM = {
    ("burst", 10): {"low":1.4, "medium":2.1, "high":2.8},
    ("burst", 15): {"low":1.8, "medium":2.7, "high":3.6},
    ("burst", 20): {"low":2.3, "medium":3.2, "high":4.2},
    ("line", 30): {"low":1.6, "medium":2.3, "high":3.0},
    ("cone", 30): {"low":1.9, "medium":2.7, "high":3.4},
}

# Level power bands (PLACEHOLDER; tune with real data)
# Each is (min, avg, max) PS for that level
LEVEL_BANDS = {
    1:(6,  8,  11),
    2:(9,  12, 16),
    3:(13, 18, 23),
    4:(17, 24, 31),
    5:(22, 30, 38),
    6:(27, 36, 46),
    7:(33, 42, 54),
    8:(39, 48, 62),
    9:(46, 55, 70),
    10:(53, 62, 78)
}

DICE_RX = re.compile(r"^\s*(\d+)d(\d+)\s*$", re.I)

def _avg_die(die: int) -> float:
    return (1 + die) / 2

def _avg_roll(dice: str) -> float:
    m = DICE_RX.match(dice or "")
    if not m: return 0.0
    n = int(m.group(1)); s = int(m.group(2))
    return n * _avg_die(s)

def _area_multiplier(area: Dict[str, Any], density: str) -> float:
    if not area: return 1.0
    shape = area.get("shape")
    key = (shape, int(area.get("radius") or area.get("length") or 0))
    table = AOE_AM.get(key)
    if not table: return 1.0
    return table.get(density, table["medium"])

def _save_tax(save: str|None) -> float:
    # Very rough; "basic" save halves/quarters/none
    if not save: return 1.0
    # baseline factor ~ expected fraction after basic saves at-level
    return 0.8

def _range_factor(r: int|None) -> float:
    if not r: return 1.0
    if r >= 120: return 1.1
    if r >= 60:  return 1.05
    return 1.0

def _action_cost(a: int|None) -> float:
    if not a: return 2.0
    return max(1.0, min(3.0, float(a)))

def _resource_cost(level: int|None) -> float:
    # treat spell level as increasing opportunity cost
    if not level: return 1.0
    return max(1.0, 0.7 + 0.15*level)

def _rider_value(riders: List[Dict[str, Any]]|None) -> float:
    if not riders: return 0.0
    val = 0.0
    for r in riders:
        if r.get("kind") == "persistent" and r.get("dice"):
            val += _avg_roll(r["dice"]) * 2  # assume ~2 rounds persistence (placeholder)
        elif r.get("kind") == "condition":
            # frightened(1) ~ small tempo; stunned(1) larger. Placeholder:
            sev = r.get("severity", 1)
            val += 1.0 * sev
    return val

def _comparables(ps: float, level: int) -> List[Dict[str, Any]]:
    # Placeholder comparables; in future, pull nearest from DB/catalog.
    band = LEVEL_BANDS.get(level, (0, ps, ps))
    return [
        {"name":"Band Min", "ps": band[0], "delta": ps - band[0]},
        {"name":"Band Avg", "ps": band[1], "delta": ps - band[1]},
        {"name":"Band Max", "ps": band[2], "delta": ps - band[2]},
    ]

def suggest_level(ps: float, declared_level: int|None) -> int:
    # Find the lowest level whose MAX band >= ps
    for lvl in sorted(LEVEL_BANDS):
        if ps <= LEVEL_BANDS[lvl][2]:
            return lvl
    return declared_level or 10

def score_spell(spell: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
    level = int(spell.get("level") or 1)
    dice  = spell.get("dice") or "0d6"
    area  = spell.get("area") or {}
    rng   = spell.get("range")
    acts  = int(spell.get("actions") or 2)
    save  = spell.get("save")
    riders= spell.get("riders") or []
    density = context.get("density", "medium")

    dt  = _avg_roll(dice)                              # damage throughput / target
    am  = _area_multiplier(area, density)              # average targets hit
    dst = _save_tax(save)                              # delivery/save tax
    rt  = _range_factor(rng)                           # range affordance
    ae  = _action_cost(acts)                           # action cost
    rc  = _resource_cost(level)                        # slot level cost
    rv  = _rider_value(riders)                         # rider value as damage/tempo equiv

    ps = (dt * am * dst * rt) / (ae * rc) + rv

    suggestion = suggest_level(ps, level)
    return {
        "ok": True,
        "ps": round(ps, 3),
        "declared_level": level,
        "suggested_level": suggestion,
        "explain": {
            "dt_avg_per_target": dt,
            "am_targets": am,
            "dst_factor": dst,
            "range_factor": rt,
            "action_cost": ae,
            "resource_cost": rc,
            "rider_value": rv
        },
        "comparables": _comparables(ps, level)
    }
# --- Catalog comparables ---
import json, os
from typing import Dict, Any, List
from sqlalchemy import text

def _iter_catalog_spells_from_sqlite(engine):
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT name, level, dice, area_shape, area_size, range, actions, save, riders_json
            FROM spells
        """)).fetchall()
        for r in rows:
            area = None
            if r[3]:
                if r[3] in ("burst","cone"):
                    area = {"shape": r[3], "radius": r[4]}
                else:
                    area = {"shape": r[3], "length": r[4]}
            yield {
                "name": r[0],
                "level": r[1],
                "dice": r[2],
                "area": area,
                "range": r[5],
                "actions": r[6],
                "save": r[7],
                "riders": (json.loads(r[8]) if r[8] else []),
            }

def nearest_spell_comparables(spell: dict, context: dict, engine=None, catalog_json_path=None, k=5):
    base = score_spell(spell, context)
    target = base["ps"]
    candidates: List[Dict[str, Any]] = []

    # 1) SQLite (preferred when DSN is configured)
    if engine is not None:
        try:
            for s in _iter_catalog_spells_from_sqlite(engine):
                sc = score_spell(s, context)
                candidates.append({"name": s.get("name","?"), "ps": sc["ps"], "level": s.get("level")})
        except Exception:
            pass

    # 2) JSON fallback
    if (not candidates) and catalog_json_path and os.path.exists(catalog_json_path):
        try:
            data = json.loads(open(catalog_json_path,"r",encoding="utf-8").read())
            for s in data:
                sc = score_spell(s, context)
                candidates.append({"name": s.get("name","?"), "ps": sc["ps"], "level": s.get("level")})
        except Exception:
            pass

    # 3) Band placeholders if catalog empty
    if not candidates:
        lvl = int(spell.get("level") or 1)
        band = LEVEL_BANDS.get(lvl, (0, target, target))
        return [
            {"name":"Band Min", "ps": band[0], "delta": target - band[0]},
            {"name":"Band Avg", "ps": band[1], "delta": target - band[1]},
            {"name":"Band Max", "ps": band[2], "delta": target - band[2]},
        ]

    # Sort by absolute PS distance and take k
    ranked = sorted(candidates, key=lambda c: abs(c["ps"] - target))[:k]
    for r in ranked:
        r["delta"] = r["ps"] - target
    return ranked

# --- Monster scoring v1 (coarse; tune with catalog later) ---
MONSTER_BANDS = {
    1:(8,12,16), 2:(12,16,22), 3:(16,22,28), 4:(21,28,36), 5:(26,34,44),
    6:(32,41,53), 7:(38,48,62), 8:(45,56,72), 9:(52,64,82), 10:(60,73,94)
}

def score_monster(mon: dict, context: dict) -> dict:
    ehp = float(mon.get("ehp", 100.0))
    dpr = float(mon.get("dpr", 12.0))
    ctrl= float(mon.get("control_index", 0.0))
    # First-pass weighting
    ps = dpr * 2.2 + (ehp * 0.08) + (ctrl * 2.0)

    # Suggest the first level whose MAX band >= ps
    suggested = 1
    for lvl in sorted(MONSTER_BANDS.keys()):
        if ps <= MONSTER_BANDS[lvl][2]:
            suggested = lvl
            break
        suggested = lvl

    band = MONSTER_BANDS.get(suggested, (0,ps,ps))
    if ps >= band[2]*0.95: tier = "high"
    elif ps >= band[1]*0.85: tier = "mid"
    else: tier = "low"

    return {
        "ok": True,
        "ps": round(ps, 2),
        "suggested_level": suggested,
        "tier": tier,
        "explain": {
            "ehp_weight": 0.08,
            "dpr_weight": 2.2,
            "control_weight": 2.0
        }
    }
