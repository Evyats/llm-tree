from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.edge import Edge
from app.models.graph import Graph
from app.models.node import Node
from app.schemas.common import EdgePayload, NodePayload, TranscriptLine
from app.services.context import node_display_text, path_to_node, transcript_from_path
from app.services.errors import GraphNotFoundError
from app.services.graph_state import parse_graph_collapsed_state, write_graph_collapsed_state
from app.services.layout import assistant_position, next_user_position
from app.services.llm import generate_chat_title, generate_variants
from app.services.payloads import to_edge_payload, to_node_payload
from app.services.variant_retention import has_multiple_assistant_variants, prune_assistant_variants


def create_graph(db: Session, title: str | None = None) -> Graph:
    graph = Graph(title=title or "Untitled Graph", title_state="untitled")
    db.add(graph)
    db.commit()
    db.refresh(graph)
    return graph


def get_graph_or_404(db: Session, graph_id: str) -> Graph:
    graph = db.get(Graph, graph_id)
    if graph is None:
        raise GraphNotFoundError("Graph not found")
    return graph


def get_graph_payload(db: Session, graph_id: str) -> tuple[str, str, str, list[NodePayload], list[EdgePayload], dict]:
    graph = get_graph_or_404(db, graph_id)
    nodes = db.scalars(select(Node).where(Node.graph_id == graph.id).order_by(Node.created_at)).all()
    if _prune_fixed_assistant_variants(db, graph.id, nodes):
        graph.updated_at = datetime.now(timezone.utc)
        db.commit()
    edges = db.scalars(select(Edge).where(Edge.graph_id == graph.id).order_by(Edge.created_at)).all()
    collapsed_state = _sanitize_graph_collapsed_state(graph, nodes)
    return graph.id, graph.title, graph.title_state, [to_node_payload(n) for n in nodes], [to_edge_payload(e) for e in edges], collapsed_state.model_dump()


def list_graphs(db: Session) -> list[Graph]:
    return db.scalars(select(Graph).order_by(Graph.updated_at.desc())).all()


def rename_graph(db: Session, graph_id: str, title: str) -> Graph:
    graph = get_graph_or_404(db, graph_id)
    graph.title = title.strip() or "Untitled Graph"
    graph.title_state = "manual"
    graph.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(graph)
    return graph


def generate_graph_title(
    db: Session,
    graph_id: str,
    runtime_api_key: str | None,
    selected_model: str | None,
) -> tuple[Graph, str]:
    graph = get_graph_or_404(db, graph_id)
    nodes = db.scalars(select(Node).where(Node.graph_id == graph.id).order_by(Node.created_at)).all()
    transcript = [
        {"role": node.role, "content": node_display_text(node)}
        for node in nodes[:6]
    ]
    title, source = generate_chat_title(
        transcript=transcript,
        runtime_api_key=runtime_api_key,
        selected_model=selected_model,
    )
    graph.title = title.strip() or "Untitled Chat"
    graph.title_state = "auto"
    graph.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(graph)
    return graph, source


def update_graph_collapsed_state(
    db: Session,
    graph_id: str,
    collapsed_targets: list[str],
    collapsed_edge_sources: dict[str, str],
) -> Graph:
    graph = get_graph_or_404(db, graph_id)
    write_graph_collapsed_state(
        graph,
        collapsed_targets=collapsed_targets,
        collapsed_edge_sources=collapsed_edge_sources,
    )
    graph.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(graph)
    return graph


def delete_graph(db: Session, graph_id: str) -> None:
    graph = get_graph_or_404(db, graph_id)
    db.delete(graph)
    db.commit()


def delete_all_graphs(db: Session) -> int:
    graphs = db.scalars(select(Graph)).all()
    deleted = len(graphs)
    for graph in graphs:
        db.delete(graph)
    db.commit()
    return deleted


def continue_conversation(
    db: Session,
    graph_id: str,
    continue_from_node_id: str | None,
    continue_from_variant_index: int | None,
    user_text: str,
    mode: str,
    highlighted_text: str | None,
    runtime_api_key: str | None,
    selected_model: str | None,
) -> tuple[NodePayload, NodePayload, list[EdgePayload], str, list[TranscriptLine]]:
    graph = get_graph_or_404(db, graph_id)
    _lock_anchor_variant(
        db=db,
        continue_from_node_id=continue_from_node_id,
        continue_from_variant_index=continue_from_variant_index,
    )
    transcript = _build_context_transcript(db, continue_from_node_id)
    stored_user_text, model_user_text = _resolve_user_text(user_text, mode, highlighted_text)
    user_node = _create_user_node(
        db=db,
        graph=graph,
        graph_id=graph_id,
        continue_from_node_id=continue_from_node_id,
        stored_user_text=stored_user_text,
        mode=mode,
        highlighted_text=highlighted_text,
    )
    assistant_node, source = _create_assistant_node(
        db=db,
        graph=graph,
        parent_user_node=user_node,
        transcript=transcript,
        model_user_text=model_user_text,
        mode=mode,
        highlighted_text=highlighted_text,
        runtime_api_key=runtime_api_key,
        selected_model=selected_model,
    )
    edges = _create_edges(db=db, graph=graph, continue_from_node_id=continue_from_node_id, user_node=user_node, assistant_node=assistant_node)

    graph.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user_node)
    db.refresh(assistant_node)

    transcript_window = _build_transcript_window(
        transcript=transcript,
        model_user_text=model_user_text,
        assistant_node=assistant_node,
    )

    return (
        to_node_payload(user_node),
        to_node_payload(assistant_node),
        [to_edge_payload(e) for e in edges],
        source,
        transcript_window,
    )


