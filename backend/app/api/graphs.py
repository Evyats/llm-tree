from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_session_id
from app.db.session import get_db
from app.schemas.graph import (
    CreateGraphRequest,
    CreateGraphResponse,
    DeleteGraphsResponse,
    GenerateGraphTitleRequest,
    GenerateGraphTitleResponse,
    GraphCollapsedState,
    GraphListItem,
    GraphResponse,
    RenameGraphRequest,
    UpdateGraphCollapsedStateRequest,
)
from app.services.conversation import (
    create_graph,
    delete_all_graphs,
    delete_graph,
    generate_graph_title,
    get_graph_payload,
    list_graphs,
    rename_graph,
    update_graph_collapsed_state,
)
from app.services.errors import GraphNotFoundError
from app.services.session_keys import get_api_key

router = APIRouter(prefix="/graphs", tags=["graphs"])


@router.post("", response_model=CreateGraphResponse)
def create_graph_endpoint(payload: CreateGraphRequest, db: Session = Depends(get_db)) -> CreateGraphResponse:
    graph = create_graph(db, payload.title)
    return CreateGraphResponse(graph_id=graph.id)


@router.get("", response_model=list[GraphListItem])
def list_graphs_endpoint(db: Session = Depends(get_db)) -> list[GraphListItem]:
    return [
        GraphListItem(graph_id=graph.id, title=graph.title, title_state=graph.title_state, updated_at=graph.updated_at.isoformat())
        for graph in list_graphs(db)
    ]


@router.get("/{graph_id}", response_model=GraphResponse)
def get_graph_endpoint(graph_id: str, db: Session = Depends(get_db)) -> GraphResponse:
    try:
        gid, title, title_state, nodes, edges, collapsed_state = get_graph_payload(db, graph_id)
    except GraphNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return GraphResponse(graph_id=gid, title=title, title_state=title_state, nodes=nodes, edges=edges, collapsed_state=GraphCollapsedState(**collapsed_state))


@router.patch("/{graph_id}", response_model=GraphListItem)
def rename_graph_endpoint(graph_id: str, payload: RenameGraphRequest, db: Session = Depends(get_db)) -> GraphListItem:
    try:
        graph = rename_graph(db, graph_id, payload.title)
    except GraphNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return GraphListItem(graph_id=graph.id, title=graph.title, title_state=graph.title_state, updated_at=graph.updated_at.isoformat())


@router.post("/{graph_id}/generate-title", response_model=GenerateGraphTitleResponse)
def generate_graph_title_endpoint(
    graph_id: str,
    payload: GenerateGraphTitleRequest,
    db: Session = Depends(get_db),
    session_id: str = Depends(get_session_id),
) -> GenerateGraphTitleResponse:
    runtime_key = get_api_key(session_id)
    try:
        graph, source = generate_graph_title(
            db,
            graph_id=graph_id,
            runtime_api_key=runtime_key,
            selected_model=payload.selected_model,
        )
    except GraphNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return GenerateGraphTitleResponse(graph_id=graph.id, title=graph.title, title_state=graph.title_state, response_source=source)


@router.put("/{graph_id}/collapsed-state", response_model=GraphCollapsedState)
def update_graph_collapsed_state_endpoint(
    graph_id: str,
    payload: UpdateGraphCollapsedStateRequest,
    db: Session = Depends(get_db),
) -> GraphCollapsedState:
    try:
        graph = update_graph_collapsed_state(
            db,
            graph_id=graph_id,
            collapsed_targets=payload.collapsed_targets,
            collapsed_edge_sources=payload.collapsed_edge_sources,
        )
    except GraphNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return GraphCollapsedState(**{
        "collapsed_targets": payload.collapsed_targets,
        "collapsed_edge_sources": payload.collapsed_edge_sources,
    })


@router.delete("/{graph_id}")
def delete_graph_endpoint(graph_id: str, db: Session = Depends(get_db)) -> dict[str, bool]:
    try:
        delete_graph(db, graph_id)
    except GraphNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"ok": True}


@router.delete("", response_model=DeleteGraphsResponse)
def delete_all_graphs_endpoint(db: Session = Depends(get_db)) -> DeleteGraphsResponse:
    deleted = delete_all_graphs(db)
    return DeleteGraphsResponse(deleted=deleted)
