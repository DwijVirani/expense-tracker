from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum

from app import db
from app.config import settings as app_settings
from app.routers import settings, telegram_internal, transactions
from app.utils.logging import get_logger, setup_logging

setup_logging(app_settings.log_level)
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await db.ensure_indexes()
    logger.info("startup complete, indexes ensured")
    yield


app = FastAPI(title="Expense Tracker API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://*.amplifyapp.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(transactions.router)
app.include_router(settings.router)
app.include_router(telegram_internal.router)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/")
async def root():
    return {"message": "Expense Tracker API is running."}


# Lambda entry point
handler = Mangum(app, lifespan="on")
