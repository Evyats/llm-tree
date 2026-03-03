from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.message import UpdateVariantRequest
from app.services.errors import InvalidNodeRoleError, NodeNotFoundError, VariantLockedError
from app.services.node_service import delete_node_subtree, update_variant_index

router = APIRouter(prefix="/nodes", tags=["nodes"])


@router.patch("/{node_id}/variant-index")
def update_variant_endpoint(
    node_id: str,
    payload: UpdateVariantRequest,
    db: Session = Depends(get_db),
) -> dict[str, bool]:
    try:
        update_variant_index(db, node_id=node_id, variant_index=payload.variant_index)
    except NodeNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except InvalidNodeRoleError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except VariantLockedError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return {"ok": True}


@router.delete("/{node_id}/subtree")
def delete_node_subtree_endpoint(
    node_id: str,
    db: Session = Depends(get_db),
) -> dict[str, bool]:
    try:
        delete_node_subtree(db, node_id=node_id)
    except NodeNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"ok": True}
