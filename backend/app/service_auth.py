"""Shared-secret auth for Telegram bot → /telegram/* routes."""

from fastapi import Header, HTTPException, status

from app.config import settings


async def require_service_token(x_service_token: str = Header(...)) -> None:
    if not settings.telegram_service_secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Service token not configured",
        )
    if x_service_token != settings.telegram_service_secret:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid service token",
        )
