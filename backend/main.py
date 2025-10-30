# backend/main.py
from fastapi import FastAPI, HTTPException, Query, Body, Response, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Any, Dict, Optional
import json, os
from pathlib import Path
from typing import List
from sqlmodel import select, SQLModel, Session
from fastapi.staticfiles import StaticFiles
from .pf2e import summarize_progression_pf2e_with_full_ac
# NEW: scoring + sim
from .power.pf2e import score_spell, nearest_spell_comparables, score_monster
from .engine.quick_sim import run_sim
from .data_layers import load_collections, build_layers

import warnings
warnings.filterwarnings("ignore", message=r'Field name "json" in ".*" shadows an attribute in parent "SQLModel"')

from .compat_imports import get_session, init_db, M
    

# build/summarize progression (shared helpers)
try:
    from backend.progression import (
        build_progression,
        summarize_progression,
        _extract_pf2e_weapon_tiers_for_level,
    )
except Exception:  # pragma: no cover
    from progression import (  # type: ignore
        build_progression,
        summarize_progression,
        _extract_pf2e_weapon_tiers_for_level,
    )

# --------------------------------------------------------------------------------------
# Paths / constants
# --------------------------------------------------------------------------------------
BACKEND_ROOT = os.path.abspath(os.path.dirname(__file__))
DATA_ROOT    = os.path.join(BACKEND_ROOT, "data", "v1")
RUNTIME_ROOT = os.path.join(BACKEND_ROOT, "data", "runtime")
OVERRIDES_PATH = os.path.join(RUNTIME_ROOT, "classes_overrides.json")
STATIC_ROOT = os.path.join(BACKEND_ROOT, "static")
SEARCHES_FILE = os.path.join(BACKEND_ROOT, "data", "runtime", "searches.json")

# NEW: Runtime dir must be defined before SEARCHES_PATH
from pathlib import Path as _Path # local alias to avoid confusion
RUNTIME_DIR = _Path(os.environ.get("TPKA_RUNTIME_DIR", os.path.join(BACKEND_ROOT, "data", "runtime"))).resolve()
RUNTIME_DIR.mkdir(parents=True, exist_ok=True)


SEARCHES_PATH = RUNTIME_DIR / "searches.json"
if not SEARCHES_PATH.exists():
    SEARCHES_PATH.write_text(json.dumps({"saved": []}, indent=2))

DB_WRITE = os.environ.get("TPKA_DB_WRITE", "0") == "1"

# --- Database (single source of truth) ---
from .db import engine as ENGINE  # uses TPKA_DATABASE_URL


# --------------------------------------------------------------------------------------
# App
# --------------------------------------------------------------------------------------
app = FastAPI(title="TPKA Character System API", version="0.6.1")

# Ensure tables exist at boot (fixes 'no such table: class')
@app.on_event("startup")
def _startup_make_schema():
    try:
        init_db()  # imports models and create_all(engine)
    except Exception as e:
        print(f"[startup] init_db failed: {e}")



app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --------------------------------------------------------------------------------------
# JSON loading (tolerant)
# --------------------------------------------------------------------------------------
def load_json_abs(path: str) -> Dict[str, Any]:
    try:
        with open(path, "r") as f:
            return json.load(f)
    except FileNotFoundError:
        return {}
    except Exception as e:
        return {"__error__": f"Failed to load {path}: {e}"}

def load_json(name: str) -> Dict[str, Any]:
    return load_json_abs(os.path.join(DATA_ROOT, name))

def ensure_list(d: Dict[str, Any], key: str) -> List[Dict[str, Any]]:
    v = d.get(key, [])
    return v if isinstance(v, list) else []

def _save_json_abs(path: str, obj: Any) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(obj, f, indent=2)

# --------------------------------------------------------------------------------------
# In-memory data caches
# --------------------------------------------------------------------------------------
CLASSES: List[Dict[str, Any]] = []
WEAPONS: List[Dict[str, Any]] = []
ARMORS:  List[Dict[str, Any]] = []
FEATS:   List[Dict[str, Any]] = []
SPELLS:  List[Dict[str, Any]] = []
ITEMS:   List[Dict[str, Any]] = []
PC_BASELINES: Dict[str, Any] = {}
OVERRIDES: Dict[str, Any] = {}  # runtime overlay merged into classes

