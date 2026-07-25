import pytest
from fastapi.testclient import TestClient

import frame2d.api as api_module
from frame2d.api import app
from frame2d.history_store import (
    DEFAULT_DATABASE_URL,
    ModelHistoryStore,
    parse_mysql_database_url,
)


class InMemoryHistoryStore:
    def __init__(self) -> None:
        self.entries: dict[str, dict] = {}

    def list(self, limit: int = 12) -> list[dict]:
        return sorted(
            self.entries.values(),
            key=lambda entry: entry["savedAt"],
            reverse=True,
        )[:limit]

    def save(self, entry: dict) -> dict:
        self.entries[entry["id"]] = entry
        return entry

    def delete(self, entry_id: str) -> bool:
        return self.entries.pop(entry_id, None) is not None

    def clear(self, source: str | None = None) -> int:
        ids = [
            entry_id
            for entry_id, entry in self.entries.items()
            if source is None or entry["source"] == source
        ]
        for entry_id in ids:
            del self.entries[entry_id]
        return len(ids)


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture(autouse=True)
def isolated_database(monkeypatch) -> None:
    store = InMemoryHistoryStore()
    monkeypatch.setattr(api_module, "ModelHistoryStore", lambda: store)


def test_default_database_url_targets_local_mysql(monkeypatch) -> None:
    monkeypatch.delenv("FRAME2D_DATABASE_URL", raising=False)

    store = ModelHistoryStore()

    assert store.database_url == DEFAULT_DATABASE_URL
    assert store.connection_options == {
        "host": "127.0.0.1",
        "port": 3307,
        "user": "frame2d",
        "password": "frame2d",
        "database": "frame2d",
        "charset": "utf8mb4",
        "connect_timeout": 10,
        "autocommit": False,
    }


def test_mysql_database_url_decodes_credentials_and_options() -> None:
    options = parse_mysql_database_url(
        "mysql+pymysql://frame%402d:p%40ss@db.internal:3308/frame%20studio"
        "?charset=utf8mb4&connect_timeout=4"
    )

    assert options["host"] == "db.internal"
    assert options["port"] == 3308
    assert options["user"] == "frame@2d"
    assert options["password"] == "p@ss"
    assert options["database"] == "frame studio"
    assert options["connect_timeout"] == 4


@pytest.fixture
def cantilever_payload() -> dict:
    return {
        "nodes": [
            {"id": 1, "x": 0.0, "y": 0.0},
            {"id": 2, "x": 2.0, "y": 0.0},
        ],
        "elements": [
            {
                "id": 1,
                "node_i": 1,
                "node_j": 2,
                "E": 200.0,
                "A": 0.02,
                "I": 0.001,
            }
        ],
        "supports": [{"node_id": 1, "u": True, "v": True, "phi": True}],
        "nodal_loads": [{"node_id": 2, "fx": 4.0, "fy": -1.0}],
        "distributed_loads": [
            {"element_id": 1, "qy_i": -0.6, "qy_j": -0.6}
        ],
        "number_of_points": 5,
        "include_plots": False,
    }


def test_health_endpoint(client: TestClient) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_solve_endpoint_returns_results(client: TestClient, cantilever_payload: dict) -> None:
    response = client.post("/api/v1/solve", json=cantilever_payload)

    assert response.status_code == 200
    body = response.json()
    assert body["nodal_displacements"][1]["u"] == pytest.approx(2.0)
    assert body["nodal_displacements"][1]["v"] == pytest.approx(-58.0 / 3.0)
    assert body["nodal_reactions"][0]["fy"] == pytest.approx(2.2)
    assert body["elements"][0]["fields"]["shear_force"][0] == pytest.approx(2.2)
    assert body["elements"][0]["fields"]["bending_moment"][0] == pytest.approx(-3.2)
    assert body["validation"]["passed"]
    assert body["plots"] is None


