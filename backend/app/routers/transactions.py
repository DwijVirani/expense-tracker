from datetime import datetime, timezone
from typing import Annotated

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from app import db
from app.auth import get_current_user
from app.parser import parse_message

router = APIRouter(prefix="/transactions", tags=["transactions"])

UserDep = Annotated[dict, Depends(get_current_user)]


def _serialize(doc: dict) -> dict:
    doc = dict(doc)
    doc["id"] = str(doc.pop("_id"))
    doc["user_id"] = str(doc["user_id"])
    return doc


class QuickAddIn(BaseModel):
    text: str


class TransactionIn(BaseModel):
    date: str | None = None
    category: str
    amount: float
    note: str = ""
    type: str = "expense"
    source: str = "web"


class TransactionPatch(BaseModel):
    category: str | None = None
    amount: float | None = None
    note: str | None = None
    date: str | None = None


@router.post("/quick-add", status_code=status.HTTP_201_CREATED)
async def quick_add(body: QuickAddIn, user: UserDep):
    parsed = parse_message(body.text, user.get("categories"))
    if parsed.amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Could not parse an amount from the message",
        )
    tx = await db.add_transaction(
        user["_id"],
        {
            "amount": parsed.amount,
            "category": parsed.category,
            "note": parsed.note,
            "type": parsed.type,
            "source": "web",
        },
    )
    return _serialize(tx)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_transaction(body: TransactionIn, user: UserDep):
    tx = await db.add_transaction(user["_id"], body.model_dump())
    return _serialize(tx)


@router.patch("/{tx_id}")
async def update_transaction(tx_id: str, body: TransactionPatch, user: UserDep):
    coll = db.get_db()["transactions"]
    existing = await coll.find_one({"_id": ObjectId(tx_id), "user_id": user["_id"]})
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    patch = {k: v for k, v in body.model_dump().items() if v is not None}
    await coll.update_one({"_id": ObjectId(tx_id)}, {"$set": patch})
    updated = await coll.find_one({"_id": ObjectId(tx_id)})
    return _serialize(updated)


@router.delete("/{tx_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transaction(tx_id: str, user: UserDep):
    coll = db.get_db()["transactions"]
    result = await coll.delete_one({"_id": ObjectId(tx_id), "user_id": user["_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)


@router.post("/undo-last")
async def undo_last(user: UserDep):
    deleted = await db.undo_last_transaction(user["_id"])
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No transactions to undo")
    return _serialize(deleted)


@router.get("")
async def list_transactions(
    user: UserDep,
    month: str | None = Query(None, description="YYYY-MM"),
    category: str | None = None,
    type: str | None = None,
    skip: int = 0,
    limit: int = 100,
):
    txns = await db.get_transactions(
        user["_id"], month=month, category=category, tx_type=type, skip=skip, limit=limit
    )
    return [_serialize(t) for t in txns]


@router.get("/summary")
async def get_summary(
    user: UserDep,
    month: str = Query(
        default_factory=lambda: datetime.now(timezone.utc).strftime("%Y-%m"),
        description="YYYY-MM",
    ),
):
    return await db.summary(user["_id"], month)
