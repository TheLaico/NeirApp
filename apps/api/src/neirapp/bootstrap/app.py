from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from neirapp.bootstrap.container import build_identity, build_ordering, build_stores
from neirapp.bootstrap.settings import Settings
from neirapp.modules.identity.presentation.router import router as identity_router
from neirapp.modules.ordering.presentation.router import router as ordering_router
from neirapp.modules.ordering.presentation.ws_manager import ConnectionManager
from neirapp.modules.stores.presentation.router import router as stores_router
from neirapp.shared.application.ports import Clock
from neirapp.shared.infrastructure.db import create_engine, create_session_factory
from neirapp.shared.presentation.errors import register_exception_handlers


def create_app(settings: Settings | None = None, clock: Clock | None = None) -> FastAPI:
    settings = settings or Settings()
    engine = create_engine(settings.database_url)
    session_factory = create_session_factory(engine)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        yield
        await engine.dispose()

    app = FastAPI(
        title="NeirApp API",
        version="0.1.0",
        lifespan=lifespan,
        docs_url=None if settings.environment == "production" else "/docs",
        redoc_url=None,
    )
    app.state.settings = settings
    app.state.engine = engine
    app.state.identity = build_identity(settings, session_factory, clock)
    app.state.stores = build_stores(session_factory, clock)
    app.state.order_notifications = ConnectionManager()
    app.state.ordering = build_ordering(
        session_factory, app.state.stores, app.state.order_notifications, clock
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    register_exception_handlers(app)

    @app.get("/health", tags=["meta"])
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(identity_router, prefix="/api/v1")
    app.include_router(stores_router, prefix="/api/v1")
    app.include_router(ordering_router, prefix="/api/v1")
    return app
