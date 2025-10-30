# backend/scripts/normalize_json.py
#!/usr/bin/env python3
import json, sys
from pathlib import Path

def norm(path_str: str) -> None:
    p = Path(path_str).expanduser().resolve()
    if not p.exists():
        # silent skip if the caller listed a non-existent file
        return
    with p.open("r", encoding="utf-8") as f:
        data = json.load(f)
    # stable formatting
    text = json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True)
    text += "\n"
    with p.open("w", encoding="utf-8") as f:
        f.write(text)
    print(f"[normalize] {p}")

if __name__ == "__main__":
    targets = sys.argv[1:]
    for t in targets:
        norm(t)
