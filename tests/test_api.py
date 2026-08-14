import pytest
from fastapi.testclient import TestClient

import frame2d.api as api_module
from frame2d.api import app
from frame2d.auth_store import DuplicateEmailError, hash_password, verify_password
from frame2d.history_store import (
    DEFAULT_DATABASE_URL,
    ModelHistoryStore,
    parse_mysql_database_url,
)


class InMemoryHistoryStore:
    def __init__(self) -> None:
        self.entries: dict[tuple[str, str], dict] = {}

    def list(self, user_id: str, limit: int = 12) -> list[dict]:
        return sorted(
            (
                entry
                for (owner_id, _), entry in self.entries.items()
                if owner_id == user_id
            ),
            key=lambda entry: entry["savedAt"],
            reverse=True,
        )[:limit]

    def save(self, user_id: str, entry: dict) -> dict:
        self.entries[(user_id, entry["id"])] = entry
        return entry

    def delete(self, user_id: str, entry_id: str) -> bool:
        return self.entries.pop((user_id, entry_id), None) is not None

    def clear(self, user_id: str, source: str | None = None) -> int:
        ids = [
            key
            for key, entry in self.entries.items()
            if key[0] == user_id and (source is None or entry["source"] == source)
        ]
        for key in ids:
            del self.entries[key]
        return len(ids)


class InMemoryAuthStore:
    def __init__(self) -> None:
        self.users: dict[str, dict[str, str]] = {}
        self.passwords: dict[str, str] = {}
        self.sessions: dict[str, str] = {}

    def register(self, email: str, display_name: str, password: str) -> dict[str, str]:
        canonical_email = email.strip().casefold()
        if canonical_email in self.users:
            raise DuplicateEmailError("An account with this email already exists")
        user = {
            "id": f"user-{len(self.users) + 1}",
            "email": canonical_email,
            "displayName": display_name.strip(),
            "createdAt": "2026-08-13T10:00:00.000Z",
        }
        self.users[canonical_email] = user
        self.passwords[canonical_email] = password
        return user

    def authenticate(self, email: str, password: str) -> dict[str, str] | None:
        canonical_email = email.strip().casefold()
        if self.passwords.get(canonical_email) != password:
            return None
        return self.users[canonical_email]

    def create_session(self, user_id: str) -> str:
        token = f"token-{user_id}-{len(self.sessions) + 1}"
        self.sessions[token] = user_id
        return token

    def user_for_session(self, token: str) -> dict[str, str] | None:
        user_id = self.sessions.get(token)
        return next((user for user in self.users.values() if user["id"] == user_id), None)

    def delete_session(self, token: str) -> None:
        self.sessions.pop(token, None)


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def authenticated_client(client: TestClient) -> TestClient:
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "engineer@example.com",
            "displayName": "Frame Engineer",
            "password": "strong-password",
        },
    )
    assert response.status_code == 201
    return client


@pytest.fixture(autouse=True)
def isolated_database(monkeypatch) -> None:
    history_store = InMemoryHistoryStore()
    auth_store = InMemoryAuthStore()
    monkeypatch.setattr(api_module, "ModelHistoryStore", lambda: history_store)
    monkeypatch.setattr(api_module, "AuthStore", lambda: auth_store)


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


def test_password_hash_is_salted_and_verifiable() -> None:
    first = hash_password("strong-password")
    second = hash_password("strong-password")

    assert first != second
    assert verify_password("strong-password", first)
    assert not verify_password("wrong-password", first)


def test_register_session_logout_and_login(client: TestClient) -> None:
    registered = client.post(
        "/api/v1/auth/register",
        json={
            "email": " Owner@Example.com ",
            "displayName": "Model Owner",
            "password": "strong-password",
        },
    )
    assert registered.status_code == 201
    assert registered.json()["email"] == "owner@example.com"
    assert registered.json()["displayName"] == "Model Owner"
    assert "HttpOnly" in registered.headers["set-cookie"]
    assert client.get("/api/v1/auth/me").json() == registered.json()

    assert client.post("/api/v1/auth/logout").status_code == 204
    assert client.get("/api/v1/auth/me").status_code == 401

    invalid = client.post(
        "/api/v1/auth/login",
        json={"email": "owner@example.com", "password": "wrong-password"},
    )
    assert invalid.status_code == 401

    logged_in = client.post(
        "/api/v1/auth/login",
        json={"email": "owner@example.com", "password": "strong-password"},
    )
    assert logged_in.status_code == 200
    assert client.get("/api/v1/auth/me").status_code == 200


