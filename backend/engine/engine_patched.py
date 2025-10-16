# backend/engine/engine_patched.py
from dataclasses import dataclass, field
from typing import List, Tuple, Dict, Optional
import random, math
from .damage_adapter import resolve_attack, roll_through_engine


# ---- Dice helpers ----
def roll_dice(num: int, die: int) -> int:
    return sum(random.randint(1, die) for _ in range(num))

def roll_damage(profile: List[Tuple[int, int, int]]) -> int:
    total = 0
    for n, d, b in profile:
        total += sum(random.randint(1, d) for _ in range(n)) + b
    return total

# ---- Types ----
@dataclass
class Combatant:
    name: str
    ac: int
    hp: int
    attack_bonus: int
    attacks_per_round: int
    damage_profile: List[Tuple[int, int, int]]
    crit_range: int = 20
    to_hit_advantage: int = 0

    # Ability hooks
    extra_damage_first_hit: List[Tuple[int,int,int]] = field(default_factory=list)  # e.g., Sneak Attack once/round
    extra_attacks_once: int = 0              # e.g., Action Surge: extra full attack sequence once per combat
    extra_damage_once: List[Tuple[int,int,int]] = field(default_factory=list)      # Spell burst: extra damage once per combat

@dataclass
class EncounterOptions:
    max_rounds: int = 20
    initiative: str = "random"     # "players_first" | "enemies_first" | "random"
    target_strategy: str = "focus_lowest"  # "focus_lowest" | "random" | "focus_highest"
    traps: List[Dict] = field(default_factory=list)
    room_effects: List[Dict] = field(default_factory=list)

# ---- Room effects processing ----
def apply_room_effects(room_effects, ctx):
    for eff in room_effects:
        if eff.get("rule") == "crit_range_wider_for_mirror":
            ctx["enemy_crit_bonus"] = ctx.get("enemy_crit_bonus", 0) + eff.get("params", {}).get("mirror_side_bonus", 1)
        if eff.get("rule") == "pulse_every_n":
            p = eff.get("params", {})
            ctx.setdefault("enemy_pulses", []).append({
                "freq": int(p.get("n", 3)),
                "dc": int(p.get("dc", 13)),
                "dmg": [tuple(x) for x in p.get("dmg", [[1,6,0]])],
            })

def choose_target(hps: List[int], strategy: str) -> int:
    alive = [i for i, hp in enumerate(hps) if hp > 0]
    if not alive: return -1
    if strategy == "random": return random.choice(alive)
    if strategy == "focus_highest": return sorted(alive, key=lambda i: hps[i], reverse=True)[0]
    return sorted(alive, key=lambda i: hps[i])[0]  # focus_lowest

def roll_to_hit(attack_bonus: int, target_ac: int, adv_state: int, crit_range: int):
    if adv_state > 0:
        r = max(random.randint(1,20), random.randint(1,20))
    elif adv_state < 0:
        r = min(random.randint(1,20), random.randint(1,20))
    else:
        r = random.randint(1,20)
    crit = r >= crit_range
    total = r + attack_bonus
    hit = (r == 20) or (total >= target_ac and r != 1)
    return hit, crit

