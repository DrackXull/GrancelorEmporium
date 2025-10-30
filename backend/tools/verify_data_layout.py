# backend/tools/verify_data_layout.py
from __future__ import annotations
import json, glob
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]  # backend/
DATA = ROOT / "data"

REQUIRED_DIRS = [
    "systems/5e",
    "systems/pf2e",
    "campaigns",
    "runtime/overrides/5e",
    "runtime/overrides/pf2e",
]

OPTIONAL_DIRS = [
    "systems/5e/monsters",
    "systems/5e/aggregates",
    "systems/pf2e/monsters",
    "systems/pf2e/aggregates",
]

FILES_HINT = {
    # Accept object{} OR array[] for these; we’ll check and allow both.
    "systems/5e/classes.json": "array|object",
    "systems/5e/spells.json": "array",
    "systems/5e/items.json": "array",
    "systems/pf2e/classes.json": "array|object",
    "systems/pf2e/spells.json": "array",
    "systems/pf2e/items.json": "array",
    "runtime/overrides/5e/classes_overrides.json": "object",
    "runtime/overrides/pf2e/classes_overrides.json": "object",
}

def _exists(p: Path):
    ok = p.exists()
    print(f"[{'OK' if ok else 'MISS'}] {p.relative_to(DATA)}")
    return ok

def _kind_ok(data, expect: str) -> bool:
    kinds = expect.split("|")
    for k in kinds:
        if k == "array" and isinstance(data, list): return True
        if k == "object" and isinstance(data, dict): return True
    return False

def _check_json(path: Path, expect_kind: str):
    if not path.exists():
        print(f"[SKIP] {path.relative_to(DATA)} (missing)")
        return True
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if not _kind_ok(data, expect_kind):
            got = "array" if isinstance(data, list) else "object" if isinstance(data, dict) else type(data).__name__
            print(f"[ERR ] {path.relative_to(DATA)} expected {expect_kind} got {got}")
            return False
        count = len(data) if isinstance(data, (list, dict)) else "n/a"
        print(f"[OK  ] {path.relative_to(DATA)} JSON kind~={expect_kind}, count={count}")
        return True
    except Exception as e:
        print(f"[ERR ] {path.relative_to(DATA)} JSON parse error: {e}")
        return False

def _count_monsters(dirpath: Path):
    if not dirpath.exists():
        print(f"[SKIP] {dirpath.relative_to(DATA)} (missing)")
        return 0
    files = sorted(glob.glob(str(dirpath / "*.json")))
    print(f"[OK  ] {dirpath.relative_to(DATA)} {len(files)} files")
    return len(files)

def main():
    print(f"Verifying layout under: {DATA}")
    ok = True
    for d in REQUIRED_DIRS:
        ok &= _exists(DATA / d)
    for d in OPTIONAL_DIRS:
        _exists(DATA / d)
    for rel, kind in FILES_HINT.items():
        ok &= _check_json(DATA / rel, kind)
    _count_monsters(DATA / "systems/5e/monsters")
    _count_monsters(DATA / "systems/pf2e/monsters")
    camps = [p.name for p in (DATA / "campaigns").glob("*") if p.is_dir()]
    print(f"Campaigns found: {camps or 'none'}")
    print("\nResult:", "PASS" if ok else "FIX NEEDED")
    return 0 if ok else 2

if __name__ == "__main__":
    raise SystemExit(main())
