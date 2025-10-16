
from fastapi import APIRouter
from backend.schemas import (
    PCSchema,
    MonsterSchema,
    ItemSchema,
    SpellSchema,
    EncounterSchema,
    RoomEffectSchema,
    ConditionSchema,
    Schemas
)

router = APIRouter()

@router.get("/api/schema", response_model=Schemas)
def get_schemas():
    return {
        "pc": PCSchema.schema(),
        "monster": MonsterSchema.schema(),
        "item": ItemSchema.schema(),
        "spell": SpellSchema.schema(),
        "encounter": EncounterSchema.schema(),
        "room_effect": RoomEffectSchema.schema(),
        "condition": ConditionSchema.schema(),
    }
