from fastapi import APIRouter, Depends

from app.api.deps import get_session_id
from app.schemas.message import SetApiKeyRequest
from app.services.session_keys import clear_api_key, set_api_key

router = APIRouter(prefix="/session", tags=["session"])


@router.post("/api-key")
def set_api_key_endpoint(payload: SetApiKeyRequest, session_id: str = Depends(get_session_id)) -> dict[str, bool]:
    set_api_key(session_id, payload.api_key)
    return {"ok": True}


@router.delete("/api-key")
def clear_api_key_endpoint(session_id: str = Depends(get_session_id)) -> dict[str, bool]:
    clear_api_key(session_id)
    return {"ok": True}

