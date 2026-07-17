import pytest
from concurrent.futures import ThreadPoolExecutor
from fastapi.testclient import TestClient

from frame2d.api import app
from frame2d.history_store import ModelHistoryStore


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture(autouse=True)
def isolated_database(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("FRAME2D_DB_PATH", str(tmp_path / "frame2d-test.sqlite3"))


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


def test_model_history_handles_concurrent_first_writes(tmp_path) -> None:
    database_path = tmp_path / "concurrent.sqlite3"

    def save(index: int) -> None:
        ModelHistoryStore(database_path).save(
            {
                "id": f"snapshot-{index}",
                "name": f"Snapshot {index}",
                "savedAt": f"2026-07-17T08:30:{index:02d}.000Z",
                "source": "saved",
                "model": {"name": f"Snapshot {index}"},
            }
        )

    with ThreadPoolExecutor(max_workers=6) as executor:
        list(executor.map(save, range(6)))

    assert len(ModelHistoryStore(database_path).list()) == 6
