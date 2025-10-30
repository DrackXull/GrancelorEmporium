# backend/compat_imports.py
from typing import Any
from backend import models as M
from backend.db import init_db, get_session, engine

"""
compat_imports: safe imports for models + db access no matter how uvicorn loads us.

Usage in main.py:
    from backend.compat_imports import get_session, init_db, M
"""
# Models
try:
    from . import models as M  # package-style
except Exception:  # pragma: no cover
    import backend.models as M  # type: ignore

# DB helpers
try:
    from .db import get_session, init_db
except Exception:  # pragma: no cover
    from backend.db import get_session, init_db  # type: ignore
