from __future__ import annotations

from typing import Optional, Dict, List
from sqlmodel import SQLModel, Field
from sqlalchemy import Column
from sqlalchemy.types import JSON as SAJSON


# --------------------------
# Core catalog-ish entities
# --------------------------
class Class(SQLModel, table=True):
    id: str = Field(primary_key=True)
    ruleset: Optional[str] = Field(default=None, index=True)
    name: Optional[str] = Field(default=None, index=True)
    hit_die: Optional[int] = None           # 5e
    hp_per_level: Optional[int] = None      # PF2e
    primary_stat: Optional[str] = None
    subclass_unlock: Optional[int] = None
    casting_stat: Optional[str] = None
    # Keep attribute name "json" to match existing code (r.json)
    json: Optional[Dict] = Field(default=None, sa_column=Column(SAJSON))


class Subclass(SQLModel, table=True):
    id: str = Field(primary_key=True)
    class_id: str = Field(index=True)
    name: Optional[str] = Field(default=None, index=True)
    json: Optional[Dict] = Field(default=None, sa_column=Column(SAJSON))


class Feature(SQLModel, table=True):
    id: str = Field(primary_key=True)
    owner_type: str = Field(index=True)     # "class" | "subclass"
    owner_id: str = Field(index=True)
    level: Optional[int] = Field(default=None, index=True)
    name: Optional[str] = Field(default=None, index=True)
    json: Optional[Dict] = Field(default=None, sa_column=Column(SAJSON))


class Weapon(SQLModel, table=True):
    id: str = Field(primary_key=True)
    name: Optional[str] = Field(default=None, index=True)
    group: Optional[str] = Field(default=None, index=True)
    traits: Optional[List[str]] = Field(default=None, sa_column=Column(SAJSON))
    json: Optional[Dict] = Field(default=None, sa_column=Column(SAJSON))


class Armor(SQLModel, table=True):
    id: str = Field(primary_key=True)
    name: Optional[str] = Field(default=None, index=True)
    category: Optional[str] = Field(default=None, index=True)  # light/medium/heavy (5e), light/medium/heavy/unarmored (pf2e)
    ac_base: Optional[int] = None
    dex_cap: Optional[int] = None
    json: Optional[Dict] = Field(default=None, sa_column=Column(SAJSON))


class Feat(SQLModel, table=True):
    id: str = Field(primary_key=True)
    name: Optional[str] = Field(default=None, index=True)
    level: Optional[int] = Field(default=None, index=True)
    tags: Optional[List[str]] = Field(default=None, sa_column=Column(SAJSON))
    json: Optional[Dict] = Field(default=None, sa_column=Column(SAJSON))


class Spell(SQLModel, table=True):
    id: str = Field(primary_key=True)
    name: Optional[str] = Field(default=None, index=True)
    level: Optional[int] = Field(default=None, index=True)
    school: Optional[str] = Field(default=None, index=True)
    class_tags: Optional[List[str]] = Field(default=None, sa_column=Column(SAJSON))
    json: Optional[Dict] = Field(default=None, sa_column=Column(SAJSON))


class Background(SQLModel, table=True):
    id: str = Field(primary_key=True)
    name: Optional[str] = Field(default=None, index=True)
    json: Optional[Dict] = Field(default=None, sa_column=Column(SAJSON))


class Ancestry(SQLModel, table=True):
    id: str = Field(primary_key=True)
    name: Optional[str] = Field(default=None, index=True)
    hp: Optional[int] = None
    json: Optional[Dict] = Field(default=None, sa_column=Column(SAJSON))


# --------------------------
# PF2e extras / mirrors
# --------------------------
class PF2eTier(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    class_id: str = Field(index=True)
    target_id: str = Field(index=True)          # weapon id or group id
    target_kind: str = Field(index=True)        # "weapon" | "group"
    default_tier: Optional[str] = None          # "U/T/E/M/L" etc.
    by_level_json: Optional[Dict] = Field(default=None, sa_column=Column(SAJSON))
    overrides_json: Optional[Dict] = Field(default=None, sa_column=Column(SAJSON))


class DefaultPayload(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    class_id: str = Field(index=True)
    ruleset: str = Field(index=True)
    payload_json: Optional[Dict] = Field(default=None, sa_column=Column(SAJSON))


# --------------------------
# Runes catalog (optional)
# --------------------------
class Rune(SQLModel, table=True):
    id: str = Field(primary_key=True)
    name: Optional[str] = Field(default=None, index=True)
    slot: Optional[str] = Field(default=None, index=True)      # "armor" | "weapon" | "shield" | "other"
    # tags/traits/extras are JSON so we can grow schema without migrations
    tags: Optional[List[str]] = Field(default=None, sa_column=Column(SAJSON))
    extras_json: Optional[Dict] = Field(default=None, sa_column=Column(SAJSON))


# --------------------------
# Gear / Skills mirrors (read-only for now)
# --------------------------
class PF2eGearPlan(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    class_id: str = Field(index=True)
    level: int = Field(index=True)
    potency: Optional[int] = None                  # e.g., 0/1/2/3/4
    striking_rank: Optional[int] = None            # 0/1/2/3
    resilient_rank: Optional[int] = None           # 0/1/2/3
    properties: Optional[List[Dict]] = Field(default=None, sa_column=Column(SAJSON))  # [{id:"flaming", level:5}, ...]


class PF2eSkillsPlan(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    class_id: str = Field(index=True)
    level: int = Field(index=True)
    # e.g., {"acrobatics":"trained","athletics":"expert",...}
    bumps_json: Optional[Dict] = Field(default=None, sa_column=Column(SAJSON))
