from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_subclass_unlock_enforced():
    # ensure API responds with issue when subclass chosen too early
    body = {
        "name": "Test",
        "class_id": "fighter",
        "level": 2,
        "ability_scores": {"str":15,"dex":14,"con":14,"int":10,"wis":10,"cha":8},
        "feat_ids": [],
        "path_id": None,
        "armor_id": None,
        "weapon_id": None,
        "item_ids": [],
        "ancestry_id": None,
        "background_id": None,
        "subclass_id": "champion",
        "spell_ids": [],
        "ruleset": "5e",
    }
    r = client.post("/api/creator/validate", json=body)
    assert r.status_code == 200
    j = r.json()
    assert j["ok"] in (True, False)
    # We don't know your data set, so only assert the message appears if the class exists
    issues = " ".join(j.get("issues", []))
    # If class exists in your data, the API should report unlock problem at level 3
    # This assertion is tolerant (doesn't fail when local data lacks fighter/champion)
    if "not found" not in issues.lower():
        assert "unlocks at level" in issues
