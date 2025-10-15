# backend/routers/damage.py

from __future__ import annotations
from typing import Dict, Any, Optional, List, Tuple
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, confloat
import random
from engine.damage import DAMAGE_TYPES, DamageConfig, calculate_damage
from engine.monte_carlo import run_monte_carlo, run_standard_scenarios
from engine.damage_adapter import (
    resolve_attack,
    monte_carlo_profile_histogram,
)


router = APIRouter(tags=["damage"])

# ---------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------
class CalcRequest(BaseModel):
    baseRoll: str = Field(..., description='Dice like "1d8+3"')
    damageType: str = Field(..., description='One of canonical types')
    targetResists: Dict[str, float] = {}
    gearMods: List[float] = []
    buffMods: List[float] = []
    debuffMods: List[float] = []
    critChance: confloat(ge=0, le=1) = 0.05
    critMult: confloat(ge=1) = 1.5
    enableVariance: bool = False
    varianceRange: confloat(ge=0, le=0.2) = 0.03
    seed: Optional[int] = None

class MonteCarloRequest(BaseModel):
    runs: int = 100000
    baseRoll: str = "1d8+3"
    damageType: str = "fire"
    resistMultiplier: confloat(ge=0, le=3) = 1.0
    critChance: confloat(ge=0, le=1) = 0.05
    critMult: confloat(ge=1) = 1.5
    enableVariance: bool = False
    varianceRange: confloat(ge=0, le=0.2) = 0.03
    seed: Optional[int] = None

class MonteStandardRequest(BaseModel):
    runs: int = 100000
    baseRoll: str = "1d8+3"
    damageType: str = "fire"
    critChance: confloat(ge=0, le=1) = 0.05
    critMult: confloat(ge=1) = 1.5
    enableVariance: bool = False
    varianceRange: confloat(ge=0, le=0.2) = 0.03
    seed: Optional[int] = None

class PreviewProfileInput(BaseModel):
    profile: List[Tuple[int,int,int]] = Field(..., description="List of (n,d,b) like [[1,8,3]] for 1d8+3")
    damageType: str = "slash"
    resists: Dict[str, float] = {}
    critChance: float = 0.05
    critMult: float = 1.5
    enableVariance: bool = False
    varianceRange: confloat(ge=0, le=0.2) = 0.03
    seed: Optional[int] = None

class ResolveAttackInput(BaseModel):
    attacker: Dict[str, Any] = {}
    target: Dict[str, Any] = {}
    baseProfile: List[Tuple[int,int,int]] = Field(..., description="[(n,d,b)] list for base swing")
    weaponId: Optional[str] = None
    typeOverride: Optional[str] = None
    critChance: float = 0.05
    critMult: float = 1.5
    enableVariance: bool = False
    varianceRange: confloat(ge=0, le=0.2) = 0.03
    # abilities
    useActionSurge: bool = False
    useSneakAttack: bool = False
    sneakProfile: Tuple[int,int,int] = (1,6,0)
    spellBurst: Optional[str] = None  # "L1"/"L2"/"L3"
    spellBurstDamageType: str = "arcane"

class HistogramRequest(BaseModel):
    runs: int = 50000
    profile: List[Tuple[int,int,int]] = Field(..., description="[(n,d,b)]")
    damageType: str = "slash"
    resistMultiplier: confloat(ge=0, le=3) = 1.0
    critChance: float = 0.05
    critMult: float = 1.5
    enableVariance: bool = False
    varianceRange: confloat(ge=0, le=0.2) = 0.03
    seed: Optional[int] = None
    binSize: int = 1

# ---------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------
@router.get("/damage/types")
def get_damage_types() -> Dict[str, Any]:
    return {"damageTypes": DAMAGE_TYPES}

