# backend/data_layers.py
from __future__ import annotations
import os, json, glob, re
from typing import List, Dict, Any, Iterable, Tuple, Optional

# ---------- tolerant readers ----------

def _strip_js_wrapper(text: str) -> str:
    s = text.strip()
    if s.startswith("export default"):
        s = s[len("export default"):].strip()
    elif s.startswith("module.exports"):
        eq = s.find("=")
        if eq != -1:
            s = s[eq+1:].strip()
    if s.endswith(";"):
        s = s[:-1].strip()
    return s

def _read_json_file(path: str) -> Any:
    try:
        with open(path, "r", encoding="utf-8") as f:
            raw = f.read()
        if path.endswith(".js"):
            raw = _strip_js_wrapper(raw)
        return json.loads(raw)
    except FileNotFoundError:
        return None
    except Exception:
        # be quiet at runtime, upstream callers can decide how to handle None
        return None

# ---------- layer iteration & merge ----------

def _iter_layer_files(layer_root: str, names: Iterable[str]) -> Iterable[Tuple[str, Any]]:
    """Yield (name, data) for each requested file/collection found in layer_root."""
    if not layer_root or not os.path.isdir(layer_root):
        return
    for name in names:
        data: Optional[Any] = None

        # 1) flat file (supports .json and .js)
        base, ext = os.path.splitext(name)  # e.g., "classes", ".json"
        candidates = []
        # honor explicit extension first; otherwise try both json/js
        if ext:
            candidates.append(os.path.join(layer_root, name))
        else:
            candidates.append(os.path.join(layer_root, f"{base}.json"))
            candidates.append(os.path.join(layer_root, f"{base}.js"))

        for p in candidates:
            if os.path.isfile(p):
                data = _read_json_file(p)
                break

        if data is not None:
            # accept array[] or object{} or wrapper {"classes":[...]}
            if isinstance(data, dict):
                wrapped = data.get(base)
                if isinstance(wrapped, list):
                    data = wrapped
                else:
                    # plain map of id->record -> collapse to list
                    vals = list(data.values())
                    if vals and all(isinstance(v, dict) for v in vals):
                        data = vals
            yield (name, data)

        # 2) folder collection (e.g., monsters/*.json)
        folder = os.path.join(layer_root, base)
        if os.path.isdir(folder):
            items: List[Dict[str, Any]] = []
            for fp in sorted(glob.glob(os.path.join(folder, "*.json"))):
                d = _read_json_file(fp)
                if isinstance(d, dict):
                    items.append(d)
                elif isinstance(d, list):
                    items.extend([x for x in d if isinstance(x, dict)])
            if items:
                yield (name, items)

def _key_of(rec: Dict[str, Any]) -> Optional[str]:
    return rec.get("id") or rec.get("name")

def _merge_arrays(arrays: List[List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
    by_id: Dict[str, Dict[str, Any]] = {}
    for arr in arrays:
        if not isinstance(arr, list):
            continue
        for r in arr:
            if not isinstance(r, dict):
                continue
            k = _key_of(r)
            if not k:
                continue
            cur = by_id.get(k, {})
            cur.update(r)  # last-writer-wins per field
            by_id[k] = cur
    return list(by_id.values())

# ---------- public API ----------

def build_layers(backend_root: str, ruleset: str, campaign: str | None) -> List[str]:
    d = lambda *p: os.path.join(backend_root, "data", *p)
    layers = []
    # 1) system base
    layers.append(d("systems", ruleset))
    # 2) system homebrew (optional)
    layers.append(d("systems", ruleset, "homebrew"))
    # 3) campaign system folder
    if campaign:
        layers.append(d("campaigns", campaign, ruleset))
        # 4) campaign shared
        layers.append(d("campaigns", campaign, "shared"))
    # 5) runtime overrides (as read-only layer data; JSON merging of overrides happens elsewhere)
    layers.append(d("runtime", "overrides", ruleset))
    return [p for p in layers if os.path.isdir(p)]

def load_collections(backend_root: str, ruleset: str, campaign: str | None, names: List[str]) -> Dict[str, List[Dict[str, Any]]]:
    layers = build_layers(backend_root, ruleset, campaign)
    out: Dict[str, List[Dict[str, Any]]] = {}
    for name in names:
        arrays: List[List[Dict[str, Any]]] = []
        for layer in layers:
            for fname, data in _iter_layer_files(layer, [name]):
                if fname != name:
                    continue
                if isinstance(data, list):
                    arrays.append(data)
                elif isinstance(data, dict):
                    arrays.append([data])
        out[name] = _merge_arrays(arrays)
    return out
