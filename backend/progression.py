# backend/progression.py
"""
Progression + summary builders for 5e / PF2e.

This file is intentionally self-contained and reads only the class/weapon
structures passed in from main.py. It implements:

- build_progression(class_def, subclass_def, ruleset, max_level)
- summarize_progression(ruleset, classes, class_id, weapons, max_level, subclass_id)
- _extract_pf2e_weapon_tiers_for_level(cls, level)

5e: includes proficiency bonus by level, subclass unlock, spell-slot math for
full/half/third casters and Warlock (pact) slots.

PF2e: collapses weapon training tiers by level and derives a simple attack bonus
track (class prof + level + potency by tier). Keep light; fine-grained class rules
can be layered later via runtime overrides.
"""

from typing import Any, Dict, List, Optional, Tuple

# ----------------------------- 5e helpers ---------------------------------
PB_BY_LEVEL = {1:2, 2:2, 3:2, 4:2, 5:3, 6:3, 7:3, 8:3, 9:4, 10:4,
               11:4, 12:4, 13:5, 14:5, 15:5, 16:5, 17:6, 18:6, 19:6, 20:6}

# 5e slot tables (abridged core, per PHB). Keys: "full", "half", "third", "pact_X" where X = warlock level
# Each entry is a list of dicts by level: {1: n1, 2: n2, ...9: n9}; we only materialize the highest level available.
# For simplicity, we include standard full/half/third caster progressions L1-20 and compute Warlock pact slots by level.
# (You can replace with exact tables from your JSON data at ingest-time once present.)
FULL_SLOTS = [
 # L : 1 2 3 4 5 6 7 8 9
  {1:2},                                  #1
  {1:3},                                  #2
  {1:4, 2:2},                             #3
  {1:4, 2:3},                             #4
  {1:4, 2:3, 3:2},                        #5
  {1:4, 2:3, 3:3},                        #6
  {1:4, 2:3, 3:3, 4:1},                   #7
  {1:4, 2:3, 3:3, 4:2},                   #8
  {1:4, 2:3, 3:3, 4:3, 5:1},              #9
  {1:4, 2:3, 3:3, 4:3, 5:2},              #10
  {1:4, 2:3, 3:3, 4:3, 5:2, 6:1},         #11
  {1:4, 2:3, 3:3, 4:3, 5:2, 6:1},         #12
  {1:4, 2:3, 3:3, 4:3, 5:2, 6:1, 7:1},    #13
  {1:4, 2:3, 3:3, 4:3, 5:2, 6:1, 7:1},    #14
  {1:4, 2:3, 3:3, 4:3, 5:2, 6:1, 7:1, 8:1}, #15
  {1:4, 2:3, 3:3, 4:3, 5:2, 6:1, 7:1, 8:1}, #16
  {1:4, 2:3, 3:3, 4:3, 5:2, 6:1, 7:1, 8:1, 9:1}, #17
  {1:4, 2:3, 3:3, 4:3, 5:3, 6:1, 7:1, 8:1, 9:1}, #18
  {1:4, 2:3, 3:3, 4:3, 5:3, 6:2, 7:1, 8:1, 9:1}, #19
  {1:4, 2:3, 3:3, 4:3, 5:3, 6:2, 7:2, 8:1, 9:1}, #20
]

HALF_SLOTS = [
  {1:0}, {1:2}, {1:3}, {1:3,2:0}, {1:4,2:2}, {1:4,2:2}, {1:4,2:3}, {1:4,2:3}, {1:4,2:3,3:2},
  {1:4,2:3,3:2}, {1:4,2:3,3:3}, {1:4,2:3,3:3}, {1:4,2:3,3:3,4:1}, {1:4,2:3,3:3,4:1},
  {1:4,2:3,3:3,4:2}, {1:4,2:3,3:3,4:2}, {1:4,2:3,3:3,4:3,5:1}, {1:4,2:3,3:3,4:3,5:1},
  {1:4,2:3,3:3,4:3,5:2}, {1:4,2:3,3:3,4:3,5:2},
]

THIRD_SLOTS = [
  {1:0}, {1:0}, {1:2}, {1:3}, {1:3}, {1:3,2:0}, {1:4,2:2}, {1:4,2:2}, {1:4,2:2,3:0},
  {1:4,2:3,3:2}, {1:4,2:3,3:2}, {1:4,2:3,3:3}, {1:4,2:3,3:3}, {1:4,2:3,3:3,4:1}, {1:4,2:3,3:3,4:1},
  {1:4,2:3,3:3,4:1}, {1:4,2:3,3:3,4:2}, {1:4,2:3,3:3,4:2}, {1:4,2:3,3:3,4:2,5:1}, {1:4,2:3,3:3,4:2,5:1},
]

def _caster_kind_for_5e(class_def: Dict[str, Any]) -> str:
    # Derive from class tags/fields; fallback to "none"
    k = (class_def.get("casting_kind") or "").lower()
    if k in {"full","half","third","pact"}:
        return k
    # heuristic by name
    name = (class_def.get("name") or "").lower()
    if any(x in name for x in ["wizard","cleric","druid","sorcerer","bard"]):
        return "full"
    if any(x in name for x in ["paladin","ranger","artificer"]):
        return "half"
    if any(x in name for x in ["eldritch knight","arcane trickster"]):
        return "third"
    if "warlock" in name:
        return "pact"
    return "none"

def _warlock_pact_slots(level: int) -> Dict[int, int]:
    # Pact Magic: slots known and level scale. Abridged: at 5: 2×3rd; 11: 3×5th; 17: 4×5th.
    if level < 2:
        return {1:1}
    if level < 3:
        return {1:2}
    if level < 5:
        return {2:2}
    if level < 7:
        return {3:2}
    if level < 9:
        return {4:2}
    if level < 11:
        return {5:2}
    if level < 17:
        return {5:3}
    return {5:4}

