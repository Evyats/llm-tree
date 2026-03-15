from datetime import datetime, timezone

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.edge import Edge
from app.models.graph import Graph
from app.models.node import Node
from app.schemas.common import EdgePayload, NodePayload
from app.schemas.graph import GraphResponse
from app.services.context import node_display_text
from app.services.errors import InvalidNodeRoleError, NodeNotFoundError, VariantLockedError
from app.services.graph_state import parse_graph_collapsed_state
from app.services.llm import generate_tree_summary_variants
from app.services.layout import Y_STEP
from app.services.payloads import to_edge_payload, to_node_payload
from app.services.variant_retention import prune_assistant_variants


def update_variant_index(db: Session, node_id: str, variant_index: int, lock_selected: bool = False) -> None:
    node = db.get(Node, node_id)
    if node is None:
        raise NodeNotFoundError("Node not found")
    if node.role != "assistant":
        raise InvalidNodeRoleError("Only assistant nodes support variants")
    has_user_child = db.scalar(select(Node.id).where(Node.parent_id == node.id, Node.role == "user").limit(1))
    if has_user_child:
        raise VariantLockedError("Variants are locked after branching from this node")
    if lock_selected:
        prune_assistant_variants(node, variant_index)
    else:
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


def compact_node_subtree(
    db: Session,
    node_id: str,
    runtime_api_key: str | None,
    selected_model: str | None,
) -> tuple[GraphResponse, str, str]:
    root = db.get(Node, node_id)
    if root is None:
        raise NodeNotFoundError("Node not found")

    node_ids = collect_subtree_node_ids(db, root.id)
    subtree_nodes = db.scalars(select(Node).where(Node.id.in_(node_ids)).order_by(Node.created_at)).all()
    children_by_parent: dict[str, list[Node]] = {}
    for node in subtree_nodes:
        if node.parent_id is None or node.parent_id not in node_ids:
            continue
        children_by_parent.setdefault(node.parent_id, []).append(node)
    tree_summary = _build_tree_summary(root, children_by_parent)
    variants, source = generate_tree_summary_variants(
        tree_summary=tree_summary,
        runtime_api_key=runtime_api_key,
        selected_model=selected_model,
    )

    incoming_edge = None
    if root.parent_id:
        incoming_edge = db.scalar(
            select(Edge).where(Edge.source_node_id == root.parent_id, Edge.target_node_id == root.id).limit(1)
        )

    db.execute(
        delete(Edge).where(Edge.source_node_id.in_(node_ids) | Edge.target_node_id.in_(node_ids))
    )
    db.execute(delete(Node).where(Node.id.in_(node_ids)))

    summary_node = Node(
        graph_id=root.graph_id,
        role="assistant",
        parent_id=root.parent_id,
        variant_short=variants.short,
        variant_medium=variants.medium,
        variant_long=variants.long,
        variant_index=0,
        position_x=root.position_x,
        position_y=root.position_y + (Y_STEP * 2),
        mode="summary",
        highlighted_text=None,
    )
    db.add(summary_node)
    db.flush()

    if root.parent_id:
        db.add(
            Edge(
                graph_id=root.graph_id,
                source_node_id=root.parent_id,
                target_node_id=summary_node.id,
                edge_type=incoming_edge.edge_type if incoming_edge else "branch",
            )
        )

    graph = db.get(Graph, root.graph_id)
    if graph is not None:
        graph.updated_at = datetime.now(timezone.utc)

    db.commit()

    graph_nodes = db.scalars(select(Node).where(Node.graph_id == root.graph_id).order_by(Node.created_at)).all()
    graph_edges = db.scalars(select(Edge).where(Edge.graph_id == root.graph_id).order_by(Edge.created_at)).all()
    graph_title = graph.title if graph is not None else "Untitled Graph"
    response = GraphResponse(
        graph_id=root.graph_id,
        title=graph_title,
        title_state=graph.title_state if graph is not None else "untitled",
        nodes=[to_node_payload(node) for node in graph_nodes],
        edges=[to_edge_payload(edge) for edge in graph_edges],
        collapsed_state=parse_graph_collapsed_state(graph) if graph is not None else {"collapsed_targets": [], "collapsed_edge_sources": {}},
    )
    return response, source, summary_node.id


def _build_tree_summary(root: Node, children_by_parent: dict[str, list[Node]]) -> dict:
    branch_count = 0
    leaf_count = 0
    node_count = 0

    def visit(node: Node) -> dict:
        nonlocal branch_count, leaf_count, node_count
        children = children_by_parent.get(node.id, [])
        node_count += 1
        if len(children) > 1:
            branch_count += 1
        if not children:
            leaf_count += 1
        return {
            "role": node.role,
            "text": node_display_text(node),
            "mode": node.mode,
            "children": [visit(child) for child in children],
        }

    tree = visit(root)
    return {
        "root_text": node_display_text(root),
        "node_count": node_count,
        "branch_count": branch_count,
        "leaf_count": leaf_count,
        "tree": tree,
    }
