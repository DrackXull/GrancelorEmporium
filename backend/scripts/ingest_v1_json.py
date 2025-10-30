#!/usr/bin/env python3
# backend/scripts/ingest_v1_json.py
"""
Ingests backend/data/v1 JSON catalogs (and optional data/system/5e, data/system/pf2e)
into SQLite via SQLModel. Idempotent upserts.

USAGE:
  # from repo root
  python -m backend.scripts.ingest_v1_json --wipe --verbose
  python -m backend.scripts.ingest_v1_json --data-root backend/data/v1
  python -m backend.scripts.ingest_v1_json --no-5e --no-pf2e
"""

import os, re, json, argparse
from typing import Any, Dict, List, Optional, Tuple
from copy import deepcopy

from sqlmodel import Session, select
try:
    from backend.compat_imports import engine, M  # type: ignore
except Exception:
    from backend.db import engine  # type: ignore
    from backend import models as M  # type: ignore


# -------------------------------
# CLI
# -------------------------------
def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("--data-root", default="backend/data/v1", help="Primary data root")
    p.add_argument("--wipe", action="store_true", help="Delete existing mirrored rows before ingest")
    p.add_argument("--no-5e", action="store_true", help="Skip optional data/system/5e folder ingest")
    p.add_argument("--no-pf2e", action="store_true", help="Skip optional data/system/pf2e folder ingest")
    p.add_argument("--verbose", action="store_true")
    return p.parse_args()


# -------------------------------
# Tolerant IO
# -------------------------------
def _strip_js_wrapper(text: str) -> str:
    """
    Accept:
      export default {...}
      module.exports = {...}
    Return the {...} part as a JSON string.
    """
    s = text.strip()
    if s.startswith("export default"):
        s = s[len("export default"):].strip()
    if s.startswith("module.exports"):
        # remove "module.exports ="
        eq = s.find("=")
        if eq != -1:
            s = s[eq+1:].strip()
    # Trim trailing semicolon
    if s.endswith(";"):
        s = s[:-1].strip()
    return s

def _load_json_any(path: str) -> Any:
    try:
        with open(path, "r", encoding="utf-8") as f:
            text = f.read()
        if path.endswith(".js"):
            text = _strip_js_wrapper(text)
        return json.loads(text)
    except FileNotFoundError:
        return None
    except Exception as e:
        print(f"[WARN] Failed to load {path}: {e}")
        return None

def _ensure_list(payload: Any, top_key: Optional[str] = None) -> List[Any]:
    if payload is None:
        return []
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict) and top_key:
        v = payload.get(top_key)
        return v if isinstance(v, list) else []
    return []

def _slug(s: str) -> str:
    s = (s or "").strip().lower()
    s = re.sub(r"[^a-z0-9]+", "_", s)
    s = re.sub(r"(^_+|_+$)", "", s)
    return s or "id"

def _safe_id(*parts: Any) -> str:
    return _slug("_".join([str(p or "") for p in parts]))

