# backend/routers/items.py
from __future__ import annotations
import os, json, uuid
from typing import Any, Dict, List, Optional, Tuple, Union
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, ConfigDict, field_validator

router = APIRouter(tags=["items"])

BASE_DIR = os.path.dirname(os.path.dirname(__file__))
USER_DIR = os.path.join(BASE_DIR, "user_data")
ITEMS_PATH = os.path.join(USER_DIR, "items.json")

def _ensure():
    os.makedirs(USER_DIR, exist_ok=True)
    if not os.path.exists(ITEMS_PATH):
        with open(ITEMS_PATH, "w") as f: json.dump([], f)

def _read() -> List[Dict[str, Any]]:
    try:
        with open(ITEMS_PATH, "r") as f: return json.load(f)
    except FileNotFoundError:
        return []

def _write(data: List[Dict[str, Any]]) -> None:
    tmp = ITEMS_PATH + ".tmp"
    with open(tmp, "w") as f: json.dump(data, f, indent=2)
    os.replace(tmp, ITEMS_PATH)

def _new_id() -> str:
    return "custom_item_" + uuid.uuid4().hex[:8]

# --- Normalization helpers ----------------------------------------------------

def _norm_damage_profile(value: Any) -> Optional[List[Tuple[int,int,int]]]:
    """
    Accepts:
      - [[n,d,b], ...]
      - {"n":1,"d":8,"b":3} or list of dicts
      - "1d8+3" (string) -> convert to one tuple
    """
    if value is None:
        return None
    if isinstance(value, str):
        # very simple "XdY+Z" parser
        import re
        m = re.match(r"^\s*(\d+)d(\d+)\s*([+-]\s*\d+)?\s*$", value)
        if not m: raise ValueError(f"Unrecognized dice string: {value}")
        n = int(m.group(1)); d = int(m.group(2)); b = int(m.group(3).replace(" ", "")) if m.group(3) else 0
        return [(n,d,b)]
    out: List[Tuple[int,int,int]] = []
    if isinstance(value, list):
        for part in value:
            if isinstance(part, (list, tuple)) and len(part) == 3:
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
    # single number
    try: return [float(v)]
    except: return []

# --- Pydantic model (accept multiple input shapes, normalize on validation) ---

class ItemModel(BaseModel):
    model_config = ConfigDict(extra="allow")  # accept unknown keys from zip formats

    # Canonical fields we save
    id: Optional[str] = None
    name: str
    slot: str = Field(..., description="weapon|armor|trinket|consumable|misc")
    damage_type: Optional[str] = None
    damage_profile: Optional[List[Tuple[int,int,int]]] = None
    ac_bonus: Optional[int] = 0
    mods: Optional[List[float]] = []
    tags: Optional[List[str]] = []

    # Accept alias keys from other schemas and normalize in validators
    # e.g. dmg_type, type, profile, dice, multipliers, modifiers
    @field_validator("damage_type", mode="before")
    @classmethod
    def _v_damage_type(cls, v, info):
        data = info.data  # raw payload dict
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

    @field_validator("mods", mode="before")
    @classmethod
    def _v_mods(cls, v, info):
        data = info.data
        if v in (None, [], ()):
            v = data.get("multipliers") or data.get("modifiers") or []
        return _coerce_float_list(v)

# --- Routes -------------------------------------------------------------------

@router.get("/items")
def list_items() -> List[Dict[str, Any]]:
    _ensure()
    return _read()

@router.post("/items")
def create_item(m: ItemModel) -> Dict[str, Any]:
    _ensure()
    data = _read()
    m.id = m.id or _new_id()
    if any(x.get("id")==m.id for x in data):
        raise HTTPException(status_code=400, detail="Item id already exists")
    data.append(m.model_dump())
    _write(data)
    return m.model_dump()

@router.put("/items/{item_id}")
def update_item(item_id: str, m: ItemModel) -> Dict[str, Any]:
    _ensure()
    data = _read()
    for i, x in enumerate(data):
        if x.get("id")==item_id:
            updated = m.model_dump(); updated["id"]=item_id
            data[i]=updated; _write(data); return updated
    raise HTTPException(status_code=404, detail="Item not found")

@router.delete("/items/{item_id}")
def delete_item(item_id: str) -> Dict[str, Any]:
    _ensure()
    data = _read()
    new = [x for x in data if x.get("id")!=item_id]
    if len(new)==len(data): raise HTTPException(status_code=404, detail="Item not found")
    _write(new); return {"ok": True}

# Optional: one-click migration to canonical form
@router.post("/items/migrate")
def migrate_items() -> Dict[str, Any]:
    _ensure()
    raw = _read()
    migrated: List[Dict[str, Any]] = []
    for row in raw:
        # Re-validate through ItemModel to normalize
        try:
            norm = ItemModel(**row).model_dump()
        except Exception as e:
            # keep original row if it cannot be normalized
            norm = row
        migrated.append(norm)
    _write(migrated)
    return {"ok": True, "count": len(migrated)}
