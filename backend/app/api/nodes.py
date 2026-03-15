from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_session_id
from app.db.session import get_db
from app.schemas.message import CompactBranchRequest, CompactBranchResponse, ExtractPathResponse, UpdateVariantRequest
from app.services.errors import InvalidNodeRoleError, NodeNotFoundError, VariantLockedError
from app.services.node_service import compact_node_subtree, delete_node_subtree, extract_path_to_new_tree, update_variant_index
from app.services.session_keys import get_api_key

router = APIRouter(prefix="/nodes", tags=["nodes"])


@router.patch("/{node_id}/variant-index")
def update_variant_endpoint(
    node_id: str,
    payload: UpdateVariantRequest,
    db: Session = Depends(get_db),
) -> dict[str, bool]:
    try:
        update_variant_index(
            db,
            node_id=node_id,
            variant_index=payload.variant_index,
            lock_selected=payload.lock_selected,
        )
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


@router.post("/{node_id}/extract-path", response_model=ExtractPathResponse)
def extract_path_endpoint(
    node_id: str,
    db: Session = Depends(get_db),
) -> ExtractPathResponse:
    try:
        nodes, edges = extract_path_to_new_tree(db, node_id=node_id)
    except NodeNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return ExtractPathResponse(created_nodes=nodes, created_edges=edges)


@router.post("/{node_id}/compact", response_model=CompactBranchResponse)
def compact_branch_endpoint(
    node_id: str,
    payload: CompactBranchRequest,
    db: Session = Depends(get_db),
    session_id: str = Depends(get_session_id),
) -> CompactBranchResponse:
    runtime_key = get_api_key(session_id)
    try:
        graph, source, compacted_node_id = compact_node_subtree(
            db=db,
            node_id=node_id,
            runtime_api_key=runtime_key,
            selected_model=payload.selected_model,
        )
    except NodeNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return CompactBranchResponse(
        graph_id=graph.graph_id,
        title=graph.title,
        title_state=graph.title_state,
        nodes=graph.nodes,
        edges=graph.edges,
        response_source=source,
        compacted_node_id=compacted_node_id,
    )
