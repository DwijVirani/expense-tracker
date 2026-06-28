"""Thin async client wrapping the backend's /telegram/* endpoints."""

import httpx

from config import settings

_HEADERS = {"X-Service-Token": settings.service_secret, "Content-Type": "application/json"}


async def resolve_link(code: str, chat_id: int) -> bool:
    async with httpx.AsyncClient(base_url=settings.backend_url) as c:
        r = await c.post("/telegram/resolve-link", json={"code": code, "chat_id": chat_id}, headers=_HEADERS)
        return r.status_code == 200


async def send_message(chat_id: int, text: str) -> dict | None:
    async with httpx.AsyncClient(base_url=settings.backend_url) as c:
        r = await c.post("/telegram/message", json={"chat_id": chat_id, "text": text}, headers=_HEADERS)
        if r.status_code == 200:
            return r.json()
        return None


async def undo(chat_id: int) -> dict | None:
    async with httpx.AsyncClient(base_url=settings.backend_url) as c:
        r = await c.post("/telegram/undo", json={"chat_id": chat_id}, headers=_HEADERS)
        if r.status_code == 200:
            return r.json()
        return None


async def get_total(chat_id: int) -> dict | None:
    async with httpx.AsyncClient(base_url=settings.backend_url) as c:
        r = await c.get(f"/telegram/total?chat_id={chat_id}", headers=_HEADERS)
        if r.status_code == 200:
            return r.json()
        return None


async def get_budget(chat_id: int) -> dict | None:
    async with httpx.AsyncClient(base_url=settings.backend_url) as c:
        r = await c.get(f"/telegram/budget?chat_id={chat_id}", headers=_HEADERS)
        if r.status_code == 200:
            return r.json()
        return None
