from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_session_id
from app.db.session import get_db
from app.schemas.message import ContinueChatRequest, ContinueMessageRequest, ContinueResponse
from app.services.errors import GraphNotFoundError
from app.services.message_service import continue_message
from app.services.session_keys import get_api_key

router = APIRouter(tags=["messages"])


@router.post("/messages/continue", response_model=ContinueResponse)
def continue_message_endpoint(
    payload: ContinueMessageRequest,
    db: Session = Depends(get_db),
    session_id: str = Depends(get_session_id),
) -> ContinueResponse:
    runtime_key = get_api_key(session_id)
    try:
        return continue_message(
            db=db,
            graph_id=payload.graph_id,
            continue_from_node_id=payload.continue_from_node_id,
            continue_from_variant_index=payload.continue_from_variant_index,
            user_text=payload.user_text,
            mode=payload.mode,
            highlighted_text=payload.highlighted_text,
            runtime_api_key=runtime_key,
        )
    except GraphNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/chat/continue", response_model=ContinueResponse)
def continue_chat_endpoint(
    payload: ContinueChatRequest,
    db: Session = Depends(get_db),
    session_id: str = Depends(get_session_id),
) -> ContinueResponse:
    runtime_key = get_api_key(session_id)
    try:
        return continue_message(
            db=db,
            graph_id=payload.graph_id,
            continue_from_node_id=payload.anchor_node_id,
            continue_from_variant_index=payload.anchor_variant_index,
            user_text=payload.user_text,
            mode="normal",
            highlighted_text=None,
            runtime_api_key=runtime_key,
        )
    except GraphNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
