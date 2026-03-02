from fastapi import Header, Request

from app.services.session_keys import normalize_session_id


def get_session_id(request: Request, x_session_id: str | None = Header(default=None)) -> str:
    client_host = request.client.host if request.client else None
    return normalize_session_id(x_session_id, client_host)

