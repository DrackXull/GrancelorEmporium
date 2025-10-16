# backend/routers/spells.py
from __future__ import annotations
import json, os, uuid
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException

router = APIRouter(tags=["creator"])

# --- Storage paths ---
BASE_DIR = os.path.dirname(os.path.dirname(__file__))
USER_DIR = os.path.join(BASE_DIR, "user_data")
SPELLS_PATH = os.path.join(USER_DIR, "spells.json")

def _ensure_user_dir():
    os.makedirs(USER_DIR, exist_ok=True)
    if not os.path.exists(SPELLS_PATH):
        json.dump([], open(SPELLS_PATH, "w"))

def _read_json(path: str) -> List[Dict[str, Any]]:
    with open(path) as f:
        return json.load(f)

def _write_json(path: str, data: List[Dict[str, Any]]):
    with open(path, "w") as f:
        json.dump(data, f, indent=2)

class SpellModel(BaseModel):
    id: Optional[str] = None
    name: str
    description: str
    level: int
    school: str

# --- ID helpers ---
def _new_spell_id() -> str: return "custom_spell_" + uuid.uuid4().hex[:8]

# --- Spell endpoints ---
@router.get("/creator/spells")
def list_spells() -> List[Dict[str, Any]]:
    _ensure_user_dir()
    return _read_json(SPELLS_PATH)

@router.post("/creator/spells")
def create_spell(spell: SpellModel) -> Dict[str, Any]:
    _ensure_user_dir()
    spells = _read_json(SPELLS_PATH)
    spell.id = spell.id or _new_spell_id()
    if any(s.get("id") == spell.id for s in spells):
        raise HTTPException(status_code=400, detail="Spell id already exists")
    spells.append(spell.model_dump())
    _write_json(SPELLS_PATH, spells)
    return spell.model_dump()
