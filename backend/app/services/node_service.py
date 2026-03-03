from datetime import datetime, timezone

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.edge import Edge
from app.models.graph import Graph
from app.models.node import Node
from app.services.errors import InvalidNodeRoleError, NodeNotFoundError, VariantLockedError


def update_variant_index(db: Session, node_id: str, variant_index: int) -> None:
    node = db.get(Node, node_id)
    if node is None:
        raise NodeNotFoundError("Node not found")
    if node.role != "assistant":
        raise InvalidNodeRoleError("Only assistant nodes support variants")
    has_user_child = db.scalar(select(Node.id).where(Node.parent_id == node.id, Node.role == "user").limit(1))
    if has_user_child:
        raise VariantLockedError("Variants are locked after branching from this node")
    node.variant_index = variant_index
    db.commit()


def collect_subtree_node_ids(db: Session, root_id: str) -> set[str]:
    node_ids_to_delete: set[str] = {root_id}
    frontier = [root_id]
    while frontier:
        children = db.scalars(select(Node.id).where(Node.parent_id.in_(frontier))).all()
        new_ids = [child_id for child_id in children if child_id not in node_ids_to_delete]
        if not new_ids:
            break
        node_ids_to_delete.update(new_ids)
        frontier = new_ids
    return node_ids_to_delete


def delete_node_subtree(db: Session, node_id: str) -> None:
    root = db.get(Node, node_id)
    if root is None:
        raise NodeNotFoundError("Node not found")

    node_ids_to_delete = collect_subtree_node_ids(db, root.id)
    db.execute(
        delete(Edge).where(Edge.source_node_id.in_(node_ids_to_delete) | Edge.target_node_id.in_(node_ids_to_delete))
    )
    db.execute(delete(Node).where(Node.id.in_(node_ids_to_delete)))

    graph = db.get(Graph, root.graph_id)
    if graph is not None:
        graph.updated_at = datetime.now(timezone.utc)

    db.commit()
