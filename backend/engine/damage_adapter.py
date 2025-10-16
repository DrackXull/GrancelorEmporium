# backend/engine/damage_adapter.py
from __future__ import annotations
from typing import Dict, Iterable, Tuple, List, Any, Optional
import math
import random

from .damage import DamageConfig, calculate_damage, DAMAGE_TYPES

# -----------------------------------------------------------------------------
# Feature 2: Damage type resolution (weapon/spell → damageType)
# -----------------------------------------------------------------------------
# You can extend this table as your content grows. Keys are lowercase.
WEAPON_TYPE_MAP: Dict[str, str] = {
    # melee
    "longsword": "slash",
    "shortsword": "slash",
    "greatsword": "slash",
    "dagger": "pierce",
    "rapier": "pierce",
    "spear": "pierce",
    "mace": "blunt",
    "warhammer": "blunt",
    "club": "blunt",
    # ranged
    "longbow": "pierce",
    "shortbow": "pierce",
    "crossbow": "pierce",
    # magic / tech
    "arcane_bolt": "arcane",
    "fire_wand": "fire",
    "frost_wand": "frost",
    "lightning_rod": "lightning",
    "tech_rifle": "tech",
}

# Spell burst (UI: L1=2d8, L2=3d8, L3=4d8)
SPELL_BURST_MAP: Dict[str, Tuple[int,int,int]] = {
    "L1": (2, 8, 0),
    "L2": (3, 8, 0),
    "L3": (4, 8, 0),
}

# -----------------------------------------------------------------------------
# Utils
# -----------------------------------------------------------------------------
def profile_to_notation(profile: List[Tuple[int, int, int]]) -> str:
    """
    Convert [(n,d,b), ...] -> "n1d1+b1 + n2d2+b2 ..."
    """
    parts: List[str] = []
    for n, d, b in profile:
        sign = "+" if b >= 0 else "-"
        parts.append(f"{n}d{d}{sign}{abs(b)}")
    return "+".join(parts) if parts else "0d1+0"

def safe_damage_type(
    weapon_id: Optional[str] = None,
    type_override: Optional[str] = None,
    fallback: str = "slash",
) -> str:
    """
    Resolve a final damage type:
      1) explicit override (if valid), else
      2) map from weapon_id, else
      3) fallback (default "slash")
    """
    if type_override and type_override in DAMAGE_TYPES:
        return type_override
    if weapon_id:
        t = WEAPON_TYPE_MAP.get(weapon_id.lower().strip())
        if t in DAMAGE_TYPES:
            return t
    return fallback

def extract_resists(creature: Any) -> Dict[str, float]:
    """
    Feature 1: Per-creature resists pulled transparently.
    Supports:
      - creature.resists (dict)
      - creature["resists"] (dict)
      - none → {}
    """
    try:
        # object attribute
        if hasattr(creature, "resists") and isinstance(getattr(creature, "resists"), dict):
            return dict(getattr(creature, "resists"))
        # dict-like
        if isinstance(creature, dict) and isinstance(creature.get("resists"), dict):
            return dict(creature["resists"])
    except Exception:
        pass
    return {}

# -----------------------------------------------------------------------------
# Core roll through the new engine
# -----------------------------------------------------------------------------
def roll_through_engine(
    profile: List[Tuple[int, int, int]],
    *,
    damage_type: str,
    resists: Dict[str, float] | None = None,
    gear_mods: Iterable[float] = (),
    buff_mods: Iterable[float] = (),
    debuff_mods: Iterable[float] = (),
    room_mods: Iterable[float] = (),
    crit_chance: float = 0.05,
    crit_mult: float = 1.5,
    variance: bool = False,
    variance_range: float = 0.03,
    rng: Optional[random.Random] = None,
) -> Dict[str, Any]:
    """
    Rolls a legacy damage profile via the Phase-1 engine (calculate_damage).
    Returns dict with baseDamage, totalMod, finalDamage, isCrit
    """
    base_roll = profile_to_notation(profile)
    cfg = DamageConfig(
        base_roll=base_roll,
        damage_type=damage_type,
        target_resists=resists or {},
        gear_mods=gear_mods,
        buff_mods=buff_mods,
        debuff_mods=debuff_mods,
        room_mods=room_mods,
        crit_chance=crit_chance,
        crit_mult=crit_mult,
        enable_variance=variance,
        variance_range=variance_range,
        rng=rng,
    )
    return calculate_damage(cfg)

