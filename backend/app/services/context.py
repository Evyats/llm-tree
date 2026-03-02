from sqlalchemy.orm import Session

from app.models.node import Node


def node_display_text(node: Node) -> str:
    if node.role == "user":
        return node.user_text or ""
    variants = [node.variant_short or "", node.variant_medium or "", node.variant_long or ""]
    idx = max(0, min(2, node.variant_index))
    chosen = variants[idx]
    if chosen:
        return chosen
    return node.variant_short or node.variant_medium or node.variant_long or ""


def path_to_node(db: Session, node_id: str | None) -> list[Node]:
    if node_id is None:
        return []
    path: list[Node] = []
    current = db.get(Node, node_id)
    while current is not None:
        path.append(current)
        if current.parent_id is None:
            break
        current = db.get(Node, current.parent_id)
    path.reverse()
    return path


def transcript_from_path(path: list[Node]) -> list[dict[str, str]]:
    transcript: list[dict[str, str]] = []
    for node in path:
        transcript.append({"role": node.role, "content": node_display_text(node)})
    return transcript
