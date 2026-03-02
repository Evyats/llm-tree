from pydantic import BaseModel

from app.schemas.common import EdgePayload, NodePayload


class GraphListItem(BaseModel):
    graph_id: str
    title: str
    updated_at: str


class CreateGraphRequest(BaseModel):
    title: str | None = None


class RenameGraphRequest(BaseModel):
    title: str


class CreateGraphResponse(BaseModel):
    graph_id: str


class DeleteGraphsResponse(BaseModel):
    deleted: int


class GraphResponse(BaseModel):
    graph_id: str
    title: str
    nodes: list[NodePayload]
    edges: list[EdgePayload]
