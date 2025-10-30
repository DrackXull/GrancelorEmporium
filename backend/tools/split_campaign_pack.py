# backend/tools/split_campaign_pack.py
from __future__ import annotations
import argparse, json, os, re
from pathlib import Path
from typing import Dict, Any, List

SAFE = re.compile(r"[^a-z0-9_-]+")

def safe_id(x: str) -> str:
    x = SAFE.sub("-", x.strip().lower())
    return re.sub(r"-+", "-", x).strip("-") or "unnamed"

def load_json(path: Path) -> Dict[str, Any]:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)

def ensure_dir(p: Path):
    p.mkdir(parents=True, exist_ok=True)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("monsters_encounters", type=Path)   # e.g. monsters_encounters.json
    ap.add_argument("traps_effects", type=Path)         # e.g. traps_room_effects.json
    ap.add_argument("--campaign", required=True)        # e.g. emporium
    ap.add_argument("--ruleset", required=True, choices=["5e","pf2e"])
    ap.add_argument("--root", default="backend/data")
    args = ap.parse_args()

    root = Path(args.root)
    # Destinations
    rs_dir       = root / "campaigns" / args.campaign / args.ruleset
    shared_dir   = root / "campaigns" / args.campaign / "shared"
    monsters_dir = rs_dir / "monsters"
    aggr_dir     = rs_dir / "aggregates"
    ensure_dir(monsters_dir); ensure_dir(shared_dir); ensure_dir(aggr_dir)

    # Load packs
    me = load_json(args.monsters_encounters)
    te = load_json(args.traps_effects)

    # 1) Monsters: write aggregate + per-file
    monsters: List[Dict[str, Any]] = list(me.get("monsters") or [])
    # Tag ruleset if missing, normalize ids
    for m in monsters:
        m.setdefault("ruleset", args.ruleset)
        mid = m.get("id") or m.get("name")
        m["id"] = safe_id(mid) if mid else None
    # aggregate
    with (aggr_dir / "monsters.json").open("w", encoding="utf-8") as f:
        json.dump(monsters, f, ensure_ascii=False, indent=2)
    # per-file
    written = 0
    for m in monsters:
        if not isinstance(m, dict) or not m.get("id"):
            continue
        with (monsters_dir / f"{m['id']}.json").open("w", encoding="utf-8") as f:
            json.dump(m, f, ensure_ascii=False, indent=2)
        written += 1

    # 2) Encounters → shared/encounters.json (system-agnostic composition)
    encounters = list(me.get("encounters") or [])
    with (shared_dir / "encounters.json").open("w", encoding="utf-8") as f:
        json.dump(encounters, f, ensure_ascii=False, indent=2)

    # 3) Traps + room effects → shared
    traps = list(te.get("traps") or [])
    with (shared_dir / "traps.json").open("w", encoding="utf-8") as f:
        json.dump(traps, f, ensure_ascii=False, indent=2)

    room_effects = list(te.get("room_effects") or [])
    with (shared_dir / "room_effects.json").open("w", encoding="utf-8") as f:
        json.dump(room_effects, f, ensure_ascii=False, indent=2)

    print(f"[ok] wrote {written} monsters to {monsters_dir}")
    print(f"[ok] aggregate saved to {aggr_dir/'monsters.json'}")
    print(f"[ok] encounters -> {shared_dir/'encounters.json'}")
    print(f"[ok] traps      -> {shared_dir/'traps.json'}")
    print(f"[ok] effects    -> {shared_dir/'room_effects.json'}")

if __name__ == "__main__":
    main()
