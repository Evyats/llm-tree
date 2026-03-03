from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
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
