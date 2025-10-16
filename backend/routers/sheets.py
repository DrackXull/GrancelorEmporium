# backend/routers/sheets.py
import json
import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Optional

router = APIRouter()

USER_DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "user_data", "sheets.json")

class CharacterSheet(BaseModel):
    hp: int
    ac: int
    stats: Dict[str, int]
    inventory: Dict[str, int]
    currency: Dict[str, int]
    notes: str

def _load_sheets_data() -> Dict[str, Any]:
    if not os.path.exists(USER_DATA_PATH):
        return {}
    with open(USER_DATA_PATH, "r") as f:
        return json.load(f)

def _save_sheets_data(data: Dict[str, Any]):
    with open(USER_DATA_PATH, "w") as f:
        json.dump(data, f, indent=2)

@router.get("/api/sheets/{pc_id}", response_model=CharacterSheet)
def get_sheet(pc_id: str):
    sheets = _load_sheets_data()
    if pc_id not in sheets:
        raise HTTPException(status_code=404, detail="Sheet not found")
    return sheets[pc_id]

@router.post("/api/sheets/{pc_id}")
def update_sheet(pc_id: str, sheet: CharacterSheet):
    sheets = _load_sheets_data()
    sheets[pc_id] = sheet.dict()
    _save_sheets_data(sheets)
    return {"ok": True, "pc_id": pc_id}
