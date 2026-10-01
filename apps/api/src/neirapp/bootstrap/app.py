from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from neirapp.bootstrap.container import (
    build_dispatch,
    build_identity,
    build_incidents,
    build_leads,
    build_ordering,
    build_pricing,
    build_reviews,
    build_stores,
    build_wallet,
)
from neirapp.bootstrap.settings import Settings
from neirapp.modules.dispatch.presentation.router import router as dispatch_router
from neirapp.modules.identity.presentation.router import router as identity_router
from neirapp.modules.incidents.presentation.router import router as incidents_router
from neirapp.modules.leads.presentation.router import router as leads_router
from neirapp.modules.media.presentation.router import router as media_router
from neirapp.modules.ordering.presentation.router import router as ordering_router
from neirapp.modules.ordering.presentation.ws_manager import ConnectionManager
from neirapp.modules.pricing.presentation.router import router as pricing_router
from neirapp.modules.reviews.presentation.router import router as reviews_router
from neirapp.modules.stores.presentation.router import router as stores_router
from neirapp.modules.wallet.presentation.router import router as wallet_router
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
    app.state.pricing = build_pricing(session_factory)
    app.state.leads = build_leads(session_factory, clock)
    app.state.ordering = build_ordering(
        session_factory,
        app.state.stores,
        app.state.order_notifications,
        app.state.pricing,
        clock,
    )
    app.state.wallet = build_wallet(session_factory, clock)
    app.state.dispatch = build_dispatch(
        session_factory, app.state.stores, app.state.ordering, app.state.wallet, clock
    )
    app.state.reviews = build_reviews(session_factory, app.state.ordering, clock)
    app.state.incidents = build_incidents(
        session_factory, app.state.ordering, app.state.dispatch, clock
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
    app.include_router(wallet_router, prefix="/api/v1")
    app.include_router(pricing_router, prefix="/api/v1")
    app.include_router(leads_router, prefix="/api/v1")
    app.include_router(dispatch_router, prefix="/api/v1")
    app.include_router(reviews_router, prefix="/api/v1")
    app.include_router(incidents_router, prefix="/api/v1")
    app.include_router(media_router, prefix="/api/v1")
    return app