def _merge_class_overrides(base_classes: List[Dict[str, Any]], overrides: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Merge runtime overrides into base classes."""
    by_id = {}
    for c in base_classes:
        cid = c.get("id") or c.get("archetype")
        if not cid:
            continue
        by_id[cid] = json.loads(json.dumps(c))  # deep copy

    for cid, ov in (overrides.get("classes") or {}).items():
        if cid not in by_id:
            by_id[cid] = ov
            continue
        tgt = by_id[cid]
        if "features_by_level" in ov:
            tgt.setdefault("features_by_level", {})
            for lvl, feats in (ov["features_by_level"] or {}).items():
                tgt["features_by_level"].setdefault(lvl, [])
                if isinstance(feats, list):
                    tgt["features_by_level"][lvl].extend([str(x) for x in feats])
        if "pf2e_weapon_tiers" in ov:
            src = ov["pf2e_weapon_tiers"] or {}
            dst = tgt.setdefault("pf2e_weapon_tiers", {})
            for k in ("default", "by_level"):
                if k in src:
                    dst[k] = src[k]
            if "overrides" in src:
                dst.setdefault("overrides", {})
                for wid, spec in (src["overrides"] or {}).items():
                    dst["overrides"][wid] = spec
        if "defaults" in ov:
            tgt.setdefault("defaults", {})
            for rs, payload in (ov["defaults"] or {}).items():
                tgt["defaults"][rs] = payload
    return list(by_id.values())

# line above: PC_BASELINES = load_json("pc_baselines.json") or {}
def refresh_data() -> None:
    """
    Populate the in-memory catalogs (CLASSES/WEAPONS/ARMORS/FEATS/SPELLS/ITEMS)
    from the same layered sources the API uses, so the Creator/Progression
    endpoints see exactly what the DataBrowser sees.
    """
    global CLASSES, WEAPONS, ARMORS, FEATS, SPELLS, ITEMS, PC_BASELINES, OVERRIDES

    # Resolve ruleset/campaign the same way other endpoints do
    rs = (os.environ.get("TPKA_RULESET") or "5e").lower()
    campaign = os.environ.get("TPKA_CAMPAIGN") or None

    # Load layered collections
    names = ["classes.json", "spells.json", "items.json", "feats.json", "backgrounds.json", "ancestries.json"]
    packs = load_collections(BACKEND_ROOT, rs, campaign, names)

    # Base class list from layered pack
    base_classes = packs.get("classes.json", [])

    # Load runtime overrides (single file path is unchanged)
    OVERRIDES = load_json_abs(OVERRIDES_PATH) or {}
    if OVERRIDES.get("__error__"): OVERRIDES = {}

    # Merge overrides into classes
    CLASSES = _merge_class_overrides(base_classes, OVERRIDES)

    # Split items into weapons/armors if your pack keeps them together;
    # else, if you have separate weapons/armors packs, swap these to packs["weapons.json"] etc.
    items_pack = packs.get("items.json", [])
    WEAPONS = [it for it in items_pack if str(it.get("type","")).lower() in ("weapon","weapons")]
    ARMORS  = [it for it in items_pack if str(it.get("type","")).lower() in ("armor","armors")]

    FEATS   = packs.get("feats.json", [])
    SPELLS  = packs.get("spells.json", [])
    # If ancestries/backgrounds are stored in items, you can keep them in ITEMS;
    # otherwise you can build dedicated lists similarly to WEAPONS/ARMORS.
    ITEMS   = items_pack

    # Keep pc_baselines from the legacy v1 location if you still use it
    PC_BASELINES = load_json("pc_baselines.json") or {}


refresh_data()

# --------------------------------------------------------------------------------------
# Models
# --------------------------------------------------------------------------------------
class ProgressionQuery(BaseModel):
    ruleset: Optional[str] = None
    class_id: str
    max_level: Optional[int] = 20
    subclass_id: Optional[str] = None

class CreatorValidateBody(BaseModel):
    name: Optional[str] = None
    class_id: str
    level: int
    ability_scores: Dict[str, int] = {}
    feat_ids: List[str] = []
    path_id: Optional[str] = None
    armor_id: Optional[str] = None
    weapon_id: Optional[str] = None
    item_ids: List[str] = []
    ancestry_id: Optional[str] = None
    background_id: Optional[str] = None
    subclass_id: Optional[str] = None
    spell_ids: List[str] = []
    ruleset: Optional[str] = None
    loadout: Optional[str] = None

class PF2eArmorState(BaseModel):
    base_ac: Optional[int] = None
    dex_cap: Optional[int] = None
    potency: Optional[int] = None
    proficiency_rank: Optional[str] = None

class PF2eProgressionRequest(BaseModel):
    level: int
    base_dex_mod: int
    proficiency_progression: Dict[int, str] = {}
    armor_by_level: Dict[int, PF2eArmorState] = {}

class BuildExportRequest(BaseModel):
    build_id: Optional[str] = None
    build: Optional[Dict[str, Any]] = None

class SaveSearchRequest(BaseModel):
    name: str
    query: Dict[str, Any]


class CreatorCreateBody(CreatorValidateBody):
    pass

# --------------------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------------------
def _get_class_by_id(cid: str) -> Optional[Dict[str, Any]]:
    return next((c for c in CLASSES if c.get("id")==cid or c.get("archetype")==cid), None)

def _subclass_unlock_for(cls: Dict[str, Any], ruleset: str) -> int:
    if "subclass_unlock" in cls:
        try:
            return int(cls["subclass_unlock"])
        except Exception:
            pass
    return 3 if (ruleset or DEFAULT_RULESET).lower()=="5e" else 2

def _exists_in(catalog: List[Dict[str, Any]], _id: Optional[str]) -> bool:
    if not _id:
        return True
    return any(it for it in catalog if it.get("id")==_id)

def _mod_from(score: Optional[int]) -> int:
    try:
        return (int(score) - 10) // 2
    except Exception:
        return 0

def _lookup_item(_id: Optional[str]) -> Optional[Dict[str, Any]]:
    if not _id:
        return None
    for it in ITEMS:
        if it.get("id") == _id:
            return it
    for it in ARMORS:
        if it.get("id") == _id:
            return it
    for it in WEAPONS:
        if it.get("id") == _id:
            return it
    return None

def _class_defaults_for(cls: Dict[str, Any], ruleset: str, loadout: Optional[str]=None) -> Dict[str, Any]:
    d = (cls.get("defaults") or {}).get(ruleset.lower()) or {}
    loadouts = d.get("loadouts") or []
    if loadout:
        chosen = next((lo for lo in loadouts if (lo.get("id")==loadout or lo.get("name")==loadout)), None)
        if chosen:
            merged = dict(d)
            merged.update(chosen)
            d = merged
    out = dict(d)
    out.setdefault("level", 1)
    out.setdefault("ability_scores", {})
    out.setdefault("feat_ids", [])
    out.setdefault("spell_ids", [])
    return out

def _pf2e_training_at_level(cls: Dict[str, Any], level: int) -> Dict[str, str]:
    return _extract_pf2e_weapon_tiers_for_level(cls, int(level))

def _apply_background_ancestry_effects(ability_scores: Dict[str, int],
                                       ancestry_id: Optional[str],
                                       background_id: Optional[str]) -> Dict[str, Any]:
    out = {"ability_scores": dict(ability_scores or {}), "skills": [], "languages": [], "grant_feat_ids": [], "grant_spell_ids": [], "pf2e_ancestry_hp": 0}
    def apply_item(it: Optional[Dict[str, Any]]):
        if not it: return
        boosts = it.get("ability_boosts") or {}
        for k, v in boosts.items():
            try: out["ability_scores"][k] = int(out["ability_scores"].get(k, 10)) + int(v)
            except Exception: pass
        for s in (it.get("skills") or []):
            if s not in out["skills"]:
                out["skills"].append(s)
        for l in (it.get("languages") or []):
            if l not in out["languages"]:
                out["languages"].append(l)
        for fid in (it.get("grant_feat_ids") or []):
            if fid not in out["grant_feat_ids"]:
                out["grant_feat_ids"].append(fid)
        for sid in (it.get("grant_spell_ids") or []):
            if sid not in out["grant_spell_ids"]:
                out["grant_spell_ids"].append(sid)
        if "hp" in it:
            try: out["pf2e_ancestry_hp"] += int(it["hp"])
            except Exception: pass
    apply_item(_lookup_item(ancestry_id))
    apply_item(_lookup_item(background_id))
    return out

def _calc_ac_5e(armor: Optional[Dict[str, Any]], dex_score: int) -> int:
    dex_mod = _mod_from(dex_score)
    if not armor: return 10 + dex_mod
    base = int(armor.get("ac_base") or 10)
    cat = (armor.get("category") or "").lower()
    dex_cap = armor.get("dex_cap")
    if dex_cap is None:
        if cat == "light":   return max(base, 11) + dex_mod
        if cat == "medium":  return max(base, 12) + min(dex_mod, 2)
        if cat == "heavy":   return max(base, 14)
        return base + dex_mod
    return base + min(dex_mod, int(dex_cap))

def _calc_ac_pf2e(armor: Optional[Dict[str, Any]], dex_score: int) -> int:
    dex_mod = _mod_from(dex_score)
    if not armor: return 10 + dex_mod
    base = int(armor.get("ac_base") or 10)
    item_bonus = max(0, base - 10)
    dex_cap = armor.get("dex_cap")
    return 10 + item_bonus + (min(dex_mod, int(dex_cap)) if dex_cap is not None else dex_mod)

def _calc_hp_5e(cls: Dict[str, Any], level: int, con_score: int) -> int:
    die = int(cls.get("hit_die", 8))
    con_mod = _mod_from(con_score)
    if level <= 0: return 1
    avg = (die // 2) + 1
    return die + con_mod + max(0, level - 1) * (avg + con_mod)

def _calc_hp_pf2e(cls: Dict[str, Any], level: int, con_score: int, ancestry_hp: int) -> int:
    per = int(cls.get("hp_per_level", 8))
    con_mod = _mod_from(con_score)
    if level <= 0: return 1
    return ancestry_hp + level * (per + con_mod)

def _skill_list_5e() -> List[str]:
    return ["acrobatics","animal_handling","arcana","athletics","deception","history","insight","intimidation","investigation","medicine","nature","perception","performance","persuasion","religion","sleight_of_hand","stealth","survival"]

def _skill_stat_5e(skill: str) -> str:
    m = {
        "acrobatics":"dex","sleight_of_hand":"dex","stealth":"dex",
        "athletics":"str",
        "arcana":"int","history":"int","investigation":"int","nature":"int","religion":"int",
        "animal_handling":"wis","insight":"wis","medicine":"wis","perception":"wis","survival":"wis",
        "deception":"cha","intimidation":"cha","performance":"cha","persuasion":"cha",
    }
    return m.get(skill, "int")

def _compute_5e_skill_bonuses(ability_scores: Dict[str,int], proficient_skills: List[str], pb: int) -> Dict[str, int]:
    out = {}
    for sk in _skill_list_5e():
        stat = _skill_stat_5e(sk)
        mod = _mod_from(ability_scores.get(stat, 10))
        bonus = mod + (pb if sk in (proficient_skills or []) else 0)
        out[sk] = bonus
    return out

def _ability_array_for_primary(primary: str) -> Dict[str, int]:
    p = (primary or "str").lower()
    base = {"str": 14, "dex": 14, "con": 14, "int": 10, "wis": 10, "cha": 8}
    for k in list(base.keys()):
        if k == p:
            base[k] = 16
    return base

def _pick_basic_weapon(ruleset: str, cls: Dict[str, Any]) -> Optional[str]:
    preferred = ["longsword", "longbow", "spear", "shortsword", "dagger", "staff"]
    ids = [w.get("id") for w in WEAPONS if w.get("id")]
    for pid in preferred:
        if pid in ids:
            return pid
    return ids[0] if ids else None

def _pick_basic_armor(ruleset: str, cls: Dict[str, Any]) -> Optional[str]:
    name = (cls.get("name") or "").lower()
    id_by_cat = {"light": None, "medium": None, "heavy": None}
    for a in ARMORS:
        cat = (a.get("category") or "").lower()
        if cat in id_by_cat and id_by_cat[cat] is None:
            id_by_cat[cat] = a.get("id")
    if any(k in name for k in ["fighter","paladin","champion"]):
        return id_by_cat["heavy"] or id_by_cat["medium"] or id_by_cat["light"]
    if any(k in name for k in ["ranger","barbarian","monk"]):
        return id_by_cat["medium"] or id_by_cat["light"] or id_by_cat["heavy"]
    return id_by_cat["light"] or id_by_cat["medium"] or id_by_cat["heavy"]

def _guess_default_for_class(rs: str, cls: Dict[str, Any]) -> Dict[str, Any]:
    primary = (cls.get("primary_stat") or "str").lower()
    scores = _ability_array_for_primary(primary)
    return {
        "level": 1,
        "ability_scores": scores,
        "weapon_id": _pick_basic_weapon(rs, cls),
        "armor_id": _pick_basic_armor(rs, cls),
        "ancestry_id": None if rs=="5e" else "human",
        "background_id": "soldier" if "fighter" in (cls.get("name","").lower()) else None,
        "feat_ids": [],
        "spell_ids": [],
        "loadouts": []
    }
def _load_saved_searches():
    if not os.path.exists(SEARCHES_FILE):
        return []
    try:
        with open(SEARCHES_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data, list) else []
    except Exception:
        return []

def _save_saved_searches(items):
    os.makedirs(os.path.dirname(SEARCHES_FILE), exist_ok=True)
    with open(SEARCHES_FILE, "w", encoding="utf-8") as f:
        json.dump(items, f, indent=2)
# --------------------------------------------------------------------------------------
# Startup (DB init)
# --------------------------------------------------------------------------------------
@app.on_event("startup")
def _startup_db():
    try:
        init_db()
    except Exception as e:
        print("[startup] DB init failed (serving JSON-backed endpoints):", e)

# --------------------------------------------------------------------------------------
# Catalog & Search (Phase 4)
# --------------------------------------------------------------------------------------
# ---------- Simple rune suggestions ----------
@app.get("/api/runes/suggest")
def runes_suggest(q: Optional[str] = Query(None), limit: int = 10, session = Depends(get_session)):
    rows = session.exec(select(M.Rune)).all()
    ql = (q or "").lower()
    hits = []
    for r in rows:
        name = r.name or r.id
        if not q or ql in name.lower():
            hits.append({"id": r.id, "name": name, "slot": r.slot, "tags": r.tags})
        if len(hits) >= limit: break
    return {"items": hits}


@app.get("/api/classes")
def list_classes(
    request: Request,
    ruleset: Optional[str] = None,
    q: Optional[str] = None,
    session: Session = Depends(get_session),  # <-- use FastAPI dependency
):
    stmt = select(Class)
    if ruleset:
        # normalize to lowercase on both sides to avoid '5E' vs '5e' mismatches
        from sqlalchemy import func
        stmt = stmt.where(func.lower(Class.ruleset) == func.lower(ruleset))
    if q:
        from sqlalchemy import func
        stmt = stmt.where(func.lower(Class.name).like(f"%{q.lower()}%"))

    rows = session.exec(stmt).all()
    return [c.to_public_dict() for c in rows]

@app.get("/api/classes/{class_id}")
def get_class(class_id: str, session = Depends(get_session)):
    c = session.get(M.Class, class_id)
    if not c:
        raise HTTPException(status_code=404, detail="class not found")
    subs = session.exec(select(M.Subclass).where(M.Subclass.class_id == class_id)).all()
    feats = session.exec(select(M.Feature).where(M.Feature.owner_type=="class", M.Feature.owner_id==class_id).order_by(M.Feature.level)).all()
    by_level = {}
    for f in feats:
        by_level.setdefault(f.level, []).append({"id": f.id, "name": f.name, "data": f.json})
    return {
        "id": c.id,
        "name": c.name,
        "ruleset": c.ruleset,
        "data": c.json,
        "subclasses": [{"id": s.id, "name": s.name, "data": s.json} for s in subs],
        "features_by_level": by_level,
    }

@app.get("/api/search")
def search(q: str, types: Optional[str] = None, session = Depends(get_session)):
    kinds = set((types or "").split(",")) if types else {"weapon","armor","feat","spell","class"}
    ql = q.lower()
    out = {}
    def _match(model, label, field="name"):
        rows = session.exec(select(model)).all()
        hit = []
        for r in rows:
            name = getattr(r, field, "") or ""
            if ql in name.lower():
                hit.append({"id": r.id, "name": name})
        if hit:
            out[label] = hit
    if "class" in kinds: _match(M.Class, "classes")
    if "weapon" in kinds: _match(M.Weapon, "weapons")
    if "armor" in kinds: _match(M.Armor, "armors")
    if "feat" in kinds: _match(M.Feat, "feats")
    if "spell" in kinds: _match(M.Spell, "spells")
    return out

@app.get("/api/catalog")
def catalog(kind: str = Query(..., pattern="^(weapons|armors|feats|spells|ancestries|backgrounds|classes|runes)$"),
            page: int = 1, page_size: int = 50, session = Depends(get_session)):
    Model = {
        "weapons": M.Weapon, "armors": M.Armor, "feats": M.Feat, "spells": M.Spell,
        "ancestries": M.Ancestry, "backgrounds": M.Background, "classes": M.Class,
        "runes": M.Rune
    }[kind]

    ruleset = (os.environ.get("TPKA_RULESET") or "5e").lower()
    campaign = os.environ.get("TPKA_CAMPAIGN") or None

    # Try DB first
    try:
        q = select(Model).where(Model.ruleset == ruleset)
        total = len(session.exec(q).all())
        rows = session.exec(q.offset((page-1)*page_size).limit(page_size)).all()

        def slim(r):
            base = {"id": r.id, "name": getattr(r, "name", None)}
            return base
        return {"page": page, "page_size": page_size, "total": total, "items": [slim(r) for r in rows]}
    except Exception:
        pass

    # Fallback: layered JSON
    names_map = {
        "classes": "classes.json",
        "spells": "spells.json",
        "weapons": "items.json",
        "armors": "items.json",
        "feats": "feats.json",
        "ancestries": "ancestries.json",
        "backgrounds": "backgrounds.json",
        "runes": "runes.json",
    }
    name = names_map.get(kind, f"{kind}.json")
    packs = load_collections(BACKEND_ROOT, ruleset, campaign, [name])
    recs = packs.get(name, [])
    start = (page-1)*page_size
    end = start + page_size
    items = [{"id": it.get("id"), "name": it.get("name")} for it in recs[start:end]]
    return {"page": page, "page_size": page_size, "total": len(recs), "items": items}

from typing import Optional, List, Dict, Any
from fastapi import Body

def _pick_name(rec: Dict[str, Any]) -> str:
    return (rec.get("name") or rec.get("id") or "").strip()

def _filter_records(recs: List[Dict[str, Any]], q: str) -> List[Dict[str, Any]]:
    if not q:
        return recs
    ql = q.lower()
    out = []
    for r in recs:
        text = f"{r.get('name','')} {r.get('id','')}".lower()
        if ql in text:
            out.append(r)
    return out
# -------- Search 2 ------- #
@app.get("/api/search2")
def search2(
    q: str = "",
    types: str = "class,weapon,armor,feat,spell,monster",
    page: int = 1,
    page_size: int = 50,
    ruleset: Optional[str] = None,
):
    # Resolve scope
    rs = (ruleset or os.environ.get("TPKA_RULESET") or CURRENT_RULESET).lower()
    campaign = os.environ.get("TPKA_CAMPAIGN") or None

    # Load layered JSON
    names = ["classes.json", "spells.json", "items.json", "monsters.json"]
    packs = load_collections(BACKEND_ROOT, rs, campaign, names)
    classes  = packs.get("classes.json", [])
    spells   = packs.get("spells.json", [])
    items    = packs.get("items.json", [])
    monsters = packs.get("monsters.json", [])

    weapons = [it for it in items if str(it.get("type","")).lower() in ("weapon","weapons")]
    armors  = [it for it in items if str(it.get("type","")).lower() in ("armor","armors")]

    groups: Dict[str, List[Dict[str, Any]]] = {
        "class": classes,
        "spell": spells,
        "weapon": weapons,
        "armor": armors,
        "feat": [],        # wire when feats.json is present in layers
        "monster": monsters,
    }

    base_counts = {k: len(v) for k, v in groups.items()}

    # q-filter
    def _filter_records(recs: List[Dict[str, Any]], qtext: str) -> List[Dict[str, Any]]:
        if not qtext: return recs
        ql = qtext.lower()
        out = []
        for r in recs:
            text = f"{r.get('name','')} {r.get('id','')}".lower()
            if ql in text:
                out.append(r)
        return out

    filtered = {k: _filter_records(v, q) for k, v in groups.items()}
    q_counts = {k: len(v) for k, v in filtered.items()}

    # type selection
    sel = {t.strip().lower() for t in types.split(",") if t.strip()}
    # merged list (kept for future infinite list views)
    merged: List[Dict[str, Any]] = []
    for kind, recs in filtered.items():
        if kind in sel:
            for r in recs:
                rid = r.get("id") or r.get("name")
                if rid:
                    merged.append({"id": rid, "name": (r.get("name") or rid), "kind": kind})

    total = len(merged)
    start = (page - 1) * page_size
    end   = start + page_size
    merged_page = merged[start:end]

    # grouped results that the Browser expects (plural keys)
    def _slim(arr):
        return [{"id": (x.get("id") or x.get("name")), "name": (x.get("name") or x.get("id"))} for x in arr]

    grouped_results = {
        "classes": {"items": _slim(filtered["class"])},
        "weapons": {"items": _slim(filtered["weapon"])},
        "armors":  {"items": _slim(filtered["armor"])},
        "feats":   {"items": _slim(filtered["feat"])},
        "spells":  {"items": _slim(filtered["spell"])},
        "monsters":{"items": _slim(filtered["monster"])},
    }

    counts = {
        "classes": base_counts["class"],
        "weapons": base_counts["weapon"],
        "armors":  base_counts["armor"],
        "feats":   base_counts["feat"],
        "spells":  base_counts["spell"],
        "monsters":base_counts["monster"],
    }

    return {
        "ok": True,
        "ruleset": rs,
        "campaign": campaign,
        "query": {"q": q, "types": list(sel), "page": page, "page_size": page_size},
        "facets": { "base_counts": base_counts, "q_counts": q_counts },
        "counts": counts,
        "results": grouped_results,
        "total": total,
        "items": merged_page   # still exposed for list UIs
    }


@app.get("/api/ping")
def api_ping():
    return {"ok": True, "service": "tpka-api", "version": app.version}

@app.get("/api/health")
def api_health():
    return {
        "ok": True,
        "ruleset": CURRENT_RULESET,
        "data_root": DATA_ROOT,
        "counts": {
            "classes": len(CLASSES),
            "weapons": len(WEAPONS),
            "armors": len(ARMORS),
            "feats": len(FEATS),
            "spells": len(SPELLS),
            "items": len(ITEMS),
        },
    }

@app.get("/api/data")
def api_data(ruleset: Optional[str] = Query(None)):
    rs = (ruleset or CURRENT_RULESET).lower()
    campaign = os.environ.get("TPKA_CAMPAIGN") or None

    # Layered load using the resolved ruleset
    layers = build_layers(BACKEND_ROOT, rs, campaign)
    names = ["classes.json", "spells.json", "items.json", "monsters.json"]
    packs = load_collections(BACKEND_ROOT, rs, campaign, names)

    monsters = packs.get("monsters.json", [])
    classes  = packs.get("classes.json", [])
    spells   = packs.get("spells.json", [])
    items    = packs.get("items.json", [])

    return {
        "ok": True,
        "ruleset": rs,
        "campaign": campaign,
        "layers": layers,
        "counts": {
            "classes": len(classes),
            "spells": len(spells),
            "items": len(items),
            "monsters": len(monsters),
        }
    }



@app.get("/api/creator/catalog")
def creator_catalog(ruleset: Optional[str] = Query(None)):
    rs = (ruleset or CURRENT_RULESET).lower()
    ancestries: List[Dict[str, Any]] = []
    backgrounds: List[Dict[str, Any]] = []
    for it in ITEMS:
        t = (it.get("type") or "").lower()
        if t in ("ancestry","race","species"): ancestries.append(it)
        elif t in ("background",): backgrounds.append(it)
    return {
        "ruleset": rs,
        "classes": CLASSES,
        "weapons": WEAPONS,
        "armors": ARMORS,
        "feats": FEATS,
        "spells": SPELLS,
        "ancestries": ancestries,
        "backgrounds": backgrounds,
    }

import json

def _searches_path(rs: str, campaign: Optional[str]) -> str:
    # Scopes saved searches by ruleset + campaign
    root = os.path.join(BACKEND_ROOT, "data", "runtime")
    os.makedirs(root, exist_ok=True)
    fname = f"searches_{rs}"
    if campaign:
        fname += f"_{campaign}"
    fname += ".json"
    return os.path.join(root, fname)

def _read_searches(path: str) -> Dict[str, Any]:
    if not os.path.exists(path):
        return {"searches": []}
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {"searches": []}

def _write_searches(path: str, data: Dict[str, Any]):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

@app.get("/api/searches")
def list_searches(ruleset: Optional[str] = None):
    items = _load_saved_searches()
    if ruleset:
        items = [x for x in items if (x.get("ruleset") or "").lower() == ruleset.lower()]
    return {"ok": True, "items": items}

class SavedSearchIn(BaseModel):
    name: str
    q: str = ""
    types: str = ""
    ruleset: Optional[str] = None

@app.post("/api/searches")
def create_search(payload: SavedSearchIn):
    items = _load_saved_searches()
    items = [x for x in items if x.get("name") != payload.name]  # upsert by name
    items.append(payload.model_dump())
    _save_saved_searches(items)
    return {"ok": True}

@app.delete("/api/searches")
def delete_search(name: str, ruleset: Optional[str] = None):
    items = _load_saved_searches()
    before = len(items)
    if ruleset:
        items = [x for x in items if not (x.get("name") == name and (x.get("ruleset") or "").lower() == ruleset.lower())]
    else:
        items = [x for x in items if x.get("name") != name]
    _save_saved_searches(items)
    return {"ok": True, "removed": before - len(items)}

@app.post("/api/searches/save")
def save_search(
    name: str = Query(..., min_length=1),
    q: str = Query(""),
    types: str = Query("class,weapon,armor,feat,spell,monster"),
    ruleset: Optional[str] = None
):
    rs = (ruleset or os.environ.get("TPKA_RULESET") or CURRENT_RULESET).lower()
    campaign = os.environ.get("TPKA_CAMPAIGN") or None
    path = _searches_path(rs, campaign)
    data = _read_searches(path)

    # Upsert by name
    entry = {"name": name, "q": q, "types": types}
    existing = next((s for s in data["searches"] if s.get("name") == name), None)
    if existing:
        existing.update(entry)
    else:
        data["searches"].append(entry)

    _write_searches(path, data)
    return {"ok": True, "saved": entry, "ruleset": rs, "campaign": campaign}

@app.post("/api/searches/delete")
def delete_search(name: str = Query(..., min_length=1), ruleset: Optional[str] = None):
    rs = (ruleset or os.environ.get("TPKA_RULESET") or CURRENT_RULESET).lower()
    campaign = os.environ.get("TPKA_CAMPAIGN") or None
    path = _searches_path(rs, campaign)
    data = _read_searches(path)
    before = len(data["searches"])
    data["searches"] = [s for s in data["searches"] if s.get("name") != name]
    _write_searches(path, data)
    return {"ok": True, "removed": before - len(data["searches"]), "ruleset": rs, "campaign": campaign}

# --------------------------------------------------------------------------------------
# Creator: validate / default / create
# --------------------------------------------------------------------------------------
@app.post("/api/creator/validate")
def creator_validate(body: "CreatorValidateBody"):
    rs = (body.ruleset or CURRENT_RULESET).lower()
    issues: List[str] = []

    cls = _get_class_by_id(body.class_id)
    if not cls:
        issues.append(f"Class '{body.class_id}' not found.")

    if body.subclass_id:
        sc = None
        if cls:
            sc = next((s for s in (cls.get("subclasses") or [])
                       if s.get("id")==body.subclass_id or s.get("archetype")==body.subclass_id), None)
        if not sc:
            issues.append(f"Subclass/Archetype '{body.subclass_id}' not available for class '{body.class_id}'.")
        else:
            unlock = _subclass_unlock_for(cls, rs)
            if int(body.level) < int(unlock):
                issues.append(f"Subclass '{body.subclass_id}' unlocks at level {unlock}. (Current level {body.level})")

    if not _exists_in(WEAPONS, body.weapon_id):
        issues.append(f"Weapon '{body.weapon_id}' not found.")
    if not _exists_in(ARMORS, body.armor_id):
        issues.append(f"Armor '{body.armor_id}' not found.")

    ok = len(issues) == 0
    return {"ok": ok, "issues": issues}

@app.get("/api/creator/default")
def creator_default(
    class_id: str = Query(...),
    ruleset: Optional[str] = Query(None),
    level: int = Query(1),
    subclass_id: Optional[str] = Query(None),
    loadout: Optional[str] = Query(None),
):
    rs = (ruleset or CURRENT_RULESET).lower()
    cls = _get_class_by_id(class_id)
    if not cls:
        return Response(content=json.dumps({"error": "class_not_found"}), media_type="application/json", status_code=404)

    lvl = max(1, int(level))
    defaults = _class_defaults_for(cls, rs, loadout=loadout)

    eff_subclass = subclass_id or defaults.get("subclass_id")
    unlock = _subclass_unlock_for(cls, rs)
    if eff_subclass and lvl < unlock:
        eff_subclass = None

    ability_scores = dict(defaults.get("ability_scores") or {})
    effects = _apply_background_ancestry_effects(ability_scores, defaults.get("ancestry_id"), defaults.get("background_id"))
    ability_scores = effects["ability_scores"]
    skills = effects["skills"]
    languages = effects["languages"]
    bonus_feats = effects["grant_feat_ids"]
    bonus_spells = effects["grant_spell_ids"]
    ancestry_hp = effects["pf2e_ancestry_hp"]

    weapon_id = defaults.get("weapon_id")
    armor_id = defaults.get("armor_id")
    dex = int(ability_scores.get("dex", 10))
    con = int(ability_scores.get("con", 10))
    armor = _lookup_item(armor_id)

    payload = {
        "name": f"Default {cls.get('name') or class_id} L{lvl}",
        "class_id": class_id,
        "level": lvl,
        "ruleset": rs,
        "subclass_id": eff_subclass,
        "ability_scores": ability_scores,
        "feat_ids": (defaults.get("feat_ids") or []) + bonus_feats,
        "spell_ids": (defaults.get("spell_ids") or []) + bonus_spells,
        "weapon_id": weapon_id,
        "armor_id": armor_id,
        "ancestry_id": defaults.get("ancestry_id"),
        "background_id": defaults.get("background_id"),
        "item_ids": [],
        "skills": skills,
        "languages": languages,
        "available_loadouts": (defaults.get("loadouts") or []),
    }

    if rs == "5e":
        s = summarize_progression("5e", CLASSES, class_id=class_id, weapons=WEAPONS, max_level=lvl, subclass_id=eff_subclass)
        last = (s.get("levels") or [{}])[-1]
        pb = int(last.get("prof_bonus", 2))
        payload["proficiency_bonus"] = pb
        payload["ac"] = _calc_ac_5e(armor, dex)
        payload["hp"] = _calc_hp_5e(cls, lvl, con)
        prof_skills = cls.get("proficient_skills") or []
        payload["skill_bonuses"] = _compute_5e_skill_bonuses(ability_scores, prof_skills, pb)
        saves = cls.get("saving_throws") or []
        save_bonuses = {a: _mod_from(ability_scores.get(a,10)) + (pb if a in saves else 0) for a in ["str","dex","con","int","wis","cha"]}
        payload["save_bonuses"] = save_bonuses
        cast_stat = (cls.get("casting_stat") or "").lower()
        if cast_stat:
            payload["spell_dc"] = 8 + pb + _mod_from(ability_scores.get(cast_stat,10))
            payload["spell_attack_bonus"] = pb + _mod_from(ability_scores.get(cast_stat,10))
        return payload

    # PF2e
    tiers = _pf2e_training_at_level(cls, lvl)
    s = summarize_progression("pf2e", CLASSES, class_id=class_id, weapons=WEAPONS, max_level=lvl, subclass_id=eff_subclass)
    last = (s.get("levels") or [{}])[-1]
    atk_map = last.get("pf2e_attack_bonus") or {}
    attacks = []
    for wid, tier in (tiers or {}).items():
        if wid == "_default": continue
        attacks.append({"weapon_id": wid, "tier": tier, "attack_bonus": atk_map.get(wid)})
    if "_default" in tiers:
        attacks.insert(0, {"weapon_id": "_default", "tier": tiers["_default"], "attack_bonus": atk_map.get("_default")})
    payload.update({
        "pf2e_training": tiers,
        "attacks_sample": attacks,
        "ac": _calc_ac_pf2e(armor, dex),
        "hp": _calc_hp_pf2e(cls, lvl, con, ancestry_hp),
    })
    return payload

@app.post("/api/creator/create_pc")
def creator_create_pc(body: "CreatorCreateBody"):
    rs = (body.ruleset or CURRENT_RULESET).lower()
    lvl = int(max(1, body.level))

    cls = _get_class_by_id(body.class_id)
    if not cls:
        return Response(content=json.dumps({"error": "class_not_found"}), media_type="application/json", status_code=404)

    defaults = _class_defaults_for(cls, rs, loadout=body.loadout)
    weapon_id = body.weapon_id or defaults.get("weapon_id")
    armor_id = body.armor_id or defaults.get("armor_id")
    ancestry_id = body.ancestry_id or defaults.get("ancestry_id")
    background_id = body.background_id or defaults.get("background_id")
    ability_scores = body.ability_scores or defaults.get("ability_scores") or {}
    feat_ids = list(body.feat_ids or defaults.get("feat_ids") or [])
    spell_ids = list(body.spell_ids or defaults.get("spell_ids") or [])
    subclass_id = body.subclass_id or defaults.get("subclass_id") or None

    unlock = _subclass_unlock_for(cls, rs)
    if subclass_id and lvl < unlock:
        subclass_id = None

    eff = _apply_background_ancestry_effects(ability_scores, ancestry_id, background_id)
    ability_scores = eff["ability_scores"]
    skills = eff["skills"]
    languages = eff["languages"]
    ancestry_hp = eff["pf2e_ancestry_hp"]
    for fid in eff["grant_feat_ids"]:
        if fid not in feat_ids: feat_ids.append(fid)
    for sid in eff["grant_spell_ids"]:
        if sid not in spell_ids: spell_ids.append(sid)

    dex = int(ability_scores.get("dex", 10))
    con = int(ability_scores.get("con", 10))
    armor = _lookup_item(armor_id)

    prof_bonus = 2
    extra = {}
    if rs == "5e":
        s = summarize_progression("5e", CLASSES, class_id=body.class_id, weapons=WEAPONS, max_level=lvl, subclass_id=subclass_id)
        last = (s.get("levels") or [{}])[-1]
        prof_bonus = int(last.get("prof_bonus", 2))
        ac = _calc_ac_5e(armor, dex)
        hp = _calc_hp_5e(cls, lvl, con)
        prof_skills = cls.get("proficient_skills") or []
        skills_with_bonus = _compute_5e_skill_bonuses(ability_scores, prof_skills, prof_bonus)
        saves = cls.get("saving_throws") or []
        save_bonuses = {a: _mod_from(ability_scores.get(a,10)) + (prof_bonus if a in saves else 0) for a in ["str","dex","con","int","wis","cha"]}
        cast_stat = (cls.get("casting_stat") or "").lower()
        if cast_stat:
            extra["spell_dc"] = 8 + prof_bonus + _mod_from(ability_scores.get(cast_stat,10))
            extra["spell_attack_bonus"] = prof_bonus + _mod_from(ability_scores.get(cast_stat,10))
        extra.update({"ac": ac, "hp": hp, "skill_bonuses": skills_with_bonus, "save_bonuses": save_bonuses})
    else:
        tiers = _pf2e_training_at_level(cls, lvl)
        s = summarize_progression("pf2e", CLASSES, class_id=body.class_id, weapons=WEAPONS, max_level=lvl, subclass_id=subclass_id)
        last = (s.get("levels") or [{}])[-1]
        atk_map = last.get("pf2e_attack_bonus") or {}
        attacks = []
        for wid, tier in (tiers or {}).items():
            if wid == "_default": continue
            attacks.append({"weapon_id": wid, "tier": tier, "attack_bonus": atk_map.get(wid)})
        if "_default" in tiers:
            attacks.insert(0, {"weapon_id": "_default", "tier": tiers["_default"], "attack_bonus": atk_map.get("_default")})
        ac = _calc_ac_pf2e(armor, dex)
        hp = _calc_hp_pf2e(cls, lvl, con, ancestry_hp)
        extra.update({"pf2e_training": tiers, "attacks_sample": attacks, "ac": ac, "hp": hp})

    pc = {
        "name": body.name or defaults.get("name") or f"PC {body.class_id} L{lvl}",
        "ruleset": rs,
        "level": lvl,
        "class_id": body.class_id,
        "subclass_id": subclass_id,
        "ability_scores": ability_scores,
        "feat_ids": feat_ids,
        "spell_ids": spell_ids,
        "weapon_id": weapon_id,
        "armor_id": armor_id,
        "ancestry_id": ancestry_id,
        "background_id": background_id,
        "items": body.item_ids or [],
        "proficiency_bonus": prof_bonus,
        "skills": skills,
        "languages": languages,
        **extra
    }
    return pc

# --------------------------------------------------------------------------------------
# Progression (JSON + CSV)
# --------------------------------------------------------------------------------------
@app.get("/api/progression")
def api_progression(class_id: str, ruleset: str = "5e", subclass_id: str | None = None, max_level: int = 20):
    class_def = next((c for c in CLASSES if (c.get("id")==class_id or c.get("archetype")==class_id)), None)
    if not class_def:
        raise HTTPException(status_code=404, detail=f"class_id '{class_id}' not found")
    subclass = None
    if subclass_id:
        for sc in (class_def.get("subclasses") or []):
            if sc.get("id")==subclass_id or sc.get("archetype")==subclass_id:
                subclass = sc
                break
    prog = build_progression(class_def, subclass, ruleset, max_level=max_level)
    return prog

# --- Progression (PF2e Full AC) ---
@app.post("/api/progression/summarize/pf2e")
def summarize_pf2e(req: PF2eProgressionRequest):
    try:
        out = summarize_progression_pf2e_with_full_ac(
            max_level=req.level,
            base_dex_mod=req.base_dex_mod,
            proficiency_progression=req.proficiency_progression,
            armor_by_level=req.armor_by_level,
        )
        return {"levels": out}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/progression")
def post_progression(q: "ProgressionQuery"):
    rs = (q.ruleset or CURRENT_RULESET).lower()
    summary = summarize_progression(
        rs, CLASSES,
        class_id=q.class_id, weapons=WEAPONS,
        max_level=int(q.max_level or 20), subclass_id=q.subclass_id
    )
    if "error" in summary:
        return Response(content=json.dumps(summary), media_type="application/json", status_code=404)
    return summary

def _progression_to_csv(summary: Dict[str, Any]) -> str:
    rows = summary.get("levels", []) or []
    rs = (summary.get("ruleset") or "5e").lower()
    weapon_catalog = summary.get("weapon_catalog") or {}
    def esc(s: Any) -> str: return '"' + str(s).replace('"', '""') + '"'
    if rs == "5e":
        header = ["level", "prof_bonus", "subclass_available", "gains"]
        lines = [",".join(map(esc, header))]
        for r in rows:
            line = [r.get("level",""), r.get("prof_bonus",""), "yes" if r.get("subclass_available") else "", "; ".join(r.get("gains", []) or [])]
            lines.append(",".join(map(esc, line)))
        return "\n".join(lines) + "\n"
    header = ["level", "default_tier", "overrides", "gains"]
    lines = [",".join(map(esc, header))]
    for r in rows:
        tiers = r.get("pf2e_weapon_tiers") or {}
        def_tier = (tiers.get("_default") or "").upper()
        overrides = []
        for wid, tier in tiers.items():
            if wid == "_default": continue
            name = weapon_catalog.get(wid) or wid
            atk = (r.get("pf2e_attack_bonus") or {}).get(wid, "")
            overrides.append(f"{name}: {str(tier).upper()} → +{atk}")
        line = [r.get("level",""), def_tier, " | ".join(overrides), "; ".join(r.get("gains", []) or [])]
        lines.append(",".join(map(esc, line)))
    return "\n".join(lines) + "\n"

@app.get("/api/progression.csv")
def get_progression_csv(
    class_id: str = Query(...),
    ruleset: Optional[str] = Query(None),
    max_level: int = Query(20),
    subclass_id: Optional[str] = Query(None),
):
    rs = (ruleset or CURRENT_RULESET).lower()
    summary = summarize_progression(
        rs, CLASSES, class_id=class_id, weapons=WEAPONS, max_level=max_level, subclass_id=subclass_id
    )
    if "error" in summary:
        csv_err = 'error,message\n"class_not_found","Class ID not found."\n'
        return Response(content=csv_err, media_type="text/csv", status_code=404)
    return Response(
        content=_progression_to_csv(summary),
        media_type="text/csv",
        headers={
            "Content-Disposition":
            f'attachment; filename="progression_{rs}_{class_id}{("_"+subclass_id) if subclass_id else ""}.csv"'
        }
    )

# --------------------------------------------------------------------------------------
# Runtime overrides API (overlay editor)
# --------------------------------------------------------------------------------------
@app.get("/api/creator/defaults")
def get_creator_defaults(
    class_id: str = Query(...),
    ruleset: Optional[str] = Query(None)
):
    rs = (ruleset or CURRENT_RULESET).lower()
    cls = _get_class_by_id(class_id)
    if not cls:
        return Response(content=json.dumps({"error": "class_not_found"}), media_type="application/json", status_code=404)
    d = _class_defaults_for(cls, rs)
    return {
        "ruleset": rs,
        "class_id": class_id,
        "defaults": d,
        "has_defaults": bool(d),
        "available_loadouts": d.get("loadouts") or []
    }

class SaveDefaultBody(BaseModel):
    class_id: str
    ruleset: Optional[str] = None
    payload: Dict[str, Any]
    loadout_id: Optional[str] = None
    loadout_name: Optional[str] = None

@app.post("/api/creator/save_default")
def post_creator_save_default(body: "SaveDefaultBody"):
    rs = (body.ruleset or CURRENT_RULESET).lower()
    cid = body.class_id
    if not _get_class_by_id(cid):
        return Response(content=json.dumps({"error": "class_not_found"}), media_type="application/json", status_code=404)

    ov = load_json_abs(OVERRIDES_PATH) or {}
    oc = ov.setdefault("classes", {})
    tgt = oc.setdefault(cid, {})
    defs = tgt.setdefault("defaults", {})
    cur = defs.get(rs) or {}

    if body.loadout_id or body.loadout_name:
        lo = cur.setdefault("loadouts", [])
        key = (body.loadout_id or body.loadout_name or "").strip()
        filtered = [x for x in lo if (x.get("id") or x.get("name")) != key]
        new_lo = dict(body.payload or {})
        if body.loadout_id: new_lo["id"] = body.loadout_id
        if body.loadout_name: new_lo["name"] = body.loadout_name
        filtered.append(new_lo)
        cur["loadouts"] = filtered
        defs[rs] = cur
    else:
        defs[rs] = dict(body.payload or {})

    _save_json_abs(OVERRIDES_PATH, ov)
    refresh_data()
    return {"ok": True}

class SeedDefaultsBody(BaseModel):
    ruleset: Optional[str] = None
    force: Optional[bool] = False

@app.post("/api/creator/seed_defaults")
def post_seed_defaults(body: "SeedDefaultsBody"):
    rs = (body.ruleset or CURRENT_RULESET).lower()
    force = bool(body.force)
    ov = load_json_abs(OVERRIDES_PATH) or {}
    oc = ov.setdefault("classes", {})

    created = []
    skipped = []
    for c in CLASSES:
        cid = c.get("id") or c.get("archetype")
        if not cid: 
            continue
        tgt = oc.setdefault(cid, {})
        defs = tgt.setdefault("defaults", {})
        already = bool(defs.get(rs))
        if already and not force:
            skipped.append(cid)
            continue
        defs[rs] = _guess_default_for_class(rs, c)
        created.append(cid)

    _save_json_abs(OVERRIDES_PATH, ov)
    refresh_data()
    return {"ok": True, "ruleset": rs, "created": created, "skipped": skipped}

@app.get("/api/runtime/overrides")
def get_overrides():
    return OVERRIDES or {"classes": {}}

@app.post("/api/runtime/overrides")
def post_overrides(payload: Dict[str, Any] = Body(...)):
    _save_json_abs(OVERRIDES_PATH, payload or {})
    refresh_data()
    return {"ok": True}

@app.get("/api/creator/readiness")
def creator_readiness(ruleset: Optional[str] = Query(None)):
    rs = (ruleset or CURRENT_RULESET).lower()
    report = []
    for c in CLASSES:
        cid = c.get("id") or c.get("archetype")
        d = (c.get("defaults") or {}).get(rs) or {}
        ok_defaults = bool(d)
        ok_pf2e = True
        if rs == "pf2e":
            ok_pf2e = bool(c.get("pf2e_weapon_tiers"))
        report.append({
            "class_id": cid,
            "name": c.get("name") or cid,
            "has_subclasses": bool(c.get("subclasses")),
            "has_defaults": ok_defaults,
            "has_pf2e_tiers": ok_pf2e,
            "ready": ok_defaults and (ok_pf2e if rs=="pf2e" else True)
        })
    return {"ruleset": rs, "classes": report}


# ---  Power Scoring (PF2e) ---
@app.post("/api/score/spell")
def api_score_spell(payload: Dict[str, Any]):
    """
    Minimal v1: expects a spell-like dict:
    {
      "name": "...",
      "level": 3,
      "dice": "6d6",
      "area": {"shape":"burst","radius":20},
      "range": 120,
      "actions": 2,
      "save": "basic-reflex" | "basic-fort" | "basic-will" | null,
      "riders": [{"kind":"persistent","dice":"1d6","type":"fire"}]
    }
    """
    try:
        result = score_spell(payload, context={"density":"medium"})
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    
@app.post("/api/score/spell/comparables")
def api_spell_comparables(payload: Dict[str, Any]):
    """
    Returns up to 5 nearest catalog spells by Power Score (PS) distance.
    Tries SQLite via DSN; falls back to JSON file at backend/data/catalog/spells.json; else band placeholders.
    """
    try:
        from sqlalchemy import create_engine
        import os
        dsn = os.environ.get("DSN")
        engine = ENGINE  # reuse the app's engine from db.py
        catalog_json = os.path.join(BACKEND_ROOT, "data", "catalog", "spells.json")
        items = nearest_spell_comparables(payload, context={"density":"medium"}, engine=engine, catalog_json_path=catalog_json)
        return {"items": items}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# --- Sim Lab skeleton ---
@app.post("/api/sim/run")
def api_sim_run(payload: Dict[str, Any]):
    """
    { "party":[{...}], "foes":[{...}], "iterations": 2000, "policy":"aggressive" }
    Each combatant may include keys like:
    { "name":"Fighter", "ehp": 120, "dpr": 18, "crit_rate": 0.1 }
    """
    try:
        return run_sim(payload)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/score/monster")
def api_score_monster(payload: Dict[str, Any]):
    try:
        result = score_monster(payload, context={"density":"medium"})
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))



# --- Export ---
@app.get("/api/export/build.json")
def export_build_json(ruleset: str, build_id: Optional[str] = None):
    # TODO: pull build from your store; for now, echo a minimal placeholder
    data = {"ruleset": ruleset, "build_id": build_id or "temp", "created_at": time.time()}
    return JSONResponse(data)

@app.get("/api/export/build.csv")
def export_build_csv(ruleset: str, build_id: Optional[str] = None):
    # Example: generate a tiny CSV
    rows = [
        ["field", "value"],
        ["ruleset", ruleset],
        ["build_id", build_id or "temp"],
        ["exported_at", datetime.utcnow().isoformat()],
    ]
    sio = io.StringIO()
    w = csv.writer(sio)
    for r in rows: w.writerow(r)
    csv_bytes = sio.getvalue().encode("utf-8")
    return Response(
        content=csv_bytes,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="build_{build_id or "temp"}.csv"'},
    )


@app.post("/api/export/build/json")
def export_build_json(payload: BuildExportRequest):
    if not payload.build and not payload.build_id:
        raise HTTPException(status_code=400, detail="Provide build or build_id")
    return {"build": payload.build or {"id": payload.build_id}}

@app.post("/api/export/build/csv")
def export_build_csv(payload: BuildExportRequest):
    if not payload.build and not payload.build_id:
        raise HTTPException(status_code=400, detail="Provide build or build_id")
    build = payload.build or {"id": payload.build_id}
    lines = ["key,value"]
    def _emit(prefix, obj):
        if isinstance(obj, dict):
            for k, v in obj.items(): _emit(f"{prefix}{k}.", v)
        elif isinstance(obj, list):
            for i, v in enumerate(obj): _emit(f"{prefix}{i}.", v)
        else:
            k = prefix[:-1] if prefix.endswith(".") else prefix
            lines.append(f"{k},{json.dumps(obj)}")
    _emit("", build)
    return {"filename":"build_export.csv","mime":"text/csv","content":"\n".join(lines)}

@app.post("/api/admin/rehydrate")
def admin_rehydrate(ruleset: str = Query(..., description="5e | pf2e"),
                    campaign: str | None = Query(None),
                    session: Session = Depends(get_session)):
    """
    Load layered JSON into SQLite for the given ruleset+campaign.
    Existing rows with same id will be updated (upsert).
    """
    names = [
        "classes.json", "spells.json", "items.json", "feats.json",
        "ancestries.json", "backgrounds.json", "runes.json", "monsters.json"
    ]
    packs = load_collections(BACKEND_ROOT, ruleset, campaign, names)

    upserts = 0
    def _upsert(model, items):
        nonlocal upserts
        for it in items:
            if not isinstance(it, dict): continue
            _id = it.get("id") or it.get("name")
            if not _id: continue
            it["ruleset"] = ruleset  # tag
            # try fetch
            row = session.exec(select(model).where(model.id == _id)).first()
            if row:
                for k,v in it.items():
                    if hasattr(row, k):
                        setattr(row, k, v)
            else:
                row = model(**{k:v for k,v in it.items() if hasattr(model, k)})
                if not getattr(row, "id", None):
                    setattr(row, "id", _id)
                session.add(row)
            upserts += 1

    mp = {
        "classes.json":      ("Class", "classes"),
        "spells.json":       ("Spell", "spells"),
        "items.json":        ("Item",  "items"),
        "feats.json":        ("Feat",  "feats"),
        "ancestries.json":   ("Ancestry", "ancestries"),
        "backgrounds.json":  ("Background", "backgrounds"),
        "runes.json":        ("Rune", "runes"),
        "monsters.json":     ("Monster", "monsters"),
    }

    import backend.models as M  # adjust if your models module path differs
    for name, (model_name, key) in mp.items():
        arr = packs.get(name, [])
        model = getattr(M, model_name, None)
        if model and arr:
            _upsert(model, arr)

    session.commit()
    return {"ok": True, "ruleset": ruleset, "campaign": campaign, "upserts": upserts}


# --------------------------------------------------------------------------------------
# Static SPA (vite build synced to backend/static)
# --------------------------------------------------------------------------------------
if os.path.isdir(STATIC_ROOT):
    app.mount("/", StaticFiles(directory=STATIC_ROOT, html=True), name="spa")
