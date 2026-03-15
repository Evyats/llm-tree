import mimetypes
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from app.api import api_router
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.db.base import Base
from app.db.session import engine
from app import models  # noqa: F401

mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("application/javascript", ".mjs")
settings = get_settings()
configure_logging(settings)


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    inspector = inspect(engine)
    graph_columns = {column["name"] for column in inspector.get_columns("graphs")}
    with engine.begin() as connection:
        if "title_state" not in graph_columns:
            connection.execute(text("ALTER TABLE graphs ADD COLUMN title_state VARCHAR(20) DEFAULT 'untitled'"))
        if "collapsed_targets_json" not in graph_columns:
            connection.execute(text("ALTER TABLE graphs ADD COLUMN collapsed_targets_json TEXT DEFAULT '[]'"))
        if "collapsed_edge_sources_json" not in graph_columns:
            connection.execute(text("ALTER TABLE graphs ADD COLUMN collapsed_edge_sources_json TEXT DEFAULT '{}'"))
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)

origins = [origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(api_router, prefix=settings.api_prefix)
