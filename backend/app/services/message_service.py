from sqlalchemy.orm import Session

from app.schemas.message import ContinueResponse
from app.services.conversation import continue_conversation


def continue_message(
    db: Session,
    graph_id: str,
    continue_from_node_id: str | None,
    continue_from_variant_index: int | None,
    user_text: str,
    mode: str,
    highlighted_text: str | None,
    runtime_api_key: str | None,
) -> ContinueResponse:
    user_node, assistant_node, edges, source, transcript = continue_conversation(
        db=db,
        graph_id=graph_id,
        continue_from_node_id=continue_from_node_id,
        continue_from_variant_index=continue_from_variant_index,
        user_text=user_text,
        mode=mode,
        highlighted_text=highlighted_text,
        runtime_api_key=runtime_api_key,
    )
    return ContinueResponse(
        created_user_node=user_node,
        created_assistant_node=assistant_node,
        created_edges=edges,
        response_source=source,  # type: ignore[arg-type]
        transcript_window=transcript,
    )
