#!/usr/bin/env python3
import json, re, sys, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[1] / "data"
ID_RE = re.compile(r"^[a-z0-9_]+$")

def load_table(relpath):
    p = ROOT / relpath
    if not p.exists(): return []
    with p.open("r", encoding="utf-8") as f:
        return json.load(f)

def index_by_id(rows):
    return {(r.get("ruleset","v1"), r["id"]): r for r in rows if "id" in r}

def must_id(x, path):
    if not ID_RE.match(x): fail(f"Bad id '{x}' in {path}")

fails = []
def fail(msg):
    print(f"[LINT] {msg}")
    fails.append(msg)

def req(obj, key, path):
    if key not in obj: fail(f"Missing '{key}' in {path}")

def check_features_by_level(fbl, path, max_lvl=20):
    for k in fbl.keys():
        if not str(k).isdigit(): fail(f"{path}: non-integer level '{k}'")
        lvl = int(k)
        if lvl < 1 or lvl > max_lvl: fail(f"{path}: out-of-range level {lvl}")

def main():
    # Load catalogs
    tables = {
        "5e/classes": load_table("5e/classes.json"),
        "5e/weapons": load_table("5e/weapons.json"),
        "5e/armors":  load_table("5e/armors.json"),
        "5e/backgrounds": load_table("5e/backgrounds.json"),
        "pf2e/classes": load_table("pf2e/classes.json"),
        "pf2e/weapons": load_table("pf2e/weapons.json"),
        "pf2e/armors":  load_table("pf2e/armors.json"),
        "pf2e/backgrounds": load_table("pf2e/backgrounds.json"),
        "pf2e/traits": load_table("pf2e/traits.json"),
        "pf2e/runes": load_table("pf2e/runes.json")
    }

    # ID format + presence
    for name, rows in tables.items():
        for i, r in enumerate(rows):
            path = f"{name}[{i}]"
            if "id" not in r: fail(f"Missing id in {path}"); continue
            must_id(r["id"], path)
            if "ruleset" not in r: fail(f"Missing ruleset in {path}")

    # Uniqueness per (ruleset, id) inside each table
    for name, rows in tables.items():
        seen = set()
        for i, r in enumerate(rows):
            if "id" not in r or "ruleset" not in r: continue
            key = (r["ruleset"], r["id"])
            if key in seen: fail(f"Duplicate id {key} in {name}")
            seen.add(key)

    # Build cross-ref indices
    idx = {}
    for key, rows in tables.items():
        for r in rows:
            ruleset = r.get("ruleset","v1")
            idx.setdefault(key, {}).setdefault((ruleset, r["id"]), r)

    def exists(table, ruleset, rid):
        return (ruleset, rid) in idx.get(table, {})

    # Class schema checks
    for ruleset in ["5e","pf2e"]:
        for i, cls in enumerate(tables[f"{ruleset}/classes"]):
            path = f"{ruleset}/classes[{i}]"
            req(cls, "name", path)
            req(cls, "features_by_level", path)
            check_features_by_level(cls["features_by_level"], f"{path}.features_by_level")
            if ruleset == "5e":
                req(cls, "hit_die", path)
            else:
                req(cls, "hp_per_level", path)

            # defaults cross-refs
            d = cls.get("defaults", {}).get(ruleset, {})
            wid, aid = d.get("weapon_id"), d.get("armor_id")
            if wid and not exists(f"{ruleset}/weapons", ruleset, wid):
                fail(f"{path}: weapon_id '{wid}' not found")
            if aid and not exists(f"{ruleset}/armors", ruleset, aid):
                fail(f"{path}: armor_id '{aid}' not found")
            bg = d.get("background_id")
            if bg and not exists(f"{ruleset}/backgrounds", ruleset, bg):
                fail(f"{path}: background_id '{bg}' not found")
            anc = d.get("ancestry_id")
            if anc and not exists(f"{ruleset}/backgrounds", ruleset, anc) and not exists(f"{ruleset}/ancestries", ruleset, anc):
                # ancestry optional; warn only if set and missing
                fail(f"{path}: ancestry_id '{anc}' not found")

    if fails:
        print(f"\n[LINT] FAILED with {len(fails)} error(s).")
        sys.exit(1)
    print("[LINT] OK")

if __name__ == "__main__":
    main()
