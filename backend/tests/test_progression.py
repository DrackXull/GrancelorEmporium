import json
from backend.progression import summarize_progression

def test_5e_subclass_merge():
    classes = [{
        "id": "fighter",
        "name": "Fighter",
        "primary_stat": "str",
        "subclass_unlock": 3,
        "features_by_level": {"5": ["Extra Attack"]},
        "subclasses": [
            {"id": "champion", "features_by_level": {"3": ["Improved Critical"], "7": ["Remarkable Athlete"]}}
        ],
    }]
    out = summarize_progression("5e", classes, class_id="fighter", weapons=[], max_level=8, subclass_id="champion")
    lv3 = next(r for r in out["levels"] if r["level"] == 3)
    lv5 = next(r for r in out["levels"] if r["level"] == 5)
    assert any("Improved Critical" in g for g in lv3.get("gains", []))
    assert any("Extra Attack" in g for g in lv5.get("gains", []))

def test_pf2e_tiers_and_attack():
    classes = [{
        "id": "fighter",
        "name": "Fighter",
        "primary_stat": "str",
        "subclass_unlock": 2,
        "pf2e_weapon_tiers": {
            "default": "trained",
            "by_level": { "5": "expert", "13": "master" },
            "overrides": { "longsword": { "default": "expert", "by_level": { "9": "master" } } }
        }
    }]
    weapons = [{"id":"longsword","name":"Longsword"}]
    out = summarize_progression("pf2e", classes, class_id="fighter", weapons=weapons, max_level=9)
    lv1 = next(r for r in out["levels"] if r["level"] == 1)
    lv5 = next(r for r in out["levels"] if r["level"] == 5)
    lv9 = next(r for r in out["levels"] if r["level"] == 9)
    assert lv1["pf2e_weapon_tiers"]["_default"] == "trained"
    assert lv5["pf2e_weapon_tiers"]["_default"] == "expert"
    assert lv9["pf2e_weapon_tiers"]["longsword"] == "master"
    # attack = level + tier bonus; expert=+4 at L5 -> 5+4=9
    assert lv5["pf2e_attack_bonus"]["_default"] == 9
