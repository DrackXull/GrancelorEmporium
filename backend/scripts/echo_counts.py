#!/usr/bin/env python3
# backend/scripts/echo_counts.py
"""
Print quick table counts from the mirrored SQLite (or Postgres if configured).

USAGE:
  python -m backend.scripts.echo_counts
"""
from sqlmodel import Session, select
try:
    from backend.compat_imports import engine, M  # type: ignore
except Exception:
    from backend.db import engine  # type: ignore
    from backend import models as M  # type: ignore

def count(session, model):
    return session.exec(select(model)).count() if hasattr(session.exec(select(model)), "count") \
           else len(session.exec(select(model)).all())

def main():
    with Session(engine) as s:
        rows = {
            "classes":     len(s.exec(select(M.Class)).all()),
            "subclasses":  len(s.exec(select(M.Subclass)).all()),
            "features":    len(s.exec(select(M.Feature)).all()),
            "weapons":     len(s.exec(select(M.Weapon)).all()),
            "armors":      len(s.exec(select(M.Armor)).all()),
            "feats":       len(s.exec(select(M.Feat)).all()),
            "spells":      len(s.exec(select(M.Spell)).all()),
            "backgrounds": len(s.exec(select(M.Background)).all()),
            "ancestries":  len(s.exec(select(M.Ancestry)).all()),
            "runes":       len(s.exec(select(M.Rune)).all()) if hasattr(M, "Rune") else 0,
            "gear_plans":  len(s.exec(select(M.PF2eGearPlan)).all()) if hasattr(M, "PF2eGearPlan") else 0,
            "skills_plans":len(s.exec(select(M.PF2eSkillsPlan)).all()) if hasattr(M, "PF2eSkillsPlan") else 0,
        }
        print(rows)

if __name__ == "__main__":
    main()
