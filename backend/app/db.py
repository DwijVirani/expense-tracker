"""MongoDB async client and CRUD helpers. Client is module-level so Lambda
warm invocations reuse the same connection pool."""

from datetime import datetime, timezone
from typing import Any

import motor.motor_asyncio
from bson import ObjectId

from app.config import settings

_client: motor.motor_asyncio.AsyncIOMotorClient | None = None


def get_client() -> motor.motor_asyncio.AsyncIOMotorClient:
    global _client
    if _client is None:
        _client = motor.motor_asyncio.AsyncIOMotorClient(settings.mongo_uri)
    return _client


def get_db() -> motor.motor_asyncio.AsyncIOMotorDatabase:
    return get_client()["expense_tracker"]


# ── Users ────────────────────────────────────────────────────────────────────

async def get_user_by_cognito_sub(sub: str) -> dict | None:
    return await get_db()["users"].find_one({"cognito_sub": sub})


async def create_user(sub: str, email: str) -> dict:
    from app.categories import DEFAULT_CATEGORIES

    doc = {
        "cognito_sub": sub,
        "email": email,
        "currency": "₹",
        "monthly_budget": 0,
        "category_budgets": {},
        "categories": {cat: kws for cat, kws in DEFAULT_CATEGORIES.items()},
        "telegram_chat_id": None,
        "created_at": datetime.now(timezone.utc),
    }
    result = await get_db()["users"].insert_one(doc)
    doc["_id"] = result.inserted_id
    return doc


async def get_or_create_user(sub: str, email: str) -> dict:
    user = await get_user_by_cognito_sub(sub)
    if user is None:
        user = await create_user(sub, email)
    return user


async def update_user(user_id: ObjectId, patch: dict) -> None:
    await get_db()["users"].update_one({"_id": user_id}, {"$set": patch})


async def get_user_by_telegram_chat_id(chat_id: int) -> dict | None:
    return await get_db()["users"].find_one({"telegram_chat_id": chat_id})


# ── Transactions ─────────────────────────────────────────────────────────────

async def add_transaction(user_id: ObjectId, tx: dict) -> dict:
    doc: dict[str, Any] = {
        "user_id": user_id,
        "date": tx.get("date", datetime.now(timezone.utc).date().isoformat()),
        "category": tx["category"],
        "amount": tx["amount"],
        "note": tx.get("note", ""),
        "type": tx.get("type", "expense"),
        "source": tx.get("source", "web"),
        "created_at": datetime.now(timezone.utc),
    }
    result = await get_db()["transactions"].insert_one(doc)
    doc["_id"] = result.inserted_id
    return doc


async def undo_last_transaction(user_id: ObjectId) -> dict | None:
    coll = get_db()["transactions"]
    last = await coll.find_one({"user_id": user_id}, sort=[("created_at", -1)])
    if last:
        await coll.delete_one({"_id": last["_id"]})
    return last


async def get_transactions(
    user_id: ObjectId,
    month: str | None = None,
    category: str | None = None,
    tx_type: str | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[dict]:
    filt: dict[str, Any] = {"user_id": user_id}
    if month:
        # month = "YYYY-MM"
        filt["date"] = {"$regex": f"^{month}"}
    if category:
        filt["category"] = category
    if tx_type:
        filt["type"] = tx_type

    cursor = (
        get_db()["transactions"]
        .find(filt)
        .sort("date", -1)
        .skip(skip)
        .limit(limit)
    )
    return await cursor.to_list(length=limit)


async def month_total(user_id: ObjectId, month: str) -> float:
    pipeline = [
        {"$match": {"user_id": user_id, "date": {"$regex": f"^{month}"}, "type": "expense"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
    ]
    result = await get_db()["transactions"].aggregate(pipeline).to_list(length=1)
    return result[0]["total"] if result else 0.0


async def summary(user_id: ObjectId, month: str) -> dict:
    """Aggregate data for the dashboard: total, per-category, daily, MoM."""
    coll = get_db()["transactions"]

    # Current month expenses
    pipeline_cat = [
        {"$match": {"user_id": user_id, "date": {"$regex": f"^{month}"}, "type": "expense"}},
        {"$group": {"_id": "$category", "total": {"$sum": "$amount"}, "count": {"$sum": 1}}},
        {"$sort": {"total": -1}},
    ]
    by_category = await coll.aggregate(pipeline_cat).to_list(length=100)

    # Daily spend
    pipeline_daily = [
        {"$match": {"user_id": user_id, "date": {"$regex": f"^{month}"}, "type": "expense"}},
        {"$group": {"_id": "$date", "total": {"$sum": "$amount"}}},
        {"$sort": {"_id": 1}},
    ]
    daily = await coll.aggregate(pipeline_daily).to_list(length=31)

    # Month-over-month (last 6 months)
    year, mon = int(month[:4]), int(month[5:7])
    months = []
    for i in range(6):
        m = mon - i
        y = year
        while m <= 0:
            m += 12
            y -= 1
        months.append(f"{y}-{m:02d}")

    mom = []
    for m in months:
        total = await month_total(user_id, m)
        mom.append({"month": m, "total": total})

    month_expense_total = sum(r["total"] for r in by_category)

    return {
        "month": month,
        "total_expense": month_expense_total,
        "by_category": [
            {
                "category": r["_id"],
                "total": r["total"],
                "count": r["count"],
                "pct": round(r["total"] / month_expense_total * 100, 1) if month_expense_total else 0,
            }
            for r in by_category
        ],
        "daily": [{"date": r["_id"], "total": r["total"]} for r in daily],
        "month_over_month": list(reversed(mom)),
    }


# ── Link codes ───────────────────────────────────────────────────────────────

async def ensure_indexes() -> None:
    """Call once at app startup to create TTL + unique indexes."""
    users = get_db()["users"]
    await users.create_index("cognito_sub", unique=True)
    await users.create_index("telegram_chat_id", sparse=True)

    txns = get_db()["transactions"]
    await txns.create_index([("user_id", 1), ("date", -1)])

    codes = get_db()["link_codes"]
    await codes.create_index("expires_at", expireAfterSeconds=0)
    await codes.create_index("code", unique=True)
