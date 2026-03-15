from collections.abc import Generator

import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"

from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app import models  # noqa: F401


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    engine = create_engine(
        "sqlite+pysqlite://",
        future=True,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    Base.metadata.create_all(bind=engine)

    def override_get_db() -> Generator[Session, None, None]:
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()


def test_create_graph_and_continue_fallback(client: TestClient) -> None:
    graph = client.post("/api/graphs", json={"title": "T"}).json()
    graph_id = graph["graph_id"]

    response = client.post(
        "/api/messages/continue",
        json={
            "graph_id": graph_id,
            "continue_from_node_id": None,
            "user_text": "What is this?",
            "mode": "normal",
            "highlighted_text": None,
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["response_source"] in {"fallback", "live"}
    assert payload["created_assistant_node"]["variants"]["short"]
    assert payload["created_assistant_node"]["variants"]["medium"]
    assert payload["created_assistant_node"]["variants"]["long"]
    assert payload["transcript_window"][-1]["role"] == "assistant"


def test_elaboration_sets_question_text(client: TestClient) -> None:
    graph_id = client.post("/api/graphs", json={"title": "T"}).json()["graph_id"]
    root = client.post(
        "/api/messages/continue",
        json={
            "graph_id": graph_id,
            "continue_from_node_id": None,
            "user_text": "Root question",
            "mode": "normal",
        },
    ).json()
    anchor = root["created_assistant_node"]["id"]
    selected = "specific claim"
    response = client.post(
        "/api/messages/continue",
        json={
            "graph_id": graph_id,
            "continue_from_node_id": anchor,
            "user_text": "please elaborate",
            "mode": "elaboration",
            "highlighted_text": selected,
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["created_user_node"]["text"] == f"{selected}?"


def test_list_graphs_endpoint(client: TestClient) -> None:
    first = client.post("/api/graphs", json={"title": "First"}).json()["graph_id"]
    second = client.post("/api/graphs", json={"title": "Second"}).json()["graph_id"]

    response = client.get("/api/graphs")
    assert response.status_code == 200
    payload = response.json()
    ids = [item["graph_id"] for item in payload]
    assert first in ids
    assert second in ids


def test_models_endpoint_returns_list_shape(client: TestClient) -> None:
    response = client.get("/api/models")
    assert response.status_code == 200
    payload = response.json()
    assert set(payload.keys()) == {"models"}
    assert isinstance(payload["models"], list)


def test_rename_and_delete_graph_endpoints(client: TestClient) -> None:
    graph_id = client.post("/api/graphs", json={"title": "Old"}).json()["graph_id"]

    renamed = client.patch(f"/api/graphs/{graph_id}", json={"title": "New"}).json()
    assert renamed["title"] == "New"

    delete_response = client.delete(f"/api/graphs/{graph_id}")
    assert delete_response.status_code == 200

    missing = client.get(f"/api/graphs/{graph_id}")
    assert missing.status_code == 404


def test_delete_all_graphs_endpoint(client: TestClient) -> None:
    client.post("/api/graphs", json={"title": "A"})
    client.post("/api/graphs", json={"title": "B"})

    response = client.delete("/api/graphs")
    assert response.status_code == 200
    assert response.json()["deleted"] >= 2

    listed = client.get("/api/graphs").json()
    assert listed == []


def test_delete_subtree_removes_all_descendants(client: TestClient) -> None:
    graph_id = client.post("/api/graphs", json={"title": "Delete subtree"}).json()["graph_id"]
    first = client.post(
        "/api/messages/continue",
        json={
            "graph_id": graph_id,
            "continue_from_node_id": None,
            "user_text": "root",
            "mode": "normal",
        },
    ).json()
    anchor_a = first["created_assistant_node"]["id"]

    second = client.post(
        "/api/messages/continue",
        json={
            "graph_id": graph_id,
            "continue_from_node_id": anchor_a,
            "user_text": "branch-1",
            "mode": "normal",
        },
    ).json()
    anchor_b = second["created_assistant_node"]["id"]

    third = client.post(
        "/api/messages/continue",
        json={
            "graph_id": graph_id,
            "continue_from_node_id": anchor_b,
            "user_text": "branch-2",
            "mode": "normal",
        },
    ).json()
    mid_user = third["created_user_node"]["parent_id"]
    assert mid_user is not None

    delete_response = client.delete(f"/api/nodes/{mid_user}/subtree")
    assert delete_response.status_code == 200

    graph = client.get(f"/api/graphs/{graph_id}").json()
    node_ids = {node["id"] for node in graph["nodes"]}
    assert mid_user not in node_ids
    assert third["created_assistant_node"]["id"] not in node_ids


def test_variant_update_returns_409_after_branching(client: TestClient) -> None:
    graph_id = client.post("/api/graphs", json={"title": "Variant lock"}).json()["graph_id"]
    base = client.post(
        "/api/messages/continue",
        json={
            "graph_id": graph_id,
            "continue_from_node_id": None,
            "user_text": "hello",
            "mode": "normal",
        },
    ).json()
    assistant_id = base["created_assistant_node"]["id"]

    _ = client.post(
        "/api/messages/continue",
        json={
            "graph_id": graph_id,
            "continue_from_node_id": assistant_id,
            "user_text": "child",
            "mode": "normal",
        },
    ).json()

    response = client.patch(f"/api/nodes/{assistant_id}/variant-index", json={"variant_index": 2})
    assert response.status_code == 409


def test_lock_variant_prunes_alternatives_from_graph_payload(client: TestClient) -> None:
    graph_id = client.post("/api/graphs", json={"title": "Lock variant"}).json()["graph_id"]
    base = client.post(
        "/api/messages/continue",
        json={
            "graph_id": graph_id,
            "continue_from_node_id": None,
            "user_text": "hello",
            "mode": "normal",
        },
    ).json()
    assistant_id = base["created_assistant_node"]["id"]

    response = client.patch(
        f"/api/nodes/{assistant_id}/variant-index",
        json={"variant_index": 2, "lock_selected": True},
    )
    assert response.status_code == 200

    graph = client.get(f"/api/graphs/{graph_id}").json()
    assistant = next(node for node in graph["nodes"] if node["id"] == assistant_id)
    assert assistant["variants"] is None
    assert assistant["text"] == base["created_assistant_node"]["variants"]["long"]


def test_branching_prunes_anchor_variants_from_graph_payload(client: TestClient) -> None:
    graph_id = client.post("/api/graphs", json={"title": "Branch prune"}).json()["graph_id"]
    base = client.post(
        "/api/messages/continue",
        json={
            "graph_id": graph_id,
            "continue_from_node_id": None,
            "user_text": "hello",
            "mode": "normal",
        },
    ).json()
    assistant_id = base["created_assistant_node"]["id"]

    branch = client.post(
        "/api/messages/continue",
        json={
            "graph_id": graph_id,
            "continue_from_node_id": assistant_id,
            "continue_from_variant_index": 1,
            "user_text": "child",
            "mode": "normal",
        },
    )
    assert branch.status_code == 200

    graph = client.get(f"/api/graphs/{graph_id}").json()
    assistant = next(node for node in graph["nodes"] if node["id"] == assistant_id)
    assert assistant["variants"] is None
    assert assistant["text"] == base["created_assistant_node"]["variants"]["medium"]


def test_continue_from_null_anchor_creates_disconnected_root_branch(client: TestClient) -> None:
    graph_id = client.post("/api/graphs", json={"title": "Disconnected roots"}).json()["graph_id"]
    _ = client.post(
        "/api/messages/continue",
        json={
            "graph_id": graph_id,
            "continue_from_node_id": None,
            "user_text": "first",
            "mode": "normal",
        },
    ).json()
    second = client.post(
        "/api/messages/continue",
        json={
            "graph_id": graph_id,
            "continue_from_node_id": None,
            "user_text": "second",
            "mode": "normal",
        },
    )
    assert second.status_code == 200
    payload = second.json()
    assert payload["created_user_node"]["parent_id"] is None
    assert len(payload["created_edges"]) == 1
    assert payload["created_edges"][0]["edge_type"] == "reply"


def test_continue_response_transcript_window_has_typed_shape(client: TestClient) -> None:
    graph_id = client.post("/api/graphs", json={"title": "Transcript shape"}).json()["graph_id"]
    response = client.post(
        "/api/messages/continue",
        json={
            "graph_id": graph_id,
            "continue_from_node_id": None,
            "user_text": "shape",
            "mode": "normal",
        },
    )
    assert response.status_code == 200
    payload = response.json()
    transcript = payload["transcript_window"]
    assert isinstance(transcript, list)
    assert transcript
    for line in transcript:
        assert set(line.keys()) == {"role", "content"}
        assert line["role"] in {"user", "assistant"}
        assert isinstance(line["content"], str)


def test_extract_path_creates_new_disconnected_chain(client: TestClient) -> None:
    graph_id = client.post("/api/graphs", json={"title": "Extract path"}).json()["graph_id"]
    first = client.post(
        "/api/messages/continue",
        json={
            "graph_id": graph_id,
            "continue_from_node_id": None,
            "user_text": "root question",
            "mode": "normal",
        },
    ).json()
    a1 = first["created_assistant_node"]["id"]
    second = client.post(
        "/api/messages/continue",
        json={
            "graph_id": graph_id,
            "continue_from_node_id": a1,
            "user_text": "follow up",
            "mode": "normal",
        },
    ).json()
    u2 = second["created_user_node"]["id"]

    extracted = client.post(f"/api/nodes/{u2}/extract-path")
    assert extracted.status_code == 200
    payload = extracted.json()

    created_nodes = payload["created_nodes"]
    created_edges = payload["created_edges"]
    assert len(created_nodes) == 3  # root user -> assistant -> selected user
    assert len(created_edges) == 2
    assert created_nodes[0]["parent_id"] is None
    assert created_nodes[1]["parent_id"] == created_nodes[0]["id"]
    assert created_nodes[2]["parent_id"] == created_nodes[1]["id"]

    graph = client.get(f"/api/graphs/{graph_id}").json()
    all_ids = {node["id"] for node in graph["nodes"]}
    for node in created_nodes:
        assert node["id"] in all_ids


def test_compact_branch_replaces_subtree_with_summary_node(client: TestClient) -> None:
    graph_id = client.post("/api/graphs", json={"title": "Compact branch"}).json()["graph_id"]
    first = client.post(
        "/api/messages/continue",
        json={
            "graph_id": graph_id,
            "continue_from_node_id": None,
            "user_text": "root",
            "mode": "normal",
        },
    ).json()
    root_assistant = first["created_assistant_node"]["id"]
    second = client.post(
        "/api/messages/continue",
        json={
            "graph_id": graph_id,
            "continue_from_node_id": root_assistant,
            "user_text": "branch a",
            "mode": "normal",
        },
    ).json()
    branch_user = second["created_user_node"]["id"]
    _ = client.post(
        "/api/messages/continue",
        json={
            "graph_id": graph_id,
            "continue_from_node_id": root_assistant,
            "user_text": "branch b",
            "mode": "normal",
        },
    ).json()

    compacted = client.post(f"/api/nodes/{branch_user}/compact", json={"selected_model": "fallback"})
    assert compacted.status_code == 200
    payload = compacted.json()
    assert payload["response_source"] == "fallback"
    assert payload["compacted_node_id"]

    graph = client.get(f"/api/graphs/{graph_id}").json()
    node_ids = {node["id"] for node in graph["nodes"]}
    assert branch_user not in node_ids
    assert payload["compacted_node_id"] in node_ids

    summary_node = next(node for node in graph["nodes"] if node["id"] == payload["compacted_node_id"])
    assert summary_node["role"] == "assistant"
    assert summary_node["parent_id"] == root_assistant
    assert summary_node["variants"]["medium"]


def test_graph_collapsed_state_round_trips(client: TestClient) -> None:
    graph_id = client.post("/api/graphs", json={"title": "Collapsed state"}).json()["graph_id"]
    first = client.post(
        "/api/messages/continue",
        json={
            "graph_id": graph_id,
            "continue_from_node_id": None,
            "user_text": "root",
            "mode": "normal",
        },
    ).json()
    root_assistant = first["created_assistant_node"]["id"]
    second = client.post(
        "/api/messages/continue",
        json={
            "graph_id": graph_id,
            "continue_from_node_id": root_assistant,
            "user_text": "branch",
            "mode": "normal",
        },
    ).json()
    branch_user = second["created_user_node"]["id"]

    response = client.put(
        f"/api/graphs/{graph_id}/collapsed-state",
        json={
            "collapsed_targets": [branch_user],
            "collapsed_edge_sources": {branch_user: root_assistant},
        },
    )
    assert response.status_code == 200

    graph = client.get(f"/api/graphs/{graph_id}")
    assert graph.status_code == 200
    payload = graph.json()
    assert payload["collapsed_state"]["collapsed_targets"] == [branch_user]
    assert payload["collapsed_state"]["collapsed_edge_sources"] == {branch_user: root_assistant}


def test_generate_graph_title_uses_short_title_and_returns_source(client: TestClient) -> None:
    graph_id = client.post("/api/graphs", json={"title": "Chat Tree"}).json()["graph_id"]
    client.post(
        "/api/messages/continue",
        json={
            "graph_id": graph_id,
            "continue_from_node_id": None,
            "user_text": "How do I deploy this FastAPI app?",
            "mode": "normal",
        },
    )

    response = client.post(
        f"/api/graphs/{graph_id}/generate-title",
        json={"selected_model": "fallback"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["graph_id"] == graph_id
    assert payload["response_source"] == "fallback"
    assert isinstance(payload["title"], str)
    assert payload["title"]


def test_revise_selected_user_text_replaces_only_target_occurrence(client: TestClient) -> None:
    graph_id = client.post("/api/graphs", json={"title": "Revise text"}).json()["graph_id"]
    created = client.post(
        "/api/messages/continue",
        json={
            "graph_id": graph_id,
            "continue_from_node_id": None,
            "user_text": "teh start and teh end",
            "mode": "normal",
        },
    ).json()
    user_node_id = created["created_user_node"]["id"]

    response = client.post(
        f"/api/nodes/{user_node_id}/revise-selected-text",
        json={
            "selected_text": "teh",
            "occurrence": 1,
            "selected_model": "fallback",
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["response_source"] == "fallback"
    assert payload["updated_node"]["text"] == "teh start and the end"


def test_revise_selected_text_rejects_assistant_nodes(client: TestClient) -> None:
    graph_id = client.post("/api/graphs", json={"title": "Revise role"}).json()["graph_id"]
    created = client.post(
        "/api/messages/continue",
        json={
            "graph_id": graph_id,
            "continue_from_node_id": None,
            "user_text": "hello",
            "mode": "normal",
        },
    ).json()
    assistant_node_id = created["created_assistant_node"]["id"]

    response = client.post(
        f"/api/nodes/{assistant_node_id}/revise-selected-text",
        json={
            "selected_text": "This",
            "occurrence": 0,
            "selected_model": "fallback",
        },
    )
    assert response.status_code == 400
