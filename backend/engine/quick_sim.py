# backend/engine/quick_sim.py
from __future__ import annotations
from typing import Dict, Any, List
import random
import math

def _team_stats(team: List[Dict[str, Any]]):
    ehp = sum(float(x.get("ehp", 50.0)) for x in team)
    dpr = sum(float(x.get("dpr", 10.0)) for x in team)
    crit = sum(float(x.get("crit_rate", 0.05)) for x in team) / max(1, len(team))
    return ehp, dpr, crit

def _one_bout(party: List[Dict[str, Any]], foes: List[Dict[str, Any]], policy: str) -> Dict[str, Any]:
    p_ehp, p_dpr, p_crit = _team_stats(party)
    f_ehp, f_dpr, f_crit = _team_stats(foes)
    rounds = 0
    while p_ehp > 0 and f_ehp > 0 and rounds < 100:
        rounds += 1
        p_var = random.gauss(1.0, 0.12)
        p_crit_mult = 1.0 + (p_crit * 0.5)
        f_ehp -= max(0.0, p_dpr * p_var * p_crit_mult)

        f_var = random.gauss(1.0, 0.12)
        f_crit_mult = 1.0 + (f_crit * 0.5)
        p_ehp -= max(0.0, f_dpr * f_var * f_crit_mult)

    party_win = p_ehp > 0 and f_ehp <= 0
    return {"party_win": party_win, "rounds": rounds,
            "party_remaining": max(0.0, p_ehp), "foe_remaining": max(0.0, f_ehp)}

def run_sim(payload: Dict[str, Any]) -> Dict[str, Any]:
    party = payload.get("party") or []
    foes = payload.get("foes") or []
    iters = int(payload.get("iterations") or 1000)
    policy = payload.get("policy") or "aggressive"

    wins = 0
    rounds_sum = 0
    for _ in range(iters):
        r = _one_bout(party, foes, policy)
        wins += 1 if r["party_win"] else 0
        rounds_sum += r["rounds"]

    winrate = wins / max(1, iters)
    return {
        "ok": True,
        "iterations": iters,
        "winrate": round(winrate, 4),
        "avg_rounds": round(rounds_sum / max(1, iters), 2)
    }
