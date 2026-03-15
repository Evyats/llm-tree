import json

from app.models.graph import Graph
from app.schemas.graph import GraphCollapsedState


def parse_graph_collapsed_state(graph: Graph) -> GraphCollapsedState:
    collapsed_targets = _load_json_list(graph.collapsed_targets_json, default=[])
    collapsed_edge_sources = _load_json_object(graph.collapsed_edge_sources_json, default={})
    return GraphCollapsedState(
        collapsed_targets=[str(item) for item in collapsed_targets if isinstance(item, str)],
        collapsed_edge_sources={
            str(key): str(value)
            for key, value in collapsed_edge_sources.items()
            if isinstance(key, str) and isinstance(value, str)
        },
    )


def write_graph_collapsed_state(
    graph: Graph,
    collapsed_targets: list[str],
    collapsed_edge_sources: dict[str, str],
) -> None:
    graph.collapsed_targets_json = json.dumps(collapsed_targets)
    graph.collapsed_edge_sources_json = json.dumps(collapsed_edge_sources)


def _load_json_list(raw: str | None, default: list) -> list:
    if not raw:
        return list(default)
    try:
        value = json.loads(raw)
    except json.JSONDecodeError:
        return list(default)
    return value if isinstance(value, list) else list(default)


def _load_json_object(raw: str | None, default: dict) -> dict:
    if not raw:
        return dict(default)
    try:
        value = json.loads(raw)
    except json.JSONDecodeError:
        return dict(default)
    return value if isinstance(value, dict) else dict(default)