def _slots_for_5e_level(kind: str, level: int) -> Dict[int, int]:
    idx = max(1, min(20, level)) - 1
    if kind == "full":
        return FULL_SLOTS[idx]
    if kind == "half":
        return HALF_SLOTS[idx]
    if kind == "third":
        return THIRD_SLOTS[idx]
    if kind == "pact":
        return _warlock_pact_slots(level)
    return {}

# ----------------------------- PF2e helpers --------------------------------
TIER_ORDER = ["U","T","E","M","L"]  # Untrained, Trained, Expert, Master, Legendary (string codes)

def _extract_pf2e_weapon_tiers_for_level(cls: Dict[str, Any], level: int) -> Dict[str, str]:
    """
    Collapse PF2e training plan for a class to effective tiers at `level`.
    Expected structure on class:
      pf2e_weapon_tiers: {
        "default": "T",
        "by_level": { "5": {"_default":"E", "longsword":"M"}, "13": {...} },
        "overrides": { "longbow": {"5":"E","13":"M"} }
      }
    Returns a dict: {"_default":"T","longsword":"M", ...} at that level.
    """
    spec = (cls or {}).get("pf2e_weapon_tiers") or {}
    result = {}
    cur_default = spec.get("default") or "T"
    result["_default"] = cur_default
    # class-wide by_level
    for lvl_str, changes in (spec.get("by_level") or {}).items():
        try:
            lvl = int(lvl_str)
        except Exception:
            continue
        if lvl <= level:
            if "_default" in changes:
                result["_default"] = changes["_default"]
            for wid, tier in changes.items():
                if wid == "_default":
                    continue
                result[wid] = tier
    # per-weapon overrides
    for wid, schedule in (spec.get("overrides") or {}).items():
        for lvl_str, tier in (schedule or {}).items():
            try:
                lvl = int(lvl_str)
            except Exception:
                continue
            if lvl <= level:
                result[wid] = tier
    return result

def _pf2e_attack_bonus_for_tier(level: int, tier: str, potency_by_level: Dict[int,int]) -> int:
    # Simple math: proficiency bonus (tier -> +0/+2/+4/+6/+8) + level + potency
    prof = {"U":0, "T":2, "E":4, "M":6, "L":8}.get(str(tier).upper(), 0)
    potency = 0
    # potency_by_level could map 2:1, 10:2, 16:3, etc.
    for gate, val in sorted((potency_by_level or {}).items()):
        if level >= gate:
            potency = val
    return level + prof + potency

# ----------------------------- Builders ------------------------------------
def build_progression(class_def: Dict[str, Any], subclass_def: Optional[Dict[str, Any]], ruleset: str, max_level: int = 20) -> Dict[str, Any]:
    rs = (ruleset or "5e").lower()
    levels: List[Dict[str, Any]] = []
    max_level = max(1, min(20, int(max_level)))
    if rs == "5e":
        # Basic “gains” line comes from features_by_level if present.
        features_by_level = (class_def.get("features_by_level") or {})
        unlock = int(class_def.get("subclass_unlock") or 3)
        kind = _caster_kind_for_5e(class_def)
        for L in range(1, max_level+1):
            gains = list(features_by_level.get(str(L), []) or [])
            row = {
                "level": L,
                "prof_bonus": PB_BY_LEVEL[L],
                "subclass_available": (L >= unlock),
                "slots": _slots_for_5e_level(kind, L),
                "gains": gains,
            }
            levels.append(row)
        return {"ruleset":"5e","class_id":class_def.get("id") or class_def.get("archetype"), "levels": levels}

    # PF2e
    pot_sched = (class_def.get("pf2e_potency_schedule") or {2:1, 10:2, 16:3})
    weapon_catalog = {}
    levels_pf = []
    for L in range(1, max_level+1):
        tiers = _extract_pf2e_weapon_tiers_for_level(class_def, L)
        atk = {}
        for wid, tier in tiers.items():
            if wid == "_default":
                atk[wid] = _pf2e_attack_bonus_for_tier(L, tier, pot_sched)
            else:
                atk[wid] = _pf2e_attack_bonus_for_tier(L, tier, pot_sched)
        gains = list((class_def.get("features_by_level") or {}).get(str(L), []) or [])
        levels_pf.append({
            "level": L,
            "pf2e_weapon_tiers": tiers,
            "pf2e_attack_bonus": atk,
            "gains": gains,
        })
    return {"ruleset":"pf2e","class_id":class_def.get("id") or class_def.get("archetype"), "weapon_catalog": weapon_catalog, "levels": levels_pf}

def summarize_progression(ruleset: str,
                          classes: List[Dict[str, Any]],
                          class_id: str,
                          weapons: List[Dict[str, Any]],
                          max_level: int = 20,
                          subclass_id: Optional[str] = None) -> Dict[str, Any]:
    rs = (ruleset or "5e").lower()
    c = next((x for x in classes if (x.get("id")==class_id or x.get("archetype")==class_id)), None)
    if not c:
        return {"error":"class_not_found"}
    sc = None
    if subclass_id:
        sc = next((s for s in (c.get("subclasses") or []) if (s.get("id")==subclass_id or s.get("archetype")==subclass_id)), None)
    prog = build_progression(c, sc, rs, max_level=max_level)
    # Build weapon catalog for nicer labels
    catalog = {w.get("id"): (w.get("name") or w.get("id")) for w in weapons if w.get("id")}
    prog["weapon_catalog"] = catalog
    return prog