@router.post("/damage/calc")
def post_calculate_damage(payload: CalcRequest) -> Dict[str, Any]:
    if payload.damageType not in DAMAGE_TYPES:
        raise HTTPException(status_code=400, detail=f"damageType must be one of: {DAMAGE_TYPES}")
    result = calculate_damage(DamageConfig(
        base_roll=payload.baseRoll,
        damage_type=payload.damageType,
        target_resists=payload.targetResists,
        gear_mods=payload.gearMods,
        buff_mods=payload.buffMods,
        debuff_mods=payload.debuffMods,
        crit_chance=payload.critChance,
        crit_mult=payload.critMult,
        enable_variance=payload.enableVariance,
        variance_range=payload.varianceRange,
        rng=(random.Random(payload.seed) if payload.seed is not None else None),
    ))
    return result

@router.post("/damage/preview_profile")
def preview_profile(payload: PreviewProfileInput) -> Dict[str, Any]:
    # Legacy-profile one-off preview through new engine
    resists = payload.resists or {}
    if payload.damageType not in DAMAGE_TYPES:
        raise HTTPException(status_code=400, detail=f"damageType must be one of: {DAMAGE_TYPES}")
    cfg = DamageConfig(
        base_roll="+".join([f"{n}d{d}{'+' if b>=0 else '-'}{abs(b)}" for n,d,b in payload.profile]),
        damage_type=payload.damageType,
        target_resists=resists,
        crit_chance=payload.critChance,
        crit_mult=payload.critMult,
        enable_variance=payload.enableVariance,
        variance_range=payload.varianceRange,
        rng=(random.Random(payload.seed) if payload.seed is not None else None),
    )
    return calculate_damage(cfg)

@router.post("/damage/montecarlo")
def post_montecarlo(payload: MonteCarloRequest) -> Dict[str, Any]:
    return run_monte_carlo(
        runs=payload.runs,
        base_roll=payload.baseRoll,
        damage_type=payload.damageType,
        resist_multiplier=payload.resistMultiplier,
        crit_chance=payload.critChance,
        crit_mult=payload.critMult,
        enable_variance=payload.enableVariance,
        variance_range=payload.varianceRange,
        seed=payload.seed
    )

@router.post("/damage/montecarlo/standard")
def post_montecarlo_standard(payload: MonteStandardRequest) -> Dict[str, Any]:
    return run_standard_scenarios(
        runs=payload.runs,
        base_roll=payload.baseRoll,
        damage_type=payload.damageType,
        crit_chance=payload.critChance,
        crit_mult=payload.critMult,
        enable_variance=payload.enableVariance,
        variance_range=payload.varianceRange,
        seed=payload.seed
    )

@router.post("/damage/resolve_attack")
def post_resolve_attack(payload: ResolveAttackInput) -> Dict[str, Any]:
    # Full composite attack using the adapter (Action Surge, Sneak, Spell Burst)
    if payload.typeOverride and payload.typeOverride not in DAMAGE_TYPES:
        raise HTTPException(status_code=400, detail=f"typeOverride must be one of: {DAMAGE_TYPES}")
    return resolve_attack(
        attacker=payload.attacker,
        target=payload.target,
        base_profile=payload.baseProfile,
        weapon_id=payload.weaponId,
        type_override=payload.typeOverride,
        crit_chance=payload.critChance,
        crit_mult=payload.critMult,
        variance=payload.enableVariance,
        variance_range=payload.varianceRange,
        use_action_surge=payload.useActionSurge,
        use_sneak_attack=payload.useSneakAttack,
        sneak_profile=payload.sneakProfile,
        spell_burst=payload.spellBurst,
        spell_burst_damage_type=payload.spellBurstDamageType,
    )

@router.post("/damage/montecarlo/hist")
def post_montecarlo_hist(payload: HistogramRequest) -> Dict[str, Any]:
    if payload.damageType not in DAMAGE_TYPES:
        raise HTTPException(status_code=400, detail=f"damageType must be one of: {DAMAGE_TYPES}")
    return monte_carlo_profile_histogram(
        runs=payload.runs,
        profile=payload.profile,
        damage_type=payload.damageType,
        resist_multiplier=payload.resistMultiplier,
        crit_chance=payload.critChance,
        crit_mult=payload.critMult,
        variance=payload.enableVariance,
        variance_range=payload.varianceRange,
        seed=payload.seed,
        bin_size=max(1, int(payload.binSize)),
    )