def _as_obj(x: Any, defaults: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    if isinstance(x, dict):
        out = dict(x)
    else:
        out = {"name": str(x)}
    if defaults:
        for k, v in defaults.items():
            out.setdefault(k, v)
    return out

def _id_for(entry: Dict[str, Any], prefix: Optional[str] = None) -> str:
    return entry.get("id") or _safe_id(prefix, entry.get("name") or entry.get("archetype") or "")

def _deep_merge(a: Dict[str, Any], b: Dict[str, Any]) -> Dict[str, Any]:
    out = deepcopy(a)
    for k, v in (b or {}).items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _deep_merge(out[k], v)
        else:
            out[k] = deepcopy(v)
    return out


# -------------------------------
# DB helpers
# -------------------------------
def _wipe_all(session: Session, verbose: bool = False) -> None:
    for model in [
        M.Class, M.Subclass, M.Feature,
        M.Weapon, M.Armor, M.Feat, M.Spell,
        M.Background, M.Ancestry, M.Rune
    ]:
        session.exec(model.__table__.delete())  # type: ignore
        if verbose:
            print(f"[wipe] {model.__name__} cleared")
    session.commit()

def _upsert(session: Session, model, pk: str, payload: Dict[str, Any]) -> None:
    row = session.get(model, pk)
    if row:
        for k, v in payload.items():
            setattr(row, k, v)
    else:
        row = model(**payload)
        session.add(row)

def _commit_batch(session: Session, verbose: bool, label: str, count: int) -> None:
    session.commit()
    if verbose:
        print(f"[✓] {label}: {count} upserted")


# -------------------------------
# Ingestors
# -------------------------------
def ingest_classes(session: Session, data: List[Any], ruleset: Optional[str], verbose: bool = False) -> Tuple[int, int, int]:
    n_cls = n_sub = n_feat = 0
    for raw in data:
        c = _as_obj(raw, {"ruleset": ruleset} if ruleset else None)
        rs = (c.get("ruleset") or ruleset or "5e")
        cid = _id_for(c, f"{rs}_class")
        cname = c.get("name") or cid

        _upsert(session, M.Class, cid, {
            "id": cid,
            "ruleset": rs,
            "name": cname,
            "hit_die": c.get("hit_die"),
            "hp_per_level": c.get("hp_per_level"),
            "primary_stat": c.get("primary_stat"),
            "subclass_unlock": c.get("subclass_unlock"),
            "casting_stat": c.get("casting_stat"),
            "json": c,
        })
        n_cls += 1

        for s_raw in (c.get("subclasses") or []):
            s = _as_obj(s_raw)
            sid = _id_for(s, f"{cid}_subclass")
            _upsert(session, M.Subclass, sid, {
                "id": sid,
                "class_id": cid,
                "name": s.get("name") or sid,
                "json": s
            })
            n_sub += 1

        fbl = c.get("features_by_level") or {}
        if isinstance(fbl, list):
            for entry in fbl:
                if not isinstance(entry, dict):
                    continue
                lvl = int(entry.get("level", 1))
                fname = entry.get("name") or f"Feature {lvl}"
                fid = _id_for(entry, f"{cid}_L{lvl}_{fname}")
                _upsert(session, M.Feature, fid, {
                    "id": fid, "owner_type": "class", "owner_id": cid, "level": lvl,
                    "name": fname, "json": entry
                })
                n_feat += 1
        elif isinstance(fbl, dict):
            for k, v in fbl.items():
                try:
                    lvl = int(k)
                except Exception:
                    continue
                items = v if isinstance(v, list) else [v]
                for name_or_obj in items:
                    if isinstance(name_or_obj, dict):
                        fname = name_or_obj.get("name") or f"Feature {lvl}"
                        fjson = name_or_obj
                    else:
                        fname = str(name_or_obj)
                        fjson = {"label": fname}
                    fid = _safe_id(cid, f"L{lvl}", fname)
                    _upsert(session, M.Feature, fid, {
                        "id": fid, "owner_type": "class", "owner_id": cid, "level": lvl,
                        "name": fname, "json": fjson
                    })
                    n_feat += 1

    _commit_batch(session, verbose, f"classes[{ruleset or 'auto'}]", n_cls)
    _commit_batch(session, verbose, f"subclasses[{ruleset or 'auto'}]", n_sub)
    _commit_batch(session, verbose, f"features[{ruleset or 'auto'}]", n_feat)
    return n_cls, n_sub, n_feat


def _ingest_simple_table(session: Session, Model, label: str, data: List[Any],
                         ruleset: Optional[str] = None, name_key: str = "name",
                         id_prefix: Optional[str] = None, verbose: bool = False) -> int:
    n = 0
    for raw in data:
        obj = _as_obj(raw, {"ruleset": ruleset} if ruleset else None)
        pk = _id_for(obj, id_prefix or label)
        _upsert(session, Model, pk, {
            "id": pk,
            "name": obj.get(name_key) or pk,
            "json": obj,
            **({"ruleset": ruleset} if hasattr(Model, "ruleset") and ruleset else {})
        })
        n += 1
    _commit_batch(session, verbose, label, n)
    return n


def _load_from_folder(data_root: str, file_base: str, top_key: Optional[str]) -> List[Any]:
    """
    Load `file_base` from either .json or .js in data_root.
    If .js, strip 'export default' / 'module.exports =' and parse.
    """
    for ext in (".json", ".js"):
        path = os.path.join(data_root, file_base + ext)
        payload = _load_json_any(path)
        if payload is not None:
            return _ensure_list(payload, top_key)
    return []


def ingest_dir(session: Session, data_root: str, ruleset: Optional[str] = None, verbose: bool = False) -> None:
    """
    Ingest a single folder (e.g., backend/data/v1, or backend/data/system/5e).
    Files are optional; missing ones are skipped.
    """
    classes = _load_from_folder(data_root, "classes", "classes")
    if classes:
        ingest_classes(session, classes, ruleset, verbose=verbose)

    weapons = _load_from_folder(data_root, "weapons", "weapons")
    armors  = _load_from_folder(data_root, "armors",  "armors")
    feats   = _load_from_folder(data_root, "feats",   "feats")
    spells  = _load_from_folder(data_root, "spells",  "spells")
    bgs     = _load_from_folder(data_root, "backgrounds", "backgrounds")
    ances   = _load_from_folder(data_root, "ancestries",  "ancestries")
    runes   = _load_from_folder(data_root, "runes",   "runes")

    if weapons:
        _ingest_simple_table(session, M.Weapon, "weapons", weapons, ruleset, id_prefix=f"{ruleset}_weapon" if ruleset else "weapon", verbose=verbose)
    if armors:
        _ingest_simple_table(session, M.Armor, "armors", armors, ruleset, id_prefix=f"{ruleset}_armor" if ruleset else "armor", verbose=verbose)
    if feats:
        _ingest_simple_table(session, M.Feat, "feats", feats, ruleset, id_prefix=f"{ruleset}_feat" if ruleset else "feat", verbose=verbose)
    if spells:
        _ingest_simple_table(session, M.Spell, "spells", spells, ruleset, id_prefix=f"{ruleset}_spell" if ruleset else "spell", verbose=verbose)
    if bgs:
        _ingest_simple_table(session, M.Background, "backgrounds", bgs, ruleset, id_prefix=f"{ruleset}_background" if ruleset else "background", verbose=verbose)
    if ances:
        _ingest_simple_table(session, M.Ancestry, "ancestries", ances, ruleset, id_prefix=f"{ruleset}_ancestry" if ruleset else "ancestry", verbose=verbose)
    if runes:
        _ingest_simple_table(session, M.Rune, "runes", runes, ruleset, id_prefix=f"{ruleset}_rune" if ruleset else "rune", verbose=verbose)


def apply_class_overrides(session: Session, overrides_path: str, ruleset: str, verbose: bool = False) -> None:
    """Merge runtime overrides into Class.json.defaults[ruleset] for each class key."""
    payload = _load_json_any(overrides_path)
    if not (payload and isinstance(payload, dict)):
        if verbose:
            print(f"[overrides:{ruleset}] none at {overrides_path}")
        return
    classes_block = payload.get("classes") or {}
    if not isinstance(classes_block, dict):
        if verbose:
            print(f"[overrides:{ruleset}] malformed 'classes' in {overrides_path}")
        return

    changed = 0
    for class_key, body in classes_block.items():
        if not isinstance(body, dict):
            continue
        row = session.get(M.Class, class_key) or session.get(M.Class, _safe_id(f"{ruleset}_class", class_key))
        if not row:
            if verbose:
                print(f"[overrides:{ruleset}] skip missing class: {class_key}")
            continue

        cj = deepcopy(row.json) if isinstance(row.json, dict) else {}
        defaults = cj.get("defaults") or {}
        current = defaults.get(ruleset) or {}
        incoming = (body.get("defaults") or {}).get(ruleset) or {}
        merged = _deep_merge(current, incoming)
        if merged != current:
            defaults[ruleset] = merged
            cj["defaults"] = defaults
            row.json = cj
            changed += 1

    session.commit()
    if verbose:
        print(f"[overrides:{ruleset}] applied to {changed} classes from {overrides_path}")


# -------------------------------
# Main
# -------------------------------
def main() -> None:
    args = parse_args()
    v1_root  = os.path.abspath(args.data_root)
    sys_5e   = os.path.abspath("backend/data/systems/5e")
    sys_pf2e = os.path.abspath("backend/data/systems/pf2e")

    os.makedirs(os.path.dirname(v1_root), exist_ok=True)

    with Session(engine) as session:
                # Ensure tables exist before wiping
        try:
            from sqlmodel import SQLModel
            SQLModel.metadata.create_all(engine)
        except Exception as e:
            print(f"[warn] create_all failed (continuing): {e}")

        if args.wipe:
            _wipe_all(session, verbose=args.verbose)

        # v1 root (shared)
        if args.verbose:
            print(f"[ingest] root: {v1_root}")
        ingest_dir(session, data_root=v1_root, ruleset=None, verbose=args.verbose)

        # system/5e
        if not args.no_5e and os.path.isdir(sys_5e):
            if args.verbose:
                print(f"[ingest] extra 5e: {sys_5e}")
            ingest_dir(session, data_root=sys_5e, ruleset="5e", verbose=args.verbose)

        # system/pf2e (supports .js)
        if not args.no_pf2e and os.path.isdir(sys_pf2e):
            if args.verbose:
                print(f"[ingest] extra pf2e: {sys_pf2e}")
            ingest_dir(session, data_root=sys_pf2e, ruleset="pf2e", verbose=args.verbose)

        # Apply split runtime overrides (if present)
        data_dir = os.path.abspath(os.path.join(v1_root, os.pardir))  # => backend/data
        ov_5e  = os.path.join(data_dir, "runtime", "overrides", "5e",  "classes_overrides.json")
        ov_pf2 = os.path.join(data_dir, "runtime", "overrides", "pf2e","classes_overrides.json")
        if os.path.isfile(ov_5e):
            apply_class_overrides(session, ov_5e,  "5e",  verbose=args.verbose)
        if os.path.isfile(ov_pf2):
            apply_class_overrides(session, ov_pf2, "pf2e", verbose=args.verbose)

        if args.verbose:
            def count(model) -> int: return len(session.exec(select(model)).all())
            print("[counts]", {
                "classes": count(M.Class),
                "subclasses": count(M.Subclass),
                "features": count(M.Feature),
                "weapons": count(M.Weapon),
                "armors": count(M.Armor),
                "feats": count(M.Feat),
                "spells": count(M.Spell),
                "backgrounds": count(M.Background),
                "ancestries": count(M.Ancestry),
                "runes": count(M.Rune),
            })


if __name__ == "__main__":
    main()