def test_solve_endpoint_accepts_nodal_moment_and_support_angle(
    client: TestClient,
    cantilever_payload: dict,
) -> None:
    cantilever_payload["supports"][0]["angle"] = 20.0
    cantilever_payload["nodal_loads"] = [{"node_id": 2, "mz": 1.0}]
    cantilever_payload["distributed_loads"] = []

    response = client.post("/api/v1/solve", json=cantilever_payload)

    assert response.status_code == 200
    body = response.json()
    assert body["nodal_displacements"][1]["v"] == pytest.approx(10.0)
    assert body["nodal_displacements"][1]["phi"] == pytest.approx(10.0)
    assert body["nodal_reactions"][0]["mz"] == pytest.approx(-1.0)


def test_solve_endpoint_can_embed_v_and_m_plots(
    client: TestClient,
    cantilever_payload: dict,
) -> None:
    cantilever_payload["include_plots"] = True
    cantilever_payload["plot_dpi"] = 72

    response = client.post("/api/v1/solve", json=cantilever_payload)

    assert response.status_code == 200
    plots = response.json()["plots"]
    assert plots["shear_force_v"]["data_uri"].startswith("data:image/png;base64,")
    assert plots["bending_moment_m"]["data_uri"].startswith(
        "data:image/png;base64,"
    )


def test_plot_endpoint_returns_png(
    client: TestClient,
    cantilever_payload: dict,
) -> None:
    response = client.post("/api/v1/plots/shear-force", json=cantilever_payload)

    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
    assert response.content.startswith(b"\x89PNG\r\n\x1a\n")


def test_unstable_model_returns_422(client: TestClient, cantilever_payload: dict) -> None:
    cantilever_payload["supports"] = []

    response = client.post("/api/v1/solve", json=cantilever_payload)

    assert response.status_code == 422
    assert "singular" in response.json()["detail"]


def test_model_history_is_persisted_listed_and_deleted(client: TestClient) -> None:
    entry = {
        "id": "snapshot-1",
        "name": "Portal frame history",
        "savedAt": "2026-07-17T08:30:00.000Z",
        "source": "saved",
        "model": {
            "name": "Portal frame history",
            "materials": [],
            "sections": [],
            "nodes": [{"id": 1, "x": 0, "y": 0}],
            "elements": [],
            "supports": [],
            "nodal_loads": [],
            "distributed_loads": [],
            "options": {"number_of_points": 101},
        },
    }

    created = client.post("/api/v1/models", json=entry)
    assert created.status_code == 201
    assert created.json() == entry

    listed = client.get("/api/v1/models")
    assert listed.status_code == 200
    assert listed.json() == [entry]

    deleted = client.delete("/api/v1/models/snapshot-1")
    assert deleted.status_code == 204
    assert client.get("/api/v1/models").json() == []


def test_deleting_unknown_model_history_returns_404(client: TestClient) -> None:
    response = client.delete("/api/v1/models/missing")

    assert response.status_code == 404


def test_model_history_can_be_cleared_in_one_request(client: TestClient) -> None:
    for index in range(3):
        entry = {
            "id": f"snapshot-{index}",
            "name": f"Snapshot {index}",
            "savedAt": f"2026-07-17T08:30:0{index}.000Z",
            "source": "saved",
            "model": {"name": f"Snapshot {index}"},
        }
        assert client.post("/api/v1/models", json=entry).status_code == 201

    response = client.delete("/api/v1/models")

    assert response.status_code == 204
    assert client.get("/api/v1/models").json() == []


def test_model_history_can_be_cleared_by_source(client: TestClient) -> None:
    for source in ("saved", "analyzed"):
        entry = {
            "id": f"snapshot-{source}",
            "name": f"Snapshot {source}",
            "savedAt": f"2026-07-17T08:30:00.000Z-{source}",
            "source": source,
            "model": {"name": f"Snapshot {source}"},
        }
        assert client.post("/api/v1/models", json=entry).status_code == 201

    response = client.delete("/api/v1/models?source=saved")

    assert response.status_code == 204
    remaining = client.get("/api/v1/models").json()
    assert [entry["source"] for entry in remaining] == ["analyzed"]
