"""Routes called by the Telegram bot only. Authenticated via X-Service-Token."""

from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from app import db
from app.parser import parse_message
from app.service_auth import require_service_token
from app.utils.logging import get_logger

logger = get_logger(__name__)

router = APIRouter(
    prefix="/telegram",
    tags=["telegram"],
    dependencies=[Depends(require_service_token)],
)


class LinkIn(BaseModel):
    code: str
    chat_id: int


class MessageIn(BaseModel):
    chat_id: int
    text: str


class UndoIn(BaseModel):
    chat_id: int


@router.post("/resolve-link")
async def resolve_link(body: LinkIn):
    codes = db.get_db()["link_codes"]
    entry = await codes.find_one(
        {
            "code": body.code,
            "used": False,
            "expires_at": {"$gt": datetime.now(timezone.utc)},
        }
    )
    if not entry:
        logger.warning("telegram link failed, invalid or expired code", code=body.code)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Invalid or expired code"
        )

    await db.update_user(entry["user_id"], {"telegram_chat_id": body.chat_id})
    await codes.update_one({"_id": entry["_id"]}, {"$set": {"used": True}})
    logger.info("telegram chat linked", user_id=entry["user_id"], chat_id=body.chat_id)
    return {"ok": True}


@router.post("/message")
async def handle_message(body: MessageIn):
    user = await db.get_user_by_telegram_chat_id(body.chat_id)
    if not user:
        logger.warning(
            "telegram message rejected, chat not linked", chat_id=body.chat_id
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Chat ID not linked"
        )

    parsed = parse_message(body.text, user.get("categories"))
    if parsed.amount <= 0:
        logger.warning(
            "telegram message parse failed", user_id=user["_id"], text=body.text
        )
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Could not parse an amount",
        )

    tx = await db.add_transaction(
        user["_id"],
        {
            "amount": parsed.amount,
            "category": parsed.category,
            "note": parsed.note,
            "type": parsed.type,
            "source": "telegram",
        },
    )
    logger.info(
        "transaction created via telegram",
        user_id=user["_id"],
        tx_id=tx["_id"],
        category=parsed.category,
    )

    month = datetime.now(timezone.utc).strftime("%Y-%m")
    total = await db.month_total(user["_id"], month)
    budget = user.get("monthly_budget", 0)

    return {
        "transaction_id": str(tx["_id"]),
        "amount": parsed.amount,
        "category": parsed.category,
        "note": parsed.note,
        "type": parsed.type,
        "month_total": total,
        "monthly_budget": budget,
        "currency": user.get("currency", "₹"),
    }


@router.post("/undo")
async def undo(body: UndoIn):
    user = await db.get_user_by_telegram_chat_id(body.chat_id)
    if not user:
        logger.warning("telegram undo rejected, chat not linked", chat_id=body.chat_id)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Chat ID not linked"
        )
    deleted = await db.undo_last_transaction(user["_id"])
    if not deleted:
        logger.warning(
            "telegram undo failed, no transactions found", user_id=user["_id"]
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="No transactions to undo"
        )
    logger.info(
        "transaction undone via telegram", user_id=user["_id"], tx_id=deleted["_id"]
    )
    return {
        "ok": True,
        "deleted_amount": deleted["amount"],
        "deleted_category": deleted["category"],
    }


@router.get("/total")
async def get_total(chat_id: int = Query(...)):
    user = await db.get_user_by_telegram_chat_id(chat_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Chat ID not linked"
        )
    month = datetime.now(timezone.utc).strftime("%Y-%m")
    total = await db.month_total(user["_id"], month)
    return {
        "month": month,
        "total": total,
        "budget": user.get("monthly_budget", 0),
        "currency": user.get("currency", "₹"),
    }


@router.get("/budget")
async def get_budget(chat_id: int = Query(...)):
    user = await db.get_user_by_telegram_chat_id(chat_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Chat ID not linked"
        )
    return {
        "monthly_budget": user.get("monthly_budget", 0),
        "category_budgets": user.get("category_budgets", {}),
        "currency": user.get("currency", "₹"),
    }
