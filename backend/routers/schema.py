# backend/routers/schema.py
from __future__ import annotations
from fastapi import APIRouter

router = APIRouter(tags=["schema"])

def _num(n): return {"type": "number", "minimum": n}
def _int(n): return {"type": "integer", "minimum": n}
def _str(): return {"type":"string"}
def _bool(): return {"type":"boolean"}

DamageTuple = {
    "type": "array",
    "items": [ _int(0), _int(1), {"type":"integer"} ],
    "minItems": 3, "maxItems": 3
}

PC_SCHEMA = {
  "type":"object",
  "properties":{
    "id": _str(), "name": _str(), "archetype": _str(),
    "level": _int(1), "hp": _int(1), "ac": _int(1),
    "weapon_id": _str(), "armor_id": _str(),
    "damage_profile": {"type":"array", "items": DamageTuple},
    "abilities": {
      "type":"object",
      "properties":{
        "sneak_attack": _bool(),
        "action_surge": _bool(),
        "spell_burst": {"type":["string","null"], "enum":[None,"L1","L2","L3"]},
      }, "required":[]
    },
    "resists": {"type":"object", "additionalProperties": _num(0.0)}
  },
  "required":["name","archetype","level","hp","ac","damage_profile"]
}

MONSTER_SCHEMA = {
  "type":"object",
  "properties":{
    "id": _str(), "name": _str(), "hp": _int(1), "ac": _int(1),
    "attack_bonus": {"type":"integer"},
    "attacks_per_round": _int(1),
    "weapon_id": _str(),
    "damage_profile": {"type":"array","items": DamageTuple},
    "resists": {"type":"object","additionalProperties": _num(0.0)}
  },
  "required":["name","hp","ac","attack_bonus","attacks_per_round","damage_profile"]
}

ITEM_SCHEMA = {
  "type":"object",
  "properties":{
    "id": _str(), "name": _str(),
    "slot": {"type":"string","enum":["weapon","armor","trinket","consumable","misc"]},
    "damage_type": _str(),
    "damage_profile": {"type":"array","items": DamageTuple},
    "ac_bonus": {"type":"integer"},
    "mods": {"type":"array","items": _num(0.0)},   # multiplicative mods
    "tags": {"type":"array","items": _str()}
  },
  "required":["name","slot"]
}

SPELL_SCHEMA = {
  "type":"object",
  "properties":{
    "id": _str(), "name": _str(),
    "damage_type": _str(),
    "damage_profile": {"type":"array","items": DamageTuple},
    "crit_mult": _num(1.0),
    "mods": {"type":"array","items": _num(0.0)},
    "tags": {"type":"array","items": _str()}
  },
  "required":["name"]
}

ENCOUNTER_SCHEMA = {
  "type":"object",
  "properties":{
    "id": _str(), "name": _str(),
    "room_effects": {"type":"array","items": _str()},
    "waves": {"type":"array","items":{
        "type":"object",
        "properties":{
          "name": _str(),
          "units": {"type":"array","items":{
            "type":"object",
            "properties":{
              "monster_id": _str(),
              "count": _int(1)
            }, "required":["monster_id","count"]
          }}
        }, "required":["units"]
    }}
  }, "required":["name","waves"]
}

CONDITION_SCHEMA = {
  "type":"object",
  "properties":{
    "id": _str(), "name": _str(),
    "mods": {"type":"object","additionalProperties": _num(0.0)}
  }, "required":["name"]
}

ROOM_EFFECT_SCHEMA = CONDITION_SCHEMA

@router.get("/schema")
def get_all_schemas():
    return {
        "pc": PC_SCHEMA,
        "monster": MONSTER_SCHEMA,
        "item": ITEM_SCHEMA,
        "spell": SPELL_SCHEMA,
        "encounter": ENCOUNTER_SCHEMA,
        "condition": CONDITION_SCHEMA,
        "room_effect": ROOM_EFFECT_SCHEMA
    }
