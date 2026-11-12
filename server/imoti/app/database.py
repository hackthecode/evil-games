"""SQLAlchemy връзка към SQLite базата и създаване на схемата."""
from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from .config import DATA_DIR, settings

# check_same_thread=False е нужно, защото asyncio задачите могат да ползват
# връзката от различни нишки на executor-а; сесиите са краткоживущи.
engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False},
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def init_db() -> None:
    """Създава папката за данни и всички таблици при първо стартиране."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    from . import models  # noqa: F401 — регистрира моделите

    models.Base.metadata.create_all(bind=engine)


def get_session() -> Session:
    """Нова сесия към базата (извикващият я затваря)."""
    return SessionLocal()
