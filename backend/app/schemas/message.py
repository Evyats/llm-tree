from typing import Literal
from pydantic import BaseModel, Field

from app.schemas.common import EdgePayload, NodePayload, TranscriptLine


class ContinueMessageRequest(BaseModel):
    graph_id: str
    continue_from_node_id: str | None = None
    continue_from_variant_index: int | None = Field(default=None, ge=0, le=2)
    user_text: str = Field(min_length=1)
    mode: Literal["normal", "elaboration"] = "normal"
    highlighted_text: str | None = None


class ContinueChatRequest(BaseModel):
    graph_id: str
    anchor_node_id: str
    anchor_variant_index: int | None = Field(default=None, ge=0, le=2)
    user_text: str = Field(min_length=1)


class ContinueResponse(BaseModel):
    created_user_node: NodePayload
    created_assistant_node: NodePayload
    created_edges: list[EdgePayload]
    response_source: Literal["live", "fallback"]
    transcript_window: list[TranscriptLine] | None = None


class ExtractPathResponse(BaseModel):
    created_nodes: list[NodePayload]
    created_edges: list[EdgePayload]


class SetApiKeyRequest(BaseModel):
    api_key: str = Field(min_length=10)


class UpdateVariantRequest(BaseModel):
    variant_index: int = Field(ge=0, le=2)
