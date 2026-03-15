from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.node import Node


def collect_subtree_node_ids(db: Session, root_id: str) -> set[str]:
    node_ids: set[str] = {root_id}
    frontier = [root_id]
    while frontier:
        children = db.scalars(select(Node.id).where(Node.parent_id.in_(frontier))).all()
        new_ids = [child_id for child_id in children if child_id not in node_ids]
        if not new_ids:
            break
        node_ids.update(new_ids)
        frontier = new_ids
    return node_ids


def build_path_to_root(db: Session, node: Node) -> list[Node]:
    path: list[Node] = []
    current: Node | None = node
    while current is not None:
        path.append(current)
        if current.parent_id is None:
            break
        current = db.get(Node, current.parent_id)
    path.reverse()
    return path