# -----------------------------------------------------------------------------
# Feature 3: Composite attack resolution (action surge / sneak / spell burst)
# -----------------------------------------------------------------------------
def resolve_attack(
    *,
    attacker: Any,
    target: Any,
    base_profile: List[Tuple[int, int, int]],
    weapon_id: Optional[str] = None,
    type_override: Optional[str] = None,
    room_effects: List[Dict] = [],
    # crit / variance
    crit_chance: float = 0.05,
    crit_mult: float = 1.5,
    variance: bool = False,
    variance_range: float = 0.03,
    rng: Optional[random.Random] = None,
    # abilities
    use_action_surge: bool = False,
    use_sneak_attack: bool = False,
    sneak_profile: Tuple[int, int, int] = (1, 6, 0),  # default 1d6 (once)
    spell_burst: Optional[str] = None,                 # "L1"/"L2"/"L3"
    spell_burst_damage_type: str = "arcane",
    # stacking modifiers (if needed later)
    gear_mods: Iterable[float] = (),
    buff_mods: Iterable[float] = (),
    debuff_mods: Iterable[float] = (),
) -> Dict[str, Any]:
    """
    Resolves a single composite attack:
      - base swing (via weapon or override type)
      - optional Action Surge (duplicate base swing once)
      - optional Sneak Attack (extra dice once)
      - optional Spell Burst (2d8/3d8/4d8 once, or override via SPELL_BURST_MAP)
    All components roll through the same (crit/variance/resist) engine.

    Returns a structured result with breakdown and totalDamage.
    """
    # Resolve types and resists
    damage_type = safe_damage_type(weapon_id, type_override, "slash")
    target_res = extract_resists(target)

    # Apply room effects
    room_mods = []
    for effect in room_effects:
        for modifier in effect.get('effect', []):
            if modifier.get('target') == 'enemy':
                if modifier.get('attribute') == 'to-hit':
                    crit_chance += modifier.get('value', 0) / 100
                elif modifier.get('attribute') == 'damage_multiplier':
                    if modifier.get('damage_type') == damage_type or modifier.get('damage_type') is None:
                        room_mods.append(modifier.get('value', 0))

    breakdown: List[Dict[str, Any]] = []
    total = 0

    # Base swing
    base_res = roll_through_engine(
        base_profile,
        damage_type=damage_type,
        resists=target_res,
        gear_mods=gear_mods,
        buff_mods=buff_mods,
        debuff_mods=debuff_mods,
        room_mods=room_mods,
        crit_chance=crit_chance,
        crit_mult=crit_mult,
        variance=variance,
        variance_range=variance_range,
        rng=rng,
    )
    base_res["tag"] = "base"
    breakdown.append(base_res)
    total += base_res["finalDamage"]

    # Action Surge = duplicate main swing once (no shared crit)
    if use_action_surge:
        surge_res = roll_through_engine(
            base_profile,
            damage_type=damage_type,
            resists=target_res,
            gear_mods=gear_mods,
            buff_mods=buff_mods,
            debuff_mods=debuff_mods,
            room_mods=room_mods,
            crit_chance=crit_chance,
            crit_mult=crit_mult,
            variance=variance,
            variance_range=variance_range,
            rng=rng,
        )
        surge_res["tag"] = "action_surge"
        breakdown.append(surge_res)
        total += surge_res["finalDamage"]

    # Sneak Attack = extra dice once
    if use_sneak_attack and (sneak_profile is not None):
        sneak_res = roll_through_engine(
            [sneak_profile],
            damage_type=damage_type,  # same type as weapon by default
            resists=target_res,
            gear_mods=gear_mods,
            buff_mods=buff_mods,
            debuff_mods=debuff_mods,
            room_mods=room_mods,
            crit_chance=crit_chance,
            crit_mult=crit_mult,
            variance=variance,
            variance_range=variance_range,
            rng=rng,
        )
        sneak_res["tag"] = "sneak_attack"
        breakdown.append(sneak_res)
        total += sneak_res["finalDamage"]

    # Spell Burst = L1/L2/L3 → (2d8/3d8/4d8)
    if spell_burst:
        extra = SPELL_BURST_MAP.get(str(spell_burst).upper())
        if extra:
            burst_res = roll_through_engine(
                [extra],
                damage_type=spell_burst_damage_type,
                resists=target_res,
                gear_mods=gear_mods,
                buff_mods=buff_mods,
                debuff_mods=debuff_mods,
                room_mods=room_mods,
                crit_chance=crit_chance,
                crit_mult=crit_mult,
                variance=variance,
                variance_range=variance_range,
                rng=rng,
            )
            burst_res["tag"] = f"spell_burst_{spell_burst}"
            breakdown.append(burst_res)
            total += burst_res["finalDamage"]

    return {
        "attackerId": getattr(attacker, "id", None) if hasattr(attacker, "id") else (attacker.get("id") if isinstance(attacker, dict) else None),
        "targetId": getattr(target, "id", None) if hasattr(target, "id") else (target.get("id") if isinstance(target, dict) else None),
        "weaponId": weapon_id,
        "damageType": damage_type,
        "components": breakdown,
        "totalDamage": int(total),
    }

