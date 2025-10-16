
from pydantic import BaseModel, Field
from typing import List, Dict, Tuple, Optional, Literal

class PCSchema(BaseModel):
    id: str
    archetype: str
    level: int
    ac: int
    hp: int
    attack_bonus: int
    attacks_per_round: int
    damage_profile: List[Tuple[int, int, int]]
    save_bonuses: Dict[str, int]
    resources: Optional[Dict] = None

class MonsterSchema(BaseModel):
    id: str
    name: str
    ac: int
    hp: int
    attack_bonus: int
    attacks_per_round: int
    damage_profile: List[List[int]]
    tags: List[str]
    gs: int

class EncounterWaveUnit(BaseModel):
    monster_id: str
    count: int

class EncounterWave(BaseModel):
    units: List[EncounterWaveUnit]

class EncounterSchema(BaseModel):
    id: str
    name: str
    waves: List[EncounterWave]
    room_effects: List[str]
    economy: Optional[Dict[str, float]] = None

class ItemSchema(BaseModel):
    id: str
    name: str
    slot: str
    gs: int
    damage_type: Optional[str] = None
    mods: Optional[Dict] = None
    temp_buff: Optional[Dict] = None
    notes: Optional[str] = None

class SpellSchema(BaseModel):
    id: str
    name: str
    level: int
    school: str
    casting_time: str
    range: str
    components: List[str]
    duration: str
    description: str
    damage_type: Optional[str] = None
    higher_level: Optional[str] = None

class ModifierSchema(BaseModel):
    target: Literal['enemy', 'party', 'all']
    attribute: str
    value: float
    damage_type: Optional[str] = None

class RoomEffectSchema(BaseModel):
    id: str
    name: str
    description: str
    effect: List[ModifierSchema]

class ConditionSchema(BaseModel):
    id: str
    name: str
    description: str

class Schemas(BaseModel):
    pc: dict = Field(..., alias="pc")
    monster: dict = Field(..., alias="monster")
    item: dict = Field(..., alias="item")
    spell: dict = Field(..., alias="spell")
    encounter: dict = Field(..., alias="encounter")
    room_effect: dict = Field(..., alias="room_effect")
    condition: dict = Field(..., alias="condition")
