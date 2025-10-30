from __future__ import annotations
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlmodel import select
from .db import get_session, init_db
from . import models as M

router = APIRouter()

@router.on_event("startup")
def _startup_db():
    try:
        init_db()
    except Exception as e:
        print("[startup] DB init failed; JSON-only routes will still serve:", e)

@router.get("/api/classes")
def list_classes(
    ruleset: Optional[str] = Query(None, pattern="^(5e|pf2e)$"),
    session = Depends(get_session),
):
    q = select(M.Class)
    if ruleset:
        q = q.where(M.Class.ruleset == ruleset)
    rows = session.exec(q).all()
    return [{"id": r.id, "ruleset": r.ruleset, "name": r.name, "subclass_unlock": r.subclass_unlock} for r in rows]

@router.get("/api/classes/{class_id}")
def get_class(class_id: str, session = Depends(get_session)):
    c = session.get(M.Class, class_id)
    if not c:
        raise HTTPException(status_code=404, detail="class not found")
    subs = session.exec(select(M.Subclass).where(M.Subclass.class_id == class_id)).all()
    feats = session.exec(
        select(M.Feature)
        .where(M.Feature.owner_type == "class", M.Feature.owner_id == class_id)
        .order_by(M.Feature.level)
    ).all()
    by_level: Dict[int, Any] = {}
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

@router.get("/api/search")
def search(q: str, types: Optional[str] = None, session = Depends(get_session)):
    kinds = set((types or "").split(",")) if types else {"weapon","armor","feat","spell","class"}
    needle = q.lower().strip()
    out = {}
    def _match(model, label, field="name"):
        rows = session.exec(select(model)).all()
        hit = []
        for r in rows:
            name = getattr(r, field, "") or ""
            if needle in name.lower():
                hit.append({"id": r.id, "name": name})
        if hit:
            out[label] = hit
    if "class" in kinds: _match(M.Class, "classes")
    if "weapon" in kinds: _match(M.Weapon, "weapons")
    if "armor" in kinds: _match(M.Armor, "armors")
    if "feat" in kinds: _match(M.Feat, "feats")
    if "spell" in kinds: _match(M.Spell, "spells")
    return out

@router.get("/api/catalog")
def catalog(
    kind: str = Query(..., pattern="^(weapons|armors|feats|spells|ancestries|backgrounds|classes)$"),
    page: int = 1,
    page_size: int = 50,
    session = Depends(get_session)
):
    Model = {
        "weapons": M.Weapon, "armors": M.Armor, "feats": M.Feat, "spells": M.Spell,
        "ancestries": M.Ancestry, "backgrounds": M.Background, "classes": M.Class
    }[kind]
    all_rows = session.exec(select(Model)).all()
    total = len(all_rows)
    start = max(0, (page-1)*page_size)
    end = start + page_size
    rows = all_rows[start:end]
    return {"page": page, "page_size": page_size, "total": total,
            "items": [{"id": r.id, "name": getattr(r, "name", None)} for r in rows]}
