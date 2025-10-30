# backend/tools/split_monsters.py
from __future__ import annotations
import json, os, sys, re
from pathlib import Path
from typing import Iterable, Dict, Any, List

def load_any(path: Path):
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    # accept array, map, or wrapper {"monsters":[...]}
    if isinstance(data, dict):
        if "monsters" in data and isinstance(data["monsters"], list):
            return data["monsters"]
        # map id->record
        if all(isinstance(v, dict) for v in data.values()):
            return list(data.values())
    if isinstance(data, list):
        return data
    raise ValueError(f"Unsupported JSON shape in {path}")

SAFE = re.compile(r"[^a-z0-9_-]+")

def safe_id(x: str) -> str:
    x = x.strip().lower()
    x = SAFE.sub("-", x)
    x = re.sub(r"-+", "-", x).strip("-")
    return x or "unnamed"

def main():
    if len(sys.argv) < 3:
        print("Usage: python backend/tools/split_monsters.py <src.json> <dst_dir>")
        print("   or: python backend/tools/split_monsters.py <src_dir_with_json> <dst_dir>")
        raise SystemExit(2)

    src = Path(sys.argv[1])
    dst = Path(sys.argv[2])
    dst.mkdir(parents=True, exist_ok=True)

    records: List[Dict[str, Any]] = []
    if src.is_file():
        records = load_any(src)
    elif src.is_dir():
        # read all *.json inside a folder and concatenate
        for fp in src.glob("*.json"):
            try:
                part = load_any(fp)
                if isinstance(part, list):
                    records += part
            except Exception as e:
                print(f"[WARN] skip {fp.name}: {e}")
    else:
        raise SystemExit(f"Not found: {src}")

    written = 0
    for rec in records:
        if not isinstance(rec, dict):
            continue
        rid = rec.get("id") or rec.get("name")
        if not rid:
            print("[WARN] record without id/name skipped")
            continue
        fname = safe_id(rid) + ".json"
        out = dst / fname
        with open(out, "w", encoding="utf-8") as f:
            json.dump(rec, f, ensure_ascii=False, indent=2)
        written += 1

    print(f"Wrote {written} monster files to {dst}")

if __name__ == "__main__":
    main()
