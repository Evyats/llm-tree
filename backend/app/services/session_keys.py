from threading import Lock


_store: dict[str, str] = {}
_lock = Lock()


def normalize_session_id(raw_session_id: str | None, client_host: str | None) -> str:
    if raw_session_id:
        return raw_session_id
    host = client_host or "anonymous"
    return f"anon-{host}"


def set_api_key(session_id: str, api_key: str) -> None:
    with _lock:
        _store[session_id] = api_key


def clear_api_key(session_id: str) -> None:
    with _lock:
        _store.pop(session_id, None)


def get_api_key(session_id: str) -> str | None:
    with _lock:
        return _store.get(session_id)
