from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.edge import Edge
from app.models.graph import Graph
from app.models.node import Node
from app.schemas.message import UpdateVariantRequest

router = APIRouter(prefix="/nodes", tags=["nodes"])


@router.patch("/{node_id}/variant-index")
def update_variant_endpoint(
    node_id: str,
    payload: UpdateVariantRequest,
    db: Session = Depends(get_db),
) -> dict[str, bool]:
    node = db.get(Node, node_id)
    if node is None:
        raise HTTPException(status_code=404, detail="Node not found")
    if node.role != "assistant":
        raise HTTPException(status_code=400, detail="Only assistant nodes support variants")
    has_user_child = db.scalar(
        select(Node.id).where(Node.parent_id == node.id, Node.role == "user").limit(1)
    )
    if has_user_child:
        raise HTTPException(status_code=409, detail="Variants are locked after branching from this node")
    node.variant_index = payload.variant_index
    db.commit()
    return {"ok": True}


@router.delete("/{node_id}/subtree")
def delete_node_subtree_endpoint(
    node_id: str,
    db: Session = Depends(get_db),
) -> dict[str, bool]:
    root = db.get(Node, node_id)
    if root is None:
        raise HTTPException(status_code=404, detail="Node not found")

    node_ids_to_delete: set[str] = {root.id}
    frontier = [root.id]
    while frontier:
        children = db.scalars(select(Node.id).where(Node.parent_id.in_(frontier))).all()
        new_ids = [child_id for child_id in children if child_id not in node_ids_to_delete]
        if not new_ids:
            break
        node_ids_to_delete.update(new_ids)
        frontier = new_ids

    db.execute(
        delete(Edge).where(
            Edge.source_node_id.in_(node_ids_to_delete) | Edge.target_node_id.in_(node_ids_to_delete)
        )
    )
    db.execute(delete(Node).where(Node.id.in_(node_ids_to_delete)))

    graph = db.get(Graph, root.graph_id)
    if graph is not None:
        graph.updated_at = datetime.now(timezone.utc)

    db.commit()
    return {"ok": True}