# ---- Core sim ----
def simulate_mixed(
    players: List[Combatant],
    enemy: Combatant,
    *,
    n_enemies: int,
    opts: EncounterOptions,
    enemy_damage_factor: float = 1.0
) -> Dict:
    """
    enemy_damage_factor < 1.0 means the enemy takes reduced damage (e.g., 0.5 for 'resist nonmagical').
    Note: n_enemies and opts are keyword-only to avoid arg ordering mistakes.
    """
    # Setup
    players_hp = [p.hp for p in players]
    enemies_hp = [enemy.hp for _ in range(n_enemies)]
    round_num = 0
    if opts.initiative == "players_first": players_turn = True
    elif opts.initiative == "enemies_first": players_turn = False
    else: players_turn = bool(random.getrandbits(1))

    # Room effect context
    ctx: Dict[str, any] = {}
    apply_room_effects(opts.room_effects, ctx)
    enemy_crit_range = max(1, enemy.crit_range - ctx.get("enemy_crit_bonus", 0))

    # Accounting
    total_player_damage = 0
    total_enemy_damage = 0
    contrib = [0 for _ in players]
    used_surge = [False for _ in players]
    used_burst = [False for _ in players]

    while round_num < opts.max_rounds and any(h>0 for h in players_hp) and any(h>0 for h in enemies_hp):
        round_num += 1
        used_sneak_this_round = [False for _ in players]

        # Pulses
        for pulse in ctx.get("enemy_pulses", []):
            if pulse["freq"] > 0 and (round_num % pulse["freq"] == 0):
                dc = pulse["dc"]
                for i in range(len(players_hp)):
                    if players_hp[i] <= 0: continue
                    save_roll = random.randint(1,20) + 2
                    dmg_prof = pulse["dmg"] if save_roll < dc else []
                    if dmg_prof:
                        dmg = roll_damage(dmg_prof)
                        players_hp[i] = max(0, players_hp[i] - dmg)
                        total_enemy_damage += dmg

        if players_turn:
            for pi, p in enumerate(players):
                if not any(h>0 for h in enemies_hp): break
                attacks_this_round = p.attacks_per_round
                if p.extra_attacks_once > 0 and not used_surge[pi]:
                    attacks_this_round += p.extra_attacks_once
                    used_surge[pi] = True

                for _ in range(attacks_this_round):
                    t = choose_target(enemies_hp, opts.target_strategy)
                    if t == -1: break
                    hit, crit = roll_to_hit(p.attack_bonus, enemy.ac, p.to_hit_advantage, p.crit_range)
                    if hit:
    # Use adapter to produce damage. We bind the crit from the hit roll (no extra crit RNG).
    # Enemy resists are auto-read by the adapter if enemy has a .resists dict; pass {} otherwise.
                        enemy_resists = getattr(enemy, "resists", {}) if hasattr(enemy, "resists") else {}

    # Sneak: once per round on first hit
                        use_sneak = (not used_sneak_this_round[pi]) and bool(p.extra_damage_first_hit)
    # If your extra_damage_first_hit is a list like [(n,d,b)], take the first tuple:
                        sneak_tuple = tuple(p.extra_damage_first_hit[0]) if (use_sneak and len(p.extra_damage_first_hit) > 0) else (1, 6, 0)

    # Resolve the base swing (+ optional Sneak) through the engine, pinning critChance to the to-hit result.
                        resolved = resolve_attack(
                            attacker=p,
                            target=enemy,
                            base_profile=p.damage_profile,      # [(n,d,b)] list
                            weapon_id=getattr(p, "weapon_id", None),
                            type_override=None,                  # or set to e.g. "fire" for spells
                            crit_chance=(1.0 if crit else 0.0),  # respect the loop’s crit result
                            crit_mult=1.5,
                            variance=False,
                            variance_range=0.03,
                            use_action_surge=False,              # the loop already handles extra attacks
                            use_sneak_attack=use_sneak,
                            sneak_profile=sneak_tuple,
                            spell_burst=None,                    # handled below (arbitrary profiles)
                            spell_burst_damage_type="arcane",
                        )
                        dmg = resolved["totalDamage"]

    # Spell Burst / once-per-combat extra (arbitrary profile) — roll it through the engine too
                    if (not used_burst[pi]) and p.extra_damage_once:
                        burst_res = roll_through_engine(
                            p.extra_damage_once,             # full [(n,d,b)] list
                            damage_type=resolved["damageType"],
                            resists=enemy_resists,
                            crit_chance=(1.0 if crit else 0.0),
                            crit_mult=1.5,
                            variance=False,
                            variance_range=0.03
                        )
                    dmg += burst_res["finalDamage"]
                    used_burst[pi] = True

                    dealt = max(0, int(math.floor(dmg * enemy_damage_factor)))
                    enemies_hp[t] = max(0, enemies_hp[t] - dealt)
                    total_player_damage += dealt
                    contrib[pi] += dealt
            players_turn = False
        else:
            for _ in range(n_enemies):
                if not any(h>0 for h in players_hp): break
                for _ in range(enemy.attacks_per_round):
                    t = choose_target(players_hp, opts.target_strategy)
                    if t == -1: break
                    hit, crit = roll_to_hit(enemy.attack_bonus, players[t].ac, enemy.to_hit_advantage, enemy_crit_range)
                    if hit:
    # PC resists are auto-read by the adapter if your PC object carries .resists or ["resists"]
                        pc_resists = getattr(players[t], "resists", {}) if hasattr(players[t], "resists") else {}

                        resolved = resolve_attack(
                            attacker=enemy,
                            target=players[t],
                            base_profile=enemy.damage_profile,
                            weapon_id=getattr(enemy, "weapon_id", None),
                            type_override=None,
                            crit_chance=(1.0 if crit else 0.0),  # pin crit to to-hit outcome
                            crit_mult=1.5,
                            variance=False,
                            variance_range=0.03,
                            use_action_surge=False,
                            use_sneak_attack=False,
                            spell_burst=None
                        )
                        dmg = resolved["totalDamage"]

                        players_hp[t] = max(0, players_hp[t] - dmg)
                        total_enemy_damage += dmg
            players_turn = True

    players_alive = sum(1 for h in players_hp if h > 0)
    enemies_alive = sum(1 for h in enemies_hp if h > 0)
    players_win = (enemies_alive == 0 and players_alive > 0)
    enemies_win = (players_alive == 0 and enemies_alive > 0)
    draw = not players_win and not enemies_win

    return {
        "rounds": round_num,
        "players_alive": players_alive,
        "enemies_alive": enemies_alive,
        "players_win": players_win,
        "enemies_win": enemies_win,
        "draw": draw,
        "total_player_damage": total_player_damage,
        "total_enemy_damage": total_enemy_damage,
        "players_damage_contrib": contrib,
        "players_hp_final": players_hp,
        "enemies_hp_final": enemies_hp
    }
