# backend/engine/monte_carlo.py
from __future__ import annotations
import random, statistics
from typing import Dict, Any, Optional, List
from .damage import DamageConfig, calculate_damage

def run_monte_carlo(
    runs: int = 100000,
    base_roll: str = "1d8+3",
    damage_type: str = "fire",
    resist_multiplier: float = 1.0,
    crit_chance: float = 0.05,
    crit_mult: float = 1.5,
    enable_variance: bool = False,
    variance_range: float = 0.03,
    seed: Optional[int] = None
) -> Dict[str, Any]:
    rng = random.Random(seed) if seed is not None else None
    samples: List[int] = []
    crits = 0

    target_resists = {damage_type: resist_multiplier}

    for _ in range(int(runs)):
        result = calculate_damage(DamageConfig(
            base_roll=base_roll,
            damage_type=damage_type,
            target_resists=target_resists,
            crit_chance=crit_chance,
            crit_mult=crit_mult,
            enable_variance=enable_variance,
            variance_range=variance_range,
            rng=rng
        ))
        samples.append(result["finalDamage"])
        if result["isCrit"]:
            crits += 1

    mean = statistics.fmean(samples) if samples else 0.0
    stdev = statistics.pstdev(samples) if len(samples) > 1 else 0.0

    return {
        "runs": runs,
        "mean": round(mean, 4),
        "stdev": round(stdev, 4),
        "min": min(samples) if samples else 0,
        "max": max(samples) if samples else 0,
        "critRate": round(crits / runs, 4) if runs else 0.0
    }

def run_standard_scenarios(
    *,
    runs: int = 100000,
    base_roll: str = "1d8+3",
    damage_type: str = "fire",
    crit_chance: float = 0.05,
    crit_mult: float = 1.5,
    enable_variance: bool = False,
    variance_range: float = 0.03,
    seed: Optional[int] = None
) -> Dict[str, Any]:
    return {
        "resistance_0_5x": run_monte_carlo(
            runs=runs, base_roll=base_roll, damage_type=damage_type,
            resist_multiplier=0.5, crit_chance=crit_chance, crit_mult=crit_mult,
            enable_variance=enable_variance, variance_range=variance_range, seed=seed
        ),
        "neutral_1_0x": run_monte_carlo(
            runs=runs, base_roll=base_roll, damage_type=damage_type,
            resist_multiplier=1.0, crit_chance=crit_chance, crit_mult=crit_mult,
            enable_variance=enable_variance, variance_range=variance_range, seed=seed
        ),
        "weakness_1_5x": run_monte_carlo(
            runs=runs, base_roll=base_roll, damage_type=damage_type,
            resist_multiplier=1.5, crit_chance=crit_chance, crit_mult=crit_mult,
            enable_variance=enable_variance, variance_range=variance_range, seed=seed
        ),
        "immunity_0x": run_monte_carlo(
            runs=runs, base_roll=base_roll, damage_type=damage_type,
            resist_multiplier=0.0, crit_chance=crit_chance, crit_mult=crit_mult,
            enable_variance=enable_variance, variance_range=variance_range, seed=seed
        ),
    }
