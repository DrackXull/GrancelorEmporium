# backend/routers/spells.py
from __future__ import annotations
import os, json, uuid
from typing import Any, Dict, List, Optional, Tuple
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, ConfigDict, field_validator

router = APIRouter(tags=["spells"])

BASE_DIR = os.path.dirname(os.path.dirname(__file__))
USER_DIR = os.path.join(BASE_DIR, "user_data")
SPELLS_PATH = os.path.join(USER_DIR, "spells.json")

def _ensure():
    os.makedirs(USER_DIR, exist_ok=True)
    if not os.path.exists(SPELLS_PATH):
        with open(SPELLS_PATH, "w") as f: json.dump([], f)

def _read() -> List[Dict[str, Any]]:
    try:
        with open(SPELLS_PATH, "r") as f: return json.load(f)
    except FileNotFoundError:
        return []

def _write(data: List[Dict[str, Any]]) -> None:
    tmp = SPELLS_PATH + ".tmp"
    with open(tmp, "w") as f: json.dump(data, f, indent=2)
    os.replace(tmp, SPELLS_PATH)

def _new_id() -> str:
    return "custom_spell_" + uuid.uuid4().hex[:8]

def _norm_damage_profile(value: Any) -> Optional[List[Tuple[int,int,int]]]:
    if value is None: return None
    if isinstance(value, str):
        import re
        m = re.match(r"^\s*(\d+)d(\d+)\s*([+-]\s*\d+)?\s*$", value)
        if not m: raise ValueError(f"Unrecognized dice string: {value}")
        n = int(m.group(1)); d = int(m.group(2)); b = int(m.group(3).replace(" ", "")) if m.group(3) else 0
        return [(n,d,b)]
    out: List[Tuple[int,int,int]] = []
    if isinstance(value, list):
        for part in value:
            if isinstance(part, (list, tuple)) and len(part)==3:
                out.append((int(part[0]), int(part[1]), int(part[2])))
            elif isinstance(part, dict):
                out.append((int(part.get("n",1)), int(part.get("d",6)), int(part.get("b",0))))
            else:
                raise ValueError(f"Bad damage_profile element: {part}")
        return out
    if isinstance(value, dict):
        out.append((int(value.get("n",1)), int(value.get("d",6)), int(value.get("b",0))))
        return out
    raise ValueError("Unsupported damage_profile format")

def _norm_string(v: Any) -> Optional[str]:
    if v is None: return None
    v = str(v).strip()
    return v or None

def _coerce_float_list(v: Any) -> Optional[List[float]]:
    if v is None: return []
    if isinstance(v, list):
        try: return [float(x) for x in v]
        except: return []
    try: return [float(v)]
    except: return []

class SpellModel(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: Optional[str] = None
    name: str
    damage_type: Optional[str] = None
    damage_profile: Optional[List[Tuple[int,int,int]]] = None
    crit_mult: float = 1.5
    mods: Optional[List[float]] = []
    tags: Optional[List[str]] = []

    @field_validator("damage_type", mode="before")
    @classmethod
    def _v_damage_type(cls, v, info):
        data = info.data
        if v is None:
            v = data.get("dmg_type") or data.get("type") or data.get("element") or data.get("damageType")
        return _norm_string(v)

    @field_validator("damage_profile", mode="before")
    @classmethod
    def _v_damage_profile(cls, v, info):
        data = info.data
        if v is None:
            v = data.get("profile") or data.get("dice") or data.get("roll") or data.get("damageProfile")
        if v is None: return None
        return _norm_damage_profile(v)

    @field_validator("crit_mult", mode="before")
    @classmethod
    def _v_crit_mult(cls, v, info):
        data = info.data
        if v in (None, ""):
            v = data.get("crit") or data.get("critx") or 1.5
        try:
            return float(v)
        except:
            return 1.5

    @field_validator("mods", mode="before")
    @classmethod
    def _v_mods(cls, v, info):
        data = info.data
        if v in (None, [], ()):
            v = data.get("multipliers") or data.get("modifiers") or []
        return _coerce_float_list(v)

@router.get("/spells")
def list_spells() -> List[Dict[str, Any]]:
    _ensure()
    return _read()

@router.post("/spells")
def create_spell(m: SpellModel) -> Dict[str, Any]:
    _ensure()
    data = _read()
    m.id = m.id or _new_id()
    if any(x.get("id")==m.id for x in data):
        raise HTTPException(status_code=400, detail="Spell id already exists")
    data.append(m.model_dump())
    _write(data)
    return m.model_dump()

@router.put("/spells/{spell_id}")
def update_spell(spell_id: str, m: SpellModel) -> Dict[str, Any]:
    _ensure()
    data = _read()
    for i, x in enumerate(data):
        if x.get("id")==spell_id:
            updated = m.model_dump(); updated["id"]=spell_id
            data[i]=updated; _write(data); return updated
    raise HTTPException(status_code=404, detail="Spell not found")

@router.delete("/spells/{spell_id}")
def delete_spell(spell_id: str) -> Dict[str, Any]:
    _ensure()
    data = _read()
    new = [x for x in data if x.get("id")!=spell_id]
    if len(new)==len(data): raise HTTPException(status_code=404, detail="Spell not found")
    _write(new); return {"ok": True}

@router.post("/spells/migrate")
def migrate_spells() -> Dict[str, Any]:
    _ensure()
    raw = _read()
    migrated: List[Dict[str, Any]] = []
    for row in raw:
        try:
            norm = SpellModel(**row).model_dump()
        except Exception:
            norm = row
        migrated.append(norm)
    _write(migrated)
    return {"ok": True, "count": len(migrated)}
