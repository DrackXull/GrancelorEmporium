
import json, os
from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
from backend.schemas import SpellSchema

router = APIRouter()

USER_DATA_DIR = "user_data"
SPELLS_FILE = os.path.join(USER_DATA_DIR, "spells.json")

def get_user_spells() -> List[Dict[str, Any]]:
    if not os.path.exists(SPELLS_FILE):
        return []
    with open(SPELLS_FILE, "r") as f:
        return json.load(f)

def save_user_spells(spells: List[Dict[str, Any]]):
    os.makedirs(USER_DATA_DIR, exist_ok=True)
    with open(SPELLS_FILE, "w") as f:
        json.dump(spells, f, indent=4)

@router.get("/api/spells", response_model=List[SpellSchema])
def list_spells():
    return get_user_spells()

@router.post("/api/spells", response_model=SpellSchema)
def create_spell(spell: SpellSchema):
    spells = get_user_spells()
    if any(s["id"] == spell.id for s in spells):
        raise HTTPException(status_code=400, detail="Spell with this ID already exists")
    spells.append(spell.dict())
    save_user_spells(spells)
    return spell

@router.get("/api/spells/{spell_id}", response_model=SpellSchema)
def get_spell(spell_id: str):
    spells = get_user_spells()
    spell = next((s for s in spells if s["id"] == spell_id), None)
    if not spell:
        raise HTTPException(status_code=404, detail="Spell not found")
    return spell

@router.put("/api/spells/{spell_id}", response_model=SpellSchema)
def update_spell(spell_id: str, spell_data: SpellSchema):
    spells = get_user_spells()
    spell_index = next((i for i, s in enumerate(spells) if s["id"] == spell_id), -1)
    if spell_index == -1:
        raise HTTPException(status_code=404, detail="Spell not found")
    spells[spell_index] = spell_data.dict()
    save_user_spells(spells)
    return spell_data

@router.delete("/api/spells/{spell_id}")
def delete_spell(spell_id: str):
    spells = get_user_spells()
    spells = [s for s in spells if s["id"] != spell_id]
    save_user_spells(spells)
    return {"ok": True}
