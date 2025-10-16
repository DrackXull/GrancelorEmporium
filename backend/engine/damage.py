# backend/engine/damage.py
from __future__ import annotations
import random
from dataclasses import dataclass
from typing import Dict, Iterable, Optional

# Canonical damage types (Phase 1A)
DAMAGE_TYPES = [
    "slash","pierce","blunt",
    "fire","frost","lightning","poison",
    "arcane","necrotic","radiant",
    "psychic","force","shadow","chaos","tech","true"
]

@dataclass
class DamageConfig:
    base_roll: str              # e.g., "1d8+3" or "1d8+3+1d6+0"
    damage_type: str            # must be one of DAMAGE_TYPES
    target_resists: Dict[str, float] = None
    gear_mods: Iterable[float] = ()
    buff_mods: Iterable[float] = ()
    debuff_mods: Iterable[float] = ()
    room_mods: Iterable[float] = ()
    crit_chance: float = 0.05
    crit_mult: float = 1.5
    enable_variance: bool = False
    variance_range: float = 0.03
    rng: Optional[random.Random] = None

def _rng(r: Optional[random.Random]) -> random.Random:
    return r if r is not None else random

def roll_dice(notation: str, rnd: Optional[random.Random] = None) -> int:
    """
    Supports:
      - "XdY+Z" or "XdY-Z"
      - multi-part joined with '+', e.g. "1d8+3+1d6+0"
    """
    import re
    total = 0
    r = _rng(rnd)
    # split by '+' and keep signs on numbers
    parts = re.split(r"\s*\+\s*", notation.strip())
    for part in parts:
        part = part.strip()
        # match "XdY(+/-Z)" or just a signed integer (edge case)
        m = re.match(r"^(\d+)d(\d+)([+-]\s*\d+)?$", part)
        if m:
            n = int(m.group(1))
            d = int(m.group(2))
            b = int(m.group(3).replace(" ", "")) if m.group(3) else 0
            for _ in range(n):
                total += r.randint(1, d)
            total += b
        else:
            # allow plain integer segments (e.g., "+2")
            try:
                total += int(part.replace(" ", ""))
            except ValueError:
                raise ValueError(f"Invalid dice segment: '{part}' in '{notation}'")
    return total

def calculate_damage(cfg: DamageConfig) -> Dict:
    if cfg.damage_type not in DAMAGE_TYPES:
        raise ValueError(f"Unknown damage_type '{cfg.damage_type}'. Allowed: {DAMAGE_TYPES}")

    r = _rng(cfg.rng)

    base = roll_dice(cfg.base_roll, r)

    # collect multipliers
    mods = []
    if cfg.target_resists and (cfg.damage_type in cfg.target_resists):
        mods.append(float(cfg.target_resists[cfg.damage_type]))
    mods.extend(float(m) for m in cfg.gear_mods)
    mods.extend(float(m) for m in cfg.buff_mods)
    mods.extend(float(m) for m in cfg.debuff_mods)
    mods.extend(float(m) for m in cfg.room_mods)

    total_mod = 1.0
    for m in mods:
        total_mod *= m

    # optional tiny variance
    if cfg.enable_variance and cfg.variance_range > 0:
        swing = (r.random() * 2 - 1) * cfg.variance_range  # [-range, +range]
        total_mod *= (1.0 + swing)

    # crit check
    is_crit = (r.random() < cfg.crit_chance)
    if is_crit:
        total_mod *= cfg.crit_mult

    # clamp for sanity
    total_mod = max(0.0, min(total_mod, 2.5))

    final_damage = int(round(base * total_mod))

    return {
        "baseDamage": base,
        "totalMod": float(f"{total_mod:.4f}"),
        "finalDamage": final_damage,
        "isCrit": is_crit
    }
