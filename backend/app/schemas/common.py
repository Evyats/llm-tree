from typing import Literal
from pydantic import BaseModel


class Variants(BaseModel):
    short: str
    medium: str
    long: str


class NodePayload(BaseModel):
    id: str
    graph_id: str
    role: Literal["user", "assistant"]
    parent_id: str | None
    text: str
    variants: Variants | None = None
    variant_index: int = 0
    position_x: float
    position_y: float
    mode: str
    highlighted_text: str | None = None


class EdgePayload(BaseModel):
    id: str
    graph_id: str
    source_node_id: str
    target_node_id: str
    edge_type: str
