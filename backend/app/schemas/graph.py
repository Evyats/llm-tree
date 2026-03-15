from pydantic import BaseModel

from app.schemas.common import EdgePayload, NodePayload


class GraphListItem(BaseModel):
    graph_id: str
    title: str
    title_state: str
    updated_at: str


class CreateGraphRequest(BaseModel):
    title: str | None = None


class RenameGraphRequest(BaseModel):
    title: str


class CreateGraphResponse(BaseModel):
    graph_id: str


class GenerateGraphTitleRequest(BaseModel):
    selected_model: str | None = None


class GenerateGraphTitleResponse(BaseModel):
    graph_id: str
    title: str
    title_state: str
    response_source: str


class DeleteGraphsResponse(BaseModel):
    deleted: int


class GraphCollapsedState(BaseModel):
    collapsed_targets: list[str]
    collapsed_edge_sources: dict[str, str]


class UpdateGraphCollapsedStateRequest(BaseModel):
    collapsed_targets: list[str]
    collapsed_edge_sources: dict[str, str]


class GraphResponse(BaseModel):
    graph_id: str
    title: str
    title_state: str
    nodes: list[NodePayload]
    edges: list[EdgePayload]
    collapsed_state: GraphCollapsedState
