from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.node import Node


X_FIXED = 0.0
Y_STEP = 210.0


def next_user_position(db: Session, graph_id: str, parent_id: str | None) -> tuple[float, float]:
    _ = parent_id
    max_y = db.scalar(select(func.max(Node.position_y)).where(Node.graph_id == graph_id))
    return X_FIXED, (max_y + Y_STEP) if max_y is not None else 0.0


def assistant_position(user_x: float, user_y: float) -> tuple[float, float]:
    _ = user_x
    return X_FIXED, user_y + Y_STEP