def _lock_anchor_variant(
    db: Session,
    continue_from_node_id: str | None,
    continue_from_variant_index: int | None,
) -> None:
    if not continue_from_node_id or continue_from_variant_index is None:
        return
    anchor = db.get(Node, continue_from_node_id)
    if anchor is None or anchor.role != "assistant":
        return
    prune_assistant_variants(anchor, continue_from_variant_index)
    db.flush()


def _prune_fixed_assistant_variants(db: Session, graph_id: str, nodes: list[Node]) -> bool:
    assistant_ids_with_user_child = {
        parent_id
        for parent_id in db.scalars(
            select(Node.parent_id).where(Node.graph_id == graph_id, Node.role == "user")
        ).all()
        if parent_id is not None
    }
    changed = False
    for node in nodes:
        if node.role != "assistant":
            continue
        if node.id not in assistant_ids_with_user_child:
            continue
        if not has_multiple_assistant_variants(node):
            continue
        prune_assistant_variants(node)
        changed = True
    if changed:
        db.flush()
    return changed


def _sanitize_graph_collapsed_state(graph: Graph, nodes: list[Node]):
    state = parse_graph_collapsed_state(graph)
    existing_ids = {node.id for node in nodes}
    collapsed_targets = [node_id for node_id in state.collapsed_targets if node_id in existing_ids]
    collapsed_edge_sources = {
        target_id: source_id
        for target_id, source_id in state.collapsed_edge_sources.items()
        if target_id in existing_ids and source_id in existing_ids and target_id in collapsed_targets
    }
    if (
        collapsed_targets != state.collapsed_targets
        or collapsed_edge_sources != state.collapsed_edge_sources
    ):
        write_graph_collapsed_state(graph, collapsed_targets, collapsed_edge_sources)
        graph.updated_at = datetime.now(timezone.utc)
        db.commit()
    return parse_graph_collapsed_state(graph)


def _build_context_transcript(db: Session, continue_from_node_id: str | None) -> list[dict[str, str]]:
    context_path = path_to_node(db, continue_from_node_id)
    return transcript_from_path(context_path)


def _resolve_user_text(user_text: str, mode: str, highlighted_text: str | None) -> tuple[str, str]:
    stored_user_text = user_text
    model_user_text = user_text
    if mode == "elaboration" and highlighted_text:
        stored_user_text = f"{highlighted_text}?"
        model_user_text = stored_user_text
    return stored_user_text, model_user_text


def _create_user_node(
    db: Session,
    graph: Graph,
    graph_id: str,
    continue_from_node_id: str | None,
    stored_user_text: str,
    mode: str,
    highlighted_text: str | None,
) -> Node:
    ux, uy = next_user_position(db, graph_id, continue_from_node_id)
    user_node = Node(
        graph_id=graph.id,
        role="user",
        parent_id=continue_from_node_id,
        user_text=stored_user_text,
        position_x=ux,
        position_y=uy,
        mode=mode,
        highlighted_text=highlighted_text,
    )
    db.add(user_node)
    db.flush()
    return user_node


def _create_assistant_node(
    db: Session,
    graph: Graph,
    parent_user_node: Node,
    transcript: list[dict[str, str]],
    model_user_text: str,
    mode: str,
    highlighted_text: str | None,
    runtime_api_key: str | None,
    selected_model: str | None,
) -> tuple[Node, str]:
    variants, source = generate_variants(
        transcript=transcript,
        user_text=model_user_text,
        mode=mode,
        highlighted_text=highlighted_text,
        runtime_api_key=runtime_api_key,
        selected_model=selected_model,
    )
    ax, ay = assistant_position(parent_user_node.position_x, parent_user_node.position_y)
    assistant_node = Node(
        graph_id=graph.id,
        role="assistant",
        parent_id=parent_user_node.id,
        variant_short=variants.short,
        variant_medium=variants.medium,
        variant_long=variants.long,
        variant_index=0,
        position_x=ax,
        position_y=ay,
        mode=mode,
        highlighted_text=highlighted_text,
    )
    db.add(assistant_node)
    db.flush()
    return assistant_node, source


def _create_edges(
    db: Session,
    graph: Graph,
    continue_from_node_id: str | None,
    user_node: Node,
    assistant_node: Node,
) -> list[Edge]:
    edges: list[Edge] = []
    if continue_from_node_id:
        edges.append(
            Edge(
                graph_id=graph.id,
                source_node_id=continue_from_node_id,
                target_node_id=user_node.id,
                edge_type="branch",
            )
        )
    edges.append(
        Edge(
            graph_id=graph.id,
            source_node_id=user_node.id,
            target_node_id=assistant_node.id,
            edge_type="reply",
        )
    )
    db.add_all(edges)
    return edges


def _build_transcript_window(
    transcript: list[dict[str, str]],
    model_user_text: str,
    assistant_node: Node,
) -> list[TranscriptLine]:
    combined = transcript + [
        {"role": "user", "content": model_user_text},
        {"role": "assistant", "content": node_display_text(assistant_node)},
    ]
    result: list[TranscriptLine] = []
    for item in combined:
        role = item.get("role", "")
        content = item.get("content", "")
        if role not in {"user", "assistant"}:
            continue
        result.append(TranscriptLine(role=role, content=content))
    return result
