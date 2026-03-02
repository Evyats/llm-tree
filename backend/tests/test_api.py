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
