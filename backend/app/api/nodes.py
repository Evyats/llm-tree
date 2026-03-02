from fastapi import APIRouter, Depends, HTTPException
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
    node.variant_index = payload.variant_index
    db.commit()
    return {"ok": True}

