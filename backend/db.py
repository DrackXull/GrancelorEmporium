# backend/db.py
from typing import Generator
from sqlmodel import SQLModel, Session, create_engine
import os, sys

# Resolve backend root (absolute), even if run from different CWDs
BACKEND_ROOT = os.path.abspath(os.path.dirname(__file__))

# Use an absolute SQLite path by default to avoid CWD drift
DEFAULT_DB = f"sqlite:///{os.path.join(BACKEND_ROOT, 'tpka.db')}"

DATABASE_URL = os.getenv("TPKA_DATABASE_URL", DEFAULT_DB)

_engine_kwargs = {}
if DATABASE_URL.startswith("sqlite"):
    _engine_kwargs["connect_args"] = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, echo=False, **_engine_kwargs)

def init_db() -> None:
    # Import models so SQLModel sees them
    import backend.models  # noqa: F401
    SQLModel.metadata.create_all(engine)
    # Tiny startup log to confirm which DB file is in use
    print(f"[db] DATABASE_URL={DATABASE_URL}", file=sys.stderr)

def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
