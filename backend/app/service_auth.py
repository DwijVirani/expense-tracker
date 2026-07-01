"""Shared-secret auth for Telegram bot → /telegram/* routes."""

from fastapi import Header, HTTPException, status

from app.config import settings
from app.utils.logging import get_logger

logger = get_logger(__name__)


async def require_service_token(x_service_token: str = Header(...)) -> None:
    if not settings.telegram_service_secret:
        logger.error("telegram service secret not configured")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Service token not configured",
        )
    if x_service_token != settings.telegram_service_secret:
        logger.warning("rejected request with invalid service token")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid service token",
        )