# -----------------------------------------------------------------------------
# Feature 4: Monte Carlo histogram helper
# -----------------------------------------------------------------------------
def histogram_binned(values: List[int], bin_size: int = 1) -> Dict[str, int]:
    """
    Returns a dict of {"binLabel": count}, where binLabel is a string range:
      e.g., with bin_size=5 → "0-4","5-9","10-14",...
    If bin_size == 1, labels are exact values as strings.
    """
    if not values:
        return {}
    if bin_size <= 1:
        out: Dict[str, int] = {}
        for v in values:
            k = str(int(v))
            out[k] = out.get(k, 0) + 1
        return out

    m = min(values)
    M = max(values)
    out: Dict[str, int] = {}
    start = (m // bin_size) * bin_size
    end = ((M // bin_size) + 1) * bin_size
    for v in values:
        bucket = ((v - start) // bin_size)
        lo = start + bucket * bin_size
        hi = lo + bin_size - 1
        label = f"{lo}-{hi}"
        out[label] = out.get(label, 0) + 1
    return out

def monte_carlo_profile_histogram(
    *,
    runs: int,
    profile: List[Tuple[int,int,int]],
    damage_type: str,
    resist_multiplier: float = 1.0,
    crit_chance: float = 0.05,
    crit_mult: float = 1.5,
    variance: bool = False,
    variance_range: float = 0.03,
    seed: Optional[int] = None,
    bin_size: int = 1,
) -> Dict[str, Any]:
    """
    Run many trials of a given legacy profile and return a histogram.
    """
    rng = random.Random(seed) if seed is not None else None
    samples: List[int] = []

    resists = {damage_type: resist_multiplier}
    for _ in range(int(runs)):
        r = roll_through_engine(
            profile,
            damage_type=damage_type,
            resists=resists,
            crit_chance=crit_chance,
            crit_mult=crit_mult,
            variance=variance,
            variance_range=variance_range,
            rng=rng,
        )
        samples.append(r["finalDamage"])

    return {
        "runs": runs,
        "binSize": bin_size,
        "histogram": histogram_binned(samples, bin_size=bin_size),
        "min": min(samples) if samples else 0,
        "max": max(samples) if samples else 0,
    }