def test_duplicate_registration_is_rejected(client: TestClient) -> None:
    payload = {
        "email": "owner@example.com",
        "displayName": "Model Owner",
        "password": "strong-password",
    }
    assert client.post("/api/v1/auth/register", json=payload).status_code == 201
    assert client.post("/api/v1/auth/register", json=payload).status_code == 409


def test_guest_can_solve_but_cannot_access_model_storage(
    client: TestClient,
    cantilever_payload: dict,
) -> None:
    assert client.post("/api/v1/solve", json=cantilever_payload).status_code == 200
    assert client.get("/api/v1/models").status_code == 401
    assert client.post("/api/v1/models", json={}).status_code == 401


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


def test_model_history_is_persisted_listed_and_deleted(authenticated_client: TestClient) -> None:
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

    created = authenticated_client.post("/api/v1/models", json=entry)
    assert created.status_code == 201
    assert created.json() == entry

    listed = authenticated_client.get("/api/v1/models")
    assert listed.status_code == 200
    assert listed.json() == [entry]

    deleted = authenticated_client.delete("/api/v1/models/snapshot-1")
    assert deleted.status_code == 204
    assert authenticated_client.get("/api/v1/models").json() == []


def test_deleting_unknown_model_history_returns_404(authenticated_client: TestClient) -> None:
    response = authenticated_client.delete("/api/v1/models/missing")

    assert response.status_code == 404


def test_model_history_can_be_cleared_in_one_request(authenticated_client: TestClient) -> None:
    for index in range(3):
        entry = {
            "id": f"snapshot-{index}",
            "name": f"Snapshot {index}",
            "savedAt": f"2026-07-17T08:30:0{index}.000Z",
            "source": "saved",
            "model": {"name": f"Snapshot {index}"},
        }
        assert authenticated_client.post("/api/v1/models", json=entry).status_code == 201

    response = authenticated_client.delete("/api/v1/models")

    assert response.status_code == 204
    assert authenticated_client.get("/api/v1/models").json() == []


def test_model_history_can_be_cleared_by_source(authenticated_client: TestClient) -> None:
    for source in ("saved", "analyzed"):
        entry = {
            "id": f"snapshot-{source}",
            "name": f"Snapshot {source}",
            "savedAt": f"2026-07-17T08:30:00.000Z-{source}",
            "source": source,
            "model": {"name": f"Snapshot {source}"},
        }
        assert authenticated_client.post("/api/v1/models", json=entry).status_code == 201

    response = authenticated_client.delete("/api/v1/models?source=saved")

    assert response.status_code == 204
    remaining = authenticated_client.get("/api/v1/models").json()
    assert [entry["source"] for entry in remaining] == ["analyzed"]


def test_model_history_is_isolated_between_users() -> None:
    shared_id = "same-client-generated-id"
    alice_entry = {
        "id": shared_id,
        "name": "Alice frame",
        "savedAt": "2026-08-13T10:00:00.000Z",
        "source": "saved",
        "model": {"name": "Alice frame"},
    }
    bob_entry = {
        **alice_entry,
        "name": "Bob frame",
        "model": {"name": "Bob frame"},
    }

    with TestClient(app) as alice, TestClient(app) as bob:
        assert alice.post(
            "/api/v1/auth/register",
            json={
                "email": "alice@example.com",
                "displayName": "Alice",
                "password": "alice-password",
            },
        ).status_code == 201
        assert bob.post(
            "/api/v1/auth/register",
            json={
                "email": "bob@example.com",
                "displayName": "Bob",
                "password": "bob-password",
            },
        ).status_code == 201

        assert alice.post("/api/v1/models", json=alice_entry).status_code == 201
        assert bob.get("/api/v1/models").json() == []
        assert bob.delete(f"/api/v1/models/{shared_id}").status_code == 404
        assert bob.post("/api/v1/models", json=bob_entry).status_code == 201

        assert alice.get("/api/v1/models").json()[0]["name"] == "Alice frame"
        assert bob.get("/api/v1/models").json()[0]["name"] == "Bob frame"
