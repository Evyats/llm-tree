import uuid
from datetime import datetime, timezone
from sqlalchemy import DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Graph(Base):
    __tablename__ = "graphs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title: Mapped[str] = mapped_column(String(255), default="Untitled Graph")
    title_state: Mapped[str] = mapped_column(String(20), default="untitled")
    collapsed_targets_json: Mapped[str] = mapped_column(Text, default="[]")
    collapsed_edge_sources_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    nodes = relationship("Node", back_populates="graph", cascade="all, delete-orphan")
    edges = relationship("Edge", back_populates="graph", cascade="all, delete-orphan")
