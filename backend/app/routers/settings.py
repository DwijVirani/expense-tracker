import random
import string
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app import db
from app.auth import get_current_user
from app.utils.logging import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/settings", tags=["settings"])

UserDep = Annotated[dict, Depends(get_current_user)]


class SettingsPatch(BaseModel):
    currency: str | None = None
    monthly_budget: float | None = None
    category_budgets: dict[str, float] | None = None
    categories: dict[str, list[str]] | None = None


@router.get("")
async def get_settings(user: UserDep):
    return {
        "currency": user.get("currency", "₹"),
        "monthly_budget": user.get("monthly_budget", 0),
        "category_budgets": user.get("category_budgets", {}),
        "categories": user.get("categories", {}),
        "telegram_linked": user.get("telegram_chat_id") is not None,
    }


@router.patch("")
async def update_settings(body: SettingsPatch, user: UserDep):
    patch = {k: v for k, v in body.model_dump().items() if v is not None}
    if patch:
        await db.update_user(user["_id"], patch)
        logger.info("settings updated", user_id=user["_id"], fields=list(patch.keys()))
    return {"ok": True}


def _gen_code() -> str:
    chars = string.ascii_uppercase + string.digits
    return "LINK-" + "".join(random.choices(chars, k=6))


@router.post("/telegram/link-code")
async def generate_link_code(user: UserDep):
    code = _gen_code()
    expires = datetime.now(timezone.utc) + timedelta(minutes=10)
    await db.get_db()["link_codes"].insert_one(
        {
            "code": code,
            "user_id": user["_id"],
            "expires_at": expires,
            "used": False,
        }
    )
    logger.info("telegram link code generated", user_id=user["_id"])
    return {"code": code, "expires_in_seconds": 600}
