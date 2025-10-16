# backend/routers/items.py
from __future__ import annotations
import json, os, uuid
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException
from backend.schemas import ItemSchema

router = APIRouter(tags=["creator"])

# --- Storage paths ---
BASE_DIR = os.path.dirname(os.path.dirname(__file__))
USER_DIR = os.path.join(BASE_DIR, "user_data")
ITEMS_PATH = os.path.join(USER_DIR, "items.json")

def _ensure_user_dir():
    os.makedirs(USER_DIR, exist_ok=True)
    if not os.path.exists(ITEMS_PATH):
        json.dump([], open(ITEMS_PATH, "w"))

def _read_json(path: str) -> List[Dict[str, Any]]:
    with open(path) as f:
        return json.load(f)

def _write_json(path: str, data: List[Dict[str, Any]]):
    with open(path, "w") as f:
        json.dump(data, f, indent=2)

class ItemModel(BaseModel):
    id: Optional[str] = None
    name: str
    description: str
    cost: Optional[int] = 0

# --- ID helpers ---
def _new_item_id() -> str: return "custom_item_" + uuid.uuid4().hex[:8]

# --- Item endpoints ---
@router.get("/creator/items")
def list_items() -> List[Dict[str, Any]]:
    _ensure_user_dir()
    return _read_json(ITEMS_PATH)

@router.post("/creator/items")
def create_item(item: ItemModel) -> Dict[str, Any]:
    _ensure_user_dir()
    items = _read_json(ITEMS_PATH)
    item.id = item.id or _new_item_id()
    if any(i.get("id") == item.id for i in items):
        raise HTTPException(status_code=400, detail="Item id already exists")
    items.append(item.model_dump())
    _write_json(ITEMS_PATH, items)
    return item.model_dump()
