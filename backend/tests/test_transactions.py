"""Integration tests for transaction endpoints using mongomock-motor."""

import pytest
import pytest_asyncio
from bson import ObjectId
from httpx import ASGITransport, AsyncClient

import app.db as db_module
from app.main import app


@pytest_asyncio.fixture(autouse=True)
async def mock_mongo(monkeypatch):
    """Replace the motor client with a mongomock client for each test."""
    from mongomock_motor import AsyncMongoMockClient

    mock_client = AsyncMongoMockClient()
    monkeypatch.setattr(db_module, "_client", mock_client)
    yield
    # reset so next test gets a fresh db
    monkeypatch.setattr(db_module, "_client", None)


def _auth_headers(sub: str = "user-a-sub", email: str = "a@test.com") -> dict:
    return {"X-Dev-Sub": sub, "X-Dev-Email": email}


@pytest.fixture
def client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.mark.asyncio
async def test_quick_add_creates_transaction(client):
    async with client as c:
        resp = await c.post(
            "/transactions/quick-add",
            json={"text": "swiggy 420 dinner"},
            headers=_auth_headers(),
        )
    assert resp.status_code == 201
    data = resp.json()
    assert data["amount"] == 420.0
    assert data["category"] == "Food"
    assert data["type"] == "expense"


@pytest.mark.asyncio
async def test_quick_add_rejects_no_amount(client):
    async with client as c:
        resp = await c.post(
            "/transactions/quick-add",
            json={"text": "just some text no number"},
            headers=_auth_headers(),
        )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_list_transactions_scoped_to_user(client):
    """User A's transactions must not appear when User B lists their own."""
    async with client as c:
        # User A adds a transaction
        await c.post(
            "/transactions/quick-add",
            json={"text": "netflix 199"},
            headers=_auth_headers("sub-a", "a@test.com"),
        )
        # User B lists transactions — should be empty
        resp = await c.get("/transactions", headers=_auth_headers("sub-b", "b@test.com"))

    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_delete_own_transaction(client):
    async with client as c:
        create = await c.post(
            "/transactions/quick-add",
            json={"text": "coffee 80"},
            headers=_auth_headers(),
        )
        tx_id = create.json()["id"]
        delete = await c.delete(f"/transactions/{tx_id}", headers=_auth_headers())

    assert delete.status_code == 204


@pytest.mark.asyncio
async def test_cannot_delete_other_users_transaction(client):
    async with client as c:
        create = await c.post(
            "/transactions/quick-add",
            json={"text": "coffee 80"},
            headers=_auth_headers("sub-a"),
        )
        tx_id = create.json()["id"]
        delete = await c.delete(
            f"/transactions/{tx_id}", headers=_auth_headers("sub-b")
        )

    assert delete.status_code == 404


@pytest.mark.asyncio
async def test_undo_last(client):
    async with client as c:
        await c.post(
            "/transactions/quick-add",
            json={"text": "petrol 500"},
            headers=_auth_headers(),
        )
        resp = await c.post("/transactions/undo-last", headers=_auth_headers())

    assert resp.status_code == 200
    assert resp.json()["amount"] == 500.0


@pytest.mark.asyncio
async def test_undo_does_not_delete_other_users_last(client):
    """Undo for user B should 404 even if user A has transactions."""
    async with client as c:
        await c.post(
            "/transactions/quick-add",
            json={"text": "uber 150"},
            headers=_auth_headers("sub-a"),
        )
        resp = await c.post("/transactions/undo-last", headers=_auth_headers("sub-b"))

    assert resp.status_code == 404
