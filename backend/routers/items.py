
import json, os
from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
from backend.schemas import ItemSchema

router = APIRouter()

USER_DATA_DIR = "user_data"
ITEMS_FILE = os.path.join(USER_DATA_DIR, "items.json")

def get_user_items() -> List[Dict[str, Any]]:
    if not os.path.exists(ITEMS_FILE):
        return []
    with open(ITEMS_FILE, "r") as f:
        return json.load(f)

def save_user_items(items: List[Dict[str, Any]]):
    os.makedirs(USER_DATA_DIR, exist_ok=True)
    with open(ITEMS_FILE, "w") as f:
        json.dump(items, f, indent=4)

@router.get("/api/items", response_model=List[ItemSchema])
def list_items():
    return get_user_items()

@router.post("/api/items", response_model=ItemSchema)
def create_item(item: ItemSchema):
    items = get_user_items()
    if any(i["id"] == item.id for i in items):
        raise HTTPException(status_code=400, detail="Item with this ID already exists")
    items.append(item.dict())
    save_user_items(items)
    return item

@router.get("/api/items/{item_id}", response_model=ItemSchema)
def get_item(item_id: str):
    items = get_user_items()
    item = next((i for i in items if i["id"] == item_id), None)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item

@router.put("/api/items/{item_id}", response_model=ItemSchema)
def update_item(item_id: str, item_data: ItemSchema):
    items = get_user_items()
    item_index = next((i for i, item in enumerate(items) if item["id"] == item_id), -1)
    if item_index == -1:
        raise HTTPException(status_code=404, detail="Item not found")
    items[item_index] = item_data.dict()
    save_user_items(items)
    return item_data

@router.delete("/api/items/{item_id}")
def delete_item(item_id: str):
    items = get_user_items()
    items = [i for i in items if i["id"] != item_id]
    save_user_items(items)
    return {"ok": True}
