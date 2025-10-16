# backend/routers/creator.py
from __future__ import annotations
import json, os, uuid
from typing import Dict, Any, List, Optional, Tuple
from pydantic import BaseModel, Field, conint, confloat
from fastapi import APIRouter, HTTPException

router = APIRouter(tags=["creator"])

# --- Storage paths (persist user creations) ---
BASE_DIR = os.path.dirname(os.path.dirname(__file__))
USER_DIR = os.path.join(BASE_DIR, "user_data")
PCS_PATH = os.path.join(USER_DIR, "pcs.json")
MONS_PATH = os.path.join(USER_DIR, "monsters.json")

def _ensure_user_dir():
    os.makedirs(USER_DIR, exist_ok=True)
    if not os.path.exists(PCS_PATH): json.dump([], open(PCS_PATH,"w"))
    if not os.path.exists(MONS_PATH): json.dump([], open(MONS_PATH,"w"))

def _read_json(path: str) -> Any:
    try:
        with open(path, "r") as f: return json.load(f)
    except FileNotFoundError:
        return []
def _write_json(path: str, data: Any):
    tmp = path + ".tmp"
    with open(tmp, "w") as f: json.dump(data, f, indent=2)
    os.replace(tmp, path)

# --- Catalog helpers (read from data/v1/* if present) ---
DATA_V1 = os.path.join(BASE_DIR, "data", "v1")

def _read_catalog(name: str) -> List[Dict[str, Any]]:
    path = os.path.join(DATA_V1, f"{name}.json")
    if os.path.exists(path):
        with open(path, "r") as f:
            return json.load(f)
    return []

def _simple_catalog() -> Dict[str, Any]:
    # tolerant: returns empty lists if files aren’t present
    return {
        "classes": _read_catalog("classes"),
        "weapons": _read_catalog("weapons"),
        "armors":  _read_catalog("armors"),
        "paths":   _read_catalog("paths"),
        "items":   _read_catalog("items"),
        "monsters_baseline": _read_catalog("monsters"),
    }

# --- Pydantic models ---
DamageTuple = Tuple[conint(ge=0), conint(ge=1), int]  # (n,d,b), allow n=0 to support "+flat"

class Abilities(BaseModel):
    sneak_attack: bool = False
    action_surge: bool = False
    spell_burst: Optional[str] = None  # "L1"/"L2"/"L3"

class PCModel(BaseModel):
    id: Optional[str] = None
    name: str
    archetype: str                   # e.g., "fighter", or class_id
    level: conint(ge=1, le=20) = 1
    hp: conint(ge=1) = 10
    ac: conint(ge=1) = 10
    weapon_id: Optional[str] = None
    armor_id: Optional[str] = None
    damage_profile: List[DamageTuple] = Field(default_factory=lambda: [(1,8,3)])
    abilities: Abilities = Abilities()
    resists: Dict[str, confloat(ge=0, le=3)] = Field(default_factory=dict)  # e.g., {"fire":0.5}

class MonsterModel(BaseModel):
    id: Optional[str] = None
    name: str
    hp: conint(ge=1) = 10
    ac: conint(ge=1) = 10
    attack_bonus: int = 0
    attacks_per_round: conint(ge=1) = 1
    weapon_id: Optional[str] = None
    damage_profile: List[DamageTuple] = Field(default_factory=lambda: [(1,6,0)])
    resists: Dict[str, confloat(ge=0, le=3)] = Field(default_factory=dict)

# --- ID helpers ---
def _new_pc_id() -> str: return "custom_pc_" + uuid.uuid4().hex[:8]
def _new_mon_id() -> str: return "custom_mon_" + uuid.uuid4().hex[:8]

# --- Catalog endpoint ---
@router.get("/creator/catalog")
def get_catalog() -> Dict[str, Any]:
    return _simple_catalog()

# --- PC endpoints ---
@router.get("/creator/pcs")
def list_pcs() -> List[Dict[str, Any]]:
    _ensure_user_dir()
    return _read_json(PCS_PATH)

@router.post("/creator/pcs")
def create_pc(pc: PCModel) -> Dict[str, Any]:
    _ensure_user_dir()
    pcs = _read_json(PCS_PATH)
    pc.id = pc.id or _new_pc_id()
    # don’t duplicate id
    if any(p.get("id")==pc.id for p in pcs):
        raise HTTPException(status_code=400, detail="PC id already exists")
    pcs.append(pc.model_dump())
    _write_json(PCS_PATH, pcs)
    return pc.model_dump()

@router.put("/creator/pcs/{pc_id}")
def update_pc(pc_id: str, pc: PCModel) -> Dict[str, Any]:
    _ensure_user_dir()
    pcs = _read_json(PCS_PATH)
    for i, p in enumerate(pcs):
        if p.get("id") == pc_id:
            updated = pc.model_dump()
            updated["id"] = pc_id
            pcs[i] = updated
            _write_json(PCS_PATH, pcs)
            return updated
    raise HTTPException(status_code=404, detail="PC not found")

@router.delete("/creator/pcs/{pc_id}")
def delete_pc(pc_id: str) -> Dict[str, Any]:
    _ensure_user_dir()
    pcs = _read_json(PCS_PATH)
    new = [p for p in pcs if p.get("id") != pc_id]
    if len(new) == len(pcs):
        raise HTTPException(status_code=404, detail="PC not found")
    _write_json(PCS_PATH, new)
    return {"ok": True}

# --- Monster endpoints ---
@router.get("/creator/monsters")
def list_monsters() -> List[Dict[str, Any]]:
    _ensure_user_dir()
    return _read_json(MONS_PATH)

@router.post("/creator/monsters")
def create_monster(m: MonsterModel) -> Dict[str, Any]:
    _ensure_user_dir()
    mons = _read_json(MONS_PATH)
    m.id = m.id or _new_mon_id()
    if any(x.get("id")==m.id for x in mons):
        raise HTTPException(status_code=400, detail="Monster id already exists")
    mons.append(m.model_dump())
    _write_json(MONS_PATH, mons)
    return m.model_dump()

@router.put("/creator/monsters/{mon_id}")
def update_monster(mon_id: str, m: MonsterModel) -> Dict[str, Any]:
    _ensure_user_dir()
    mons = _read_json(MONS_PATH)
    for i, x in enumerate(mons):
        if x.get("id") == mon_id:
            updated = m.model_dump()
            updated["id"] = mon_id
            mons[i] = updated
            _write_json(MONS_PATH, mons)
            return updated
    raise HTTPException(status_code=404, detail="Monster not found")

@router.delete("/creator/monsters/{mon_id}")
def delete_monster(mon_id: str) -> Dict[str, Any]:
    _ensure_user_dir()
    mons = _read_json(MONS_PATH)
    new = [x for x in mons if x.get("id") != mon_id]
    if len(new) == len(mons):
        raise HTTPException(status_code=404, detail="Monster not found")
    _write_json(MONS_PATH, new)
    return {"ok": True}
