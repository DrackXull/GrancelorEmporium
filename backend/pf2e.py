# backend/pf2e.py
from typing import Dict, List, Optional
from pydantic import BaseModel

# Proficiency bonuses in PF2e: level + [2,4,6,8]
_RANK_TO_BONUS = {
    "t": 2,  # trained
    "e": 4,  # expert
    "m": 6,  # master
    "l": 8,  # legendary
}

class ArmorState(BaseModel):
    base_ac: Optional[int] = None
    dex_cap: Optional[int] = None
    potency: Optional[int] = None
    proficiency_rank: Optional[str] = None

def _carry_forward(sparse_by_level: Dict[int, ArmorState], level: int) -> ArmorState:
    """Carry forward last known armor values to 'level'."""
    current = ArmorState(base_ac=0, dex_cap=10, potency=0, proficiency_rank="t")
    for L in range(1, level + 1):
        if L in sparse_by_level:
            s = sparse_by_level[L]
            if s.base_ac is not None: current.base_ac = s.base_ac
            if s.dex_cap is not None: current.dex_cap = s.dex_cap
            if s.potency is not None: current.potency = s.potency
            if s.proficiency_rank is not None: current.proficiency_rank = s.proficiency_rank
    return current

def _rank_for_level(prog: Dict[int, str], level: int) -> str:
    """Given {level:'t'|'e'|'m'|'l'} bumps, return active rank at 'level'."""
    r = "t"
    for L in sorted(prog.keys()):
        if L <= level:
            r = prog[L]
    return r

def _prof_bonus(level: int, rank: str) -> int:
    base = _RANK_TO_BONUS.get(rank, 2)
    return base + level

def _dex_used(base_dex_mod: int, dex_cap: int) -> int:
    if dex_cap is None:
        return base_dex_mod
    return min(base_dex_mod, dex_cap)

def summarize_progression_pf2e_with_full_ac(
    max_level: int,
    base_dex_mod: int,
    proficiency_progression: Dict[int, str],
    armor_by_level: Dict[int, dict],
) -> List[dict]:
    """
    Returns [{"level": i, "pf2e_full_ac": N, ...}, ...] using:
      AC = 10 + armor.item_bonus + Prof(level, rank) + min(dex_mod, dex_cap) + potency_rune
    Notes:
      * armor_by_level is sparse; last known carries forward.
      * proficiency_progression can be sparse bumps; last known carries forward too.
    """
    # Normalize armor_by_level to ArmorState
    sparse: Dict[int, ArmorState] = {}
    for k, v in armor_by_level.items():
        sparse[int(k)] = ArmorState(**(v or {}))

    out = []
    for level in range(1, max_level + 1):
        s: ArmorState = _carry_forward(sparse, level)
        rank = s.proficiency_rank or _rank_for_level(proficiency_progression, level)
        prof = _prof_bonus(level, rank)
        dex = _dex_used(base_dex_mod, s.dex_cap if s.dex_cap is not None else 10)
        item_bonus = s.base_ac or 0
        potency = s.potency or 0

        full_ac = 10 + item_bonus + prof + dex + potency

        out.append({
            "level": level,
            "pf2e_full_ac": full_ac,
            "components": {
                "base": 10,
                "item_bonus": item_bonus,
                "proficiency": prof,
                "dex_used": dex,
                "potency": potency,
                "rank": rank
            }
        })
    return out
