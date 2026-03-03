from datetime import datetime, timezone

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.edge import Edge
from app.models.graph import Graph
from app.models.node import Node
from app.schemas.common import EdgePayload, NodePayload
from app.services.errors import InvalidNodeRoleError, NodeNotFoundError, VariantLockedError
from app.services.payloads import to_edge_payload, to_node_payload


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


def extract_path_to_new_tree(db: Session, node_id: str) -> tuple[list[NodePayload], list[EdgePayload]]:
    target = db.get(Node, node_id)
    if target is None:
        raise NodeNotFoundError("Node not found")

    path: list[Node] = []
    current = target
    while current is not None:
        path.append(current)
        if current.parent_id is None:
            break
        current = db.get(Node, current.parent_id)
    path.reverse()

    graph_nodes = db.scalars(select(Node).where(Node.graph_id == target.graph_id)).all()
    base_x = (max((node.position_x for node in graph_nodes), default=0.0) + 380.0)
    base_y = min((node.position_y for node in graph_nodes), default=100.0)

    created_nodes: list[Node] = []
    prev_new_node_id: str | None = None
    for i, original in enumerate(path):
        clone = Node(
            graph_id=original.graph_id,
            role=original.role,
            parent_id=prev_new_node_id,
            user_text=original.user_text,
            variant_short=original.variant_short,
            variant_medium=original.variant_medium,
            variant_long=original.variant_long,
            variant_index=original.variant_index,
            position_x=base_x,
            position_y=base_y + i * 180.0,
            mode=original.mode,
            highlighted_text=original.highlighted_text,
        )
        db.add(clone)
        db.flush()
        created_nodes.append(clone)
        prev_new_node_id = clone.id

    original_edge_type = {
        (edge.source_node_id, edge.target_node_id): edge.edge_type
        for edge in db.scalars(select(Edge).where(Edge.graph_id == target.graph_id)).all()
    }

    created_edges: list[Edge] = []
    for i in range(1, len(created_nodes)):
        source_original = path[i - 1]
        target_original = path[i]
        edge_type = original_edge_type.get((source_original.id, target_original.id))
        if edge_type is None:
            edge_type = "reply" if target_original.role == "assistant" else "branch"
        edge = Edge(
            graph_id=target.graph_id,
            source_node_id=created_nodes[i - 1].id,
            target_node_id=created_nodes[i].id,
            edge_type=edge_type,
        )
        created_edges.append(edge)

    if created_edges:
        db.add_all(created_edges)

    graph = db.get(Graph, target.graph_id)
    if graph is not None:
        graph.updated_at = datetime.now(timezone.utc)

    db.commit()

    return [to_node_payload(node) for node in created_nodes], [to_edge_payload(edge) for edge in created_edges]
