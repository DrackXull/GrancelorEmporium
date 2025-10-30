# backend/rulesets.py
import os, json
from typing import Dict, Any

# Folder layout:
# backend/data/
#   5e/
#     classes.json, ancestries.json (races), backgrounds.json, feats.json,
#     spells.json, items.json, weapons.json, armors.json
#   pf2e/
#     classes.json, ancestries.json, backgrounds.json, feats.json,
#     spells.json, items.json, weapons.json, armors.json

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")

def _safe_load(path: str) -> Dict[str, Any]:
    if not os.path.isfile(path):
        return {}
    with open(path, "r") as f:
        return json.load(f)

def load_ruleset(ruleset: str) -> Dict[str, Any]:
    rs = (ruleset or "5e").lower()
    root = os.path.join(DATA_DIR, rs)
    def L(name): return _safe_load(os.path.join(root, name))

    # Normalize keys across rulesets
    data = {
        "ruleset": rs,
        "classes":      L("classes.json").get("classes", []),
        "ancestries":   L("ancestries.json").get("ancestries", []),  # 5e calls these races/species
        "backgrounds":  L("backgrounds.json").get("backgrounds", []),
        "feats":        L("feats.json").get("feats", []),
        "spells":       L("spells.json").get("spells", []),
        "items":        L("items.json").get("items", []),
        "weapons":      L("weapons.json").get("weapons", []),
        "armors":       L("armors.json").get("armors", []),
    }
    return data
