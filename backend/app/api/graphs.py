from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.graph import (
    CreateGraphRequest,
    CreateGraphResponse,
    DeleteGraphsResponse,
    GraphListItem,
    GraphResponse,
    RenameGraphRequest,
)
from app.services.conversation import (
    create_graph,
    delete_all_graphs,
    delete_graph,
    get_graph_payload,
    list_graphs,
    rename_graph,
)

router = APIRouter(prefix="/graphs", tags=["graphs"])


@router.post("", response_model=CreateGraphResponse)
def create_graph_endpoint(payload: CreateGraphRequest, db: Session = Depends(get_db)) -> CreateGraphResponse:
    graph = create_graph(db, payload.title)
    return CreateGraphResponse(graph_id=graph.id)


@router.get("", response_model=list[GraphListItem])
def list_graphs_endpoint(db: Session = Depends(get_db)) -> list[GraphListItem]:
    return [
        GraphListItem(graph_id=graph.id, title=graph.title, updated_at=graph.updated_at.isoformat())
        for graph in list_graphs(db)
    ]


@router.get("/{graph_id}", response_model=GraphResponse)
def get_graph_endpoint(graph_id: str, db: Session = Depends(get_db)) -> GraphResponse:
    try:
        gid, title, nodes, edges = get_graph_payload(db, graph_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return GraphResponse(graph_id=gid, title=title, nodes=nodes, edges=edges)


@router.patch("/{graph_id}", response_model=GraphListItem)
def rename_graph_endpoint(graph_id: str, payload: RenameGraphRequest, db: Session = Depends(get_db)) -> GraphListItem:
    try:
        graph = rename_graph(db, graph_id, payload.title)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return GraphListItem(graph_id=graph.id, title=graph.title, updated_at=graph.updated_at.isoformat())


@router.delete("/{graph_id}")
def delete_graph_endpoint(graph_id: str, db: Session = Depends(get_db)) -> dict[str, bool]:
    try:
        delete_graph(db, graph_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"ok": True}


@router.delete("", response_model=DeleteGraphsResponse)
def delete_all_graphs_endpoint(db: Session = Depends(get_db)) -> DeleteGraphsResponse:
    deleted = delete_all_graphs(db)
    return DeleteGraphsResponse(deleted=deleted)
