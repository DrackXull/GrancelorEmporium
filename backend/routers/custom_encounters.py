# backend/routers/custom_encounters.py
from __future__ import annotations
import os, json, uuid
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field, conint
from fastapi import APIRouter, HTTPException

router = APIRouter(tags=["custom_encounters"])

BASE_DIR = os.path.dirname(os.path.dirname(__file__))
USER_DIR = os.path.join(BASE_DIR, "user_data")
ENCOUNTERS_PATH = os.path.join(USER_DIR, "encounters.json")
MONS_PATH = os.path.join(USER_DIR, "monsters.json")  # creator saves here

def _ensure():
  os.makedirs(USER_DIR, exist_ok=True)
  if not os.path.exists(ENCOUNTERS_PATH): json.dump([], open(ENCOUNTERS_PATH,"w"))

def _read(path: str, default):
  try:
    with open(path, "r") as f:
      return json.load(f)
  except FileNotFoundError:
    return default

def _write(path: str, data):
  tmp = path + ".tmp"
  with open(tmp, "w") as f: json.dump(data, f, indent=2)
  os.replace(tmp, path)

class NewEncounter(BaseModel):
  name: str = Field(..., description="Display name in dropdown")
  monster_id: str = Field(..., description="Must exist in user monsters")
  count: conint(ge=1) = 3
  room_effects: List[str] = []

@router.get("/custom_encounters")
def list_custom_encounters() -> List[Dict[str, Any]]:
  _ensure()
  return _read(ENCOUNTERS_PATH, [])

@router.post("/custom_encounters")
def create_custom_encounter(payload: NewEncounter) -> Dict[str, Any]:
  _ensure()
  # sanity: monster should exist in user monsters
  mons = _read(MONS_PATH, [])
  if not any(m.get("id") == payload.monster_id for m in mons):
    raise HTTPException(status_code=400, detail="Monster id not found in user creations")

  encs = _read(ENCOUNTERS_PATH, [])
  enc_id = "custom_enc_" + uuid.uuid4().hex[:8]
  enc = {
    "id": enc_id,
    "name": payload.name,
    "room_effects": payload.room_effects,
    "waves": [
      {
        "name": "Wave 1",
        "units": [
          { "monster_id": payload.monster_id, "count": int(payload.count) }
        ]
      }
    ]
  }
  encs.append(enc)
  _write(ENCOUNTERS_PATH, encs)
  return enc

@router.delete("/custom_encounters/{enc_id}")
def delete_custom_encounter(enc_id: str) -> Dict[str, Any]:
  _ensure()
  encs = _read(ENCOUNTERS_PATH, [])
  new = [e for e in encs if e.get("id") != enc_id]
  if len(new) == len(encs):
    raise HTTPException(status_code=404, detail="Encounter not found")
  _write(ENCOUNTERS_PATH, new)
  return {"ok": True}
