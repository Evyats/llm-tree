from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.edge import Edge
from app.models.graph import Graph
from app.models.node import Node
from app.schemas.graph import GraphResponse
from app.services.graph_state import parse_graph_collapsed_state
from app.services.payloads import to_edge_payload, to_node_payload


def touch_graph(graph: Graph | None) -> None:
    if graph is not None:
        graph.updated_at = datetime.now(timezone.utc)


def list_graph_nodes(db: Session, graph_id: str) -> list[Node]:
    return db.scalars(select(Node).where(Node.graph_id == graph_id).order_by(Node.created_at)).all()


def list_graph_edges(db: Session, graph_id: str) -> list[Edge]:
    return db.scalars(select(Edge).where(Edge.graph_id == graph_id).order_by(Edge.created_at)).all()


def build_graph_response(db: Session, graph: Graph) -> GraphResponse:
    nodes = list_graph_nodes(db, graph.id)
    edges = list_graph_edges(db, graph.id)
    return GraphResponse(
        graph_id=graph.id,
        title=graph.title,
        title_state=graph.title_state,
        nodes=[to_node_payload(node) for node in nodes],
        edges=[to_edge_payload(edge) for edge in edges],
        collapsed_state=parse_graph_collapsed_state(graph),
    )
