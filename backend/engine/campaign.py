# backend/engine/campaign.py
from dataclasses import dataclass, field, asdict
from typing import Dict, List, Optional, Any
from .engine_patched import Combatant, EncounterOptions, simulate_mixed

@dataclass
class MemberState:
    pc_id: str
    name: str
    max_hp: int
    hp: int
    ac: int
    attack_bonus: int
    attacks_per_round: int
    damage_profile: List[tuple]
    crit_range: int = 20
    to_hit_adv: int = 0
    # (room for resources later: spell_slots, features, etc.)

    def to_combatant(self) -> Combatant:
        return Combatant(
            name=self.name, ac=self.ac, hp=self.hp,
            attack_bonus=self.attack_bonus,
            attacks_per_round=self.attacks_per_round,
            damage_profile=self.damage_profile,
            crit_range=self.crit_range, to_hit_adv=self.to_hit_adv
        )

def build_member_state(pc: Dict) -> MemberState:
    return MemberState(
        pc_id=pc["id"],
        name=pc["id"],
        max_hp=int(pc["hp"]),
        hp=int(pc["hp"]),
        ac=int(pc["ac"]),
        attack_bonus=int(pc["attack_bonus"]),
        attacks_per_round=int(pc["attacks_per_round"]),
        damage_profile=[tuple(x) for x in pc["damage_profile"]],
        crit_range=int(pc.get("crit_range", 20)),
        to_hit_adv=int(pc.get("to_hit_adv", 0)),
    )

def apply_short_rest(p: MemberState):
    # MVP: heal 25% max HP, not exceeding max
    heal = max(1, int(0.25 * p.max_hp))
    p.hp = min(p.max_hp, p.hp + heal)

def apply_long_rest(p: MemberState):
    # MVP: full heal
    p.hp = p.max_hp
    # (Later: reset spell slots, features, charges, etc.)

@dataclass
class StepReport:
    index: int
    type: str
    name: str
    win_pct: float
    lose_pct: float
    draw_pct: float
    avg_rounds: float
    avg_player_dmg_total: float
    avg_enemy_dmg_total: float
    party_hp_after: List[int]
    debt_delta: float = 0.0
    descent_delta: float = 0.0

def run_encounter_step(
    party: List[MemberState],
    enemy: Combatant,
    n_enemies: int,
    traps: List[Dict],
    room_effects: List[Dict],
    trials: int,
    initiative: str,
    strategy: str,
    econ: Dict[str, float],
) -> StepReport:
    opts = EncounterOptions(
        max_rounds=20,
        initiative=initiative,
        target_strategy=strategy,
        traps=traps,
        room_effects=room_effects
    )

    wins = losses = draws = 0
    rounds_list: List[int] = []
    p_dmg = []
    e_dmg = []
    # track HP carryover: average final HP per seat across trials
    hp_sums = [0 for _ in party]

    for _ in range(trials):
        # snapshot current HP per member for this trial
        combatants = [m.to_combatant() for m in party]
        r = simulate_mixed(combatants, enemy, n_enemies=n_enemies, opts=opts)
        wins += 1 if r["players_win"] else 0
        losses += 1 if r["enemies_win"] else 0
        draws += 1 if r["draw"] else 0
        rounds_list.append(r["rounds"])
        p_dmg.append(r["total_player_damage"])
        e_dmg.append(r["total_enemy_damage"])
        # accumulate final hp (per member index); pad if sizes mismatch
        final_hp = r.get("players_hp_final", [])
        for i in range(len(party)):
            hp_sums[i] += int(final_hp[i] if i < len(final_hp) else 0)

    # Compute averages
    trials_f = float(trials)
    win_pct = 100.0 * wins / trials_f
    lose_pct = 100.0 * losses / trials_f
    draw_pct = 100.0 * draws / trials_f
    avg_rounds = sum(rounds_list)/trials_f if rounds_list else 0.0
    avg_p_total = sum(p_dmg)/trials_f if p_dmg else 0.0
    avg_e_total = sum(e_dmg)/trials_f if e_dmg else 0.0
    avg_hp_after = [int(h / trials_f) for h in hp_sums]

    # Update party HPs to the *average* outcome for carryover
    for i, m in enumerate(party):
        m.hp = max(0, min(m.max_hp, avg_hp_after[i]))

    # Economy deltas (simple hook)
    debt_delta = econ.get("debt_on_loss", 1.0) * (lose_pct / 100.0)
    descent_delta = econ.get("descent_on_win", 1.0) * (win_pct / 100.0)

    return StepReport(
        index=0, type="encounter", name=enemy.name,
        win_pct=win_pct, lose_pct=lose_pct, draw_pct=draw_pct,
        avg_rounds=avg_rounds,
        avg_player_dmg_total=avg_p_total,
        avg_enemy_dmg_total=avg_e_total,
        party_hp_after=avg_hp_after,
        debt_delta=debt_delta,
        descent_delta=descent_delta
    )

def run_series(
    party: List[MemberState],
    sequence: List[Dict[str, Any]],
    monsters_by_id: Dict[str, Dict],
    traps_by_id: Dict[str, Dict],
    rooms_by_id: Dict[str, Dict],
    encounters_by_id: Dict[str, Dict],
    initiative: str,
    strategy: str
) -> Dict[str, Any]:
    """
    sequence: list of steps:
      - {"type":"encounter","encounter_id":"mirror_room_act1","trials":1000,"trap_ids":[]}
      - {"type":"short_rest"} | {"type":"long_rest"}
    """
    timeline: List[Dict[str, Any]] = []
    totals = {"debt": 0.0, "descent": 0.0}
    step_index = 0

    for step in sequence:
        step_index += 1
        stype = step["type"]

        if stype == "encounter":
            enc = encounters_by_id[step["encounter_id"]]
            unit = enc["waves"][0]["units"][0]
            mon = monsters_by_id[unit["monster_id"]]
            n_enemies = unit["count"]
            trap_ids = step.get("trap_ids", [])
            traps = [traps_by_id[t] for t in trap_ids if t in traps_by_id]
            room_effects = [rooms_by_id[r] for r in enc.get("room_effects", []) if r in rooms_by_id]
            trials = int(step.get("trials", 1000))

            enemy = Combatant(
                name=mon["name"], ac=mon["ac"], hp=mon["hp"],
                attack_bonus=mon["attack_bonus"],
                attacks_per_round=mon["attacks_per_round"],
                damage_profile=[tuple(x) for x in mon["damage_profile"]],
            )
            econ = enc.get("economy", {"debt_on_loss":1.0, "descent_on_win":1.0})
            rep = run_encounter_step(
                party=party, enemy=enemy, n_enemies=n_enemies,
                traps=traps, room_effects=room_effects,
                trials=trials, initiative=initiative, strategy=strategy,
                econ=econ,
            )
            rep.index = step_index
            rep.name = enc.get("name", mon["name"])
            timeline.append(asdict(rep))
            totals["debt"] += rep.debt_delta
            totals["descent"] += rep.descent_delta

        elif stype == "short_rest":
            for m in party: apply_short_rest(m)
            timeline.append({
                "index": step_index, "type": "short_rest", "name": "Short Rest",
                "party_hp_after": [m.hp for m in party]
            })

        elif stype == "long_rest":
            for m in party: apply_long_rest(m)
            timeline.append({
                "index": step_index, "type": "long_rest", "name": "Long Rest",
                "party_hp_after": [m.hp for m in party]
            })

        else:
            timeline.append({
                "index": step_index, "type": stype, "name": stype, "note": "unknown step type"
            })

    return {
        "timeline": timeline,
        "totals": totals,
        "party_final_hp": [m.hp for m in party]
    }
